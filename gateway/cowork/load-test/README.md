# Load Test Harness

Load testing tool for CIC + Cowork Gateway pipeline. Validates registry throughput, manifest operations, sync state churn, heartbeat cadence, retry/backoff stability, error envelope correctness, and hash consistency under concurrent load.

## Multiplier Model

1x baseline = 5 concurrent simulated gateways. Multiplier scales concurrency only:
- 1x = 5 gateways
- 10x = 50 gateways
- 100x = 500 gateways
- 500x = 2500 gateways

Each gateway repeats a cycle:
```
handshake() → syncState() → pullManifestHash() → [detectDrift() if mismatch] → pushManifest() → heartbeat()
```

on a 30s interval (harness-owned assumption, not pulled from real code spec).

Gateway start times are staggered across the interval to avoid thundering-herd bursts.

## Running Tests

```bash
# Run harness's own unit tests
npm test

# Run load scenarios
npm run load:test:1x      # 5 concurrent, 60s
npm run load:test:10x     # 50 concurrent, 120s
npm run load:test:100x    # 500 concurrent, 180s
npm run load:test:500x    # 2500 concurrent, 300s
```

## Output

Report: `load-test-results/<timestamp>/report.json` + `summary.md`

JSON schema:
```json
{
  "runId": "...",
  "startedAt": "...",
  "finishedAt": "...",
  "mockServerBaseUrl": "...",
  "scenarios": [
    {
      "multiplier": 1,
      "concurrency": 5,
      "cycleIntervalMs": 30000,
      "registry": {
        "opLatencyMs": {"p50": 0, "p95": 0, "p99": 0},
        "opsTotal": 0
      },
      "manifest": {
        "pushSuccessRate": 0,
        "pushLatencyMs": {...},
        "pushCount": 0,
        "pullSuccessRate": 0,
        "pullLatencyMs": {...},
        "pullCount": 0
      },
      "syncStateChurn": {"mutationsPerSecond": 0},
      "heartbeat": {
        "targetIntervalMs": 30000,
        "observedIntervalMs": {...},
        "driftMs": 0
      },
      "retryBackoff": {
        "observedDelaysMs": [...],
        "expectedDelaysMs": [100, 300, 1000],
        "matched": true
      },
      "errorEnvelope": {
        "conformsToAdapterResponse": false,
        "sampleMismatches": [...]
      },
      "hashConsistency": {
        "pulledHashesAlwaysMatchAPush": true,
        "tornDetected": 0
      },
      "thresholdFlags": [...]
    }
  ]
}
```

## Collectors

**Registry Op Latency** — `SkillRegistry.load()/getAll()/countRegistered()` latencies with p50/p95/p99 percentiles. Synchronous fs I/O with no batching — expect first bottleneck at 500x.

**Manifest Push/Pull** — Success rates + latencies from `CoworkClient.pushManifest()` / `pullManifestHash()`.

**Sync State Churn** — Mutation rate per second via `SyncCoordinator.getState()`.

**Heartbeat Cadence Drift** — Observed inter-heartbeat intervals vs 30s target. Since real code has no timer loop, this measures harness timer degradation under load.

**Retry/Backoff** — Force failures via mock server fault injection, assert observed delays against `CoworkHttp`'s `retryDelays=[100,300,1000]`. Note: `DEFAULT_RETRY_POLICY` in `SyncProtocol.ts` appears unused — confirm nothing consumes it.

**Error Envelope Conformance** — Mock server returns raw `{error: '...'}` shapes, not the repo's canonical `AdapterResponse{ok,data?,error?,meta}`. Reported as a conformance finding, not coerced.

**Hash Consistency** — Each gateway has its own `SyncCoordinator`/`SyncState` (no shared state across gateways). Real concurrency surface is the **mock server's shared `state.manifestHash`** being raced by concurrent `pushManifest()` calls. Mock server's push handler computes hash synchronously with no `await` gap, so Node's single-threaded model prevents torn writes — this is a **smoke check** (verifies serialization + no crash), not a stress-sensitive interleave detector. If future work needs to test real interleave windows, add an artificial delay via fault injection between manifest-write and hash-compute steps.

**Threshold Flags** — Compare observed latencies/retries against `PHASE_27.env.example` budgets (`WEBHOOK_TIMEOUT=5000`, `WEBHOOK_RETRIES=3`, `ADAPTER_TIMEOUT=10000`, `ADAPTER_RETRIES=3`). Flagged in report only; re-tuning is later Phase 4 optimization work.

## Architecture Scope Notes

- **Wave 1** (current): Mock server (in-process), measures application-level behavior.
- **Wave 2** (future): Real docker-compose stack (`--base-url http://localhost:3116`).
- **No new dependencies**: Hand-rolled concurrent TS driving real `CoworkClient` + `SyncCoordinator` classes via `Promise.allSettled`. Not autocannon/k6/artillery.
- **Per-gateway isolation**: No shared state between gateways in the real codebase; harness respects this boundary and doesn't inject cross-gateway races.

## Findings Flagged

1. **Manifest size constant across multipliers**: Isolates concurrency-count degradation from request-rate degradation.
2. **No per-gateway timer loop in real code**: Harness heartbeat collection measures harness-side timer degradation, not a spec-driven behavior.
3. **Error envelope shape mismatch**: Mock server doesn't use `AdapterResponse` — this is a conformance gap worth documenting.
4. **Hash consistency check is smoke-test only**: Architectural limitation of Node's single-threaded model and mock server's synchronous hash compute.
