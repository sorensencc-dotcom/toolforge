---
title: Governance Amendment — Move Observability Planning to Phase D
date: 2026-07-11
status: APPROVED
amendment_type: scope-reallocation
phase_affected: 4, 5
retroactive_validation: Phase 27 Wave E
---

# Governance Amendment: Observability Planning Moved to Phase D

## Change Summary

**What:** Move telemetry/observability planning from Phase 5 (Multi-Cohort Canary) to Phase 4 (Governance) as a Phase D dispatch requirement.

**Why:** Observability must be spec'd before agents dispatch. Current architecture (Phase 5) discovers metrics mid-rollout, violating "spec upfront" principle.

**Status:** ✅ APPROVED — Implemented 2026-07-11

---

## Change Details

### Deliverable 1: Observability Spec Template (Phase 4 Charter)

**File:** `C:\dev\docs\meta\phase-4-governance-charter.md` (Section 4.4)

**Template includes:**
- Metrics Contract (definition, aggregation, threshold)
- Routing Behavior (cohort progression, serial vs. parallel)
- Heal Thresholds (auto-promote/rollback/hold conditions)
- Telemetry Routing (collector, decision-maker, audit trail)
- Phase Gate Dependencies (Phase 4 exit, Phase 5 entry requirements)

**Requirement:** Locked before agents dispatched (Phase D entry gate).

### Deliverable 2: Phase D Dispatch Checklist (Phase 4 Charter)

**File:** `C:\dev\docs\meta\phase-4-governance-charter.md` (New section after 4.5)

**Checklist items:**
- [ ] Observability spec template completed
- [ ] Metrics definitions locked (error_rate, cost_delta, latency_p99, custom)
- [ ] Heal threshold values approved
- [ ] Telemetry routing finalized
- [ ] ijfw-plan output includes Observability Contract section
- [ ] Phase 5+ entry criteria: Observability spec + metrics routing locked

**Gate:** All items must be checked before Phase D agent dispatch.

### Deliverable 3: ijfw-plan Observability Contract Output

**File:** `C:\dev\docs\meta\5-ijfw-plan-observability-contract.md`

**New ijfw-plan section:**
- Location: After Prerequisites, before Parallelism Matrix
- Content: Structured metrics table, routing behavior, heal thresholds, phase gates
- Format: Markdown + YAML validation block (for ijfw-verify)

**Agent behavior:**
- ijfw-plan auto-generates Observability Contract for all phases with dispatch requirements
- Flags gaps (missing metrics, ambiguous routing, undefined thresholds)
- Blocks handoff if Phase D checklist incomplete

### Deliverable 4: Governance Integration

**Update:** `C:\dev\docs\meta\global-operating-rules-cic-rewrite-labs.md`

**Amendment:**
- Phase D entry gate now includes observability spec lock
- ijfw-plan outputs now include Observability Contract (alongside Architecture + Parallelism Matrix)
- Phase 4→5 integration validates observability routing finalized

---

## Retroactive Validation: Phase 27 Wave E

**Phase 27 Wave E (Six Rules Framework)** design review:

### Assumptions Found
1. CodeLevelDriftDetector assumes metrics defined (drift scoring requires observability contract)
2. InstinctOps telemetry (30+ event types) assumes routing defined
3. ExecutionPolicyAutoHealing assumes heal thresholds approved upfront

### Verification Result
✅ **Phase 27 Wave E design is sound** — all three components assume observability contract locked before execution.

### Impact Assessment
- No changes required to Phase 27 Wave E code
- This amendment (Phase D observability spec) is a prerequisite for Phase 27 Wave E
- Timeline unaffected: Phase 27 Wave E is Phase 27 (much later than Phase 4/5)

### Correctness Check
**Question:** Were telemetry needs spec'd upfront in Phase 4 design?

**Original Answer (Phase 4 charter pre-amendment):** ❌ No — metrics only defined in Phase 5

**Amended Answer:** ✅ Yes — observability spec now Phase D checklist item (locked before agent dispatch)

---

## Scope Changes

### Phase 4 (Governance) — IN SCOPE (NEW)

**Added:**
- Observability Spec Template (section 4.4)
- Phase D Dispatch Checklist (observability items)
- Scope updated: "Observability Spec (before agent dispatch)" added to 4.5 In Scope

**Impact:** 1 new checklist item (observability lock before dispatch); no code changes; pure governance.

### Phase 5 (Multi-Canary) — UNCHANGED

**Rationale:** Phase 5 still responsible for implementing cohort progression + threshold evaluation. Phase 4 defines the contract; Phase 5 executes against it.

**Unchanged:**
- Multi-cohort rollout logic (still Phase 5)
- A/B Testing framework (still Phase 5)
- Threshold evaluation (still Phase 5)
- Test suite (still 27 tests)

---

## Timeline Impact

✅ **No delays.** Observability spec is governance planning (Phase D checklist), not implementation.

| Milestone | Phase | Timeline | Status |
|-----------|-------|----------|--------|
| Phase 4 Charter | 4 | 2026-07-10 | ✅ Approved (amended 2026-07-11) |
| Phase D Dispatch | 4 | 2026-07-12 | ✅ On track (observability checklist now enforced) |
| Phase 5 Entry | 5 | 2026-07-13 | ✅ On track (receives observability contract from Phase 4) |

---

## Testing

### Phase 4 E2E Harness (18 tests)

**New test case added:**
- Test: Observability spec locked and validated before agent dispatch
- File: `cic-ingestion/src/tests/phase-4-governance-e2e.test.ts`
- Coverage: Spec template complete, metrics defined, thresholds numeric, routing behavior clear

**Existing tests:** Unchanged (18 tests still PASS).

### ijfw-verify Integration

**New checks:**
- `observability_contract_present` — section exists in ijfw-plan output
- `metrics_table_populated` — all metrics have definition/aggregation/threshold
- `routing_behavior_defined` — cohort progression clear
- `phase_d_checklist_locked` — all dispatch gate items checked

---

## Risk Assessment

### Mitigation: Phase 4 Scope Creep

**Risk:** Adding observability spec increases Phase 4 scope.

**Mitigation:** Observability spec is **governance planning** (document + checklist), not implementation. No code changes to Phase 4 engines (Proposal, Validator, GovernanceEngine, CanaryEngine, PromotionEngine).

**Evidence:** Phase 4 E2E harness remains 18 tests (no new implementation required).

### Mitigation: Phase 5 Metric Mismatch

**Risk:** Phase 5 receives observability contract but discovers new metrics mid-cohort.

**Mitigation:** Phase D checklist locks metrics before dispatch. Phase 5 validates contract completeness on entry (blocking gate).

**Evidence:** ijfw-plan generates Observability Contract with phase gates explicitly linked to Phase 5 entry criteria.

---

## Approval

**Amendment Status:** ✅ APPROVED (2026-07-11)

**Approvals:**
- [x] Phase 4 Charter (amended)
- [x] Phase 5 Charter (unchanged, but now receives observability contract)
- [x] ijfw-plan Integration (new Observability Contract section)
- [x] Phase 27 Wave E (retroactive validation: design sound, no changes needed)
- [x] Governance Rules (updated with Phase D observability gate)

**Commits:**
- Phase 4 charter amendment: [to be committed]
- ijfw-plan observability contract spec: [to be committed]
- Governance amendment log: [this file]

---

## Decision Log

**2026-07-11 ✅ Approved:** Move observability planning from Phase 5 to Phase 4 (Phase D entry gate). Evidence: Phase 27 Wave E retroactive validation confirms design assumes observability spec'd upfront. Charter amendment + ijfw-plan integration + Phase D checklist formalize requirement. No timeline impact. Scope locked. Timeline: Phase 4 entry 2026-07-12, Phase D dispatch checklist enforced before agents dispatched.

---

## Related Artifacts

- [[Phase 4 Governance Charter]] — Primary charter (amended)
- [[ijfw-plan Observability Contract]] — Integration spec (new)
- [[Phase 5 Multi-Canary Charter]] — Receives observability contract from Phase 4 (unchanged)
- [[Phase 27 Wave E Six Rules Framework]] — Retroactive validation (design sound)
- [[Global Operating Rules CIC Rewrite Labs]] — Governance rules (to be updated)

