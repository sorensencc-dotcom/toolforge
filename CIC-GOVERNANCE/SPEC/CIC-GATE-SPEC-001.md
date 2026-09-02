---
title: "CIC Gate Closure Specification"
document_id: "CIC-GATE-SPEC-001"
category: "spec"
status: "candidate"
version: "1.0.0-candidate.1"
---


# CIC Gate Closure Specification

Document ID: `CIC-GATE-SPEC-001`  
Version: `1.0.1-candidate.1`  
Status: `CANDIDATE — NOT RATIFIED`  
Parent: `CIC-GOV-MANIFEST-001 v1.1.0-candidate.1`  
Owner: Tier 1 (Chris)  
Automation role: Tier 3

This reconciles supplied gate-control draft with Global Operating Rules.
Supplied acceptance criteria remain test targets, subject to these corrections:

1. Manifest Owner records recommendations; Tier 1 alone ratifies closure.
2. Lineage stays append-only. Failed transactions append `ROLLBACK`; existing
   records are never reversed, edited, marked, or removed.
3. Partial trailing bytes are quarantined before repair; valid historical
   records remain untouched. Repair appends `CORRUPT_RECORD` afterward.
4. Lineage action vocabulary includes `ROLLBACK`, `MUTATED`,
   `CORRUPT_RECORD`, and `ACTIVATED`.
5. Publication events are append-only child records referencing parent
   lineage; parent records are never mutated.
6. Gate test success proves implementation readiness only. Closure still
   requires Tier 1 approval, ratified amendment, and lineage evidence.

## Gate Registry

| Gate | Candidate mechanics | Closure authority | Status |
| --- | --- | --- | --- |
| GATE-01 | Transactional artifact store and rollback | Tier 1 | OPEN |
| GATE-02 | Isolated publication, retries, failure query | Tier 1 | OPEN |
| GATE-03 | Persistent actor registry and transitions | Tier 1 | OPEN |
| GATE-04 | Atomic lock, hash chain, integrity audit | Tier 1 | OPEN |
| GATE-05 | Declaration validator and activation transition | Tier 1 | OPEN |

GATE-05 cannot begin while any earlier gate remains other than `CLOSED`.
Candidate test reports must never self-ratify or close a gate.

## Ratified Amendment AMD-v2.4.0-0001

Effective 2026-07-13 for candidate verification:

**AC-01-003:** A transaction that fails before a complete `INGESTED` record is
durably appended must restore artifact-store state and append a separate
`ROLLBACK` record containing `artifact_id`, `transaction_id`,
`failure_reason`, and timestamp. Existing complete lineage records must never
be edited, reversed, deleted, or marked in place. Invalid trailing bytes from
an interrupted append must be quarantined under lineage repair protocol.

**TC-01-003 expected outcome:** Artifact removed or previous bytes restored;
no complete `INGESTED` record for failed transaction; append-only `ROLLBACK`
record present; invalid trailing bytes, if produced, quarantined and followed
by `CORRUPT_RECORD` evidence.

**TC-01-003 pass criterion:** Store state matches pre-transaction bytes; no
complete `INGESTED` record references failed transaction; schema-valid
`ROLLBACK` record contains transaction and failure metadata; lineage hash chain
verifies after any required tail repair.
