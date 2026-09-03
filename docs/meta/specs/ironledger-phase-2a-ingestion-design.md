# IronLedger Phase 2a ingestion design

Status: design for operator review; no implementation approval.
Scope: file acquisition, parsing, canonical identity, and idempotent staging only. No categorization rules, no approval or rejection workflow, no interactive review loop, no compilation, no projection, no network.
Derived from: `ironledger-architecture-design.md`, `ironledger-implementation-plan.md`, `ironledger-phase-0-threat-model-baseline.md`, `ironledger-phase-1-plan.md` (all operator-approved).

## 1. Why this sub-phase exists

The approved implementation plan lists "file ingestion and review CLI" as one Phase 2. Every design axis was set to its widest option: vetted parse libraries, a full generic CSV engine, a schema migration for proposed postings, and a full predicate rule matcher. Splitting the work at the staged-row seam keeps each operator gate small enough to review well.

- Phase 2a (this document): a local file becomes immutable evidence and a `pending` staged transaction with proposed postings. Deterministic versioned identity makes re-import idempotent. The only query surface is a read-only `review list`.
- Phase 2b (separate spec): the categorization rule matcher, `review show`, `review categorize`, `review approve`, `review reject`, the interactive review loop, and the operator-authorization gate extended to those actions.

The split is a plan-level decomposition. It changes no Phase 0 invariant, no architecture decision, and no locked convention, so it needs no design amendment.

## 2. Fixed invariants inherited

- Beancount is the sole accounting authority. SQLite is a disposable projection. Staged transactions and staged postings are a workflow record, never accounting truth.
- Monetary values are signed 64-bit integer minor units with an explicit currency code and an explicit scale from the pinned ISO-4217 table. No floating-point value is accepted on any ingestion path. Unlike currencies are never netted.
- Source documents and source records are retained evidence. Foreign keys never cascade a delete into `source_documents` or `source_records`.
- Audit events are append-only, monotonic, and hash chained. Every authorized action emits one event and fails closed on any chain break.
- Safe mode defaults on and disables every mutation surface, including import.
- All stored timestamps are UTC ISO-8601 with an explicit trailing `Z`. All paths resolve against the approved roots in the Phase 0 baseline section 3.
- Identity-algorithm versions are immutable. Phase 2a introduces version 1. A later version never re-identifies a historical record.
- Automation may prepare an import but may not perform the authorizing action.

## 3. Module layout

New package `src/ironledger/ingest/`:

| Module | Responsibility | Depends on |
|---|---|---|
| `inbox.py` | Resolve the operator ingest inbox path from `config/filesystem-roots.json` key `ingest_inbox`. Reject `..`, symlink escape, UNC paths, device paths, and disallowed file types. A missing key or missing config file fails closed with a message that names decision D-4. | stdlib `pathlib`, `os` |
| `acquire.py` | Copy one file out of the inbox into `evidence/source_documents/<sha256>`. Record MIME type, encoding, provenance, `acquisition_time_utc` (host clock, read once), `content_sha256`, and `raw_payload_ref`. Reuse the existing `source_document_id` when the content hash is already present, regardless of the dropped file's name. Report whether the document is new, and whether every row it produced last time is already staged. | `inbox`, `conventions` |
| `formats/ofx.py` | Parse OFX 1.x SGML, OFX 2.x XML, and QFX through `ofxtools`. Extract each `STMTTRN`: posted date, amount, `FITID`, name, memo, transaction type, and the statement or transaction currency. | `ofxtools` |
| `formats/csv_engine.py` | Generic CSV ingestion. Sniff the delimiter and header. Detect column roles, with a `config/csv-profiles/<name>.json` profile as an explicit override. Coerce dates from an explicit format list only. Parse amounts to minor units across sign conventions: leading minus, trailing minus, parentheses, and separate debit and credit columns. Resolve each row's currency from an explicit currency column, else the profile's `default_currency` key, else reject the file. A profile without an explicit currency column must declare `default_currency`. Currency symbols are advisory and never authoritative. A file that carries several rows resolving to different ISO-4217 codes is accepted; a row whose currency cannot be resolved to an ISO code is rejected. | stdlib `csv`, `conventions` |
| `records.py` | Normalize one parsed row into a canonical JSON `source_record` payload with documented field and whitespace rules. Write it under `evidence/source_records/` and insert the `source_records` row. `record_index` is the 0-based position in the file. | `conventions` |
| `identity.py` | Compute the versioned identity fingerprint. `identity_algo_version = 1`. Select FITID or the SHA-256 fallback. | `conventions`, `db` |
| `stage.py` | Write one `staged_transactions` header and its `staged_postings` rows. Upsert is idempotent on `(identity_algo_version, identity_fingerprint)`. | `db`, migration 0003 |
| `pipeline.py` | Orchestrate `acquire` then parse then `records` then `identity` then `stage` for one file. Single-threaded. Emit exactly one audit event per invocation. | all of the above, `audit` |

New CLI package `src/ironledger/cli/`:

| Module | Responsibility |
|---|---|
| `__main__.py` | An `argparse` command tree. Phase 2a commands only (section 6). |
| `auth.py` | The operator-authorization gate (section 7). Phase 2b extends this module; it does not fork it. |
| `render.py` | Plain-text and `--json` output for `review list` and `fitid-trust list`. |

New migration `src/ironledger/db/schema/0003_staged_postings.sql` (section 5).

## 4. Dependencies

Add to `pyproject.toml` `dependencies`:

- `ofxtools`, pinned with `==`. It is pure Python and parses OFX 1.0.2 SGML and OFX 2.x XML. IronLedger calls only its parser on local bytes and never constructs its OFX client, so it adds no outbound network path. A committed lockfile (`requirements.lock`, generated by `pip-compile`) pins the full transitive set.

Everything else stays in the standard library:

- The CLI uses `argparse`, not `click` or `typer`. One new dependency for parsing is justified; a second for argument handling is not.
- CSV parsing uses `csv`.
- Encoding detection uses a BOM sniff plus a bounded trial of UTF-8, UTF-16, and Latin-1. No `chardet`.

A short dependency-posture note is added under `docs/meta/` and reviewed with this spec. It records why `ofxtools` is acceptable against the Phase 0 section 2.2 editor-and-plugin and section 6 outbound-allowlist postures.

## 5. Schema migration 0003

`staged_postings` is a `STRICT` table. Proposed postings are a workflow record attached to a staged transaction header, so they cascade with the header. Their link back to evidence is `RESTRICT`.

| Column | Type and constraint |
|---|---|
| `staged_posting_id` | `TEXT PRIMARY KEY` |
| `staged_transaction_id` | `TEXT NOT NULL REFERENCES staged_transactions (staged_transaction_id) ON DELETE CASCADE ON UPDATE RESTRICT` |
| `source_record_id` | `TEXT NOT NULL REFERENCES source_records (source_record_id) ON DELETE RESTRICT ON UPDATE RESTRICT` |
| `role` | `TEXT NOT NULL CHECK (role IN ('imported', 'contra'))` |
| `posting_index` | `INTEGER NOT NULL CHECK (posting_index >= 0)` |
| `account` | `TEXT CHECK (account IS NULL OR account GLOB 'Assets:*' OR account GLOB 'Liabilities:*' OR account GLOB 'Equity:*' OR account GLOB 'Income:*' OR account GLOB 'Expenses:*')` |
| `minor_units` | `INTEGER NOT NULL` |
| `currency` | `TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]')` |
| `minor_unit_scale` | `INTEGER NOT NULL CHECK (minor_unit_scale >= 0)` |
| `created_at_utc` | `TEXT NOT NULL CHECK (created_at_utc GLOB '????-??-??T??:??:??*Z')` |

Table constraints:

- `UNIQUE (staged_transaction_id, posting_index)`
- `CHECK (role = 'contra' OR account IS NOT NULL)` — only a `contra` posting may carry a null account. An `imported` posting always names its account.

An import writes two rows for each staged transaction: the `imported` posting names the importing account (known from the CSV profile or the OFX statement) and carries the row amount and its currency; the `contra` posting carries the negated amount, the same currency, and `account = NULL` until Phase 2b categorization sets it. The table `CHECK` enforces that only the `contra` role may hold a null account. The two `minor_units` values sum to zero for the currency, so a same-currency balance check already passes before categorization.

The migration applies once on a fresh database, is not re-applied, and leaves no partial schema version if interrupted, matching the Phase 1 runner contract.

## 6. Command surface

```
ironledger import <path> [--confirm <phrase>] [--allow-partial]
ironledger review list [--status pending] [--json]
ironledger fitid-trust add --institution <id> --account <id> [--note <text>] [--confirm <phrase>]
ironledger fitid-trust list [--json]
```

- `import` acquires, parses, and stages one file. `--allow-partial` is off by default; see section 8.
- `review list` is read-only. It reads `staged_transactions` joined to a `staged_postings` summary and applies no mutation path.
- `fitid-trust add` inserts one `fitid_trust_records` row. `fitid-trust list` is read-only.

`review show`, `review categorize`, `review approve`, `review reject`, the interactive loop, and `rule` commands are Phase 2b.

## 7. Operator-authorization gate

`import` and `fitid-trust add` are operator-authorization points (Phase 0 baseline section 7.2, items 1 and, by identity impact, 14). Phase 2a ships the gate that both use, and Phase 2b extends the same `cli/auth.py` module to the review and rule actions.

The gate, in order:

1. If safe mode is on, raise `AuthorizationError`, exit code 3, and emit an audit event with `result = denied`.
2. If standard input is a TTY, prompt for a typed confirmation phrase and compare it to the expected phrase for the action.
3. If standard input is not a TTY, require `--confirm <phrase>` and compare it.
4. On any mismatch or absence, raise `AuthorizationError`, exit code 3, and emit an audit event with `result = denied`.
5. On success, record which mechanism authorized the action (`tty` or `confirm-flag`) in the audit event.

Automation that runs non-interactively with no `--confirm` fails closed. The expected phrase is a fixed, published string per action (`import <path>` for an import, `trust <institution>/<account>` for a FITID trust add), not a secret. It is printed in the command's `--help` output and recorded in the Phase 2a evidence. The gate is a deliberate speed bump against an unattended agent importing by accident, not a credential; its security value is the audit event and the safe-mode precondition, not the phrase's secrecy.

## 8. Data flow and idempotency

```
operator drops a file in the inbox (D-4 path, outside the repo, read-only to IronLedger)
  -> ironledger import <path> --confirm "<phrase>"
     -> auth gate: safe mode off, operator confirmed        else fail closed, audit denied
     -> inbox.resolve: path under the configured inbox root, no traversal, symlink, UNC, device, or bad type
                                                             else IngestPathError, nothing written
     -> acquire: copy to evidence/source_documents/<sha256>, record metadata
                 content hash already present AND every row it produced before is staged
                   -> short-circuit: no parse, emit audit records_created=0, exit 0
                 content hash present but some rows unstaged (a prior --allow-partial run)
                   -> continue, so the missing rows can be staged
     -> parse (ofx | csv_engine) -> list of parsed rows
                 integer minor units only; reject float, ambiguous currency, unparseable date, inexact amount
     -> for each row:
          records.normalize -> evidence/source_records/ + source_records insert
                 idempotent on content hash and (source_document_id, record_index)
          identity.fingerprint(row) -> FITID iff a trust record exists and the row carries a FITID, else sha256 fallback
          stage.upsert -> staged_transactions + staged_postings (imported + NULL-account contra)
                 existing (identity_algo_version, identity_fingerprint) -> no-op
     -> emit one audit event: action=import, target=source_document_id, result=ok or error, hashes recorded
  -> ironledger review list -> read-only staged rows with a posting summary
```

Re-running the same command on the same file creates zero new `source_documents`, `source_records`, `staged_transactions`, and `staged_postings` rows. `acquire` compares the content hash and, when the document is already present, checks whether every `source_record` and staged row it produced before still exists. If so, `pipeline` short-circuits before parsing: it does no format work, writes nothing, and emits one audit event with `result = ok` and `records_created = 0`. If the document is present but a prior `--allow-partial` run left rows unstaged, `pipeline` proceeds through parse and per-row idempotent upsert so the missing rows land, then audits the real `records_created` count. Either way an authorized import invocation always emits exactly one audit event.

## 9. Identity

`identity_algo_version = 1`. The fingerprint is `sha256` over a canonical serialization of the tuple:

```
(1, canonical_account, iso_date, minor_units, currency, canonical_payee, institution_account_key)
```

- `canonical_account` is the importing account, resolved from the CSV profile or the OFX statement, validated by `conventions.validate_account_name`.
- `iso_date` is the institution-supplied posted date as a local calendar date, unaltered, in `YYYY-MM-DD`.
- `minor_units` and `currency` are the row amount and its resolved ISO-4217 code.
- `canonical_payee` is the payee or OFX `NAME` transformed in a fixed order: Unicode NFC normalization, then `str.casefold()`, then ASCII whitespace collapse to a single space, then strip. The order is frozen for version 1 so the fingerprint is stable across operating systems.
- `institution_account_key` is a stable identifier for the source institution and account, so an identical amount on the same date at two institutions does not collide. For OFX and QFX it is derived from `BANKACCTFROM` or `CCACCTFROM` (`BANKID` plus `ACCTID`). For CSV it comes from the profile's declared institution and account fields. It is never the memo or narration, which are too volatile.

Canonicalization rules for version 1 are frozen: NFC, case folding, ASCII whitespace collapse to a single space, and the documented per-field trimming. A future `identity_algo_version = 2` applies only to rows ingested after it is introduced.

FITID is used as the identity only when `fitid_trust_records` has a row for the `(institution_id, account_id)` pair and the parsed record carries a non-empty `FITID`. Otherwise the SHA-256 fallback applies. The `identity_method` value (`fitid` or `sha256_fallback`) is stored on the staged transaction.

The correct operator order is to run `fitid-trust add` for an account before the first `import` of that account. When an OFX or QFX statement carries populated `FITID`s for an `(institution_id, account_id)` pair that has no trust record, `import` prints an advisory line naming the pair and the `fitid-trust add` command, then proceeds with the SHA-256 fallback. Adding the trust record afterward and re-importing the same file produces a second set of staged transactions under `fitid` identities: the fallback and FITID fingerprints differ by construction, so the two do not merge. Phase 2a accepts this as a known limitation; a reconcile pass that supersedes fallback-identity staged rows when an account is later trusted is Phase 2b work. The advisory keeps an operator from reaching that state by accident.

## 10. Error handling

Every failure path fails closed. Import is all-or-nothing for one file unless `--allow-partial` is passed.

| Condition | Result |
|---|---|
| Path outside the inbox root, traversal, symlink escape, UNC, device path, or disallowed type | `IngestPathError`, nothing written |
| Unknown or ambiguous currency, unparseable date, floating-point amount, or an amount not exactly representable in minor units | `ParseError` naming the row index; the whole file is rejected unless `--allow-partial` |
| MIME type not in the allowed set (`text/csv`, `application/x-ofx`, and `application/octet-stream` for OFX SGML) | rejected before parsing |
| `ofxtools` raises | wrapped as `ParseError`; the file is rejected |
| SQLite constraint violation during staging | the transaction rolls back, `StageError`; the schema version is unaffected |
| `config/filesystem-roots.json` missing, or its `ingest_inbox` key absent | `ConfigError` with a remediation message that names decision D-4 |
| Safe mode on, or no valid operator confirmation | `AuthorizationError`, exit code 3, audit event `result = denied` |

## 11. The verify_manifest hardening fix

`manifests.verify_manifest` step 4 interpolates a table name from `parsed.row_counts` keys, which originate in an untrusted manifest string, directly into `f"SELECT count(*) FROM {tbl_name}"`. The severity is low because `sqlite3` `execute` runs a single statement and IronLedger is single-operator and local, but a crafted manifest can still probe the schema or force an error.

Fix, in `manifests.py`:

1. Before the row-count loop in `verify_manifest`, read the real table set once: `SELECT name FROM sqlite_master WHERE type = 'table'`.
2. For each manifest table name, raise `ManifestVerificationError` if it is not in that set.
3. Build the count query with a quoted identifier: `'"' + name.replace('"', '""') + '"'`.
4. Apply the same quoting in `generate_projection_manifest`, whose names come from `sqlite_master` and are already trusted. This is defense in depth and changes no behavior.

Regression test: a manifest whose `row_counts` carries a key such as `"x); DROP TABLE audit_events; --"` or any name absent from `sqlite_master` fails verification cleanly, with no SQL executed beyond the guarded count.

## 12. Test contract for the Phase 2a exit gate

Focused suite only, matching the Phase 1 evidence discipline. Full-suite, live, and production evidence stay deferred.

1. Re-importing an identical OFX file and an identical CSV file each produce zero duplicate `source_documents`, `source_records`, `staged_transactions`, and `staged_postings` rows.
2. With a `fitid_trust_records` row present, `identity_method` is `fitid`; without one, it is `sha256_fallback`. The same logical transaction under the two methods is documented as not merging, because the identity inputs differ.
3. Property tests: NFC and case-fold variants, leading, trailing, and collapsed whitespace, and row reordering in the file all produce identical fingerprints. Malformed values and rows whose currency resolves only to an ambiguous symbol are rejected. A file whose rows carry several different resolved ISO-4217 codes is accepted, each row staged under its own currency; a CSV profile with neither a currency column nor `default_currency` is rejected before any row is staged.
4. Integer arithmetic: amounts across a scale-0 currency (JPY), a scale-2 currency (USD), and a scale-3 currency parse exactly. A floating-point input is rejected. Parentheses, trailing-minus, and split debit and credit column sign conventions each resolve to the correct signed minor units.
5. Path traversal, symlink escape, UNC, device path, and disallowed file type inputs are all rejected with nothing written.
6. `import` with safe mode on, and `import` with neither a TTY confirmation nor a matching `--confirm`, each fail closed and emit an audit event with `result = denied`.
7. Migration 0003 applies on a fresh database, is not applied twice, and leaves no partial schema version when interrupted.
8. The `verify_manifest` table-name injection regression from section 11 passes.
9. `review list` returns staged rows read-only and exposes no mutation path.

## 13. Out of scope for Phase 2a

The categorization rule matcher, `review show`, `review categorize`, `review approve`, `review reject`, the interactive review loop, `rule` commands, compilation, `bean-check`, projection, search, MCP, SimpleFIN, RAG, mobile access, backups, and Git publication. Phase 2a's authorization gate covers `import` and `fitid-trust add` only.

## 14. Open items carried

- **D-4** ingest inbox absolute path. Phase 2a is config-driven. The operator sets `config/filesystem-roots.json` `ingest_inbox` before the first real import. This spec records the requirement; it is not a code blocker for building and testing Phase 2a against fixtures.
- The `docs/meta/` dependency-posture note for `ofxtools` is written and reviewed alongside this spec.

## 15. Approval gate

The operator reviews this spec and either approves entry to a Phase 2a implementation plan or requests changes. Implementation begins only after explicit approval typed in the transcript. Any change to Beancount authority, evidence retention, the default read-only access posture, the operator-authorization model, currency policy, or network exposure requires a design amendment and renewed approval.
