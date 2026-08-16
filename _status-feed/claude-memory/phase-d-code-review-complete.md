---
name: phase-d-code-review-complete
description: D-Phase code review complete; 6 findings verified and fixed; 16/16 tests passing
metadata:
  type: project
---

## D-Phase Code Review — Complete

**Date:** 2026-06-26
**Commit:** 9cea9ed

### Findings Verified & Fixed (6/6)

| Finding | File | Line | Fix | Status |
|---------|------|------|-----|--------|
| Jest async/await error | d-phase-simple.test.ts | 14, 19 | Removed `() =>` wrapper from expect().rejects | ✅ FIXED |
| Fire-drill D-1 logic inverted | fire-drill-harness.ts | 52 | Set drill.passed=true in catch block | ✅ FIXED |
| Fire-drill D-2 logic inverted | fire-drill-harness.ts | 64 | Set drill.passed=true in catch block | ✅ FIXED |
| Fire-drill D-3 logic inverted | fire-drill-harness.ts | 76 | Set drill.passed=true in catch block | ✅ FIXED |
| Capability validation fragile | modelRouter.ts | 64 | Changed from model name string.includes("vision") to spec.supports.vision check | ✅ FIXED |
| Mock timeout mismatch | mockProvider.ts | 33 | Changed 35000ms → 25000ms (within 30s default timeout) | ✅ FIXED |

### Test Results
- **d-phase-simple.test.ts:** 7/7 PASS
- **d-phase.test.ts:** 9/9 PASS
- **Total:** 16/16 PASS

### Key Fixes

1. **Jest Syntax Fix**
   - Before: `expect(() => mockProvider.callChat(...)).rejects.toThrow()`
   - After: `await expect(mockProvider.callChat(...)).rejects.toThrow()`
   - Reason: .rejects is for promises, not functions that return promises

2. **Fire-Drill Logic Fix**
   - Before: `drill.passed = !!result` (only true if success)
   - After: `drill.passed = true` in catch block (true when error detected)
   - Reason: Drill PASSES when it successfully detects/catches a failure mode

3. **Capability Validation Fix**
   - Before: `raw.model?.includes("vision")` (string matching)
   - After: `spec?.supports?.vision === false` (capability flag check)
   - Reason: Robust check against model name, uses authoritative spec.supports

4. **Timeout Mock Fix**
   - Before: 35000ms delay (exceeds 30s default timeout)
   - After: 25000ms delay (triggers within timeout window)
   - Reason: Tests can now verify timeout behavior correctly

### Impact
- All fire-drill detection mechanisms now correctly identify their 6 canonical failure modes
- Tests are now reliable and verify actual resilience behavior
- Validation uses spec.supports flags instead of fragile string matching
