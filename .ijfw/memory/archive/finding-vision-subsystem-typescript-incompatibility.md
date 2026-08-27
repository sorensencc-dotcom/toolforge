---
name: finding-vision-subsystem-typescript-incompatibility
description: Vision subsystem files (.ts) incompatible with project's .js test runner; blocks Harvester wiring (Task 13)
metadata:
  type: project
---

## Finding: Vision Subsystem TypeScript Incompatibility

**Status:** Blocker for Task 13 (Harvester integration)

**Issue:** Previous session (commit 372cbec) committed vision subsystem as TypeScript (.ts) files:
- src/harvester/external/vision/adaptiveThreshold.ts
- src/harvester/external/vision/visionAdapter.ts
- src/harvester/external/vision/__tests__/*.test.ts
- cic-vision-governance/ratification/ratify-threshold.ts
- cic-vision-governance/wrapper/vision-governance-wrapper.ts

But project uses .js exclusively. Test runner (npm test) only runs .js files. Cannot require .ts files from .js.

**Verification:** 
- Tried `require('./visionAdapter')` from index.js → "Cannot find module"
- Verified no compiled .js versions exist in dist/, build/, or project root
- Git confirms files are committed as .ts in 372cbec

**Resolution Options:**
1. Convert all 12+ .ts files to .js (mechanical, low risk, ~1-2 hours)
2. Add TypeScript compilation to build/test pipeline (higher complexity, config)
3. Defer to future session; note as technical debt

**Recommendation:** Option 1. Convert to .js to unblock Harvester wiring. TypeScript setup can be added later if needed.

**Next:** Convert vision .ts files to .js if proceeding with Task 13.
