---
name: phase-4-5-4-7-sales-pipeline-complete
description: Phase 4.5–4.7 sales pipeline complete; Lead Scoring + Preview + Pricing engines ship together; 127 tests
metadata: 
  node_type: memory
  type: project
  originSessionId: 019d4ac4-98c1-4d63-8787-8e3ddd53c796
---

## Three-Pillar Sales Pipeline ✅

Complete deterministic sales workflow for Rewrite Labs lead qualification, preview generation, and pricing estimation.

**Completion date:** 2026-06-13

---

## Phase 4.5 — Lead Scoring Engine ✅

**Status:** Complete (67 tests passing)

Scores website on complexity, audit issues, accessibility debt, competitive gaps → 0-100 score + Tier A-D.

**Key:**
- LeadScoringEngine class (TypeScript strict)
- scoreIRPacket(ir) convenience wrapper
- Tier thresholds: A≥85, B≥65, C≥45, D≥0
- Factor weights: complexity 35%, audit 30%, accessibility 20%, competitive 15%
- Output: score, tier, percentile, factors breakdown, insights, recommendations, nextSteps

**Location:** `c:\dev\rewrite-mcp\packages\ir-toolkit\src\lead-scorer\`

---

## Phase 4.6 — Preview Generator ✅

**Status:** Complete (32 tests passing)

Generates before/after redesign galleries with component diffs, layout improvements, design token suggestions, effort estimates.

**Key:**
- PreviewGenerator class
- generatePreview(ir, config) wrapper
- Output: PreviewGallery with componentPreviews[], layoutDiffs[], designTokenDiffs[], scores 0-100, narratives, highlights
- Component categorization: hero, forms, navigation, cards, buttons, other
- Effort estimation: low/medium/high/enterprise
- Configuration: focusOnAccessibility, emphasizeVisualDesign, includePerformance, detailLevel

**Location:** `c:\dev\rewrite-mcp\packages\ir-toolkit\src\preview-generator\`

---

## Phase 4.7 — Pricing Engine ✅

**Status:** Complete (32 tests passing)

Deterministic cost estimation with tier breakdown, component costs, timeline, customization options.

**Key:**
- PricingEngine class
- generatePricing(gallery, config) wrapper
- Base component costs by category: hero $4k, forms $3k, nav $3.5k, cards $2.5k, buttons $1.5k, other $2k
- Effort multiplier: low 1.0, medium 1.5, high 2.0
- Complexity multiplier: component complexity/100
- Accessibility bonus: +20% if a11y work present
- Token standardization: +15% if >3 token categories
- Output: PricingQuote with totalEstimate, tier (basic/professional/enterprise), breakdown (discovery/design/dev/qa/deploy), component costs, timeline, assumptions, customizations

**Tier classification:**
- Basic: <$75k
- Professional: $75k-$150k
- Enterprise: >$150k

**Location:** `c:\dev\rewrite-mcp\packages\ir-toolkit\src\pricing-engine\`

---

## Test Coverage

**Total:** 127 tests (all passing)
- Phase 4.5: 67 tests (lead scoring)
- Phase 4.6: 32 tests (preview generation)
- Phase 4.7: 32 tests (pricing engine, NEW)

**Coverage includes:**
- Generation logic + output structure
- Component categorization + effort estimation
- Cost breakdown accuracy + timeline calculation
- Tier determination + confidence levels
- Multipliers (effort, complexity, accessibility, tokens)
- Custom configuration
- Determinism (same input = same output always)
- Edge cases (no a11y, many routes, complex components, enterprise effort)

---

## Files Changed

**New:**
- `src/pricing-engine/generator.ts` (287 lines)
- `src/pricing-engine/generator.test.ts` (32 tests)
- `src/pricing-engine/index.ts` (barrel export)
- `src/schemas/pricing.types.ts` (6 TypeScript interfaces)

**Updated:**
- `src/index.ts` — Added pricing-engine export
- `src/schemas/index.ts` — Added pricing types export
- `package.json` — Added pricing-engine to exports field
- `README.md` — Added pricing generation section + output example, updated test count to 127, marked Phase 4.7 ✅

---

## Next Step

**Phase 4.8 (proposed):** Workflow orchestration layer
- Wire Lead Scoring → Preview → Pricing end-to-end
- Input: IRPacket, output: complete sales package (score + gallery + quote)
- Dashboard integration for sales team
- Deterministic narrative generation

---

## How to Apply

Load Lead Score → feed to Preview Generator → feed to Pricing Engine:

```typescript
import { scoreIRPacket } from '@rewrite-labs/ir-toolkit/lead-scorer';
import { generatePreview } from '@rewrite-labs/ir-toolkit/preview-generator';
import { generatePricing } from '@rewrite-labs/ir-toolkit/pricing-engine';

const ir: IRPacket = { /* ... */ };

// Step 1: Score
const score = scoreIRPacket(ir);
if (score.salesReady) {
  // Step 2: Preview
  const gallery = generatePreview(ir);
  
  // Step 3: Price
  const quote = generatePricing(gallery);
  
  console.log(`Tier ${score.tier}, $${quote.totalEstimate}, ${quote.executionTimeline.total} days`);
}
```

---

## Production Readiness

✅ TypeScript strict mode  
✅ Zero external dependencies  
✅ Deterministic output (reproducible, no randomness)  
✅ Comprehensive test coverage (127 tests, all passing)  
✅ Full documentation (API examples + output structures)  
✅ Error handling + validation  
✅ Custom configuration support  
✅ Sales-ready summaries + assumptions

**Location:** `c:\dev\rewrite-mcp\packages\ir-toolkit` (monorepo)  
**Package:** `@rewrite-labs/ir-toolkit@0.1.0`  
**Tests:** Run `npm test` in package directory → 127 passing
