# CIC Vision Subsystem (cic-vision-governance)

**Status:** v1.0 (TDD-complete, Method A: Gemini API)

Governed, adaptive vision analysis pipeline for the CIC Harvester. Produces normalized facts for TRM ingestion without exposing images, metadata, or provider internals.

## Architecture

### Hybrid Provider Pipeline

Fallback sequence: CLIP → BLIP → DINO/SAM → Google Vision (Method A: Gemini API)

- **Baseline:** CLIP + BLIP (fast, free)
- **Structure:** DINO + SAM (spatial, free)
- **Enrichment:** Google Vision via Gemini API (fallback, Method A)

Confidence threshold is adaptive; each call refines the bounds [0.60, 0.85].

### Governance

Threshold updates produce **pending artifacts** (`CIC-VISION-THRESHOLD` type) stored in `cic-vision-governance/artifacts/threshold/`.

Only **Chris** (ACTOR-001) ratifies artifacts → `status: 'ratified'` → threshold becomes active.

```
Update → Pending Artifact → Ratification → Active Threshold
```

Lineage is append-only, per-artifact versioned (v001, v002, ...).

### TRM Boundary

Vision subsystem returns **normalized facts only**:
- Confidence score
- Labels (structured strings)
- Regions (coordinates)

TRM never receives:
- Images
- Provider metadata or stats
- Raw confidence internals
- Threshold artifacts

## Files

```
cic-vision-governance/
  schema/
    CIC-VISION-THRESHOLD.schema.json    # Artifact schema
    lineage-log.schema.json              # Append-only log
  artifacts/threshold/
    v001.json, v002.json, ...           # Pending/ratified artifacts
  lineage/
    lineage-log.json                     # Operation log
  ratification/
    ratify-threshold.ts                  # Ratification tool
    __tests__/
      ratify-threshold.test.ts           # Ratification tests
  wrapper/
    vision-governance-wrapper.ts         # Artifact writer + loader
```

Implementation in `src/harvester/external/vision/`:
- `adaptiveThreshold.ts` — Adaptive threshold engine
- `visionAdapter.ts` — Hybrid pipeline
- `__tests__/` — Unit + integration tests

## API

### Vision Adapter

```ts
import { analyzeImage } from 'src/harvester/external/vision/visionAdapter';

const result = await analyzeImage(imageBuffer);
// { confidence: 0.82, labels: [...], regions: [...], metadata: {...} }
```

### Artifact Writer

```ts
import { writePendingThresholdArtifactFromVisionAdapter } from 'cic-vision-governance/wrapper/vision-governance-wrapper';

const artifact = await writePendingThresholdArtifactFromVisionAdapter('ACTOR-001');
// { version: 'v001', status: 'pending', ... }
```

### Ratification

```ts
import { ratifyThreshold } from 'cic-vision-governance/ratification/ratify-threshold';

await ratifyThreshold('v001', 'ACTOR-001');
// Threshold becomes active; lineage appended
```

## Configuration

**Environment Variable:**
```
GOOGLE_API_KEY=AIzaSy_...
```

Google Vision API uses Method A (Gemini, API-key auth). Key required for fallback calls.

**Threshold Bounds:**
- Min: 0.60
- Max: 0.85
- Initial: 0.72

## Testing

```bash
npm test -- src/harvester/external/vision/
npm test -- cic-vision-governance/ratification/
```

**Coverage:** 36–50 tests PASS (unit + integration)

## Next Steps

1. **Load Active Threshold on Startup** — Harvester loads latest ratified artifact at boot
2. **TRM Integration** — Vision results feed to TRM as normalized facts
3. **Method B Migration** — If volume warrants, switch to Google Cloud Vision API
4. **Dashboard** — Threshold history + ratification UI
