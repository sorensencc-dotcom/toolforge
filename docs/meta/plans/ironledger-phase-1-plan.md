# IronLedger Phase 1 plan

Status: draft for operator review  
Scope: canonical ledger, schema, and integrity foundations; no implementation authorization

## Gate before execution

Phase 1 remains blocked until the operator resolves D-1 and types explicit Phase 1 approval in the transcript.

D-1 concerns the shared repository preflight. `C:/dev/scripts/verify-repo-context.ps1` requires `package.json`, while IronLedger uses `pyproject.toml`. The recommended resolution is a maintainer patch that accepts `package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml`. The implementation agent must not patch the protected script, add a misleading `package.json`, or treat an exception as resolved without operator direction.

After D-1 resolution, record the preflight result, repository root, branch, working tree, and remotes before each execution wave. Keep all implementation work in `C:/dev/dev-sandbox/IronLedger`. Keep governed documents under `C:/dev/docs/meta/`.

## Phase boundary

Phase 1 defines and tests the canonical local accounting foundation:

- Beancount file layout, account policy, currency policy, and source-link convention.
- SQLite migrations for source evidence, staging, ledger indexes, audit events, and compile runs.
- Strict integer monetary constraints, explicit currency identity, account validation, UTC timestamps, and immutable evidence retention.
- Append-only audit sequence and hash-chain format.
- Projection and source hash-manifest formats, including an empty validated projection.

Do not implement ingestion parsers, review workflows, compilation, network listeners, MCP tools, SimpleFIN, RAG, mobile access, backups, or Git publication in this phase.

## Fixed invariants from Phase 0

- Beancount remains the sole accounting authority; SQLite remains disposable and rebuildable.
- Monetary values use signed integer minor units, explicit currency, and explicit scale. Do not use floating-point accounting arithmetic or net unlike currencies.
- Source documents and source records remain retained evidence. Foreign keys must not cascade deletes into evidence.
- Audit events are append-only, monotonic, hash chained, and fail closed on gaps, reordering, or tampering.
- Safe mode defaults on and disables mutation surfaces.
- Store timestamps in UTC, resolve paths against approved roots, and keep secrets outside the repository and source tree.
- Concrete accounts remain deferred until the first authorized import. Phase 1 locks policy and validation rules, not a complete personal chart of accounts.

## Task breakdown

### 1. Define canonical ledger conventions

Specify the directory and file naming layout under `ledger/`, the account-name grammar, the versioned currency table reference, minor-unit scale rules, and the source-link metadata carried by entries and postings. Document canonical identity fields without implementing import identity generation.

Acceptance test: a convention fixture validates a supported account, currency, amount, UTC timestamp, and source link, while rejecting an unknown account, unknown currency, missing scale, malformed timestamp, and invalid source reference.

### 2. Design initial migrations

Create migration definitions for `source_documents`, `source_records`, `staged_transactions`, `ledger_entries`, `ledger_postings`, `audit_events`, and `compile_runs`. Include schema versioning, primary keys, uniqueness rules, required provenance, identity algorithm versions, UTC timestamps, compile status, and recovery state.

Acceptance test: a fresh database applies migrations in order, reports the expected schema version, and applies no migration twice. A migration interruption test leaves a recoverable state without a partially accepted schema version.

### 3. Enforce strict monetary and identity constraints

Use SQLite strict tables and integer amount columns. Require currency in every monetary identity and posting row. Reject floating-point values, malformed currency fields, absent currency fields, unsupported scales, invalid signs, invalid account identifiers, and duplicate source identities. Preserve historical identity algorithm versions.

Acceptance tests:

- Invalid amount types and fractional minor units fail.
- Unknown currencies and missing currency fields fail.
- Invalid account names and posting signs fail.
- Duplicate identity insertion fails without overwriting the first record.
- Unlike-currency balancing fails.

### 4. Protect retained evidence

Define foreign keys and delete behavior so ledger indexes, staged records, and audit references cannot delete or cascade-delete `source_documents` or `source_records`. Permit projection cleanup only where the evidence-retention invariant remains intact.

Acceptance test: deleting a referenced source document or source record fails, and a destructive delete transaction leaves all evidence and references unchanged.

### 5. Define the append-only audit chain

Specify the audit event envelope, monotonic sequence allocation, UTC event time, actor, action, target, result, projection version, compile-run reference, and canonical event hash. Define the genesis value, previous-hash field, current-hash computation, serialization rules, and verification result. Sequence gaps, duplicate sequence values, reordering, malformed hashes, and tampered payloads must fail closed.

Acceptance tests:

- A valid event sequence verifies from genesis through its head hash.
- A missing, reordered, duplicated, or altered event fails verification.
- Concurrent or replayed sequence allocation cannot create two accepted events with one sequence number.
- An append-only database policy rejects update and delete attempts against accepted audit events.

### 6. Define projection and source manifests

Specify versioned manifests containing the projection schema version, the compile-run ID, the source input hash, the ledger input hash, the output hash, the row counts, and the canonical manifest digest. Define deterministic ordering and encoding. Define the empty projection result and its validation rules.

Acceptance tests:

- An empty projection can be created, passes SQLite integrity and schema checks, and produces a stable manifest.
- Revalidating the same projection reproduces the same manifest digest.
- Changing a row, schema version, input hash, or ordering causes manifest verification to fail.

### 7. Add phase evidence and operator handoff

Record commands, outputs, timestamps, and test results for each acceptance test. Separate focused test evidence from full-suite, live, and production evidence; Phase 1 requires focused migration and integrity evidence only. Do not claim Phase 1 completion until the operator reviews the evidence and approves the exit gate.

## Exit evidence matrix

| Exit criterion | Concrete test evidence |
|---|---|
| Schema migrations pass | Fresh migration, repeat migration, schema-version, and interrupted-migration tests |
| Invalid amounts fail | Strict-column and integer-minor-unit rejection tests |
| Invalid currencies fail | Unknown, missing, malformed, and unsupported-scale currency tests |
| Invalid accounts fail | Account grammar and policy validation tests |
| Invalid signs fail | Debit/credit sign and balancing validation tests |
| Duplicate identities fail | Unique-identity and idempotent duplicate-insert tests |
| Destructive evidence deletes fail | Foreign-key, restricted-delete, and no-cascade evidence-retention tests |
| Audit chain verifies | Genesis-to-head verification test with stable canonical hashes |
| Audit tampering fails | Gap, reorder, duplicate, payload, previous-hash, and head-hash tamper tests |
| Empty projection validates | Empty SQLite creation, integrity, schema, and manifest-validation test |
| Manifest tampering fails | Input-hash, row-count, schema-version, ordering, and digest mismatch tests |

## Authorization and failure behavior

Phase 1 creates no user-facing mutation workflow. Migration setup and test fixtures run locally after approval. Safe mode remains on by default. Any invalid input, constraint violation, audit-chain discontinuity, manifest mismatch, migration interruption, or evidence-delete attempt stops the operation and returns a machine-readable failure; no partial ledger authority or evidence deletion may remain accepted.

## Approval gate

The operator must resolve D-1, review this plan, and type explicit Phase 1 approval before implementation begins. A later change to Beancount authority, evidence retention, currency policy, network exposure, safe mode, or authorization boundaries requires a design amendment and renewed approval.
