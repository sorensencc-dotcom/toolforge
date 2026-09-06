# IronLedger Phase 3 Beancount compiler and recovery journal design

Status: design for operator review; no implementation approval.
Scope: compile approved staged transactions into canonical Beancount, validate with `bean-check`, write the ledger atomically, and journal every compile for deterministic recovery. Analytics, search, MCP, and any Git publication of the ledger stay out of scope.

## 1. Why this sub-phase exists

Phases 2a and 2b produce approved `staged_transactions` with a fully categorized posting pair: an `imported` leg naming the account the file was imported for, and a `contra` leg whose account was assigned during review. Nothing yet turns that approved set into the accounting record. Phase 3 is the compiler: it renders the approved set into the canonical Beancount file layout locked in Phase 1, proves the result with `bean-check`, swaps it into place atomically, records an index of what was emitted, and keeps an append-only journal so an interrupted compile recovers deterministically or stops for operator review.

## 2. Fixed invariants inherited

- Beancount plus retained source evidence is the sole accounting authority. The SQLite tables are an index and a workflow record, never a second mutable ledger.
- Monetary values are signed integer minor units with an explicit currency and scale. No floating-point value touches an accounting path. Unlike currencies are never netted.
- Timestamps are ISO-8601 UTC with a trailing `Z`.
- Every entry and posting traces to a `source_document_id`, a `source_record_id`, an immutable `identity_algo_version`, and an `identity_method` discriminator.
- Mutation-capable operations require an explicit operator-authorization phrase typed at the prompt, are blocked by safe mode, and emit an append-only audit event.
- Mutation-capable processes are serialized.
- The ledger layout is `conventions.LEDGER_LAYOUT`: `ledger/main.beancount` (options and includes), `ledger/accounts.beancount` (one `open` per account, single-currency constraint), and `ledger/txns/YYYY.beancount` (compiled entries, one file per calendar year).

## 3. Compile model

`ironledger compile` performs a full deterministic regeneration. Every run rewrites `main.beancount`, `accounts.beancount`, and every `txns/YYYY.beancount` from the entire set of `approved` staged transactions. The rendered bytes are a pure function of the approved set, so a replayed compile produces byte-identical files, the intended and actual output hashes are trivially comparable, and recovery from a clean state is always safe. There is no incremental append path.

Only `approved` transactions compile. Phase 2b made `approved` terminal, so the approved set only grows: a later compile picks up newly approved transactions and re-emits the whole ledger. `pending`, `categorized`, and `rejected` transactions are never rendered.

### 3.1 Input selection and validation

The compiler loads each `approved` staged transaction with its two `staged_postings` rows joined to `source_records` and `source_documents`. It refuses the run, before journaling anything, if any of the following hold:

- A `contra` leg still has `account IS NULL` (an approved transaction that was never categorized; this should be unreachable given the Phase 2b approve gate, and the check makes the invariant explicit).
- The two `minor_units` values for a transaction do not sum to zero per currency. The check reuses `conventions.validate_same_currency_balance`.
- An account is referenced with two different currencies across the approved set (a single-currency `open` cannot be emitted).
- An account name, posting sign, or currency fails `conventions` validation.

A refusal is a `CompileInputError`, exits non-zero, and leaves the database and the ledger untouched.

## 4. Beancount output format

All files use LF newlines, a trailing newline, two-space posting indentation, and ASCII. Rendering lives in pure functions in `compile/render.py` that take the loaded approved set and return `{relative_path: bytes}`; the functions perform no IO.

### 4.1 Entry rendering

One entry per approved staged transaction, written to `txns/YYYY.beancount` where `YYYY` is the year of `proposed_date`. Within a year file, entries are ordered by `proposed_date` ascending, then `identity_fingerprint` ascending.

```
YYYY-MM-DD * "payee" "narration"
  staged-transaction-id: "<staged_transaction_id>"
  Account:Imported:Leg    -1234 USD
    source-document-id: "<source_document_id>"
    source-record-id: "<source_record_id>"
    identity-algo-version: "<n>"
    identity-method: "<fitid|sha256_fallback>"
  Account:Contra:Leg       1234 USD
    source-document-id: "<source_document_id>"
    source-record-id: "<source_record_id>"
    identity-algo-version: "<n>"
    identity-method: "<fitid|sha256_fallback>"
```

- The flag is always `*`.
- `payee` and `narration` are escaped for Beancount string rules (backslash and double quote).
- The `imported` leg is written first, then the `contra` leg.
- Each amount is rendered from `minor_units` and `minor_unit_scale`: the integer is divided by `10 ** scale` and formatted with exactly `scale` fractional digits and no thousands separators, for example `minor_units = -1234, scale = 2` renders `-12.34`. No inline cost or price is emitted.
- Posting metadata carries the source linkage. The entry-level `staged-transaction-id` metadata ties the entry back to its workflow row.

### 4.2 `accounts.beancount`

One `open` directive per distinct account referenced by any approved posting, sorted by account name:

```
YYYY-MM-DD open Account:Name CUR
```

The date is the earliest `proposed_date` among the postings that reference the account. `CUR` is the single currency observed for the account across the approved set; a second currency for the same account is the currency-conflict refusal in section 3.1.

### 4.3 `main.beancount`

Regenerated every compile:

```
option "title" "IronLedger"
option "operating_currency" "USD"
; one operating_currency line per distinct currency in the approved set, sorted

include "accounts.beancount"
include "txns/2023.beancount"
include "txns/2024.beancount"
; one include per year with at least one approved entry, in ascending year order
```

## 5. Hashing

`compile/hashing.py` provides two hashes, both SHA-256, lowercase hex:

- `input_hash` is taken over a canonical serialization of the approved set: for each transaction in `(proposed_date, identity_fingerprint)` order, a fixed-field record of the transaction and its two postings, including account, `minor_units`, `minor_unit_scale`, currency, and the four source-linkage fields. The serialization format is versioned by a literal constant in the module.
- `intended_output_hash` is taken over the concatenation of the rendered file bytes in a fixed path order: `main.beancount`, `accounts.beancount`, then `txns/YYYY.beancount` in ascending year order.
- `actual_output_hash` is computed the same way over the bytes read back from the live ledger paths after the atomic replace completes.

## 6. Migration `0005_compile_journal.sql`

`compile_runs` already exists from migration 0001 with `status IN ('started', 'succeeded', 'failed', 'recovered')`, `recovery_state`, and the three hash columns. Phase 3 adds one append-only journal table:

```sql
CREATE TABLE compile_journal (
    seq            INTEGER PRIMARY KEY,          -- explicit monotonic allocation, not AUTOINCREMENT
    compile_run_id TEXT NOT NULL
        REFERENCES compile_runs (compile_run_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    state          TEXT NOT NULL CHECK (state IN (
        'started', 'bean_checked', 'replaced', 'succeeded', 'failed', 'recovered', 'refused'
    )),
    ts_utc         TEXT NOT NULL CHECK (ts_utc GLOB '????-??-??T??:??:??*Z'),
    detail         TEXT NOT NULL DEFAULT '',
    CHECK (seq >= 1)
) STRICT;

CREATE INDEX idx_compile_journal_run ON compile_journal (compile_run_id);

-- Append-only: BEFORE UPDATE and BEFORE DELETE triggers RAISE(ABORT),
-- mirroring the audit_events triggers in migration 0002.
```

The `seq` column is allocated explicitly and monotonically across all runs, the same pattern as `audit_events.seq`. The migration file is written whole in the first implementation task; the migration runner freezes its checksum afterward, so no later task edits it.

## 7. Command surface

The `compile` subtree is added to `cli/__main__.py` (argparse, consistent with the rejected-dependency note in the dependency posture).

### 7.1 `ironledger compile`

1. Require the operator-authorization phrase `authorize compile` (see section 9).
2. Refuse if safe mode is active.
3. Acquire an exclusive lock on `ledger/.compile.lock`. If held, exit non-zero with `CompileLockedError` and journal nothing.
4. Load and validate the approved set (section 3.1).
5. Render the file bytes (section 4) and compute `input_hash` and `intended_output_hash` (section 5).
6. Insert a `compile_runs` row with `status = 'started'`, the recorded `beancount_version` and `compiler_version`, `input_hash`, and `intended_output_hash`. Append `compile_journal` state `started`.
7. Write the rendered files to `ledger/.staging/`.
8. Run `bean-check` against the staging copy (section 8). On failure, go to section 10.
9. Append `compile_journal` state `bean_checked`.
10. `os.replace` the staging files into their live paths in a fixed order: `accounts.beancount`, then `main.beancount`, then `txns/YYYY.beancount` oldest year first. `fsync` each containing directory.
11. Append `compile_journal` state `replaced`.
12. Read the live files back, compute `actual_output_hash`, and assert it equals `intended_output_hash`. Store it on the `compile_runs` row.
13. Set `compile_runs.status = 'succeeded'`. Append `compile_journal` state `succeeded`.
14. Replace the ledger index: delete the `ledger_postings` and `ledger_entries` rows from the previous successful run, then insert one `ledger_entries` row per compiled transaction and its `ledger_postings` rows, all stamped with this `compile_run_id`.
15. Emit an audit event, `action = "compile"`, `result = "ok"`, carrying the `compile_run_id` and both hashes.
16. Release the lock. Print a summary: run id, entry count, year files written, and the output hash.

### 7.2 `ironledger compile status`

Read-only, no authorization. Prints the latest `compile_runs` row, the tail of its `compile_journal`, the current on-disk ledger hash, and whether it matches the latest successful run.

### 7.3 `ironledger compile recover`

1. Require the operator-authorization phrase `authorize compile recover`.
2. Refuse if safe mode is active.
3. Acquire the `ledger/.compile.lock`.
4. Find the `compile_runs` row with `status = 'started'` (there is at most one, because the lock serializes compiles). If none, report "nothing to recover" and exit zero.
5. Apply the recovery decision table (section 11).

## 8. `bean-check` invocation

`compile/beancheck.py` locates the pinned `bean-check` executable, runs it as a subprocess against `ledger/.staging/main.beancount` with a bounded timeout, and captures stdout, stderr, and the exit code. It records `beancount_version` (from `importlib.metadata.version("beancount")`) and `compiler_version` (a literal IronLedger compiler version constant) onto the `compile_runs` row. Beancount is never imported on the accounting path; the compiler only ever shells out to `bean-check`.

If the executable is absent, the compiler raises `BeanCheckUnavailableError` before inserting any `compile_runs` row. The Phase 3 exit gate requires the executable to be present.

## 9. Operator-authorization gate

`cli/auth.py` gains two fixed phrases, matching the Phase 2a and 2b pattern:

| Command | Phrase |
|---|---|
| `ironledger compile` | `authorize compile` |
| `ironledger compile recover` | `authorize compile recover` |

The phrase is compared exactly after trimming a single trailing newline. A mismatch denies the command, emits an audit event with `result = "denied"`, and exits non-zero without acquiring the lock.

## 10. `bean-check` failure handling

When `bean-check` exits non-zero:

- The staging directory is moved to `ledger/.staging/failed-<compile_run_id>/` so the operator can inspect the exact rejected files and the `bean-check` output, which is written alongside them as `bean-check.txt`.
- The live ledger files are not touched.
- No `ledger_entries` or `ledger_postings` rows are written.
- `compile_runs.status` is set to `failed`. `compile_journal` state `failed` is appended with the `bean-check` exit code in `detail`.
- An audit event is emitted with `action = "compile"` and `result = "error"`.
- The command exits non-zero and prints the path to the failed staging directory.

## 11. Recovery decision table

`compile recover` (and a defensive check at the start of the next `compile`) inspects a run left in `status = 'started'` and decides by hashing what is on disk against the run's `intended_output_hash` and the previous successful run's `actual_output_hash`.

| On-disk state | Decision |
|---|---|
| Staging directory absent; live files hash equals the previous successful run's output | Nothing was written. Mark the dangling run `failed`, journal `failed` with detail `aborted before writes`. |
| Staging complete and its hash equals `intended_output_hash`; one or more live files still hold the old bytes | Deterministic recovery. Finish the `os.replace` sequence, recompute `actual_output_hash`, assert equality, populate the ledger index, set `status = 'recovered'`, journal `replaced` then `recovered`, emit an audit event `result = "ok"`. This step is **idempotent and re-entrant**: `os.replace` of a file that already holds the intended bytes is a no-op, so a crash *during* recovery leaves the run re-eligible for this same row, and re-running `ironledger compile recover` any number of times drives it to `recovered` without a fresh `started` run and without a row-4 escalation. Recovery journals `replaced` once per invocation that performs at least one replace; a no-op re-run journals only `recovered`. |
| Staging present but its hash does not equal `intended_output_hash` | Refuse. The run stays `started`, journal `refused` with detail `staging hash mismatch`, print a review report, and instruct the operator to re-run `ironledger compile` from a clean state. |
| Live files match neither the previous successful output hash nor `intended_output_hash`, **and** no intact staging directory matching `intended_output_hash` is present | Refuse and escalate: this is genuine corruption (a partial replace compounded by an external edit, or a dual input/output mismatch). Journal `refused` with detail `live ledger in an unrecognized state`, print the full hash diff, and take no automatic action. A partially replaced live tree is **not** this row when staging is intact and matches `intended_output_hash` — that is deterministic recovery above. |
| The run reached `bean_checked` or later in the journal but `bean-check` output shows it failed | Treat as a `failed` run per section 10; do not attempt recovery. |

A recompile from a clean state (no `started` run, live files equal the latest successful output) is always safe and needs no recovery. `ironledger compile recover` is safe to invoke when there is nothing to recover: it reports "no dangling run" and exits `0`.

## 12. Module layout

New package `src/ironledger/compile/`:

| Module | Responsibility |
|---|---|
| `model.py` | Load and validate the approved set; dataclasses for transactions and postings. |
| `render.py` | Pure functions: approved set to `{path: bytes}`. Deterministic order and formatting. No IO. |
| `hashing.py` | `input_hash` and `intended_output_hash` / `actual_output_hash`. |
| `beancheck.py` | Locate and run `bean-check` as a subprocess; capture version and output. |
| `journal.py` | Write `compile_runs` rows and append `compile_journal`; read helpers for recovery. |
| `writer.py` | The atomic sequence in section 7.1: lock, journal, stage, check, replace, fsync, index, audit. |
| `recover.py` | The section 11 decision table. |
| `errors.py` | `CompileError` base, `CompileInputError`, `CompileLockedError`, `BeanCheckUnavailableError`, `BeanCheckFailedError`, `AmbiguousRecoveryError`. |

CLI touch points: `cli/__main__.py` (the `compile` subtree), `cli/auth.py` (two phrases), `cli/render.py` (`compile status` and the recovery report).

## 13. Dependency-posture amendment

`docs/meta/ironledger-dependency-posture.md` gains a section for Phase 3:

- `beancount` is added to `pyproject.toml` `dependencies`, pinned with `==` to the version resolved at implementation time.
- `requirements.lock` is regenerated with `pip-compile`. Every transitive line the regeneration adds is a separate review item recorded in the Phase 3 evidence, not an automatic accept.
- Beancount is invoked only as the `bean-check` subprocess. IronLedger never imports `beancount` on the accounting path and never constructs any Beancount network or plugin object.
- Phase 0 section 2.2 note: `beancount` ships a compiled parser extension and runs with operator privileges when `bean-check` executes. It is a build-time and test-time install, never fetched by the running system.

## 14. Test contract for the Phase 3 exit gate

All 17 items below are gate-blocking. Each must be implemented as one or more explicitly named tests in `tests/test_phase3_exit_contract.py` that assert the stated behavior directly; a subset does not pass the gate. Item 11 requires one test per decision-table row in section 11 (including a re-entrant recovery re-run). Item 12 requires a crash-injection fault point in the writer, exercised so `os.replace` stops between two target files and `compile recover` then completes deterministically.

1. `render.py` produces byte-identical output across two runs and across a reordered input set.
2. Amount formatting is correct for representative `minor_units` and `minor_unit_scale` values, including negative amounts and scale 0.
3. Entry ordering, posting ordering (`imported` then `contra`), and `open` ordering are deterministic and correct.
4. `payee` and `narration` escaping is correct for strings containing quotes and backslashes.
5. `input_hash` and `intended_output_hash` are stable across runs and change when the approved set changes.
6. A valid approved set compiles and real `bean-check` passes (integration test; the gate requires the `bean-check` executable present).
7. Unbalanced postings, an invalid account, an invalid sign, and a cross-currency transaction each fail the compile.
8. An approved transaction with a `contra` leg still `NULL` is refused before journaling.
9. `ledger_entries` and `ledger_postings` are populated after a successful compile and are replaced, not appended, on recompile.
10. A replayed compile over the same approved set produces byte-identical files and no duplicate index rows.
11. Every recovery decision-table row: pre-write abort, staging-complete finish, staging hash mismatch refusal, unrecognized live-state escalation, and a `bean_checked`-or-later failed run; plus a re-entrant case where `compile recover` is interrupted mid-recovery and a second `compile recover` still drives the run to `recovered` with no row-4 escalation.
12. An `os.replace` interrupted between two target files (crash injected in the writer) recovers deterministically via `compile recover`, and a repeat `compile recover` after full recovery is a safe no-op.
13. Two concurrent `compile` invocations: the second fails with `CompileLockedError` and journals nothing.
14. Safe mode blocks `compile` and `compile recover`.
15. Each command requires its exact authorization phrase; a mismatch denies and audits `result = "denied"`.
16. Every successful compile, failure, recovery, and denial emits the expected audit event carrying the `compile_run_id`.
17. A missing `bean-check` executable raises `BeanCheckUnavailableError` before any `compile_runs` row is inserted.

## 15. Out of scope for Phase 3

- The analytics and search projection, FTS, and the projection hash manifest (Phase 4).
- The read-only MCP server (Phase 5).
- Any Git `add`, `commit`, or `push` of the `ledger/` tree.
- Incremental compilation.
- Editing or recompiling an individual approved transaction; the approved set is append-only and the ledger is regenerated whole.

## 16. Open items carried

- The exact pinned `beancount` version and the full set of transitive dependencies are recorded during implementation and reviewed in the Phase 3 evidence.
- The IronLedger compiler version constant is fixed in the first implementation task.

## 17. Approval gate

Phase 3 requires operator review of this design, then operator review of the Phase 3 exit evidence before Phase 4 starts. Any change to Beancount authority, evidence retention, the default read-only access posture, network exposure, or automatic publication requires a design amendment and renewed approval.
