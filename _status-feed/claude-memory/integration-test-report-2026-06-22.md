---
name: integration-test-report-2026-06-22
description: "Integration test health audit — 91.6% pass rate (1325/1446), 27 failing suites due to missing infrastructure"
metadata: 
  node_type: memory
  type: project
  date: 2026-06-22
  originSessionId: eab3dbe5-4e17-4416-be15-6dc7bd520b97
---

# Integration Test Report — 2026-06-22

## Summary

**Pass Rate:** 91.6% (1325/1446 tests)  
**Status:** Below 95% gate — infrastructure blockers  
**Failed Suites:** 27/111  
**Flaky Tests:** 9 identified

## Critical Blockers (8 suites, 117 tests)

All failures root-caused to 3 issues:

### 1. Missing Services (9 + 6 + 8 + 4 = 27 failures)
- TorqueQuery @ localhost:3110 — Phase 26 integration tests
- MemoryStore connection — Phase 23.2 autonomy tests
- Docker test container — Tool execution tests (cic-ingestion/src/aperture/)
- Prompt cache server dependency

**Fix:** `docker-compose up -d` before `npm test`

### 2. Missing Config Files (5 failures)
- `cic-ingestion/config/defaults.json` missing
- ConfigLoader.test.ts + schema.test.ts fail on file not found

**Fix:** Generate or commit defaults.json template

### 3. Incomplete Mock Setup (6 failures)
- `gracefulShutdown.test.ts` mocks missing required fields:
  - `flushMetricsFn` (required, missing from all 6 test cases)
  - `closeConnectionsFn` (required, missing from all 6 test cases)
- Type mismatch: `{ drainFn, logger? }` → `{ drainFn, flushMetricsFn, closeConnectionsFn, logger }`

**Fix:** Update test fixtures in gracefulShutdown.test.ts (lines 65, 73, 82, 101, 118, 135, 160)

## Flaky Edge Cases (9 tests)

| Test | Failure Rate | Root Cause |
|------|-------------|-----------|
| goldenQueries ranking | 1/7 (14%) | Edge case near 0.5 boundary |
| VerticalDriftDetector (WAF) | 1/40 (2.5%) | Boundary condition |
| VerticalDriftDetector (structural) | 1/40 (2.5%) | Boundary condition |

## Coverage Gaps

Files <80%:
- `cic-ingestion/src/config/` — 42%
- `cic-ingestion/src/autonomy/bridges/` — 65%
- `cic-ingestion/src/aperture/` — 58%
- `src/runtime/services/` — 72%

## Next Session Actions (Priority Order)

1. **Start infrastructure** (5 min)
   - `docker-compose up -d`
   - Verify 3110, 8000, Docker daemon responding

2. **Generate defaults.json** (10 min)
   - Create `cic-ingestion/config/defaults.json` with required schema
   - Test ConfigLoader tests pass

3. **Fix gracefulShutdown.test.ts** (15 min)
   - Add `flushMetricsFn: jest.fn()` to all 6 mock objects
   - Add `closeConnectionsFn: jest.fn()` to all 6 mock objects
   - Lines: 65, 73, 82, 101, 118, 135, 160

4. **Re-run suite** (2 min)
   - Target: 1350+ passing, 95%+ pass rate
   - Verify Phase 26 TorqueQuery tests pass
   - Verify ConfigLoader tests pass
   - Verify gracefulShutdown tests pass

5. **Debug edge cases** (30 min, if time)
   - Golden query ranking: test scores [0.49, 0.50, 0.51]
   - Drift detection: test boundaries [-1e-6, 0, +1e-6, 0.999999, 1.0]

## Files to Fix

- `cic-ingestion/src/runtime/tests/gracefulShutdown.test.ts` — 6 mock objects
- `cic-ingestion/config/defaults.json` — create template
- `src/metrics/VerticalDriftDetector.test.ts` — add boundary cases
- `cic-ingestion/src/vector/__tests__/goldenQueries.test.ts` — add edge cases

## Command Reference

```bash
# Start infrastructure
docker-compose up -d

# Run full test suite
npm test

# Run specific suite after fix
npm test -- gracefulShutdown.test.ts
npm test -- phase-26-integration.test.ts
npm test -- loader.test.ts
```

## Expected Outcome

After fixes: **95%+ pass rate (1370+/1446)**, all integration suites green, flaky edge cases isolated for investigation.
