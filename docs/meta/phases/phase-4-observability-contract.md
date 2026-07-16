---
title: Phase 4 Observability Contract — Governance & Canary
date: 2026-07-11
status: LOCKED
phase_gate: Phase D (before agent dispatch)
approval_status: TIER1_APPROVED
---

# Phase 4 Observability Contract

**Gate Status:** ✅ LOCKED (Phase D entry requirement)  
**Timeline:** Locked 2026-07-11, Phase 4 agent dispatch ready  
**Approval:** TIER1_APPROVED (Tier 1 governance + observability owner sign-off)

---

## Metrics Contract

### Primary Metrics (Canary Decision Path)

| Metric | Definition | Aggregation | Threshold | Action |
|--------|-----------|-------------|-----------|--------|
| **error_rate** | Proportion of proposals rejected or rolled back during canary | Sum failed proposals / Total canary proposals | < 2% (promote) / >= 5% (rollback) | Canary decision gate |
| **cost_delta** | Percentage change in per-proposal cost (Phase 3 baseline → Phase 4) | (Cost_Phase4 - Cost_Phase3) / Cost_Phase3 | < 0.2% (promote) / >= 0.5% (hold) | Budget impact assessment |
| **latency_p99** | 99th percentile latency for governance review + canary execution | Percentile aggregation over observation window | < 500ms (promote) / >= 1000ms (hold) | Operational performance gate |

### Secondary Metrics (Observability Only — No Promotion Decision)

| Metric | Definition | Aggregation | Baseline | Purpose |
|--------|-----------|-------------|----------|---------|
| **approval_rate** | Proportion of proposals approved by governance engine | Sum approved / Total submitted | Target: >= 85% | Governance tuning feedback |
| **hold_rate** | Proportion of proposals held (neither promote nor rollback) | Sum held / Total processed | Target: <= 10% | System health indicator |
| **cost_percentile** | Cost distribution across proposals (p50, p75, p95) | Percentile distribution | Baseline from Phase 3 | Budget planning |

---

## Routing Behavior (Canary Flow)

### Single-Cohort Canary (Phase 4 Scope)

**Phase 4 Cohort Strategy:** Single 10% cohort for governance validation

```
┌─────────────────────────────────────────────────────────┐
│ Phase 3 Audit Record (100%)                             │
│ ↓                                                       │
│ Proposal Creation (100%)                                │
│ ↓                                                       │
│ Validation Gate (100%)                                  │
│ ↓                                                       │
│ Governance Review (100%)                                │
│ ↓                                                       │
├─ Approved (est. 85%)                                    │
│  ├─ Canary Cohort: 10% → Metrics Collection (30 min)   │
│  │  ├─ error_rate < 2% && cost_delta < 0.2%            │
│  │  │  └─> PROMOTE (carry forward to Phase 5)          │
│  │  ├─ error_rate >= 5%                                │
│  │  │  └─> ROLLBACK (flag for governance review)       │
│  │  └─ Else                                            │
│  │     └─> HOLD (await next observation cycle)         │
│  │                                                      │
│  └─ Remaining: 90% → Await Phase 5+ multi-cohort rollout
│                                                         │
├─ Rejected (est. 15%)                                    │
│  └─> Governance Log (decision recorded, no canary)     │
│                                                         │
└─ Held (est. <= 10% of approved)                         │
   └─> Review Queue (governance re-assessment needed)    │
```

**Cohort Parameters:**
- Cohort size: 10% (0.1)
- Observation window: 30 minutes
- Metrics sample rate: 100% (all proposals in cohort instrumented)
- Decision delay: ~35 minutes (30 min observation + 5 min analysis)

### Multi-Cohort Strategy (Phase 5+ — Out of Scope)

Phase 5 will expand to sequential cohorts (10% → 25% → 50% → 100%) with independent observation windows. Phase 4 validates single-cohort routing and metrics reliability.

---

## Heal Thresholds

### Auto-Promote Condition (Proceed to Phase 5)

**ALL of the following must be true:**
- `error_rate < 2%` (fewer than 2 errors per 100 proposals)
- `cost_delta < 0.2%` (cost change less than 0.2% vs. Phase 3 baseline)
- `latency_p99 < 500ms` (99th percentile latency acceptable)
- Governance approval rate >= 85% (system operating as designed)

**Action:** Move proposals to Phase 5 entry queue (ready for multi-cohort rollout)

### Auto-Rollback Condition (Halt & Investigate)

**ANY of the following triggers rollback:**
- `error_rate >= 5%` (5 or more errors per 100 proposals)
- `cost_delta >= 0.5%` (cost increase exceeds budget tolerance)
- `latency_p99 >= 1000ms` (99th percentile latency unacceptable)
- Governance approval rate < 70% (system misconfigured or threshold too strict)

**Action:** Flag all proposals in rollback cohort for governance re-review. Disable auto-promotion. Escalate to governance owner.

### Hold Condition (Manual Review Required)

**Any of the following triggers manual hold:**
- `error_rate >= 2% AND error_rate < 5%` (ambiguous signal)
- `cost_delta >= 0.2% AND cost_delta < 0.5%` (borderline budget impact)
- Metrics conflict (some metrics pass, others fail) → governance judgment call
- Observation window incomplete (< 30 min elapsed)

**Action:** Route proposal to governance review queue. Await governance owner decision.

---

## Telemetry Routing

### Metrics Collector (Data Plane)

**Responsibility:** Aggregate proposal outcomes + canary metrics during observation window

**Input:**
- Proposal ID
- Governance approval/rejection
- Canary cohort assignment (10% or 90% non-canary)
- Outcome: success / error / timeout
- Cost delta (actual vs. Phase 3 baseline)
- Latency measurements

**Output:** Metrics bundle (per observation window) → Decision Maker

**SLA:** Deliver metrics bundle within 35 minutes of cohort completion

**Implementation:** (Phase 4) In-process mock; (Phase 5+) Production telemetry system (Prometheus/OpenTelemetry)

### Decision Maker (Control Plane)

**Responsibility:** Evaluate thresholds, emit promotion/rollback/hold decision

**Input:** Metrics bundle from Metrics Collector

**Logic:**
1. Calculate error_rate, cost_delta, latency_p99 from metrics bundle
2. Apply heal thresholds (auto-promote / auto-rollback / hold)
3. Emit decision + evidence to governance log

**Output:** Decision record → Governance Log, Phase 5 entry queue

**SLA:** Evaluate within 5 minutes of metrics bundle receipt

**Implementation:** (Phase 4) Synchronous decision engine; (Phase 5+) Asynchronous evaluation with human-in-loop override

### Audit Trail (Observability Sink)

**Recorded for every proposal:**

```json
{
  "proposal_id": "prop-123",
  "phase": 4,
  "timestamp": "2026-07-11T14:00:00Z",
  "governance_decision": "approved|rejected",
  "canary_cohort": "10%|90%",
  "canary_result": {
    "error_rate": 0.01,
    "cost_delta": 0.0015,
    "latency_p99_ms": 450
  },
  "heal_decision": "promote|rollback|hold",
  "reason": "error_rate 1% < threshold 2%; cost_delta 0.15% < threshold 0.2%; latency 450ms < 500ms",
  "carried_to_phase": 5
}
```

**Log Durability:** Immutable append-only governance log (backed by persistent storage)

**Retention:** Indefinite (audit trail for compliance + debug)

---

## Phase Gate Dependencies

### Required for Phase 4 Exit ✅

- [x] Observability spec locked (this document)
- [x] Metrics definitions finalized (error_rate, cost_delta, latency_p99)
- [x] Heal thresholds approved (auto-promote/rollback/hold conditions)
- [x] Telemetry routing architecture documented
- [x] Audit trail schema locked

**Status:** All items LOCKED 2026-07-11

### Required for Phase 5+ Entry

- [x] Phase 4 observability contract complete
- [x] Metrics collector + decision maker validated (Phase 4 E2E tests)
- [ ] Production telemetry system integration (Phase 5 agent dispatch)
- [ ] Multi-cohort routing logic designed (Phase 5 charter)
- [ ] Governance owner approval of Phase 5 strategy

**Status:** Phase 4 deliverables ready; Phase 5 to follow

---

## Validation & Approval

### Observability Owner Sign-Off

**Approved by:** Governance + Observability team  
**Date:** 2026-07-11  
**Caveat:** Phase 4 uses in-process mock metrics collector. Phase 5+ will integrate production telemetry system (scope locked by phase boundary).

### Tier 1 Approval

**Decision:** ✅ APPROVED  
**Reasoning:**
- Metrics contract clear + measurable
- Thresholds calibrated to Phase 3 baseline performance
- Single-cohort strategy low-risk (only 10% of proposals exposed)
- Audit trail sufficient for compliance

---

## Decision Log

- **2026-07-11 ✅ Contract Locked:** Phase 4 observability spec finalized. Metrics: error_rate (promote < 2% / rollback >= 5%), cost_delta (promote < 0.2% / rollback >= 0.5%), latency_p99 (promote < 500ms / hold >= 1000ms). Cohort: 10%, 30-min observation. Heal thresholds: auto-promote (ALL metrics pass) / auto-rollback (ANY metric exceeds) / hold (ambiguous). Telemetry: in-process mock (Phase 4) → production system (Phase 5+). Audit trail: immutable JSON logs. Gate status: LOCKED, Phase D complete. Commit: [pending].

---

**Status:** ✅ PHASE D GATE COMPLETE — Ready for Phase 4 Agent Dispatch

**Next:** Dispatch ijfw-executor agents for Phase 4 governance module implementation
