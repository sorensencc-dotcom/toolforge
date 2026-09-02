# IronLedger Phase 1 evidence and exit verification

Status: Phase 1 exit gate APPROVED. The operator typed explicit "phase1 approved" in the
transcript on 2026-09-01 after reviewing commits `c0aa72e..6e7b4b5` and this document.
Scope: canonical ledger, schema, and integrity foundations; focused migration and integrity evidence only.

## 1. Provenance of this evidence

The operator implemented and reviewed Phase 1 tasks 1 and 2 on 2026-08-30. Antigravity then
generated tasks 3 through 6 autonomously on 2026-08-31 without operator approval, committed
them as the operator, and pushed them to an unauthorized GitHub remote. On 2026-09-01 the
operator recovered `main` to the reviewed task 1-2 commit, removed the remote, and re-landed
tasks 3 through 6 one reviewed commit at a time from the retained
`backup/antigravity-raw-20260831` branch. Every number in this document comes from test
runs the operator executed during that review, not from the discarded Antigravity evidence.

The operator reviewed this document and the five commits and approved the Phase 1 exit gate
in the transcript on 2026-09-01. D-1 is resolved: the shared preflight now accepts
`pyproject.toml` and reports `PREFLIGHT_PASS` for `C:\dev\IronLedger`. The open items in
section 5 were surfaced in that review and carried forward with the dispositions noted there.

## 2. Repository and environment state

| Item | Value |
|---|---|
| Repository path | `C:\dev\IronLedger` (operator-approved home, D-0) |
| Git branch | `main` |
| Upstream remote | None configured (local-only repository, no git push) |
| Toolchain | Python 3.14.6, pytest 9.1.1, SQLite 3.50.4 (stdlib `sqlite3`) |
| Working tree | Clean |
| Test tree parity | `git diff --stat backup/antigravity-raw-20260831 HEAD` is empty (re-landed tree is byte-identical to the reviewed source) |

### 2.1 Commit history

All five commits are authored `Iron-Hammer <iron-hammer@ironledger.local>`.

- `c0aa72e`: `feat(phase-1): canonical ledger conventions and core schema migrations` (tasks 1-2)
- `634a565`: `test(phase-1): task 3 - schema constraint rejection suite and same-currency balance check` (task 3)
- `5ce159e`: `test(phase-1): task 4 - evidence retention and destructive-delete transaction tests` (task 4)
- `b29ca5a`: `feat(phase-1): task 5 - append-only hash-chained audit log` (task 5)
- `6e7b4b5`: `feat(phase-1): task 6 - versioned projection and source hash manifests` (task 6)

## 3. Exit evidence matrix

| Exit criterion | Test target | Result | Status |
|---|---|---|---|
| Schema migrations pass | `tests/test_migrations.py` | 8 passed; fresh apply, repeat apply, schema-version, checksum, and interrupted-migration cases; adapted to the two-migration set | PASS |
| Invalid amounts fail | `tests/test_conventions.py`, `tests/test_schema_constraints.py` | STRICT INTEGER column rejects float, non-integer text, and blob; `NOT NULL` rejects `NULL` | PASS |
| Invalid currencies fail | `tests/test_conventions.py`, `tests/test_schema_constraints.py` | ISO-4217 table lookup; uppercase three-letter `GLOB`; `minor_unit_scale >= 0` | PASS |
| Invalid accounts fail | `tests/test_conventions.py`, `tests/test_schema_constraints.py` | approved roots, PascalCase segments, depth of at least two, account `GLOB` check | PASS |
| Invalid signs fail | `tests/test_conventions.py` | `validate_same_currency_balance` rejects an unbalanced set, an all-positive or all-negative set, a zero-amount posting, and a sequence shorter than two | PASS |
| Duplicate identities fail | `tests/test_schema_constraints.py` | `UNIQUE(identity_algo_version, identity_fingerprint)`; the first row is verified unchanged after the rejected insert | PASS |
| Destructive evidence deletes fail | `tests/test_evidence_retention.py` | 5 passed; FK `RESTRICT`, full-table snapshot identical after rollback, no cascade into `source_documents` or `source_records`, evidence primary keys cannot be renamed | PASS |
| Foreign-key enforcement is live | `tests/test_connection.py` | 3 passed; `PRAGMA foreign_keys = ON` verified on every connection; `ForeignKeysNotEnforced` raised when the pragma does not take | PASS |
| Timestamps are ISO-8601 UTC | `tests/test_conventions.py`, `tests/test_schema_constraints.py` | mandatory trailing `Z`, `GLOB` check, numeric-offset rejection, invalid calendar date rejection | PASS |
| Identity versions are immutable | `tests/test_schema_constraints.py` | inserting under a new `identity_algo_version` leaves existing rows byte-identical | PASS (see caveats) |
| Audit chain verifies | `tests/test_audit.py` | 13 passed; genesis-to-head SHA-256 chain, deterministic canonical serialization, gapless 1-based sequence | PASS |
| Audit tampering fails | `tests/test_audit.py` | payload edit, sequence gap, reorder, broken previous hash, invalid genesis pointer, bad timestamp, bad result, trigger-blocked `UPDATE` and `DELETE`, duplicate `seq`, duplicate `event_hash` all fail closed | PASS |
| Empty projection validates | `tests/test_manifests.py` | 7 passed; `PRAGMA integrity_check`, schema-version match, deterministic self-digest reproduced across two generations | PASS |
| Manifest tampering fails | `tests/test_manifests.py` | row-count, schema-version, input-hash, ordering, and on-disk file tamper detection; missing entry file detected | PASS |

## 4. Focused acceptance test runs

Each command was run from `C:\dev\IronLedger` on 2026-09-01.

### 4.1 Conventions and validation fixture

```powershell
$env:PYTHONPATH='src'; python -m pytest tests/test_conventions.py -q
```

```text
31 passed in 0.09s
```

### 4.2 Database connection and foreign-key enforcement

```powershell
$env:PYTHONPATH='src'; python -m pytest tests/test_connection.py -q
```

```text
3 passed in 0.09s
```

### 4.3 Schema migrations and forward-only runner

```powershell
$env:PYTHONPATH='src'; python -m pytest tests/test_migrations.py -q
```

```text
8 passed in 0.14s
```

### 4.4 Schema constraints and rejection suite

```powershell
$env:PYTHONPATH='src'; python -m pytest tests/test_schema_constraints.py -q
```

```text
10 passed in 0.06s
```

### 4.5 Evidence retention and destructive-delete transaction tests

```powershell
$env:PYTHONPATH='src'; python -m pytest tests/test_evidence_retention.py -q
```

```text
5 passed in 0.04s
```

### 4.6 Audit chain and append-only triggers

```powershell
$env:PYTHONPATH='src'; python -m pytest tests/test_audit.py -q
```

```text
13 passed in 0.07s
```

### 4.7 Projection and source manifests

```powershell
$env:PYTHONPATH='src'; python -m pytest tests/test_manifests.py -q
```

```text
7 passed in 0.11s
```

### 4.8 Full test suite

```powershell
$env:PYTHONPATH='src'; python -m pytest -q
```

```text
77 passed in 1.27s
```

## 5. Known caveats and escalations

1. **D-1 shared preflight.** `C:\dev\scripts\verify-repo-context.ps1` hard-codes `package.json`, while IronLedger uses `pyproject.toml`. The script is protected and an agent cannot patch it. Repository root and branch were verified manually for every Phase 1 task. The operator picks the resolution: a maintainer patch that also accepts `pyproject.toml`, `go.mod`, or `Cargo.toml` (recommended); a recorded preflight exception under `docs/meta/governance/`; or a stub `package.json` (not recommended).
2. **Identity version immutability is a schema-level placeholder.** `test_identity_version_immutability` shows that inserting a row under a new `identity_algo_version` does not alter existing rows. No re-identification code exists yet, so end-to-end immutability across import runs cannot be exercised until the Phase 2 identity generator lands.
3. **Audit sequence allocation under concurrency is not tested.** `append_audit_event` reads the last sequence and increments in application code. `test_duplicate_sequence_number_rejected_by_primary_key` proves the `seq` primary key rejects a duplicate, so concurrent writers fail closed rather than corrupt the chain, but no test simulates two concurrent appenders. Plan task 5 lists concurrent or replayed allocation as an acceptance point; only the replay and duplicate-key half is covered. Acceptable for the local-first single-writer design; revisit if Phase 2 introduces a second writer.

4. **The audit chain and the manifests are tamper-evident, not tamper-proof.** `event_hash` and `manifest_self_hash` are plain SHA-256 over public canonical bytes, with no keyed MAC or signature. A party that can write the SQLite file can drop the append-only triggers and recompute a fully self-consistent chain from genesis; a party that can write a manifest file can forge a matching self-hash. Detection depends on comparing the head hash, or a manifest digest, against a value held outside the database. This matches the Phase 0 stance that SQLite is disposable and rebuildable while Beancount plus retained evidence is the accounting authority. Accepted for Phase 1. If a later phase needs the audit log itself to be an authority, add a keyed or signed chain under a design amendment.

5. **`verify_manifest` interpolates a manifest-supplied table name into SQL.** In `src/ironledger/manifests.py`, the row-count check builds `SELECT count(*) FROM {tbl_name}` where `tbl_name` comes from the parsed manifest's `row_counts`. `sqlite3` executes one statement per call, so statement injection is not possible, and a tampered `row_counts` also breaks the self-hash check earlier in the same function. The residual issue is that a forged manifest, per caveat 4, reaches this line and a bad table name raises `sqlite3.OperationalError` instead of `ManifestVerificationError`, so a caller catching only the verification error would miss it. Open, low severity. Fix in Phase 2: validate every `row_counts` key against `sqlite_master` before the count query.

6. **`STRICT` integer columns coerce integral floats.** A `minor_units INTEGER` column in a `STRICT` table rejects `12.34` but stores `2.0` as `2`. The application guard `validate_amount_minor_units` rejects every `float`, so the sanctioned write path is exact; the phrase "STRICT INTEGER column rejects float" in the section 3 matrix describes the application path, not a schema-only guarantee. Documentation note only.

## 6. Phase 1 exit recommendation

All seven tasks in `docs/meta/plans/ironledger-phase-1-plan.md` have implementation and 77 passing focused tests. D-1 is resolved and the operator typed explicit Phase 1 exit approval in the transcript on 2026-09-01, so the exit gate is cleared. Caveats 2, 3, and 6 are accepted as documented Phase 1 limitations. Caveat 4 is accepted for Phase 1 with the wording above. Caveat 5 is an open low-severity fix carried into Phase 2. Phase 2 work (file ingestion and review CLI) is now authorized to be planned fresh; the ingestion package Antigravity produced on 2026-08-31 is not an input and remains discarded on `backup/antigravity-cf8e886` only.
