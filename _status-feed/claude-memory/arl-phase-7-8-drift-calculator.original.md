---
name: arl-phase-7-8-drift-calculator
description: "Phase 7.8 architecture — ARL Drift Impact Calculator (DIC) that computes unified drift vector from semantic, temporal, narrative, causal signals"
metadata: 
  node_type: memory
  type: project
  originSessionId: 66d93d8e-6351-44f9-9e8c-239e3ef7d224
---

# Phase 7.8 — Drift Impact Calculator (DIC)

**Purpose:** Deterministic drift signal reflecting how much a candidate expansion pushes CIC away from stable narrative, semantic, and temporal centerline.

Turns all reasoning signals (7.1–7.6) into unified drift vector consumed by Stability Plane, CognitionPanel, and BOB.

Evaluates: semantic drift, temporal drift, narrative drift, causal drift, composite drift, direction (positive/neutral/negative), magnitude (0–1).

## File Structure

```
src/reasoning/arl/engine/DriftImpactCalculator.ts
src/reasoning/arl/contracts/DriftImpact.ts
```

## Contract: `DriftImpact.ts`

```ts
export interface DriftImpact {
  semanticDrift: number;     // -1 to +1
  temporalDrift: number;     // -1 to +1
  narrativeDrift: number;    // -1 to +1
  causalDrift: number;       // -1 to +1
  compositeDrift: number;    // -1 to +1
  overall: number;           // -1 to +1
}
```

## Core Function: `DriftImpactCalculator.ts`

```ts
import { DriftImpact } from '../contracts/DriftImpact';
import { SemanticAlignment } from '../contracts/SemanticAlignment';
import { TemporalConsistency } from '../contracts/TemporalConsistency';
import { NarrativeImpact } from '../contracts/NarrativeImpact';
import { CausalReasoning } from '../contracts/CausalReasoning';
import { CompositeReasoning } from '../contracts/CompositeReasoning';

export function computeDriftImpact(
  semantic: SemanticAlignment,
  temporal: TemporalConsistency,
  narrative: NarrativeImpact,
  causal: CausalReasoning,
  composite: CompositeReasoning
): DriftImpact {
  return {
    semanticDrift: 0,
    temporalDrift: 0,
    narrativeDrift: 0,
    causalDrift: 0,
    compositeDrift: 0,
    overall: 0
  };
}
```

## Pipeline Integration

Modify `runArl` to call `computeDriftImpact(semantic, temporal, narrative, causal, composite)` after computing confidence.

Update `synthesizeVerdict` to accept drift parameter and use `drift.overall` as `driftImpact` in returned `ReasoningVerdict`.

## Stability Plane

Add to ARL section:
```json
"drift": {
  "semanticDrift": 0,
  "temporalDrift": 0,
  "narrativeDrift": 0,
  "causalDrift": 0,
  "compositeDrift": 0,
  "overall": 0
}
```

## Test Blueprint

`tests/arl/DriftImpactCalculator.test.ts` — deterministic zeroed structure test, passing all inputs → DriftImpact with all component drifts = 0, overall = 0.

## Unlocks

- [[arl-phase-7-9-reasoning-trace-formatter]]
- [[arl-phase-7-10-operator-dashboard]]
- [[arl-phase-7-11-weighting-model]]
