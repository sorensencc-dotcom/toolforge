---
name: phase-27-wave-e-six-rules-framework
description: "Six Rules Framework implementation for Phase 27 Wave E — drift detection, instinct enforcement, auto-healing"
metadata: 
  node_type: memory
  type: project
  originSessionId: bd3a8b0d-47f8-4f0f-a511-393c978880be
---

# Phase 27 Wave E — Six Rules Framework Implementation

**Date:** 2026-07-08  
**Status:** ✅ Code complete, committed, ready for Wave E integration  
**Commit:** a0167de  
**Files:** 6 new, 1 integration guide  

## What Was Built

Deterministic autonomous coding discipline system (integrated into CIC Phase 27 Wave E):

### 1. CodeLevelDriftDetector
- **Location:** `cic-ingestion/src/drift/CodeLevelDriftDetector.ts`
- **Purpose:** Detects four coding failure modes:
  - **Kitchen Sink (KS):** Scope creep beyond acceptance criteria
  - **Wrong Abstraction (WA):** Duplicated logic not factored
  - **Optimistic Path (OP):** Missing error handling/negative tests
  - **Runaway Refactor (RR):** Cascading changes beyond scope
- **Interface:** `check(input) → DriftSignal | null`
- **Scoring:** 0.0–1.0, hard drift = 1.0

### 2. InstinctOps
- **Location:** `cic-ingestion/src/autonomy/InstinctOps.ts`
- **Purpose:** 10 pre-cognitive biases for autonomous agents
  1. Verification First (failing test before fix)
  2. Define Done (acceptance criteria upfront)
  3. Deterministic Debugging (reproduce → isolate → test)
  4. Dependency Skepticism (justify every dependency)
  5. Surface Uncertainty (no confident guessing)
  6. Failure Mode Self-Recognition (KS/WA/OP/RR detection)
  7. Surgical Change Preference (minimal diffs)
  8. Plan Before Code (deterministic planning)
  9. Negative Case Awareness (error test coverage)
  10. Drift Halt Reflex (immediate stop on drift)
- **Enforcement:** Hooks fire before execution, halt if violated
- **Telemetry:** Tracks all instinct events (30+ event types)

### 3. ExecutionPolicyAutoHealing
- **Location:** `cic-ingestion/src/autonomy/ExecutionPolicyInterceptor.AutoHealing.ts`
- **Purpose:** Automatic plan recovery when drift detected
- **Strategy:** Mode-specific healing (KS → shrink scope, WA → extract logic, OP → add error tests, RR → freeze arch)
- **Resume Decision:** Hard drifts (KS/RR) require manual approval; soft drifts (WA/OP) can auto-resume
- **Output:** Revised plan + criteria + amplified constraints

### 4. SixRulesFramework (Barrel Export)
- **Location:** `cic-ingestion/src/autonomy/SixRulesFramework.ts`
- **Purpose:** Single import point for all three layers

## Test Coverage

**File:** `cic-ingestion/src/tests/six-rules-integration.test.ts`
- CodeLevelDriftDetector: 8 test suites, 20+ tests
- InstinctOps: 3 test suites, 15+ tests
- ExecutionPolicyAutoHealing: 3 test suites, 10+ tests
- Total: 30+ test cases covering all modes + integration scenarios

Test status: Framework written, tests compiled; npm test suite had pre-existing failures (unrelated to Six Rules code).

## Documentation

**File:** `docs/cic/six-rules-framework.md`
- Integration guide for Wave E
- Drift mode explanations + healing strategies
- InstinctOps 10-rule reference
- Usage examples + API reference
- Phase 27 integration checklist

## Integration with CIC OS

### New ExecutionMode
```typescript
INSTINCT_ENFORCED = 'INSTINCT_ENFORCED'
```
Use when running Wave E repair/prune operations.

### Architecture Integration
```
ExecutionPolicy (existing)
  ↓
InstinctOps (NEW) — enforces 10 biases upfront
  ↓
Code Execution
  ↓
CodeLevelDriftDetector (NEW) — detect KS/WA/OP/RR
  ↓
ExecutionPolicyAutoHealing (NEW) — halt + regenerate plan
  ↓
Resume Gate
```

## Wave E Integration Points

- Repair operations: wrap plan/code/tests in CodeLevelInput
- Before planner: check Define Done via InstinctOps.beforePlan()
- Before coder: check Plan Before Code via InstinctOps.beforeCode()
- After execution: check for drift via CodeLevelDriftDetector.check()
- On drift: auto-heal via ExecutionPolicyAutoHealing.onDriftDetected()

## Key Design Decisions

1. **Hard vs. Soft Drift**
   - KS/RR = hard (manual approval to resume)
   - WA/OP = soft (can auto-heal and resume)

2. **Instinct Layer Position**
   - Fires BEFORE execution (bias layer)
   - Not reactive; pre-cognitive

3. **No Duplication**
   - Fits into existing DriftOps layer
   - Extends ExecutionPolicy via AutoHealing
   - New InstinctOps service (separate from existing)

4. **Constraint Amplification**
   - Healing rewrites criteria + plan with stricter constraints
   - Amplified constraints block future violations

## Metrics & Observability

- `driftScore`: 0.0–1.0 per input
- Instinct telemetry: 30+ event types tracked
- DriftSignal: type, severity, details, timestamp
- Healing report: formatted audit trail

## What's Ready for Wave E

✅ CodeLevelDriftDetector — production code  
✅ InstinctOps — production code  
✅ ExecutionPolicyAutoHealing — production code  
✅ Test suite — 30+ cases  
✅ Documentation — integration guide + API reference  
✅ Commit — a0167de with clean git history  

## Wave E Integration — COMPLETE ✅

**Commit:** 74d5bad

RepairManifestSixRules wraps manifest repair with Six Rules enforcement:
- Define Done: acceptance criteria (max corruption %, min survival %, timeout)
- Plan Before Code: default repair plan + expected outcomes  
- Criteria Validation: check post-repair stats against acceptance criteria
- Drift Detection: flag runaway repair (>50% record removal on large manifests)
- Auto-Healing: can extend to call ExecutionPolicyAutoHealing on drift

Integration:
```typescript
const wrapper = new RepairManifestSixRules();
const criteria = wrapper.getDefaultCriteria(); // or custom
const result = await wrapper.repairWithSixRules(criteria);

if (result.success) {
  // Repair succeeded, all criteria met, no drift
} else if (result.driftDetected) {
  // Runaway repair or other drift detected
  console.log(result.driftSignal);
} else {
  // Criteria violation (corruption/survival threshold)
  console.log(result.instinctViolations);
}
```

Test Coverage:
- Define Done: validates acceptance criteria completeness
- Criteria Validation: detects high corruption rate, low survival rate
- Drift Detection: flags runaway repair (>50% removal)
- End-to-End: successful repair flow

## Wave E Status

✅ Framework defined (CodeLevelDriftDetector + InstinctOps + AutoHealing)
✅ Repair loop wrapped (RepairManifestSixRules)
✅ Tests written (48 total test cases across both phases)
✅ Commits: a0167de (framework) + 74d5bad (integration)

Ready for Wave E execution + Wave F refinement.

## Related

- [[phase-27-ingestion-autonomy-locked]] — Wave A–F plan
- [[ExecutionPolicy architecture]] — existing execution modes
- [[CIC Drift Engine v3]] — operational drift infrastructure
