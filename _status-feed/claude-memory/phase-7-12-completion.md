---
name: phase-7-12-threshold-model-complete
description: Phase 7.12 — Threshold Model completed with deterministic decision engine and BOB governance signals
metadata: 
  node_type: memory
  type: project
  originSessionId: de5328ec-1d8f-4151-8365-e3397df5904a
---

**Phase 7.12 — Threshold Model** ✅ COMPLETED on 2026-06-05

## What was built

**ThresholdModel** — Deterministic decision engine that evaluates ARL expansion candidates against 4 hard thresholds:
- Composite reasoning ≥ 0.75
- Confidence ≥ 0.70
- Drift magnitude ≤ 0.30
- Contradiction severity ≤ 0.20

**Decision logic:**
- ACCEPT: All checks pass
- QUARANTINE: 1 check fails → escalate to governance
- REJECT: 2+ checks fail → blocked

**Reject codes** (E001-E005) — Operator-visible error codes enabling governance routing:
- E001: composite reasoning below threshold
- E002: confidence below threshold
- E003: drift magnitude exceeds threshold
- E004: contradiction severity exceeds threshold
- E005: multiple threshold failures

**GovernanceSignalGenerator** — Converts threshold results into BOB governance signals with:
- Automatic escalation routing (memory integrity check, narrative coherence review, operator review)
- Risk level assessment (low/medium/high)
- Operator override policy enforcement
- Audit trail with timestamp and reason count

## Implementation

- **Core files:**
 - `projects/cic/ingestion/src/reasoning/arl/engine/ThresholdModel.ts` (92 lines)
 - `projects/cic/ingestion/src/reasoning/arl/engine/GovernanceSignalGenerator.ts` (94 lines)
 - `projects/cic/ingestion/src/reasoning/arl/engine/VerdictSynthesizer.ts` (updated with integration)

- **Test suites:**
 - `projects/cic/ingestion/tests/reasoning/arl/engine/ThresholdModel.test.ts` (200+ lines, 40+ tests)
 - `projects/cic/ingestion/tests/reasoning/arl/engine/GovernanceSignalGenerator.test.ts` (250+ lines, 15+ tests)

- **Documentation:**
 - `docs/cic/PHASE_7_12_THRESHOLD_MODEL.md` (comprehensive architecture + usage guide)

## Integration

- **Upstream:** Consumes weighted reasoning from Phase 7.11 (compositeReasoning, confidence)
- **Downstream:** Emits governance signals to BOB for Phase 7.13 rule triggers
- **Lateral:** Supports escalation to Phase 7.14 (self-diagnostics) and Phase 7.15 (memory consistency)

## Key decisions

- **Four thresholds:** Reflects 4 main reasoning failure modes (low reasoning quality, low confidence, high drift, high contradiction)
- **QUARANTINE state:** Single failures don't outright reject; they escalate for governance review + operator judgment
- **Reject codes:** Enable deterministic governance routing without hardcoding in BOB rule engine
- **Governance signals:** Structured output for machine consumption by governance layer
- **Backward compatibility:** VerdictSynthesizer supports both full-metrics (Phase 7.12) and confidence-only (legacy) modes

## Impact

**Expected:** 95% of expansions ACCEPT immediately without governance intervention. 5% escalate for review/override. <1% hard reject.

**Performance:** O(1) decision time — all four checks are static comparisons with no external calls.

**Next:** Phase 7.13 (Governance Hooks) wires reject codes into BOB rule engine.
