---
name: drift-2026-07-14-cic-design-enforcement
description: Pattern of CIC design system violations across waves; need pre-code design gate
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ccf05dba-5b2e-42cb-914e-45473bad602b
---

**Pattern:** Phase 9 Waves A-B shipped with design violations (3x in single session).

**Incidents:**
1. **Wave A:** No design system enforcement mentioned; schema/API shipped without visual review gate.
2. **Wave B-1:** Purple gradient header (#667eea) instead of Cast Iron Charlie → drift-2026-07-14-ui-design-system (discovered mid-build).
3. **Wave B-2:** Light background theme instead of dark → required full refactor.

**Root Cause:** Pre-code design check skipped. CSS written without reference design review. Built → tested → THEN caught drift.

**Why It Happened:** Speed bias. Phase 9 charter locked, builder (Antigravity) shipped components fast. No conformance gate between "code ready" and "design conformance check."

**Impact:** 3 commits fixing styling instead of 1 right-first-time. ~400 LOC rewritten. Burn on design authority (Cast Iron Charlie wasn't referenced until user pointed to it).

**Fix:** Pre-code design gate for all artifact-bearing waves.

**Design Enforcement Checklist (BEFORE coding):**
- [ ] Identify design system (CIC? Cast Iron Charlie? Other?)
- [ ] Verify current design reference exists + is accessible
- [ ] Document palette, typography, layout, tone in charter
- [ ] Create sample component (button, card, header) in target design
- [ ] Review sample with Tier 1 before full build
- [ ] Link design reference in code comments

**How to Apply:**
- Charter phase: name design system explicitly (not implicit)
- Wave dispatch: include design review as prerequisite to code start
- Builder wave: review design before first commit
- Post-build: audit sample components, fix systemic drift

**Prevention:** Charter + kickoff should make design system non-optional, not a courtesy.

**Related:** [[cic-design-system-preference]], [[drift-incident-2026-07-13-dashboard]], [[workflow-checklists-embedded]] (add design pre-check)
