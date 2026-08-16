---
name: phase-27-4-team-dispatch
description: Phase 27.4 skeleton complete; all 8 critical bugs fixed; team dispatch plan created; parallel execution ready 2026-06-21
metadata:
  type: project
---

## Phase 27.4 Status: Teams A–D Dispatch

**Date:** 2026-06-21
**State:** Skeleton + critical fixes merged to master
**Next:** Parallel team execution (36 hours, completion target 2026-06-22 18:00 UTC)

## Commits (Merged)

**cic repo:**
- e757089 — Budget Ledger API + Fallback async fix + SLO Controller Prometheus queries + kubectl scale
- 2b38626 — Circuit breaker p95 window + HALF_OPEN race fix
- 35dffbe — SLO Controller threshold evaluation

**main repo:**
- 38668c4 — Canary rollout kubectl scale
- b1feed1 — Prometheus burn-rate windows (1h slow, 5m fast)

## Critical Fixes Verified

All 8 findings from code review CONFIRMED + FIXED:
1. ✅ Budget Ledger API contract (camelCase, txn_ref, error schema)
2. ✅ Fallback chain async/await mismatch (sync handlers)
3. ✅ Canary rollout kubectl command (scale not set)
4. ✅ Prometheus burn-rate windows (1h slow, 5m fast)
5. ✅ SLO Controller Prometheus queries wired
6. ✅ SLO Controller threshold evaluation added
7. ✅ Circuit breaker p95 from window (not single request)
8. ✅ Circuit breaker HALF_OPEN admission race (atomic increment)

## Team Dispatch Plan

See: `c:\dev\PHASE_27_4_DISPATCH.md`

**Team A — Budget Ledger DB Wiring** (5 TODOs)
- Duplicate txn_ref check + storage
- Account balance queries
- Reconciliation worker + Postgres schema

**Team B — SLO Controller Prometheus Integration** (6 TODOs)
- Redis state persistence
- Adapter gateway /control calls
- Budget ledger transaction emission
- Prometheus metrics export
- PagerDuty alerting

**Team C — Adapter Gateway Integration** (4 TODOs)
- Primary adapter API handler
- Redis cache secondary handler
- LaunchDarkly canary stage gates
- Response caching

**Team D — Fire Drill Scenarios** (5+ TODOs)
- FD-01 latency spike (inject → observe → cleanup)
- FD-02 through FD-20 degradation scenarios
- Assertion framework

## Dependency Graph

A → B → C ← B
         ↓
         D (all)

**Critical Path:** A, B, C parallel; D serial after all complete.

## Success Criteria

- ≥98% unit test pass rate per team
- All fire-drill scenarios pass
- Canary gates: error_rate <1%, latency <600ms, drift <0.1%

## Timeline

- **Dispatch:** 2026-06-21 15:00 UTC
- **Completion target:** 2026-06-22 18:00 UTC (36 hours)
- **Canary rollout:** 2026-06-23 (post-fire-drill validation)

## Related

- [[phase-27-m1-commit]] — Prior M1 with registry + policy engine
- [[phase-27-4-skeleton-implementation]] — Skeleton files (prior session)