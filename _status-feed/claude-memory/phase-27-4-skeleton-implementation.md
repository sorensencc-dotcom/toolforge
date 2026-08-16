---
name: phase-27-4-skeleton-implementation
description: "Phase 27.4 Recovery skeleton implementation complete; 20 files, 4 epics, 2 commits merged to master"
metadata: 
  node_type: memory
  type: project
  originSessionId: ae6cea02-bfb4-405f-ad7f-5512f7d721ab
---

## Phase 27.4 Recovery: Skeleton Implementation Complete

**Date**: 2026-06-20  
**Status**: ✅ COMPLETE — Merged to master  
**Commits**: 2809a40 (main) + 9fc1a99 (cic), merged via phase-27-4-recovery branch

## What Was Built

### Epic-01: Budget Ledger v2 (6 files)
- PostgreSQL migration: 3 tables (ledger_accounts, ledger_transactions, ledger_entries), indexes, DR==CR constraint
- ORM models: LedgerAccount, LedgerTransaction, LedgerEntry, ReconciliationRecord
- API server: Flask stubs for POST /transactions (idempotent), GET /balance, POST /reconcile
- Reconciliation worker: async, hourly reconciliation via Kubernetes CronJob

**Why**: Double-entry accounting system required for cost allocation accuracy (SLO-004: 99.99%) and budget-driven control signals. Idempotency via txn_ref UUID key prevents duplicate-transaction bugs under SLO violations.

**How to apply**: Team A wires DB connection, implements transaction logic + invariant checks, tests 1000 TPS load. Timeline: T+0 → T+5 (5 days).

### Epic-02: SLO Recording & Alert Rules (2 files)
- Five named SLOs with recording rules + burn-rate metrics
- SLO-001: Availability (99.9%), SLO-002: Latency p95 (≤500ms), SLO-003: Adapter uptime (99.5%), SLO-004: Cost accuracy (99.99%), SLO-005: Pipeline freshness (≤5min)
- Burn-rate recording rules (fast burn >14x, slow burn >6x per 30-day budget)
- Prometheus query rules in cic_slo_274.yaml

**Why**: Recording rules decouple SLO evaluation from control loop. Fast/slow windows provide two-tier alert severity (CRITICAL at 14x, WARNING at 6x).

**How to apply**: Add to prometheus/alert-rules.yml, validate with `promtool check rules`, test with mock metrics.

### Epic-03: SLO Controller (6 files)
- Main loop: 60s interval, query Prometheus → evaluate burn-rate → emit signals
- PrometheusClient: instant/range queries, health checks, retry logic (3x exponential backoff)
- SLOState & ControlSignal models
- Burn-rate evaluator with threshold logic
- Metrics endpoint (/metrics) for Prometheus scrape

**Why**: Closed-loop feedback. 60s interval catches burn-rate transitions within SLO budget window. Idempotent state tracking prevents duplicate signals.

**How to apply**: Team A wires HTTP client to real Prometheus queries, implements signal emission (→ adapter-gateway /control), adds Redis state store. Timeline: T+0 → T+3 (3 days).

### Epic-04: Adapter Degraded-Mode (5 files)
- CircuitBreaker: 3-state machine (CLOSED → OPEN → HALF_OPEN), configurable error_rate + latency thresholds
- DegradedModeManager: enable/disable per adapter, GET /health/degraded endpoint (200 ok / 503 degraded)
- FallbackChain: primary → secondary → default executor, timeout-aware
- LaunchDarkly SDK integration (stub)

**Why**: Graceful degradation under SLO violation. Circuit breaker prevents cascading failures. Fallback chains reduce MTTR by avoiding full adapter reset.

**How to apply**: Team B wires LaunchDarkly SDK, emits fallback metrics, updates adapter-gateway Dockerfile. Timeline: T+7 → T+12 (5 days).

### Epic-05: Fire-Drill Suite (3 files)
- FireDrillRunner: orchestrate scenarios, track pass rate, generate reports
- FD-01 template: latency spike detection + throttle signal validation
- 20 scenarios planned (FD-01 through FD-20)

**Why**: Validates SLO control loop under 20 failure modes before prod rollout. FD-20 is end-to-end test (all SLOs firing + control signals + ledger entries + degraded-mode).

**How to apply**: Team C implements 19 more scenarios, wires JIRA automation, target ≥98% pass rate. Timeline: T+10 → T+20 (10 days).

### Epic-06: Deployment & Ops (3 files)
- Kubernetes ConfigMap cic-config-274: SLO thresholds, burn rates, timeouts, feature flag keys
- Migration runner: run_migrations_274.sh (psql + Flyway support)
- Canary rollout: 3-stage (5% → 25% → 100%) with metric gates (error_rate <1%, latency <600ms, drift <0.1%)

**Why**: Kubernetes-native configuration, declarative. Canary gates prevent cascading failure from bad ledger logic or circuit breaker bugs.

**How to apply**: Team D wires gate metric queries (Prometheus API), tests rollback in staging, dry-run weekly. Timeline: T+14 → T+21 (7 days).

## Files Created

### Main Repo (c:\dev) — 6 files, 786 LOC
- PHASE_27_4_SKELETON_SUMMARY.md — implementation guide
- prometheus/cic_slo_274.yaml — 5 recording rule groups
- api/openapi/budget_ledger_v2.yaml — OpenAPI 3.0.3 spec
- deploy/k8s/cic-config-274.yaml — Kubernetes ConfigMap
- deploy/scripts/run_migrations_274.sh — migration runner
- deploy/scripts/canary_rollout_274.sh — 3-stage rollout orchestrator

### cic Repo (c:\dev\cic) — 20 files, 1496 LOC
- cic/budget_ledger/ — 6 files (schema, models, API, worker, __init__)
- cic/slo_controller/ — 6 files (controller, clients, models, __init__)
- cic/adapters/gateway/ — 5 files (circuit breaker, degraded mode, fallbacks, __init__)
- cic/fire_drills/ — 3 files (runner, FD-01, __init__)

## Timeline

**MVP1 (T+0 → T+7)**: Foundations
- Budget Ledger v2 operational (T+0 → T+5)
- SLO Controller wired + metrics (T+0 → T+3)
- Prometheus rules validated (T+1)
- Pre-T+0 baseline snapshot (T+0)

**MVP2 (T+7 → T+24)**: Safety & Validation
- Adapter degraded-mode (T+7 → T+12)
- Fire-drill suite ≥98% pass (T+10 → T+20)
- Canary rollout validated (T+14 → T+21)
- Rollback runbook signed (T+20)

## Team Assignments

**Team A** (4 eng): SLO Governance
- Budget Ledger v2: full stack (schema, API, worker, Docker)
- SLO Controller: Prometheus wiring, signal emission, metrics
- Prometheus rules: validation + deployment

**Team B** (3 eng): Adapter Safety
- Circuit breakers: thresholds, state transitions
- Degraded-mode: manager, health endpoint, fallback chains
- LaunchDarkly integration

**Team C** (3 eng): Validation
- Fire-drill scenarios: FD-02 through FD-20 (19 scenarios)
- Pass certificate automation
- JIRA integration

**Team D** (2 eng): Infra & Ops
- Kubernetes manifests (Deployments, StatefulSets, Jobs, ConfigMaps)
- Migration automation
- Canary gate evaluation
- Rollback runbook + dry-run weekly

## Critical Path

1. Budget Ledger v2 (blocks SLO controller signal emission)
2. SLO Controller wiring (blocks degraded-mode testing)
3. Adapter degraded-mode (blocks fire-drills)
4. Fire-drill suite (validation gate for MVP1)
5. Canary rollout (final safety gate)

## Known Gaps (Stubs)

- PrometheusClient: HTTP implementation (stub with mock values)
- Budget Ledger DB: connection logic (stub)
- Adapter gateway: LaunchDarkly SDK (stub)
- Fire drills: JIRA integration (stub)
- Control signal emission: adapter-gateway endpoint (stub)
- State store: Redis implementation (stub)

All stubs clearly marked with `# TODO:` comments.

## Next Steps

1. Assign teams A-D to epics
2. Verify team A has Prometheus + PostgreSQL access
3. Set up staging environment (Phase 27.4 shadow)
4. Deploy migration runner on T+0
5. Run fire-drill suite on T+20 (gate for canary)

## Reference

- Summary doc: [PHASE_27_4_SKELETON_SUMMARY.md](../../../../PHASE_27_4_SKELETON_SUMMARY.md)
- Branch: phase-27-4-recovery (merged to master)
- cic commit: 9fc1a99
- main commit: 2809a40
