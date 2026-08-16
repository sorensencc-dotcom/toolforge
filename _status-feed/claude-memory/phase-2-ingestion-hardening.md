---
name: phase-2-ingestion-hardening
description: "Phase 2 CloakBrowser ingestion hardening plan (retries, warm pool, SPA heuristics, verticals, drift detection, dashboard)"
metadata: 
  node_type: memory
  type: project
  originSessionId: e9cdc4d5-4259-4d6a-aeb9-df0e83675fe4
---

# Phase 2: Ingestion Hardening

## Fact
CIC is entering Phase 2 of CloakBrowser integration: hardening, latency reduction, vertical expansion, observability completion.

**Why:** Phase 1 achieved 92% JS-heavy success but left optimization gaps (cold-start latency, no retries, limited verticals, no drift detection).

**How to apply:** Phase 2 execution depends on Phase 1 being locked (done). OBS-005 (dashboard rewrite) is a parallel blocker but not critical path.

## Changes (Phase 2)

- Deterministic retry layer (max 2 retries, 250ms/500ms backoff)
- CloakBrowser warm pool (2–4 sessions, reduce cold-start ~300–500ms)
- SPA-aware screenshot heuristics (`__NEXT_DATA__`, React roots, DOM stability)
- New verticals: Legal, Accounting, Home Improvement
- Multi-URL sampling (`/`, `/home`, `/services`) with DOM completeness scoring
- DLQ auto-recovery (deterministic permanent failure marking)
- Vertical drift detection (>10% drop alerts)
- Dashboard metrics integration (CloakBrowser engine, routing, errors, DLQ, drift)

## Success Criteria

- JS-heavy success ≥95% (from 92%)
- Median load time ≤2000ms (from 2208ms)
- DLQ reduction ≥50%
- Vertical drift detection operational
- Dashboard completeness 100% for Cloak metrics

## Specs

- `CLOAKBROWSER_INGESTION_HARDENING.v2.0.0.md` (consolidated PRD)
- `CLOAKBROWSER_DASHBOARD_UI_COMPONENTS.v0.1.0.md` (React/TSX specs)
- Phase 2 Linear CSV (8 tasks, dependencies mapped)

## Blockers

- OBS-005 (dashboard rewrite) — parallel track, no execution risk
- No other critical blockers

## Next Steps (Ordered)

1. Tag Phase 1 as v1.0.0 (main + cic-ingestion)
2. Wrap Phase 1 session
3. Open Phase 2 execution session
4. Start ENV-002: Retry layer spike (1.5h)

Related: [[CLOAKBROWSER_INTEGRATION]], [[api-credit-drain-fixed]]
