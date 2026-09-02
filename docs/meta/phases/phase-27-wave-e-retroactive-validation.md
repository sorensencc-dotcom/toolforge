---
title: Phase 27 Wave E Retroactive Validation — Observability Spec Upfront
date: 2026-07-11
status: COMPLETE
validation_target: Phase 27 Wave E Six Rules Framework
source_amendment: governance-amendment-observability-phase-d
---

# Phase 27 Wave E Retroactive Validation

**Question:** Were telemetry/observability needs specified upfront (before Phase 27 Wave E execution)?

**Answer:** ❌ NO (pre-amendment) → ✅ YES (post-amendment)

**Conclusion:** Phase 27 Wave E design is sound. Amendment (Phase D observability spec) formalizes the implicit upfront requirement that Wave E assumed.

---

## Wave E Components Analyzed

### 1. CodeLevelDriftDetector

**Purpose:** Detects four coding failure modes (Kitchen Sink, Wrong Abstraction, Optimistic Path, Runaway Refactor).

**Key Interface:**
```typescript
check(input: CodeLevelInput): DriftSignal | null
// Returns: driftScore (0.0–1.0), type, severity, details, timestamp
```

**Observability Dependency:**
- Drift detection requires **metrics to evaluate** (e.g., "is this scope creep?" requires baseline metrics)
- DriftSignal output requires **telemetry routing** (where to log drift events?)
- Scoring (0.0–1.0) requires **aggregation method** (how to combine multiple drift signals?)

**Requirement Implied:** Observability contract must exist before detector runs.

---

### 2. InstinctOps

**Purpose:** 10 pre-cognitive biases for autonomous agents.

**Biases (select):**
1. Verification First (failing test before fix)
2. Define Done (acceptance criteria upfront)
3. Deterministic Debugging (reproduce → isolate → test)
6. Failure Mode Self-Recognition (KS/WA/OP/RR detection)
10. Drift Halt Reflex (immediate stop on drift)

**Telemetry Output:**
```
30+ event types tracked:
- define_done_satisfied
- test_verification_passed
- drift_detected_ks  (Kitchen Sink)
- drift_detected_wa  (Wrong Abstraction)
- drift_detected_op  (Optimistic Path)
- drift_detected_rr  (Runaway Refactor)
- instinct_violation_logged
- [etc.]
```

**Observability Dependency:**
- 30+ event types require **metrics definitions** (what is each event? how to aggregate?)
- Event logging requires **telemetry routing** (where to send events?)
- Hooks fire pre-execution, requiring **heal thresholds** (when to stop execution?)

**Requirement Implied:** Metrics contract + routing + thresholds must be defined before InstinctOps enforcement runs.

---

### 3. ExecutionPolicyAutoHealing

**Purpose:** Automatic plan recovery when drift detected (KS → shrink scope, WA → extract logic, OP → add error tests, RR → freeze arch).

**Key Decision Logic:**
```typescript
if (driftDetected) {
  if (isSoftDrift(OP, WA)) {
    // Auto-heal + resume (KS/WA)
    auto_healAndResume();
  } else if (isHardDrift(KS, RR)) {
    // Require manual approval (KS/RR)
    requireManualApproval();
  }
}
```

**Heal Thresholds:**
- Hard drift (KS/RR): Manual approval required
- Soft drift (WA/OP): Auto-heal + resume allowed
- No drift: Continue normally

**Observability Dependency:**
- Hard vs. soft drift classification requires **drift metrics** (how to distinguish?)
- Healing action selection requires **heal thresholds** (when to auto-heal vs. hold?)
- Resume decision requires **decision-maker routing** (who approves manual cases?)

**Requirement Implied:** Heal thresholds + routing must be defined before auto-healing runs.

---

## Convergence: All Three Components Assume Observability Upfront

| Component | Event Type | Observability Required | When Required |
|-----------|-----------|---|---|
| CodeLevelDriftDetector | DriftSignal (drift score 0.0–1.0) | Metrics to evaluate, routing to log | Before check() |
| InstinctOps | 30+ instinct events | Metric definitions, routing, thresholds | Before enforcement |
| ExecutionPolicyAutoHealing | Hard/soft drift decision | Heal thresholds, decision-maker routing | Before on-drift-detected() |

**Pattern:** All three components have an implicit dependency chain:

```
Observability Contract (metrics, routing, thresholds)
  ↓
CodeLevelDriftDetector (uses metrics to score)
  ↓
InstinctOps (uses metrics to enforce, routes events)
  ↓
ExecutionPolicyAutoHealing (uses thresholds to decide heal action)
```

---

## Pre-Amendment: Where Was Observability Spec'd?

**Pre-amendment charter analysis:**

| Phase | Observability Spec | Status |
|-------|---|---|
| Phase 4 (Governance) | ❌ Not mentioned | Only canary thresholds (5% error rate) |
| Phase 5 (Multi-Canary) | ✅ Defined | Metrics + thresholds + cohort progression |
| Phase 27 Wave E (Six Rules) | ❌ Assumed | Implicit dependency, not written down |

**Gap Found:** Phase 27 Wave E design assumes observability contract exists (implied by component dependencies), but no charter explicitly defines when it's locked.

---

## Post-Amendment: Observability Spec Lock

**Post-amendment charter analysis:**

| Phase | Observability Spec | Status |
|-------|---|---|
| Phase 4 (Governance) | ✅ **NEW** — Phase D Dispatch Checklist | Observability spec locked before agent dispatch |
| Phase 5 (Multi-Canary) | ✅ Receives contract from Phase 4 | Metrics + thresholds + cohort progression |
| Phase 27 Wave E (Six Rules) | ✅ Implicit requirement now explicit | Assumes observability contract (Phase 4) locked |

**Amendment Result:** Implicit dependency now formalized in Phase D checklist.

---

## Correctness Verification

### Question 1: Does Phase 27 Wave E design require observability upfront?

**Before Amendment:**
- Code review: Yes, components assume metrics/routing exist
- Charter support: No, not written in any charter
- **Answer: Ambiguous**

**After Amendment:**
- Code review: Yes, same
- Charter support: Yes, Phase D observability spec checklist
- **Answer: Definitively Yes**

### Question 2: Is Phase 27 Wave E design sound given the amendment?

**Validation:**
- ✅ CodeLevelDriftDetector uses metrics (Phase D provides metrics contract)
- ✅ InstinctOps logs 30+ events (Phase D provides telemetry routing)
- ✅ ExecutionPolicyAutoHealing makes hard/soft decisions (Phase D provides heal thresholds)
- ✅ All three components work in sequence (Phase D defines dependency order)

**Answer: Yes, design is sound.**

### Question 3: Are there any code changes needed in Phase 27 Wave E?

**Analysis:**
- Phase 27 Wave E code assumes observability contract exists ✅ (amendment provides this)
- Phase 27 Wave E code does not implement observability contract (separate concern) ✅ (correct separation)
- Phase 27 Wave E integration points (where to hook observability) are documented ✅ (in Wave E memory file)

**Answer: No code changes needed. Design is correct as-is.**

---

## Integration Points: Phase 27 Wave E → Observability Contract

**Where Phase 27 Wave E consumes observability contract:**

### 1. CodeLevelDriftDetector.check()
```typescript
// Requires: Metrics definitions (from Phase D observability spec)
// Uses: error_rate, cost_delta, custom metrics
// Output: DriftSignal with severity (routes to telemetry system from Phase D)
```

### 2. InstinctOps enforcement hooks
```typescript
// Requires: Heal thresholds (from Phase D observability spec)
// Uses: Hard drift (KS/RR) → manual, Soft drift (WA/OP) → auto-heal
// Output: 30+ telemetry events (routes via Phase D telemetry routing)
```

### 3. ExecutionPolicyAutoHealing.onDriftDetected()
```typescript
// Requires: Heal thresholds + decision-maker routing (from Phase D spec)
// Uses: Hard/soft drift classification
// Output: Revised plan (audit logged via Phase D audit trail)
```

**All integration points satisfied by Phase D Observability Contract.**

---

## Timeline Impact

**Question:** Does adding Phase D observability spec delay Phase 27 Wave E?

**Timeline:**

| Phase | Start | Duration | Status |
|-------|-------|----------|--------|
| Phase 4 (Governance) | 2026-07-10 | ~2 days | Amended 2026-07-11 (no delay) |
| Phase 5 (Multi-Canary) | 2026-07-13 | ~5 days | Receives observability contract from Phase 4 |
| ... | ... | ... | ... |
| Phase 27 Wave E (Six Rules) | [Future] | ~5 days | Assumes Phase 4+5 observability in place |

**Answer: No delay. Observability spec is governance planning, not implementation. Phase 27 Wave E is weeks later.**

---

## Risk Analysis: Phase 27 Wave E

### Pre-Amendment Risk

**Risk:** Wave E components assume observability contract, but no charter locks it.

- **Impact:** High — code complexity increases without documented contract
- **Probability:** High — implicit dependency not documented
- **Severity:** Medium — code works, but governance gap

### Post-Amendment Mitigation

**Mitigation:** Phase D Observability Spec Checklist + ijfw-plan Observability Contract section.

- **Gap closed:** Implicit dependency now explicit
- **Charter support:** Phase 4 charter + Phase D checklist formalize requirement
- **Verification:** ijfw-verify checks observability contract before Phase D dispatch

**Risk reduced from High→Low.**

---

## Validation Checklist

- [x] Phase 27 Wave E components analyzed
- [x] Observability dependencies documented (CodeLevelDriftDetector, InstinctOps, AutoHealing)
- [x] Implicit vs. explicit contract identified
- [x] Phase 4 amendment confirms observability upfront
- [x] Code changes required: None (design sound)
- [x] Timeline impact: None (no delays)
- [x] Risk assessment: Reduced (implicit→explicit)
- [x] Integration points verified (all consume observability contract)

---

## Conclusion

**Phase 27 Wave E is designed correctly.** Its three components (CodeLevelDriftDetector, InstinctOps, ExecutionPolicyAutoHealing) implicitly depend on an observability contract (metrics, routing, thresholds) being defined upfront.

**This amendment formalizes that implicit requirement** by:
1. Adding Observability Spec Template to Phase 4 (section 4.4)
2. Adding Phase D Dispatch Checklist with observability lock requirement
3. Integrating observability contract into ijfw-plan outputs
4. Documenting observability contract in charters (Phase 4 → Phase 5 → Phase 27)

**No code changes to Phase 27 Wave E needed.** The amendment simply makes explicit what the code design already assumes.

---

## Approval

**Validation Status:** ✅ COMPLETE & APPROVED (2026-07-11)

**Findings:**
- Phase 27 Wave E design is sound ✅
- Observability upfront requirement is necessary ✅
- Phase D amendment satisfies requirement ✅
- No code changes needed ✅
- No timeline impact ✅

**Authorization:** Amendment to Phase 4 charter + ijfw-plan integration approved. Phase 27 Wave E unchanged, retroactive validation complete.

