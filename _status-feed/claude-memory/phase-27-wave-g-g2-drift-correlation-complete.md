---
name: phase-27-wave-g-g2-drift-correlation-complete
description: Phase 27 Wave G — G.2 Cross-Wave Drift Correlation Graph complete — 5 patterns, 18 tests PASS
metadata:
  type: project
  originSessionId: bd3a8b0d-47f8-4f0f-a511-393c978880be
---

# Phase 27 Wave G — G.2 Drift Correlation Graph ✅ COMPLETE

**Date:** 2026-07-08  
**Duration:** Wave G.2 implementation (follows G.1)  
**Status:** Ready for integration with Wave G.3 Resume Gate  
**Commit:** aae3832 (cic-ingestion submodule)

## What Was Built

Cross-wave drift correlation engine that traces drift signals across Waves B–F to identify root causes and recommend healing primitives.

### Correlation Patterns (5 total)

1. **B→F: Planning Ambiguity → Refactor Drift**
   - Confidence: 0.85
   - Trigger: KITCHEN_SINK in B (ambiguous scope), RUNAWAY_REFACTOR in F (cascading changes)
   - Root cause: Plan definition did not specify scope boundaries
   - Example: Plan expects [src/core], code touches [src/core, src/utils, src/types, src/config]

2. **C→E: Dependency Creep → Healing Loop**
   - Confidence: 0.80
   - Trigger: New imports in C (unjustified), WRONG_ABSTRACTION in E (duplication)
   - Root cause: Dependency added without architectural review
   - Example: Import lodash + moment without justification → duplication in repair

3. **D→F: Debug Misdiagnosis → Drift Escalation**
   - Confidence: 0.75
   - Trigger: OPTIMISTIC_PATH in D (missing error handling), escalation in F
   - Root cause: Debug fix addressed symptom not root cause
   - Example: Added passing tests instead of error tests → drift escapes to F

4. **E→F: Healing Failure → Runaway Drift**
   - Confidence: 0.70
   - Trigger: Repair/healing in E, RUNAWAY_REFACTOR in F
   - Root cause: Healing primitive did not address underlying issue
   - Example: Repair succeeded but broke architecture → cascade refactor in validation

5. **F→B: Detected Drift → Replan**
   - Confidence: 0.65
   - Trigger: CRITICAL drift in F, replanning needed
   - Root cause: Original plan was insufficient or execution diverged
   - Feedback loop: Drift signals trigger plan regeneration

### Correlation Algorithm (6-step)

1. **Group by Wave** — Partition events by source wave B–F
2. **Pattern Matching** — Check for related failure modes + file overlap
3. **Confidence Scoring** — Base score × wave escalation (up to 1.0)
4. **Root Cause Tracing** — Walk backwards through edges (max 5 hops)
5. **Vector Generation** — Build CorrelatedDriftVector with recommendations
6. **Deduplication** — Merge events with same root cause + mode

### Output: CorrelatedDriftVector

```typescript
{
  sourceWave: 'F',           // Where detected
  rootCauseWave: 'B',        // Traced back to origin
  failureMode: 'RUNAWAY_REFACTOR',
  severity: 0.85,            // 0.0–1.0, escalated by wave count
  correlatedEvents: [        // Multi-wave chain
    { wave: 'B', failureMode: 'KITCHEN_SINK', ... },
    { wave: 'F', failureMode: 'RUNAWAY_REFACTOR', ... }
  ],
  recommendedPrimitives: [   // G.1 healing strategies
    'heal.shrink_scope',
    'heal.tighten_criteria',
    'heal.enforce_surgical_diff',
    'heal.freeze_architecture'
  ],
  confidence: 0.82,          // Correlation strength (0.0–1.0)
  description: 'Multi-wave drift: RUNAWAY_REFACTOR detected in Wave F, originating from Wave B. Affected waves: B,F',
  timestamp: 1720435200000
}
```

## Deliverables

✅ **DriftCorrelationGraph.ts** (330 lines)
- recordEvent() — add drift signal
- correlate() — analyze cross-wave patterns
- recommendPrimitives() — G.1 healing strategies per failure mode
- buildCorrelationMatrix() — 5×5 confidence table
- traceRootCause() — walk backwards to origin
- Helper methods for overlap detection, severity computation, description building

✅ **DriftCorrelationGraph.test.ts** (450 lines, 18 tests)
- Single-wave events (baseline)
- B→F planning ambiguity correlation
- C→E dependency creep correlation
- D→F debug misdiagnosis
- E→F healing failure
- F→B replan trigger
- Primitive recommendation per failure mode
- Severity computation + escalation
- Correlation matrix validation
- Root cause tracing
- Multi-wave chains (B→C→E→F)
- Confidence scoring
- All 18 PASS ✅

✅ **g.drift.correlation.graph.yaml** (200+ lines)
- Pattern definitions (B→F, C→E, D→F, E→F, F→B)
- Algorithm walkthrough (6-step process)
- Output type schemas (CorrelatedDriftVector, WaveDriftEvent)
- G.1 integration points
- Correlation matrix (5×5 confidence table)
- Visualization (graph structure)
- Failure mode transitions
- Telemetry fields

## Test Results

```
PASS  src/autonomy/DriftCorrelationGraph.test.ts
  DriftCorrelationGraph
    Single Wave Events
      ✓ records single drift event
      ✓ returns empty correlation for isolated event
    B→F: Planning Ambiguity → Refactor Drift
      ✓ correlates planning ambiguity to refactor drift
    C→E: Dependency Creep → Healing Loop
      ✓ correlates dependency creep to healing activation
    D→F: Debug Misdiagnosis → Drift Escalation
      ✓ traces misdiagnosed fix to escalated drift
    E→F: Healing Failure → Runaway Drift
      ✓ detects healing attempt followed by escalation
    F→B: Drift Triggers Replan
      ✓ identifies drift requiring plan regeneration
    Recommended Primitives
      ✓ recommends shrink_scope + tighten for KITCHEN_SINK
      ✓ recommends abstraction for WRONG_ABSTRACTION
      ✓ recommends inject_negative for OPTIMISTIC_PATH
      ✓ recommends surgical + freeze for RUNAWAY_REFACTOR
    Severity Computation
      ✓ single HIGH event scores 0.75
      ✓ escalates severity with multiple waves
    Correlation Matrix
      ✓ builds correlation matrix
      ✓ matrix has confidence values
    Root Cause Tracing
      ✓ traces drift to root cause wave
    Multi-Wave Drift Patterns
      ✓ detects complete chain: B→C→E→F
    Confidence Scoring
      ✓ high confidence for multi-wave correlation

Tests:       18 passed, 18 total
```

## Correlation Matrix

5×5 confidence table (rows: source, cols: target):

```
       B    C    D    E    F
    B  —   0.55 0.50 0.60 0.85
    C  —   —    0.55 0.80 0.60
    D  —   —    —    0.60 0.75
    E  —   —    —    —    0.70
    F  0.65 —    —    —    —
```

**Key:** F→B allows feedback loop (replan), most patterns flow forward (B→F cascade), diagonal represents sequential phase flow.

## Integration with G.1 Healing Primitives

**Input:** DriftSignal[] from Wave B–F execution

**Processing:**
1. G.2 receives accumulated drift events
2. Correlates across waves to find root cause
3. Traces back 5 hops max through pattern edges
4. Computes severity as weighted average (escalated by wave count)
5. Recommends G.1 healing primitives based on failureMode + rootCauseWave

**Output:** CorrelatedDriftVector[]
- Identifies which wave originated problem
- Lists all affected waves in chain
- Recommends specific G.1 primitives (shrink_scope, tighten_criteria, etc.)
- Confidence score for pattern strength

**Flow to G.3:**
- CorrelatedDriftVector → G.3 Resume Gate
- Gate validates revised plan/criteria from G.1
- If approved: resume with healing applied
- If denied: escalate to human review

## Failure Mode Transitions

Tracked across waves:

- **KITCHEN_SINK** → RUNAWAY_REFACTOR (scope creep cascades)
- **KITCHEN_SINK** → WRONG_ABSTRACTION (duplicated logic emerges)
- **OPTIMISTIC_PATH** → WRONG_ABSTRACTION (skipped error paths)
- **OPTIMISTIC_PATH** → RUNAWAY_REFACTOR (error recovery attempts cascade)
- **WRONG_ABSTRACTION** — contained (no further transition)
- **RUNAWAY_REFACTOR** — highest severity (stops execution)

## Metrics

- **Patterns:** 5/5 defined (B→F, C→E, D→F, E→F, F→B)
- **Test Cases:** 18/18 PASS
- **Code Quality:** 0 TS errors
- **Confidence Range:** 0.65–0.85
- **Max Traceback:** 5 hops
- **Wave Count:** 5 (B, C, D, E, F)

## What's Next

**Wave G.3:** Resume-Gate Logic
- Validate revised acceptance criteria exist
- Check for cross-wave contradictions
- Decide resume approval (hard vs soft drift)
- Output: resume.allowed = true|false

**Wave G.4:** Multi-Wave Telemetry Stitching
- Collect unified drift + healing history from Waves B–F
- Create single dashboard for root cause analysis
- Phase 28 entry point

## Related

- [[phase-27-wave-g-g1-healing-primitives-complete]] — G.1 (predecessor, provides primitives)
- [[phase-27-wave-f-verification-complete]] — Wave F (drift detector, provides signals)
- [[phase-27-wave-e-six-rules-framework]] — Wave E (Six Rules, feeds events to G.2)
