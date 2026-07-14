# AMD-v2.4.0-0001 — Append-Only Rollback Semantics

Status: `RATIFIED`  
Submitted: 2026-07-13  
Submitted by: `ACT-20260713-0001` — candidate harness identity  
Ratification authority: Tier 1  
Breaking change: No

## Decision Requested

Replace `VOID` mutation semantics in GATE-01 with append-only `ROLLBACK`
semantics. Existing lineage records remain immutable.

## Affected Requirements

- `CIC-GATE-SPEC-001` AC-01-003
- `CIC-GATE-SPEC-001` TC-01-003
- GATE-01 closure report mapping

## Current Text

AC-01-003 permits an attempted lineage record to be reversed or marked
`VOID`. TC-01-003 requires a `VOID` record after a partial lineage write.

## Proposed Text

**AC-01-003:** A transaction that fails before a complete `INGESTED` record is
durably appended must restore artifact-store state and append a separate
`ROLLBACK` record containing `artifact_id`, `transaction_id`,
`failure_reason`, and timestamp. Existing complete lineage records must never
be edited, reversed, deleted, or marked in place. Invalid trailing bytes from
an interrupted append must be quarantined under the lineage repair protocol.

**TC-01-003 expected outcome:** Artifact removed or previous bytes restored;
no complete `INGESTED` record for failed transaction; append-only `ROLLBACK`
record present; invalid trailing bytes, if produced, quarantined and followed
by `CORRUPT_RECORD` evidence.

**TC-01-003 pass criterion:** Store state matches pre-transaction bytes; no
complete `INGESTED` record references failed transaction; schema-valid
`ROLLBACK` record contains transaction and failure metadata; lineage hash chain
verifies after any required tail repair.

## Rationale

`VOID` implies modifying or semantically cancelling prior history. That
conflicts with append-only immutability. Separate `ROLLBACK` evidence preserves
failed-attempt history without rewriting it and matches implemented candidate
behavior.

## Compatibility and Risk

- No API or schema field removal.
- Adds precise use of existing candidate action `ROLLBACK`.
- Historical records remain unchanged.
- Consumers recognizing only original action vocabulary need update before
  activation.

## Verification Required After Ratification

1. Add true mid-lineage-write fault injection for TC-01-003.
2. Verify partial bytes are quarantined without modifying valid records.
3. Verify artifact bytes restore exactly.
4. Verify no complete `INGESTED` record exists for failed transaction.
5. Verify `ROLLBACK` and any `CORRUPT_RECORD` records preserve hash chain.
6. Re-run GATE-01 report in production-target environment.

## Approval

Tier 1 decision: `APPROVED`  
Ratified date: `2026-07-13`  
Ratified by: `Tier 1 (Chris)`  
Linked lineage ID: `LIN-07edcfa722e14ed39c7242b30c4da1ad`
