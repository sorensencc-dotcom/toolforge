# IronLedger Phase 2b review and categorization design

Status: design for operator review; no implementation approval.
Scope: contra-account categorization, a database-backed categorization rule engine with import-time auto-fill, the review state machine (`show`, `categorize`, `approve`, `reject`, `reopen`, `auto-match`), a guided interactive review loop, and `rule` management. No Beancount compilation, no `bean-check`, no projection, no search, no MCP, no network.
Derived from: `ironledger-architecture-design.md`, `ironledger-implementation-plan.md`, `ironledger-phase-0-threat-model-baseline.md`, `ironledger-phase-2a-ingestion-design.md`, `ironledger-phase-2a-plan.md` (all operator-approved), and `docs/meta/phases/ironledger-phase-2b-handoff.md`.

## 1. Why this sub-phase exists

The approved implementation plan lists "file ingestion and review CLI" as one Phase 2. Phase 2a split off file acquisition, parsing, canonical versioned identity, and idempotent staging, and shipped a read-only `review list` plus the operator-authorization gate for `import` and `fitid-trust add`. Phase 2a section 13 deferred the rest of implementation-plan Phase 2 item 5: categorization, approval, rejection, the rule surface, and the interactive review loop.

Phase 2b closes that gap. A `pending` staged transaction gains a contra account, moves through an explicit review lifecycle, and reaches an `approved` or `rejected` terminal state under operator authorization and safe-mode control. A deterministic rule engine assigns the contra account by payee so routine statements do not require a keystroke per row.

The split is a plan-level decomposition. It changes no Phase 0 invariant, no architecture decision, and no locked convention, so it needs no design amendment. It does modify Phase 2a implementation code in two bounded places, both described in section 5.

## 2. Fixed invariants inherited

- Beancount is the sole accounting authority. SQLite is a disposable projection. Staged transactions and staged postings are a workflow record, never accounting truth.
- Monetary values are signed 64-bit integer minor units with an explicit currency code and an explicit scale from the pinned ISO-4217 table. No floating-point value is accepted on any path. Unlike currencies are never netted.
- Source documents and source records are retained evidence. Foreign keys never cascade a delete into `source_documents` or `source_records`.
- Audit events are append-only, monotonic, and hash chained. Every authorized mutating action emits exactly one audit event and fails closed on any chain break.
- Safe mode defaults on and disables every mutation surface, including every Phase 2b review and rule action.
- All stored timestamps are UTC ISO-8601 with an explicit trailing `Z`. All paths resolve against the approved roots in the Phase 0 baseline section 3.
- Identity-algorithm versions are immutable. Phase 2b does not introduce a new identity version and does not re-identify any historical record.
- Automation may prepare a review but may not perform an authorizing action. Non-interactive invocation with no `--confirm` fails closed.

## 3. Review state machine

`staged_transactions.status` moves through four states:

```
pending  <->  categorized  <->  rejected
   \_______________/  \______________/
              |  approve
              v
          approved   (terminal in Phase 2b)
```

- `pending`, `categorized`, and `rejected` interconvert freely through explicit commands. Each transition emits one audit event.
- `approved` is terminal in Phase 2b. Un-approval belongs to Phase 3, where an approved transaction reaches the ledger. `approve` from any state other than `pending` or `categorized` fails closed.
- `categorized` means the contra posting carries a non-null account **and** an operator action or `review auto-match` affirmatively set it. A rule that fills the account at import time leaves the transaction `pending`: a rule guess is not a decision.
- `reject` accepts an optional `--reason <text>`, stored on the row and recorded in the audit event.
- Re-importing a source file whose rows already produced staged transactions stays a zero-row no-op, including for rows now in `rejected` or `approved` state. Phase 2a idempotency on `(identity_algo_version, identity_fingerprint)` is unchanged; Phase 2b adds no path that resurrects or duplicates a fingerprinted row.

### Transition table

| From | Command | To | Authorization |
|---|---|---|---|
| `pending` | `review categorize` | `categorized` | safe mode off |
| `categorized` | `review categorize` | `categorized` (account replaced) | safe mode off |
| `pending` | `review auto-match` | `categorized` | safe mode off, phrase |
| `pending`, `categorized` | `review approve` | `approved` | safe mode off, phrase, approve gate |
| `pending`, `categorized` | `review reject` | `rejected` | safe mode off, phrase |
| `categorized`, `rejected` | `review reopen` | `pending` | safe mode off, phrase |

`review categorize <id> <account>` sets the contra account and, when the row is `pending`, advances it to `categorized` and sets `categorized_at_utc` in the same transaction. On a row already `categorized` it replaces the account and leaves the status and `categorized_at_utc` unchanged. A `categorize` on a `rejected` or `approved` row fails closed with a message naming `review reopen`. An import-time rule fill (section 5.1) is the one path that sets the contra account without advancing status: it leaves the row `pending`, because a rule guess is not an operator decision.

## 4. Schema migration `0004_review_workflow.sql`

The migration applies once on a fresh database, is never re-applied, and leaves no partial schema version if interrupted, matching the Phase 1 runner contract.

The Phase 1 migration runner wraps every migration file in a single `BEGIN; … COMMIT;`, and SQLite ignores `PRAGMA foreign_keys` inside a transaction. The classic table rebuild's `PRAGMA foreign_keys = OFF` step is therefore unavailable. The migration instead rebuilds with foreign keys still enforced by first removing the only inbound reference that would bite.

### 4.1 Rebuild `staged_transactions`

`staged_transactions` is a `STRICT` table with a `status` `CHECK`; SQLite cannot alter a `CHECK`. Two tables reference `staged_transactions.staged_transaction_id`: `staged_postings` (migration 0003, `ON DELETE CASCADE`) and `ledger_entries` (migration 0001, `ON DELETE RESTRICT`, always empty in Phase 2b because no compile has run). With foreign keys on, `DROP TABLE staged_transactions` would cascade-delete every `staged_postings` row, so the migration parks and restores that child table:

1. `CREATE TABLE staged_postings_rebuild_backup AS SELECT * FROM staged_postings;` — a plain, constraint-free copy of the child rows.
2. `DELETE FROM staged_postings;` — the child table is now empty, so the later `DROP` cascades into nothing.
3. `CREATE TABLE staged_transactions_new (…)` with the widened `status` `CHECK (status IN ('pending', 'categorized', 'approved', 'rejected'))`, every existing column and the `UNIQUE (identity_algo_version, identity_fingerprint)` constraint unchanged, plus two new columns:
   - `reject_reason TEXT` — nullable; set on a transition into `rejected` with `--reason`, cleared on `reopen`.
   - `categorized_at_utc TEXT CHECK (categorized_at_utc IS NULL OR categorized_at_utc GLOB '????-??-??T??:??:??*Z')` — set on the first move to `categorized`, cleared on `reopen`.
4. `INSERT INTO staged_transactions_new SELECT <existing columns>, NULL, NULL FROM staged_transactions;`
5. `DROP TABLE staged_transactions;` — `staged_postings` is empty so its `CASCADE` deletes nothing; `ledger_entries` is empty so its `RESTRICT` is not triggered.
6. `ALTER TABLE staged_transactions_new RENAME TO staged_transactions;` — the `staged_postings` and `ledger_entries` foreign-key clauses still name `staged_transactions` and now resolve to the rebuilt table.
7. `INSERT INTO staged_postings SELECT * FROM staged_postings_rebuild_backup;` — every parent row exists again under the same primary key, so each child foreign key resolves.
8. `DROP TABLE staged_postings_rebuild_backup;`
9. The `staged_postings` indexes (`idx_staged_postings_transaction`, `idx_staged_postings_source`) survive the `DELETE`/re-`INSERT` because the table itself is never dropped. No index on `staged_transactions` beyond the inline `UNIQUE` needs recreating.

A test asserts `PRAGMA foreign_key_check` returns no rows after the migration and that a pre-existing `staged_transactions` row plus its `staged_postings` children survive the rebuild intact.

The append-only audit triggers from migration `0002` target `audit_events` only and are untouched.

### 4.2 New table `categorization_rules`

`STRICT`.

| Column | Type and constraint |
|---|---|
| `rule_id` | `TEXT PRIMARY KEY` |
| `match_type` | `TEXT NOT NULL CHECK (match_type IN ('exact', 'prefix', 'regex'))` |
| `pattern` | `TEXT NOT NULL` — matched against `canonical_payee` (section 6) |
| `importing_account` | `TEXT CHECK (importing_account IS NULL OR importing_account GLOB 'Assets:*' OR importing_account GLOB 'Liabilities:*' OR importing_account GLOB 'Equity:*' OR importing_account GLOB 'Income:*' OR importing_account GLOB 'Expenses:*')` — `NULL` means the rule applies to any importing account |
| `target_account` | `TEXT NOT NULL CHECK (target_account GLOB 'Assets:*' OR target_account GLOB 'Liabilities:*' OR target_account GLOB 'Equity:*' OR target_account GLOB 'Income:*' OR target_account GLOB 'Expenses:*')` |
| `priority` | `INTEGER NOT NULL DEFAULT 100` |
| `active` | `INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))` |
| `created_at_utc` | `TEXT NOT NULL CHECK (created_at_utc GLOB '????-??-??T??:??:??*Z')` |
| `disabled_at_utc` | `TEXT CHECK (disabled_at_utc IS NULL OR disabled_at_utc GLOB '????-??-??T??:??:??*Z')` |

Table constraints:

- `UNIQUE (match_type, pattern, importing_account)` — one rule per match target and scope. A second identical target is a clean error, not a silent duplicate. `NULL` `importing_account` values collate as distinct from any concrete account under SQLite `UNIQUE`, which is the intended behavior: a global rule and an account-scoped rule for the same pattern coexist.
- Index `(active, priority)` for the resolution query.

`regex` patterns are compiled with Python `re` at `rule add` time and at `--persist-rule` time; a `re.error` rejects the write before any row is inserted. A stored `regex` rule that somehow fails to compile at resolution time (for example after a Python upgrade changes `re` semantics) is skipped, and the resolver records a single audit event `rule_compile_skipped` naming the `rule_id`; it never aborts a review.

## 5. Phase 2a implementation changes

Phase 2b modifies Phase 2a code in exactly two bounded places. Both preserve the Phase 2a exit-gate test suite.

### 5.1 Import-time rule auto-fill

`src/ironledger/ingest/stage.py` (and its caller `pipeline.py`) resolve categorization rules for the row's `(canonical_payee, importing_account)` after building the `imported` and `contra` postings and before the upsert:

- On a rule match, the `contra` posting's `account` is set to the rule's `target_account`. `status` stays `pending`.
- On no match, the `contra` posting's `account` stays `NULL`, exactly as Phase 2a leaves it.
- Rule resolution runs only when the staged transaction is newly inserted. An upsert that lands on an existing `(identity_algo_version, identity_fingerprint)` is a no-op and never re-runs categorization, so changing a rule never rewrites an already-staged row.
- The existing `import` audit event gains one field, `rules_applied`, an integer count of rows whose contra account a rule filled during that invocation. The short-circuit path (`records_created = 0`) reports `rules_applied = 0`.

The all-or-nothing rollback, `--allow-partial`, and content-hash short-circuit behavior are unchanged.

### 5.2 Remove `_with_placeholder_account`

Phase 2a's `_with_placeholder_account` gave OFX imports a deterministic placeholder contra account so a row could stage without a categorization step. With migration 0004's explicit `categorized` status and section 5.1's rule auto-fill, the placeholder is removed:

- OFX and QFX imports leave the `contra` account `NULL` unless a rule matches, exactly as CSV imports do.
- Re-import idempotency is unaffected: a `NULL` contra account is stable across re-imports, and the identity fingerprint never included the contra account.
- The Phase 2a test that asserted the OFX placeholder is updated to assert a `NULL` contra account plus, in a separate case, a rule-filled account.

## 6. Categorization rule engine

### 6.1 Payee canonicalization

Rule matching uses the same `canonical_payee` transform frozen for identity version 1 in Phase 2a section 9: Unicode NFC normalization, then `str.casefold()`, then ASCII whitespace collapse to a single space, then strip. Reusing the frozen transform means a rule written against a payee matches the same rows that share an identity input, with no second normalization to keep in sync.

### 6.2 Resolution

Given `(canonical_payee, importing_account)`:

1. Select rules where `active = 1` and (`importing_account IS NULL` or `importing_account = :importing_account`).
2. Order by `priority ASC`, then `created_at_utc ASC`.
3. Return the `target_account` of the first rule whose `pattern` matches:
   - `exact`: `pattern == canonical_payee`.
   - `prefix`: `canonical_payee.startswith(pattern)`.
   - `regex`: `re.search(pattern, canonical_payee)` is not `None`.
4. No rule matches: return no account.

Resolution is pure and side-effect free apart from the `rule_compile_skipped` audit event described in section 4.2. It is called from import staging (section 5.1), from `review auto-match` (section 7), and from the guided loop to compute a suggested account.

### 6.3 `--persist-rule`

`review categorize <id> <target_account> --persist-rule` writes one `exact` rule in the same transaction as the categorization:

- `match_type = 'exact'`, `pattern = canonical_payee` of the staged transaction, `importing_account =` the row's importing account (never `NULL`; a persisted rule is scoped to the account it was learned on), `target_account =` the chosen account, `priority = 50` (a hand-taught exact rule outranks the default 100 so a later broad `prefix` rule does not shadow it), `active = 1`.
- A collision on `UNIQUE (match_type, pattern, importing_account)` aborts the whole command with a message telling the operator to `rule disable <rule_id>` the existing rule first. The categorization does not partially apply.

### 6.4 `rule` commands

```
ironledger rule add --match-type {exact|prefix|regex} --pattern <text> --account <target_account>
                    [--importing-account <account>] [--priority <int>] [--confirm <phrase>]
ironledger rule list [--json]
ironledger rule disable <rule_id> [--confirm <phrase>]
```

- `rule add` validates `--match-type`, compiles a `regex` pattern, validates both account names with `conventions.validate_account_name`, inserts one row, emits `rule_add`. Phrase-gated.
- `rule list` is read-only: `rule_id`, `match_type`, `pattern`, `importing_account`, `target_account`, `priority`, `active`, `created_at_utc`, `disabled_at_utc`. No `--confirm`, no mutation path.
- `rule disable <rule_id>` sets `active = 0`, `disabled_at_utc = now`, emits `rule_disable`. Phrase-gated. Disable is the only removal: rules are never hard-deleted, so the audit trail and any historical reasoning stay intact. A disabled rule can be superseded by a fresh `rule add`.

## 7. Command surface

```
ironledger review list [--status {pending|categorized|approved|rejected}] [--json]
ironledger review show <staged_transaction_id> [--json]
ironledger review categorize <staged_transaction_id> <target_account> [--persist-rule] [--confirm <phrase>]
ironledger review auto-match [--importing-account <account>] [--confirm <phrase>]
ironledger review approve <staged_transaction_id> [--confirm <phrase>]
ironledger review reject  <staged_transaction_id> [--reason <text>] [--confirm <phrase>]
ironledger review reopen  <staged_transaction_id> [--confirm <phrase>]
ironledger review                                   # guided interactive loop, no subcommand
ironledger rule add ...                             # section 6.4
ironledger rule list [--json]
ironledger rule disable <rule_id> [--confirm <phrase>]
```

- `review list` is the Phase 2a command, extended only to accept `categorized` in `--status`.
- `review show` prints one staged transaction: header fields, both postings with accounts and signed minor units, the identity method and fingerprint, the source document and source record references, and, when the contra account is `NULL`, the rule suggestion if one resolves. Read-only, `--json` supported, no mutation path.
- `review categorize` sets the contra account (section 3 lifecycle note). Not phrase-gated; safe mode is still checked and a denied attempt emits an audit event with `result = denied`.
- `review auto-match` resolves rules for every `pending` transaction whose contra account is `NULL`, optionally filtered to one `--importing-account`. Each filled row moves to `categorized` with `categorized_at_utc = now` and emits one `auto_match` audit event; the command prints a summary line (`matched N of M`). Phrase-gated, because it is a bulk state change.
- `review approve` applies the approve gate (section 8) and, on success, sets `status = 'approved'`, `decided_at_utc = now`, emits `approve`. Phrase-gated.
- `review reject` sets `status = 'rejected'`, `reject_reason = --reason` (or `NULL`), `decided_at_utc = now`, emits `reject`. Phrase-gated.
- `review reopen` sets `status = 'pending'`, clears `reject_reason`, `categorized_at_utc`, and `decided_at_utc`, emits `reopen` with the from-state. The contra account is left as it was, so a reopened row keeps any rule-filled or operator-set account. Phrase-gated.

### 7.1 Guided interactive loop

`ironledger review` with no subcommand:

- Refuses to start if safe mode is on (`AuthorizationError`, exit 3, audit `denied`).
- Emits `review_session_start`, then iterates staged transactions in status order `pending` then `categorized`, each group oldest-first by `created_at_utc`.
- For each row it prints the `review show` view plus, when the contra account is `NULL`, the resolved rule suggestion, then prompts:

  ```
  [c]ategorize  [a]pprove  [r]eject  [s]kip  [q]uit >
  ```

  - `c` prompts `account [<suggestion>]: `. An empty line accepts the suggestion when one exists; otherwise `c` re-prompts. The account is validated with `conventions.validate_account_name`. On success the row moves to `categorized` and the loop re-displays it so the operator can then `a` or `r`.
  - `a` runs the approve gate. On a gate failure it prints the reason and returns to the prompt for the same row.
  - `r` prompts `reason (optional): ` and rejects.
  - `s` advances without change.
  - `q` ends the loop.
- The first `a` or `r` in a session prompts the authorization phrase once (`review-session <db-basename>`), reads from the TTY or requires the session to have been started with `--confirm <phrase>` when stdin is not a TTY, and caches the granted authorization for the remainder of the loop. `c` and `s` never prompt. Every individual `c`, `a`, and `r` still emits its own `categorize`, `approve`, or `reject` audit event.
- On exit the loop emits `review_session_end` with the count of each decision taken.

The loop reads decisions from stdin, so tests drive it with a scripted input stream. `render.py` gains the `show` view and the loop's per-row rendering; no new dependency.

## 8. Approve gate

`review approve` and the loop's `a` action share one function. It refuses, with exit code 3, no state change, and an audit event `result = denied` naming the failing check, unless every condition holds:

1. The current status is `pending` or `categorized`.
2. Every posting on the transaction, `imported` and `contra`, has a non-null `account` that passes `conventions.validate_account_name`.
3. The postings sum to zero within each currency. Phase 2a constructs them that way; the gate re-checks defensively and fails closed on any drift.
4. No posting set nets across unlike currencies. A transaction whose postings carry more than one currency is rejected here, consistent with the architecture invariant, since Phase 2b does not compile multi-currency entries.

On success: `status = 'approved'`, `decided_at_utc = now`, one `approve` audit event carrying both postings' accounts, the identity method, and the identity fingerprint. No ledger write occurs; that is Phase 3.

## 9. Operator-authorization gate

Phase 2b extends `src/ironledger/cli/auth.py`; it does not fork it. The `_PREFIX` map gains:

| Action | Phrase prefix | Subject | Expected phrase |
|---|---|---|---|
| `approve` | `approve` | `<staged_transaction_id>` | `approve <id>` |
| `reject` | `reject` | `<staged_transaction_id>` | `reject <id>` |
| `reopen` | `reopen` | `<staged_transaction_id>` | `reopen <id>` |
| `auto-match` | `auto-match` | `<importing-account>` or `all` | `auto-match all` |
| `rule-add` | `rule` | `<target_account>` | `rule Expenses:Groceries` |
| `rule-disable` | `rule-disable` | `<rule_id>` | `rule-disable <rule_id>` |
| `review-session` | `review-session` | database file basename | `review-session ledger.db` |

Phrases are fixed, published in each command's `--help`, and recorded in the Phase 2b evidence. They are a deliberate speed bump against an unattended agent mutating review state, not a secret. Their security value is the audit event and the safe-mode precondition.

`review categorize`, `review show`, `review list`, and `rule list` do not call the phrase gate. `categorize` still calls `safe_mode_enabled`; a safe-mode-on attempt raises `AuthorizationError`, exits 3, and emits an audit event with `result = denied`. `show`, `list`, and `rule list` are pure reads and call no gate.

Every phrase-gated action records the authorizing mechanism (`tty` or `confirm-flag`) in its audit event, exactly as Phase 2a.

## 10. Observability

`audit.append_audit_event` has a fixed field envelope (`seq`, `ts_utc`, `actor`, `action`, `target`, `result`, and six nullable ledger/hash fields); it has no free-form payload column. Phase 2a already carries event detail in the `action` string (`import (records_created=5)`, `import (denied: safe mode is on)`). Phase 2b follows the same convention. Every event below has `actor = "operator"`, `target` as noted, and `result` one of `ok` / `denied` / `error`:

| `action` string | `target` | When |
|---|---|---|
| `review categorize (<target_account>)` | staged transaction id | account set on a `pending` or `categorized` row |
| `review categorize (<target_account>; rule <rule_id>)` | staged transaction id | account came from accepting a loop rule suggestion |
| `review auto-match (<target_account>; rule <rule_id>)` | staged transaction id | one per row filled by `auto-match` |
| `review auto-match (matched <n> of <m>)` | `<importing-account>` or `all` | `auto-match` summary, one per command |
| `review approve` | staged transaction id | approve-gate pass |
| `review reject` | staged transaction id | move to `rejected` (reason stored on the row, not the event) |
| `review reopen (from <state>)` | staged transaction id | move back to `pending` |
| `rule add (<match_type> <pattern> -> <target_account>)` | rule id | `rule add` or `--persist-rule` |
| `rule disable` | rule id | `rule disable` |
| `rule resolve (skipped uncompilable regex)` | rule id | a stored `regex` rule failed to compile at resolution time; `result = error`, no abort |
| `review-session start` | database file basename | guided loop entered |
| `review-session end (c=<n> a=<n> r=<n> s=<n>)` | database file basename | guided loop exited |

The Phase 2a `import` event's `action` string gains the count: `import (records_created=<n>, rules_applied=<k>)`.

`denied` events reuse the Phase 2a pattern `<action> (denied: <reason>)` written by `auth.require_operator` and by the `categorize` safe-mode guard. No new query surface; `GET /v1/audit` is Phase 5 and unaffected.

## 11. Error handling

Every failure path fails closed. No command leaves a row in a half-changed state.

| Condition | Result |
|---|---|
| Safe mode on for any mutating command | `AuthorizationError`, exit 3, audit `denied` |
| Missing or wrong `--confirm` for a phrase-gated command, non-TTY stdin | `AuthorizationError`, exit 3, audit `denied` |
| `categorize`, `approve`, `reject`, `reopen`, or `show` on an unknown `staged_transaction_id` | `LookupError`-class error, exit non-zero, nothing written |
| `categorize` on a `rejected` or `approved` row | error naming `review reopen`, nothing written |
| `approve` when a posting account is null, invalid, non-balancing, or multi-currency | approve gate refusal, exit 3, audit `denied`, no state change |
| `reopen` on a `pending` or `approved` row | error (`pending` is a no-op error; `approved` is terminal), nothing written |
| `rule add` with an invalid `--match-type`, an uncompilable `regex`, or an invalid account name | `ValueError`-class error, exit non-zero, nothing written |
| `rule add` or `--persist-rule` colliding on `UNIQUE (match_type, pattern, importing_account)` | error naming the existing `rule_id` and `rule disable`, nothing written |
| `rule disable` on an unknown or already-disabled `rule_id` | error, nothing written |
| SQLite constraint violation during any write | transaction rolls back, error surfaced, schema version unaffected |
| Migration 0004 interrupted mid-rebuild | no partial schema version; the runner leaves the database at the prior version |

## 12. Test contract for the Phase 2b exit gate

Focused `pytest` suite only, matching the Phase 1 and Phase 2a evidence discipline. Full-suite, live-bank-file, and production evidence stay deferred. The suite starts from the Phase 2a baseline (161 passed, 1 skipped) and every task keeps it green.

1. **Migration.** 0004 applies on a fresh database, is not applied twice, and leaves no partial schema version when interrupted. After the `staged_transactions` rebuild, `PRAGMA foreign_key_check` is clean and existing `staged_postings` rows still resolve. The widened `status` `CHECK` accepts `categorized` and rejects any fifth value.
2. **State machine.** Every transition in the section 3 table succeeds and emits exactly one audit event. `approved` rejects `categorize`, `reject`, `reopen`, and a second `approve`. `categorize` on `rejected` and on `approved` fails closed naming `reopen`. `reopen` from `categorized` and from `rejected` returns the row to `pending` and clears `reject_reason`, `categorized_at_utc`, and `decided_at_utc` while leaving the contra account intact.
3. **Rule resolution.** `exact`, `prefix`, and `regex` each match the right payees; `priority ASC` then `created_at_utc ASC` ordering is proven with overlapping rules; an `importing_account`-scoped rule does not fire for another account; an `active = 0` rule is skipped. An uncompilable `regex` is rejected at `rule add`. A stored `regex` that fails at resolution time is skipped with a `rule_compile_skipped` event and does not abort.
4. **Import-time auto-fill.** A matching rule sets the contra account at stage time, the row stays `pending`, and the `import` event reports the right `rules_applied` count. No match leaves the contra account `NULL`. Re-importing the same file after adding or changing a rule is still a zero-row no-op and does not rewrite the existing row. OFX and QFX imports no longer produce a placeholder contra account; a separate case proves a rule-filled OFX contra account.
5. **`--persist-rule`.** `categorize --persist-rule` writes one `exact`, account-scoped, `priority = 50` rule in the same transaction as the categorization. A `UNIQUE` collision aborts the whole command and the categorization does not apply.
6. **`auto-match`.** It fills only `pending` transactions with a `NULL` contra account, moves each to `categorized`, emits one `auto_match` event per row plus a summary event, and honors `--importing-account`. A row already `categorized` is untouched.
7. **Authorization.** `approve`, `reject`, `reopen`, `auto-match`, `rule add`, and `rule disable` each fail closed with safe mode on, and with non-TTY stdin and no or wrong `--confirm`; each emits a `denied` audit event. `categorize` fails closed on safe mode only. Every gated success records `tty` or `confirm-flag`.
8. **Approve gate.** A null contra account, an invalid account name, a constructed non-balancing posting set, and a constructed multi-currency posting set each block `approve` with a `denied` event and no state change. A fully categorized, balanced, single-currency transaction approves and sets `decided_at_utc`.
9. **Guided loop.** Driven by a scripted stdin stream: a `c` then `a`, a `c` then `r`, an `s`, and a `q` across several rows produce the expected end states; the authorization phrase is prompted exactly once for the whole session; one audit event fires per decision; `review_session_start` and `review_session_end` bracket the run and the end event carries correct counts. The loop refuses to start with safe mode on.
10. **Read-only surfaces.** `review list --status categorized`, `review show`, `review show --json`, and `rule list` expose no mutation path and emit no mutating audit event.

## 13. Out of scope for Phase 2b

Beancount compilation, `bean-check`, ledger writes, un-approval, projection, search, FTS, MCP, SimpleFIN, RAG export, mobile access, encrypted backup, and Git publication. Rule matching on amount, sign, amount range, or institution or account key beyond the optional `importing_account` scope. Rule auto-learning beyond an explicit `--persist-rule`. A `pending` or `categorized` timeout or expiry. A second identity-algorithm version. Any change to the Phase 2a import wire behavior other than the two bounded modifications in section 5.

## 14. Open items carried

- **D-4** ingest inbox absolute path remains config-driven and unset in the repo, exactly as Phase 2a left it. Phase 2b adds no dependency on it beyond what `import` already requires.
- The Phase 2b evidence document records the fixed authorization phrases for `approve`, `reject`, `reopen`, `auto-match`, `rule add`, `rule disable`, and the review session, alongside the Phase 2a phrases.

## 15. Approval gate

The operator reviews this spec and either approves entry to a Phase 2b implementation plan or requests changes. Implementation begins only after explicit approval typed in the transcript, per `docs/meta/plans/ironledger-implementation-plan.md` "Approval gates". Any change to Beancount authority, evidence retention, the default read-only access posture, the operator-authorization model, currency policy, or network exposure requires a design amendment and renewed approval.
