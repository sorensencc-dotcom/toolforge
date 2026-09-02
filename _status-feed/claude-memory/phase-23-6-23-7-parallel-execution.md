---
name: phase-23-6-23-7-parallel-execution
description: Phase 23.6–23.7 parallel execution (Memory Explorer UI + Memory-Driven Autonomy); coordinated via MLA/CKG
metadata: 
  node_type: memory
  type: project
  originSessionId: d5df32a8-d2ad-4224-a1ad-ba12e0d3976b
---

# Phase 23.6–23.7 — Parallel (UI + Autonomy)

Two tracks: Track A (23.6 Explorer UI), Track B (23.7 Memory-Driven Autonomy). Sync via MLA/CKG.

## Track A: 23.6 — Explorer UI

Goal: Timeline, drift overlays, health, correlation traces.

**23.6.1 UI Architecture:** Components (ExplorerLayout, TimelineView, DriftOverlay, HealthIndicators, CorrelationTracer), models (TimelineEvent, DriftMetrics, HealthMetrics). API: GET /memory/events?type=ARPS_DELTA,PIPELINE_RUN,GOVERNANCE_SIGNAL&dates → TimelineEvent[]. ✓ Render, 1000+ events <lag, overlays <500ms, traces <200ms, responsive.

**23.6.2 Timeline:** ARPS/PIPELINE_RUN/GOVERNANCE/APR/CRO events, hourly/daily/weekly grouping, zoom/pan/nav. ✓ Chronological, clickable, color-coded, detail panels.

**23.6.3 Drift & Health:** DriftOverlay(timestamp, score 0-1, signals{semantic|temporal|narrative|causal}, severity). HealthMetric(window, uptime, success%, latency, errors). ✓ Anomaly highlight >0.7, trends, tooltips.

**23.6.4 Correlation:** Trace(id, initiatingEvent, related[], critical_path). ✓ <200ms, JSON/CSV export.

**23.6.5 MemoryQueryAPI:** ExplorerClient(getTimeline, getDrift, getHealth, getTrace, subscribe). ✓ <2s timeout, 5s poll, cache invalidate, exponential backoff.

**23.6.6 Tests:** >80% coverage, 10+ integration, <100ms render, <500ms load, pixel-perfect.

**23.6.7 Launch:** /cic/explorer, <2s queries, 0 errors, docs, alerts.

---

## Track B: 23.7 — Memory-Driven Autonomy

Goal: Detect drift/instability/regression, propose roadmap updates, governance integration.

**23.7.1 Signals:** AutonomySignal(type{drift|instability|regression|opportunity}, severity, confidence, phases[], evidence). THRESHOLDS: DRIFT 0.75, INSTABILITY_ERROR 0.15, REGRESSION_LATENCY 2.0, OPPORTUNITY 0.95. ✓ Detect 4 signals, classify, confidence 0-1, recommendations.

**23.7.2 Proposals:** RoadmapProposal(id, triggeredBy[], actions{reprioritize|allocate|add|defer}, impact{phases, duration, risk, deps}, confidence, status). ✓ ≥3 signals, impact assessed, dependencies checked, approval ready.

**23.7.3 Queries:** GET /autonomy/signals?severity&window, GET /proposals?status, GET /trends?metric&phase, POST /simulate?action&phase&days. ✓ <500ms, pagination, filters, non-destructive sim.

**23.7.4 APR/ARPS:** Signals→APR (replan critical), Proposals→ARPS (ARPS_DELTA logs). ✓ Flow, replan, log, priorities, feedback.

**23.7.5 Governance:** Route high-risk→Council, policy rails, audit trail, feedback. ✓ risk=high requires Council, rejections fed back, GOVERNANCE_SIGNAL logged.

**23.7.6 Learning:** Accuracy tracking, threshold auto-adjust (false positives), >30d decay, confidence improves. ✓ Curves visible.

**23.7.7 Tests:** >80% coverage, 15+ integration, <100ms detection, <500ms proposals.

**23.7.8 Dashboards:** Signals display, history search, metrics, audit log, alerts.

## Coordination: MLA/CKG Sync

**Sync 1 (MLA):** CIC→MLA→Track B (analyze)→AutonomySignal→Track A (display). Events: ARPS_DELTA, PIPELINE_RUN, AGENT_TELEMETRY, GOVERNANCE_SIGNAL, AUTONOMY_SIGNAL.

**Sync 2 (MemoryQueryAPI):** Both query authoritative MLA state.

**Sync 3 (CKG):** Track A (entity lifecycle)↔CKG↔Track B (relationships). Synthesized reasoning queried by both.

**Sync 4 (Governance):** Proposal→Governance→GOVERNANCE_SIGNAL→Track A (display), Track B (learn).

## Implementation Sequence

**Weeks 1–2 Foundation:** A: UI arch, timeline, queries. B: Signal detection, proposals, API. Sync: MLA writes, MemoryQueryAPI reads.

**Weeks 3–4 Features:** A: Drift/health, correlation, tests. B: APR, governance, learning. Sync: B writes signals, A displays.

**Week 5 Launch:** A: Staging, monitoring. B: Tests, dashboards. Sync: E2E Signals→Proposals→Governance→Audit.

## Success

✓ <100ms render, <2s queries ✓ <100ms detect, <500ms propose ✓ MLA/CKG sync ✓ >80% tests, 15+ integration ✓ Governance routing ✓ Docs

## Files

/memory: MemoryStore, MemoryQueryAPI. /ui: ExplorerLayout, TimelineView, DriftOverlay, HealthIndicators, CorrelationTracer, Queries. /autonomy: SignalDetection, RoadmapProposal, API, Bridges, Learner. /tests, /monitoring.
