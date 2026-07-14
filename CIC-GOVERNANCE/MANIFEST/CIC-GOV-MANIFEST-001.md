# CIC Governance Consolidation Manifest

Document ID: `CIC-GOV-MANIFEST-001`  
Version: `1.1.0-candidate.1`  
Status: `CANDIDATE — NOT RATIFIED`  
Owner: Tier 1 (Chris)  
Automation role: Tier 3

## Authority

This manifest indexes CIC governance components. It remains subordinate to
Tier 1 decisions, `CLAUDE.md`, and
`docs/meta/global-operating-rules-cic-rewrite-labs.md`. Codex may validate and
record approved operations but cannot ratify amendments or resolve conflicts.

## Component Registry

| Component | Version | State | Path |
| --- | --- | --- | --- |
| Specification | 2.4.0 | Candidate | `SPEC/Spec_v2.4.0.md` |
| Ingestion schema | 2.4.0 | Candidate | `SCHEMA/CIC-Ingestion-Schema-v2.4.0.json` |
| Wrapper | 3.1.0-candidate.1 | Candidate | `WRAPPERS/Codex-Governance-Engine-Wrapper.py` |
| Wrapper registry | 1.0.0-draft | Candidate | `WRAPPERS/wrapper-registry.json` |
| Amendment registry | 1.0.1-draft | Draft; GATE-01 closure ratified | `AMENDMENTS/amendment-registry.json` |
| Lineage | 2.4 | Active evidence; four records | `LINEAGE/CIC-Lineage-v2.4.jsonl` |
| Pipeline | 2.4.0 | Candidate | `PIPELINE/CIC-Pipeline-v2.4.0.md` |
| Gate specification | 1.0.0-candidate.1 | Candidate | `SPEC/CIC-GATE-SPEC-001.md` |
| Gate registry | 1.0.2-candidate.1 | GATE-01 closed; GATE-02 through GATE-05 open | `MANIFEST/gate-registry.json` |
| Gate runtime | candidate.1 | Candidate | `WRAPPERS/governance_runtime.py` |
| Actor registry | candidate.1 | Candidate | `WRAPPERS/actor-registry.json` |
| Phase 9 Charter | 1.0 | ACTIVE — Tier 1 approved 2026-07-14 | `MANIFEST/PHASE-09-CHARTER.md` |

## Implemented Controls

- Required-field and unknown-field rejection.
- Artifact ID, semver, spec-version, hash, timestamp, tag, and note validation.
- Canonical JSON SHA-256 verification.
- Caller-supplied actor registry enforcement.
- Parent artifact checks for mutations.
- Append-only JSONL lineage with flush and filesystem sync.
- Corrupt-lineage halt.
- Candidate artifact transactions and rollback lineage.
- Candidate publication retry and consumer isolation.
- Persistent actor registry with ordered state transitions.
- Atomic lineage lock, hash chain, integrity verification, and tail repair.
- Activation declaration validation with fail-closed gate checks.

## Open Activation Gates

- GATE-01 artifact-store transaction and rollback integration is closed by
  `AMD-v2.4.0-GATE-01-CLOSED`; this does not activate governance runtime.
- Downstream publication and retry policy.
- Persistent actor registry and authorization administration.
- Cross-process lineage locking and concurrency tests.
- Tier 1 ratification and release record.

No component may use `ACTIVE` status until every gate is closed or explicitly
waived by Tier 1 with recorded rationale.
