# IronLedger Phase 2 plan: ingestion, canonicalization, identity generation, and review CLI

**Program**: IronLedger  
**Milestone**: Phase 2 — Ingestion pipelines, fingerprint cryptography, and review surfaces  
**Governed repo**: `C:\dev\IronLedger`  
**Governed docs**: `C:\dev\docs\meta\`  
**Context & upstream contracts**: `docs/meta/phases/ironledger-phase-1-evidence.md`, `src/ironledger/conventions.py`, `src/ironledger/audit.py`

---

## 1. Phase 2 objectives and governance invariants

Phase 2 builds the ingestion boundary, transformation pipelines, identity determinism, and the human-governed operator CLI on top of the strict database schema, conventions, and append-only audit chain established in Phase 1.

### Phase 2 invariants

1. **Zero-float accounting**: All monetary conversions (parsing string or decimal representations to integer minor units) must use exact integer arithmetic or fixed-width string parsing. Binary floating-point arithmetic is strictly forbidden on any accounting path.
2. **Immutable raw evidence archive**: Ingested files (CSV, OFX, QFX) are archived to `evidence/source_documents/{sha256_digest}.raw` with read-only permissions. Overwriting or mutating existing evidence files is rejected.
3. **Deterministic fingerprint and identity**:
   - Primary: Trusted `FITID` mapped to canonical account.
   - Fallback: SHA-256 over `(identity_version, canonical_account, iso_date, minor_units, currency, normalized_payee)`.
4. **Idempotent ingestion**: Re-importing the same statement payload (identical `content_sha256`) produces 0 duplicate records and preserves existing staged row states.
5. **Fail-closed audit trail**: All staging creations, rule evaluations, account categorizations, manual allocations, approvals, and rejections append monotonic, hash-chained records to `audit_events`.

---

## 2. Work breakdown structure and task matrix

```text
Phase 2: Ingestion, Identity & Review CLI
├── [Task 2.1] Raw Evidence Storage & Ingest Inbox Handler
├── [Task 2.2] File Format Parsers (CSV, OFX/QFX) & Payee Normalizer
├── [Task 2.3] Fingerprinting, FITID Trust Records & Identity Resolver
├── [Task 2.4] Staging Pipeline & Database Ingestion Engine
├── [Task 2.5] Single-Operator Review CLI (`ironledger-cli`)
└── [Task 2.6] Acceptance Test Suite & Exit Evidence Document
```

---

### Task 2.1: Raw evidence archive and ingest inbox architecture

- **Target module**: `src/ironledger/ingestion/evidence_store.py`
- **Responsibilities**:
  - Accept incoming bytes or file paths from an operator inbox (resolving Decision **D-4**).
  - Compute the SHA-256 digest of the raw payload.
  - Store content into `evidence/source_documents/{sha256}.raw`.
  - Extract and persist metadata: MIME type detection, byte length, provenance description, UTC acquisition timestamp, and read-only file permissions.

---

### Task 2.2: Parser engine and normalization contracts

- **Target modules**:
  - `src/ironledger/ingestion/normalizer.py`
  - `src/ironledger/ingestion/parsers/csv_parser.py`
  - `src/ironledger/ingestion/parsers/ofx_parser.py`
- **Data contracts**:
  - `RawRecord`: Intermediate extraction dataclass.
  - `NormalizedRecord`: Typed contract containing `(canonical_account, iso_date, minor_units, currency, raw_payee, normalized_payee, fitid, extra_metadata)`.
- **Payee normalizer grammar**:
  - Strip terminal and point-of-sale prefixes (`SQ *`, `TST*`, `PAYPAL *`, `PURCHASE -`, `CHECKCARD`).
  - Strip noise tokens (trailing store numbers, postal codes, state abbreviations, phone numbers).
  - Collapse multi-whitespace and return canonical capitalized casing.

---

### Task 2.3: Identity generation and FITID trust registry

- **Target module**: `src/ironledger/identity.py`
- **Algorithm version**: `1`
- **Logic**:
  - Query table `fitid_trust_records` for the source institution and account.
  - If trusted and `FITID` present: compute SHA-256 over `(1, canonical_account, fitid)` with method `fitid`.
  - If untrusted or `FITID` missing: compute SHA-256 over `(1, canonical_account, iso_date, minor_units, currency, normalized_payee)` with method `sha256_fallback`.

---

### Task 2.4: Staging engine and database integration

- **Target module**: `src/ironledger/ingestion/engine.py`
- **Relational targets**: `source_documents`, `source_records`, `staged_transactions`.
- **Invariants**:
  - Execute within single database transaction blocks.
  - Duplicate file check: reject or skip if `content_sha256` already exists in `source_documents`.
  - Batch insert `source_records` and `staged_transactions` with `status = 'pending'`.
  - Append audit event: `import_source` with document digest and record count.

---

### Task 2.5: Operator review CLI

- **Target module**: `src/ironledger/cli/review.py`
- **CLI commands**:
  - `ironledger review list [--pending|--flagged]`: Tabular inspection of uncompiled staged transactions.
  - `ironledger review categorize <fingerprint> <target_account> [--persist-rule]`: Allocate transaction to an offset account (e.g. `Expenses:Groceries:Supermarket`) and optionally store rule.
  - `ironledger review approve <fingerprint>`: Mark staged transaction as approved.
  - `ironledger review reject <fingerprint> --reason <text>`: Mark staged transaction as rejected.
  - `ironledger review auto-match [--rules-file <path>]`: Apply deterministic regex rules to pending records.
- **Security and safety mode**:
  - Safe mode enabled by default (dry-run output only unless `--commit` / `--write` flag is supplied).
  - Every mutating action appends to `audit_events`.

---

## 3. Verification and acceptance criteria

The phase exits when all tests pass with 100% compliance against the exit matrix:

```powershell
$env:PYTHONPATH='src'; python -m pytest -q
```

### Test contract matrix

| Suite | Target module | Scope & invariant assertions |
|---|---|---|
| `tests/test_evidence_store.py` | `evidence_store.py` | Digest integrity, duplicate archive rejection, read-only file permissions. |
| `tests/test_normalizer.py` | `normalizer.py` | Minor unit zero-float parsing (`"$12.34"` -> `1234`, `"-0.50"` -> `-50`), payee regex noise sanitization. |
| `tests/test_parsers.py` | `csv_parser.py`, `ofx_parser.py` | Correct parsing of standard CSV formats and SGML/XML OFX 1.x/2.x feeds without external dependencies. |
| `tests/test_identity.py` | `identity.py` | Stable fingerprint reproducibility across runs; FITID trust-override vs fallback synthetic hashing. |
| `tests/test_staging_engine.py` | `engine.py` | Atomic transaction rollback on parse failure, duplicate file rejection, idempotent row staging. |
| `tests/test_review_cli.py` | `cli/review.py` | Safe-mode defaults, interactive categorization, regex rule persistence, audit trail event generation. |

---

## 4. Operational sign-off and execution next steps

To begin Phase 2 implementation:

1. **Decision D-4 resolution**: Designate the ingest inbox directory (e.g. `C:\dev\IronLedger\inbox\` or external user path).
2. Commit `C:\dev\docs\meta\plans\ironledger-phase-2-plan.md`.
3. Proceed with Task 2.1 and Task 2.2 implementation upon operator approval.
