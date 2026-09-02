---
name: arl-phase-7-7-confidence-model
description: Phase 7.7 architecture — ARL Confidence Model (ACM) that computes deterministic weighted confidence score from composite reasoning
metadata: 
  node_type: memory
  type: project
  originSessionId: 66d93d8e-6351-44f9-9e8c-239e3ef7d224
---

# Phase 7.7 — ARL Confidence Model (ACM)

**Purpose:** Deterministic, weighted confidence score that reflects overall reliability, safety, and narrative alignment of candidate expansion.

Turns all reasoning signals (7.1–7.6) into single scalar that drives operator visibility, governance thresholds, and accept/reject decisions.

## File Structure

```
src/reasoning/arl/engine/ConfidenceModel.ts
src/reasoning/arl/contracts/Confidence.ts
```

## Contract: `Confidence.ts`

```ts
export interface ArlConfidence {
  weightedScore: number;   // 0–1
  factors: {
    coherence: number;
    semantic: number;
    temporal: number;
    causal: number;
    narrative: number;
  };
}
```

## Core Function: `ConfidenceModel.ts`

```ts
import { CompositeReasoning } from '../contracts/CompositeReasoning';
import { ArlConfidence } from '../contracts/Confidence';

export function computeArlConfidence(
  composite: CompositeReasoning
): ArlConfidence {
  return {
    weightedScore: 0,
    factors: {
      coherence: composite.coherence,
      semantic: composite.semantic,
      temporal: composite.temporal,
      causal: composite.causal,
      narrative: composite.narrative
    }
  };
}
```

## Pipeline Integration

Modify `runArl` to call `computeArlConfidence(composite)` after computing composite reasoning.

Update `synthesizeVerdict` to accept confidence parameter and use `confidence.weightedScore` as final verdict confidence.

## Stability Plane

Add to ARL section:
```json
"confidence": {
  "weightedScore": 0,
  "factors": { "coherence": 0, "semantic": 0, "temporal": 0, "causal": 0, "narrative": 0 }
}
```

## Test Blueprint

`tests/arl/ConfidenceModel.test.ts` — deterministic zeroed structure test, passing composite → ArlConfidence with all factors mirrored + weightedScore = 0.

## Unlocks

- [[arl-phase-7-8-drift-calculator]]
- [[arl-phase-7-9-reasoning-trace-formatter]]
- [[arl-phase-7-10-operator-dashboard]]
