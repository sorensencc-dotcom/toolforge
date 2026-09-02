# Phase 4 Wave 1: Load Test Harness

**Status:** Complete. All 39 unit tests pass. Ready for manual runs against mock server.

## Overview

Load testing tool for CIC + Cowork Gateway pipeline hardening. Drives simulated gateways through the full handshake→sync→pull→drift→push→heartbeat cycle under concurrent load (1x/10x/100x/500x multipliers).

## Files

**Core harness** (`toolforge/gateway/cowork/load-test/`):
- `multiplier.ts` — 1x→5 gateways, 10x→50, 100x→500, 500x→2500
- `scenario.ts` — GatewaySimulator: real CoworkClient + SyncCoordinator
- `collectors.ts` — 7 metric collectors (latency, ops, churn, drift, retries, envelope, hash)
- `assertions.ts` — Threshold checks vs PHASE_27.env budgets
- `report.ts` — JSON + Markdown report writer
- `runner.ts` — CLI orchestrator (mock server + concurrency + aggregation)
- `README.md` — Scope, findings, limitations

**Tests** (`tests/load-test/`):
- `multiplier.test.ts`, `scenario.test.ts`, `collectors.test.ts`, `assertions.test.ts`, `report.test.ts`
- All 39 tests pass

**Configuration**:
- `.gitignore` entry: `load-test-results/`
- `package.json` npm scripts: `load:test:1x|10x|100x|500x`

## Running

```bash
cd C:\dev\toolforge\gateway\cowork

# Unit tests (in-process mock server, quick)
npm test -- --testPathPattern="load-test"

# Load scenarios (manual, against in-process mock server)
npm run load:test:1x      # 5 gateways, 60s
npm run load:test:10x     # 50 gateways, 120s
npm run load:test:100x    # 500 gateways, 180s
npm run load:test:500x    # 2500 gateways, 300s
```

Output: `load-test-results/<ISO-timestamp>/report.json` + `summary.md`

## Architecture

- **Multiplier model:** Concurrency only (not per-gateway request rate). Isolates "N concurrent actors degrade throughput" from "one actor hammering faster breaks things."
- **Gateway start staggering:** Each gateway sleeps `i * (30s / concurrency)` ms before first cycle, spreading bursts across the cycle interval instead of thundering-herd spike at t=0.
- **Metric collectors:**
  - Registry op latency (p50/p95/p99 for SkillRegistry ops)
  - Manifest push/pull (success rate + latency)
  - Sync state churn (mutations/sec)
  - Heartbeat cadence drift (observed vs 30s target)
  - Retry/backoff patterns (`retryDelays=[100,300,1000]` conformance)
  - Error envelope conformance (vs `AdapterResponse{ok,data?,error?,meta}`)
  - Hash consistency (pulled hashes match pushed hashes)
- **Threshold flags:** Compare p99 latencies + retry counts against `PHASE_27.env.example` budgets (webhook/adapter timeouts, retries). Report-only (no pass/fail gate).

## Key Design Decisions

1. **Hand-rolled TS, no new deps:** Drive real `CoworkClient` + `SyncCoordinator` classes via `Promise.allSettled`, not autocannon/k6/artillery. Goal is application-level behavior, not raw HTTP RPS.

2. **In-process mock server (Wave 1):** `tests/helpers/mockServer.ts` provides fault injection + request logging. Parameterized `--base-url` for future Wave 2 against real docker-compose stack.

3. **Hash consistency is smoke-test only:** Mock server's push handler computes hash synchronously with no `await` gap. Node's single-threaded model prevents torn writes. Test verifies serialization + no crash, not stress-sensitive interleaves. Document this boundary in README.

4. **30s cycle interval is harness-owned:** Real code has no timer loop. Heartbeat collection measures harness timer degradation under load, not spec-driven behavior.

5. **Manifest size constant across multipliers:** Isolates concurrency-count regression from request-rate regression.

## Findings Flagged (Not Fixed)

- `DEFAULT_RETRY_POLICY` in `SyncProtocol.ts` (`backoffMs:[100,500,2000]`) appears unused/dead across codebase. Confirm via grep before cleanup.
- Mock server error responses (`{error: 'unauthorized'}`) don't conform to repo's canonical `AdapterResponse` shape. Conformance gap worth documenting.
- `SkillRegistry.load()` is synchronous fs I/O with no batching — expect first bottleneck at 500x concurrency. Baseline for optimization.

## Out of Scope (Wave 2, Future)

- Pointing at real docker-compose stack (`cic-ingestion` @ host:3116)
- Wiring results into monitoring/dashboards
- Re-tuning `PHASE_27.env.example` budgets
- Per-gateway state race testing (no shared state in current architecture)

## Testing

All 39 unit tests pass:
- assertions.test.ts: 12/12 ✓
- multiplier.test.ts: 7/7 ✓
- collectors.test.ts: 11/11 ✓
- scenario.test.ts: 4/4 ✓
- report.test.ts: 4/4 ✓

No integration tests yet (depend on real API in Wave 2).

---
Committed: [git commit hash]
