---
name: phase-8-cost-optimization-locked
description: "Phase 8 architecture locked — cost optimization + dynamic model selection. Integration with Phase 7 state machine. 10 files, 3-day implementation plan."
metadata: 
  node_type: memory
  type: project
  originSessionId: 969cacd2-ffc8-4ac9-bee9-157ef801db11
---

# Phase 8: Cost Optimization + Dynamic Model Selection — Architecture Locked

**Status:** Implementation complete. All 10 files coded, compiled, committed.  
**Completed:** 2026-06-23  
**Scope:** 10 files, 860 LOC, 4 phases (8.0–8.4), Phase 7 integration ready.

**Commits:**
- 71f7b5c: Phase 8.0 — types (RequestContext, ModelDescriptor, CostEvent)
- 832e36c: Phase 8.1 — telemetry + cost model
- 081b20d: Phase 8.2 — forecast + policy
- 89bbfda: Phase 8.3 — model router + coordinator
- b373620: Phase 8.4 — CIC integration adapter (complete)

---

## Core Objectives

- Minimize cost **without violating SLA**
- Dynamically select models based on **cost, latency, drift, accuracy**
- Enforce **budget ceilings** + auto-downgrade/upgrade
- Integrate with Phase 7's **state machine + drift + SLA signals**

---

## Architecture Layers (A–D)

### A. Phase 8 ↔ Phase 7 Integration

**New state machine inputs:**
- `costPressureLevel` (LOW / MEDIUM / HIGH)
- `budgetStatus` (WITHIN_BUDGET / SOFT_CEILING / HARD_CEILING)

**New state paths:**
- ONLINE → DEGRADED_COST (cost pressure, SLA OK)
- ONLINE → OFFLINE (hard budget ceiling)
- DEGRADED/OFFLINE → ONLINE (cost recovered)

**Signals flow:**
- Cost windows (5m, 1h, 24h) fed to state evaluator every 10s loop
- Policy decision (ALLOW/DOWNGRADE/BLOCK) → routing middleware

**Why:** Cost and SLA are inseparable. State machine must know when cost pressure forces downgrade.

---

### B. Prometheus Metrics (11 core signals)

1. `cic_cost_total_usd` — cumulative cost
2. `cic_cost_request_usd` — per-request histogram
3. `cic_cost_input_tokens` — input token counter
4. `cic_cost_output_tokens` — output token counter
5. `cic_cost_daily_spend_usd` — rolling 24h gauge
6. `cic_cost_budget_soft_ceiling_active` — soft ceiling binary
7. `cic_cost_budget_hard_ceiling_active` — hard ceiling binary
8. `cic_cost_policy_decisions_total` — decision counter
9. `cic_cost_anomaly_score` — forecast anomaly gauge
10. `cic_cost_model_selection_changes_total` — routing changes
11. `cic_cost_downgrade_events_total` — downgrades due to pressure

**Labels:** `agent_id`, `model_id`, `tenant_id`, `priority`, `operation_type`, `horizon`, `decision`, `reason`

---

### C. Audit Events (5 types)

1. **COST_POLICY_DECISION** — daily spend vs ceilings
2. **MODEL_ROUTING_DECISION** — selected model + rationale
3. **COST_DEGRADATION_ENTERED** — state transition reason
4. **COST_HARD_CEILING_ENFORCED** — budget blocked
5. **COST_RECOVERY_INITIATED** / **COST_RECOVERY_COMPLETED** — recovery sequence

**Shape:** `{id, timestamp, type, actor, context, payload}`. Deterministic, CIC-grade.

---

### D. Implementation Plan (Locked)

**10 files, 3 days, 4 phases (8.0–8.4)**

#### Phase 8.0 — Types (Day 1 AM, 2–3h)
Files: 1–3 (RequestContext, ModelDescriptor, CostEvent)
Gate: All types compile, no runtime code

#### Phase 8.1 — Telemetry + Model (Day 1 PM, 3–4h)
Files: 4–5 (CostTelemetryCollector, CostModel)
Gate: 100% cost math coverage, no rounding errors

#### Phase 8.2 — Forecast + Policy (Day 2 AM, 3–4h)
Files: 6–7 (CostForecastEngine, CostPolicyEngine)
Gate: Forecast validated, policy logic deterministic

#### Phase 8.3 — Router (Day 2 PM, 4–5h)
Files: 8–9 (ModelCapabilityRegistry, DynamicModelRouter, SLAAndCostCoordinator)
Gate: All routing paths covered, deterministic tie-breaking

#### Phase 8.4 — CIC Integration (Day 3, 3–4h)
File: 10 (CICIntegrationAdapterPhase8)
Gate: E2E request → decision → telemetry, Phase 7 hooks in place

---

## File List (Locked)

Directory: `cic/src/analyzers/image/v3/`

| # | File | Phase | Lines | Purpose |
|---|------|-------|-------|---------|
| 1 | `types/request_context.ts` | 8.0 | ~30 | Request envelope + SLA |
| 2 | `types/model_descriptor.ts` | 8.0 | ~40 | Model capability descriptor |
| 3 | `types/cost_event.ts` | 8.0 | ~20 | Cost telemetry shape |
| 4 | `cost/cost_telemetry_collector.ts` | 8.1 | ~40 | Raw cost → sink |
| 5 | `cost/cost_model.ts` | 8.1 | ~50 | Rolling windows |
| 6 | `cost/cost_forecast_engine.ts` | 8.2 | ~40 | Projection + anomaly |
| 7 | `cost/cost_policy_engine.ts` | 8.2 | ~35 | Budget ceilings |
| 8 | `models/model_capability_registry.ts` | 8.3 | ~45 | Registration + filtering |
| 9 | `models/dynamic_model_router.ts` | 8.3 | ~80 | SLA + drift + cost scoring |
| 10 | `integration/cic_integration_adapter_phase8.ts` | 8.4 | ~60 | CIC wiring |

**Total:** ~440 LOC (skeleton), ~700 LOC (tests), ~1.1K LOC (complete).

---

## Success Criteria (Locked)

- [ ] 10/10 files implemented
- [ ] 150+ unit tests (phases 8.1–8.3)
- [ ] 20+ integration tests (phase 8.4)
- [ ] Phase 7 state machine extended (new states + transitions)
- [ ] Cost windows → state evaluator hooked
- [ ] Prometheus metrics exportable
- [ ] Audit events structured + loggable
- [ ] Zero unhandled cost calc edge cases
- [ ] All routing paths tested under LOW/MEDIUM/HIGH cost pressure

---

## Dependencies

- Phase 7 complete (state machine + drift monitor)
- Prometheus client library (prom-client)
- Anthropic SDK + model pricing (fallback to placeholder pricing if missing)

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Rounding errors in cost math | Deterministic unit tests, no float ambiguity |
| Phase 7 state machine complexity | Extend existing, don't refactor |
| Model registry not exhaustive | Pre-populate + synthetic tests |
| Budget crossing at request boundary | Policy evaluated *before* execution |

---

## Next Step

Day 1 AM: Implement Phase 8.0 (types 1–3). PLAN.md ready in repo root.
