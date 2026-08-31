# IronLedger implementation plan

Status: derived from approved architecture and security design  
Scope: implementation sequencing and verification; no implementation in this document

## Governing decisions

- Beancount is the sole accounting authority.
- SQLite is a disposable, rebuildable projection.
- Source documents and source records are retained evidence.
- Default MCP is read-only.
- Mutations require the local CLI and explicit operator authorization.
- Services bind to localhost or an approved private route only.
- Monetary values use signed integer minor units internally.
- Git commit and push are never automatic.

## Delivery rules

Implement one phase at a time. Before starting a phase, record its schema, authorization boundary, failure behavior, and acceptance tests. Do not expose a network listener, add mutation-capable MCP tools, or add automated publication without an explicit design amendment. Preserve unrelated files and changes. Keep source evidence immutable through normal workflows.

## Phase 0: repository and threat-model baseline

### Work

1. Verify repository root, governed documentation location, current branch, working tree, remotes, and applicable agent instructions.
2. Record the single-operator trust model, host compromise assumptions, private-mobile boundary, offline requirements, and backup threat model.
3. Define approved filesystem roots, secret locations, outbound network allowlist, safe-mode behavior, and operator authorization points.
4. Lock naming, currency, account, timestamp, identity-version, audit-sequence, and hash-manifest conventions.

### Exit evidence

- Threat model and trust boundaries reviewed.
- No public listener permitted by default.
- Secret and backup handling decisions recorded.
- Phase-specific test contract accepted.

## Phase 1: canonical ledger, schema, and integrity foundations

### Work

1. Establish Beancount file layout, account policy, currency policy, and source-link convention.
2. Define migrations for `source_documents`, `source_records`, `staged_transactions`, `ledger_entries`, `ledger_postings`, `audit_events`, and `compile_runs`.
3. Add strict SQLite constraints for integer amounts, currencies, account identifiers, identity versions, UTC timestamps, and non-cascading evidence retention.
4. Define append-only audit sequence and hash-chain format.
5. Define projection and source hash-manifest formats.

### Exit evidence

- Schema migration tests pass.
- Invalid amounts, currencies, accounts, signs, duplicate identities, and destructive evidence deletes fail.
- Audit sequence and hash-chain verification tests pass.
- Empty SQLite projection can be created and validated.

## Phase 2: file ingestion and review CLI

### Work

1. Implement CSV, OFX, and QFX parsers with MIME, encoding, provenance, and raw-content retention.
2. Implement deterministic canonicalization and versioned identity generation.
3. Implement integer minor-unit arithmetic and explicit currency validation.
4. Insert idempotent source and staged records without overwriting evidence.
5. Implement CLI review, categorization, approval, rejection, and safe-mode checks.
6. Require operator authorization for imports and rule changes.

### Exit evidence

- Re-importing identical sources produces zero duplicates.
- FITID trust conditions and fallback fingerprints are tested.
- Unicode, whitespace, ordering, malformed values, ambiguous symbols, and multi-currency property tests pass.
- Unauthorized review and rule changes fail closed.

## Phase 3: Beancount compiler and recovery journal

### Work

1. Compile approved staged transactions into deterministic Beancount entries.
2. Validate account names, posting signs, source links, currencies, and same-currency balance.
3. Run `bean-check` using a recorded exact Beancount/compiler version.
4. Write the ledger atomically through validated temporary-file replacement.
5. Persist append-only monotonic journal states and input/output hashes.
6. Implement interrupted-write detection, deterministic recovery, ambiguous-replay refusal, and dual-hash-mismatch escalation.
7. Serialize all mutation-capable compile operations.

### Exit evidence

- Valid compile and `bean-check` integration tests pass.
- Unbalanced, invalid-account, invalid-sign, and cross-currency cases fail.
- Recovery tests cover every journal boundary and partial filesystem write.
- Replayed compile produces the same output and no duplicate postings.

## Phase 4: analytics and search projection

### Work

1. Build a new SQLite projection from validated Beancount and source metadata.
2. Populate ledger indexes, analytical views, and FTS5 through explicit rebuildable projection code.
3. Include payee, narration, account, and posting-level text in FTS.
4. Produce and verify the projection hash manifest.
5. Activate projections by atomic directory swap or symlink flip.
6. Add freshness, integrity, row-count, traceability, and schema-version checks.

### Exit evidence

- Deleting the projection and rebuilding it reproduces expected rows, hashes, views, and FTS results.
- FTS remains correct after transaction and posting changes.
- No analytical query nets unlike currencies or uses floating-point accounting arithmetic.
- Activation never exposes a partially built projection.

## Phase 5: read-only MCP server

### Work

1. Expose only bounded, schema-validated read tools for search, category aggregation, balances, runway, and health.
2. Enforce pagination, maximum limits, query budgets, date validation, and account-filter validation.
3. Bind locally by default and expose no compile or mutation capability.
4. Return integer or fixed-point/decimal presentation values.
5. Emit audit events for meaningful queries and authorization failures without logging secrets.

### Exit evidence

- MCP contract tests cover schemas, errors, limits, pagination, and capability declarations.
- Unauthorized mutation attempts have no mutation path and fail closed.
- Large scans, invalid filters, traversal payloads, and malformed requests are rejected.
- Network-binding tests confirm no public unauthenticated listener.

## Phase 6: optional SimpleFIN poller

### Work

1. Store credentials outside Git and source trees using the selected OS secret mechanism.
2. Implement allowlisted outbound access, redacted logs, rotation, revocation, retry bounds, and replay-safe acquisition.
3. Route responses through the same immutable source and staging pipeline as files.
4. Keep automation at pull, stage, report, and stop unless the operator explicitly authorizes the next action.

### Exit evidence

- Secret-leakage, redaction, rotation, revocation, and allowlist tests pass.
- Replayed responses remain idempotent.
- Network failure and malformed-response recovery are tested.
- No automatic commit or push occurs.

## Phase 7: optional NotebookLM/RAG boundary

### Work

1. Define an approved export schema and least-privilege field allowlist.
2. Exclude credentials, raw secrets, unauthorized sensitive exports, and mutation instructions.
3. Include source references, ledger/projection hashes, export version, and audit manifest.
4. Keep the integration read-only and isolated from the accounting and mutation processes.

### Exit evidence

- Export redaction and source-traceability tests pass.
- NotebookLM/RAG has no write capability.
- Export manifests verify against the selected projection and compile run.

## Phase 8: private mobile access, encrypted backup, and hardening

### Work

1. Select and configure the private VPN/mesh or authenticated private reverse proxy.
2. Expose only the read-only surface to mobile clients.
3. Add encrypted backups for source evidence and Beancount separately from projections.
4. Implement isolated restore, hash verification, compile verification, and traceability checks.
5. Add safe mode, operational health checks, backup-age checks, audit-chain verification, and tamper alarms.
6. Document host hardening, disk encryption, extension/plugin risk, and recovery procedures.

### Exit evidence

- Binding and private-route tests pass.
- Mobile compromise and misconfiguration cases fail closed.
- Separate backup restore succeeds in isolation.
- Safe mode disables every mutation surface.
- Operational checks report projection freshness, failed imports, integrity, audit continuity, and backup age.

## Cross-phase verification matrix

| Invariant | Required evidence |
|---|---|
| Beancount authority | Projection rebuild derives from Beancount; SQLite edits cannot alter accounting truth |
| Integer accounting | Unit, property, and integration tests reject floating-point paths and cross-currency netting |
| Idempotent identity | Replayed and reordered sources produce no duplicates; historical identity versions remain stable |
| Evidence retention | Source deletion and cascading-cleanup tests fail closed |
| Compile recovery | Journal replay, partial write, dual mismatch, and serialization tests pass |
| Projection integrity | Hash manifest, freshness, FTS, schema, row-count, and traceability checks pass |
| Access isolation | MCP capability tests prove read-only default and no unauthorized mutation |
| Secret safety | Secret scanning, log redaction, rotation, revocation, and outbound allowlist tests pass |
| Audit integrity | Monotonic sequence, unbroken hash chain, and tamper detection pass |
| Operational recovery | Encrypted backup restore succeeds separately for ledger/source and projection data |

## Approval gates

Each phase requires operator review of its exit evidence before the next phase starts. A failed gate blocks activation of the affected boundary. Any change to Beancount authority, evidence retention, default MCP capability, network exposure, secret handling, automatic publication, or multi-user scope requires a design amendment and renewed approval.

This plan does not authorize code changes, deployment, network exposure, credential acquisition, Git publication, or automatic push. Those actions require the relevant phase approval and explicit operator authorization.
