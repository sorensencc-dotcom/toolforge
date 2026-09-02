# IronLedger architecture and security design

Status: design for operator review  
Scope: architecture and security only; no implementation approval.

## Decision

IronLedger is a local-first, single-operator system. Beancount is the sole accounting authority. SQLite is a disposable, rebuildable projection/cache, never a second mutable ledger. The canonical flow is:

`source evidence -> staged transaction -> human approval -> Beancount -> bean-check -> SQLite projection -> read-only queries`

Default network surface is none or localhost-only. Optional mobile access uses only a private VPN/mesh or authenticated private reverse proxy. Git must not track a live SQLite/WAL database. Sync automation pulls, stages, reports, and stops; commit and push require explicit operator authorization.

## Architecture

### Ingestion

CSV, OFX, QFX, and SimpleFIN inputs produce immutable source-document metadata and retained source records. Store MIME type, encoding, provenance, UTC acquisition time, content hash, and raw-payload reference. Normalize monetary values to signed integer minor units; reject floating-point arithmetic, ambiguous currency symbols, malformed dates, invalid accounts, and unknown currencies. Validate currencies against a versioned static ISO-4217 table.

Use FITID only under documented institution/account-specific trust conditions. Otherwise use SHA-256 over versioned canonical account, date, amount, currency, payee, and other identity fields. Canonicalization covers case, whitespace, Unicode normalization, and documented whitespace rules. Identity algorithm versions are immutable and never retroactively re-identify historical records. Re-import is idempotent and never overwrites evidence.

### Accounting

Only approved staged transactions enter the compiler. Beancount files and source evidence are the accounting record. Validate account names, signs, currencies, source links, and same-currency balance before `bean-check`. Never net unlike currencies.

Use an append-only, monotonic compile journal. `compile_runs` records compile-run ID, exact Beancount/compiler versions, input hash, intended and actual output hashes, status, timestamps, and recovery state. Write Beancount through an atomic temporary-file-to-rename operation with platform durability checks. Recovery refuses ambiguous replay or dual input/output hash mismatch and requires operator review.

Mutation-capable processes are single-threaded or explicitly serialized. Projection freshness is valid only when tied to the latest successful compile run and verified hashes.

### Projection

Rebuild SQLite from validated Beancount plus source metadata, then activate the new projection using an atomic directory swap or symlink flip. Store a projection version and hash manifest. Permit deletion and reconstruction without loss of accounting truth.

Use WAL, foreign keys, strict constraints, FTS5, and integer monetary columns. Validate SQLite integrity, schema/version, hashes, row counts, account/currency validity, posting signs, same-currency balance, source traceability, and freshness. Projection schema changes require operator approval.

FTS is maintained by explicit rebuildable projection logic covering payee, narration, account names, and posting-level text. Triggers may optimize updates but are not the correctness authority.

### Access and governance

The local review CLI handles mutations. Default MCP is read-only and exposes bounded, paginated, schema-validated search, aggregation, balances, runway, and health queries. It has no compile or mutation capability. Any later mutation service must be separately enabled, capability-token protected with expiry and nonce, replay-protected, serialized, authenticated with WebAuthn/passkey step-up, and audited.

Imports, approvals, rule changes, compilation, re-posting, and sensitive exports require operator authorization. Audit events are append-only, monotonic, and include actor, action, target, result, projection version, compile-run ID, and hashes. Seal the stream with a hash chain or equivalent Merkle root; gaps, reordering, or tampering fail closed.

## Security controls

- Bind by default to localhost; reject public or non-private mobile bindings.
- Restrict outbound HTTP(S) to an explicit allowlist. Disable browser OAuth for financial imports unless separately approved.
- Keep SimpleFIN credentials outside Git/source trees; redact logs; support rotation and revocation; prevent browser autofill storage.
- Authorize paths against configured roots; reject traversal, symlink escapes, unsafe file types, and unsafe destinations.
- Provide operator-configurable safe mode that disables every mutation surface.
- Hash source content, ledger inputs/outputs, projections, and manifests before sensitive operations.
- Encrypt backups and restore ledger/source evidence separately from projections in an isolated test location.
- Threat-model local privilege escalation, editor/plugin access, browser leakage, mobile compromise, host OS rename/WAL changes, and hardware failure.
- Treat NotebookLM/RAG as a least-privilege, read-only export boundary with an auditable manifest; never grant it mutation access.

Residual risk remains for a fully compromised host, stolen operator credentials, malicious editor extensions, and hardware failure before backup. Host hardening, disk encryption, OS access control, and tested restore remain required.

## Data model

Use `source_documents`, `source_records`, `staged_transactions`, `ledger_entries`, `ledger_postings`, `audit_events`, and `compile_runs`. Ledger tables are Beancount indexes, not authority. Posting metadata carries source identity linkage. Foreign-key cleanup must never cascade into source evidence. All monetary records carry currency and integer minor units. API presentation uses integer fields or fixed-point/decimal strings, never binary floating point.

## Verification contract

Evidence must prove:

1. Repeated import creates zero duplicates.
2. Invalid accounts, signs, currencies, and cross-currency netting fail.
3. Every posting traces to retained source evidence.
4. Beancount and `bean-check` pass before projection activation.
5. SQLite deletion and rebuild reproduce the expected projection and hash manifest.
6. FTS reflects transaction and posting changes.
7. Default MCP cannot mutate state.
8. Interrupted compilation recovers deterministically or stops for review.
9. Backups restore successfully with integrity and traceability checks.
10. Automatic Git push is disabled by default.
11. Identity changes do not alter historical identities.
12. The audit hash chain is complete and monotonic.
13. UTC acquisition timestamps remain consistent under clock skew.
14. Safe mode disables all mutation paths and outbound access obeys the allowlist.

Tests cover parsers, integer arithmetic, fingerprints, schema constraints, authorization, replay, ordering, malformed and multi-currency inputs, interrupted compilation, journal replay, projection rebuild, restore, traversal, tampering, secret leakage, network binding, MCP contracts, limits, pagination, freshness, and backup age.

## Delivery boundaries

After written design approval, proceed in order: threat-model baseline; canonical ledger and schema; file ingestion/review; compiler and journal; projection/search; read-only MCP; optional SimpleFIN; optional RAG export; private mobile access, encrypted backup, and operational hardening. Each boundary requires its verification evidence before the next begins. No code or implementation plan is authorized by this document.

## Decisions required before affected work

Record the selected OS secret mechanism, private mobile route, retention/backup durations, WebAuthn recovery procedure, Beancount account/currency policy, and projection schema approval process. These choices must not weaken Beancount authority, evidence retention, read-only default access, or explicit operator authorization.
