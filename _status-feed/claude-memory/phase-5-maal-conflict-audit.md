---
name: phase-5-maal-conflict-audit
description: "Deterministic audit checklist for optimization phases vs MAAL routing — verifies no semantic drift, no nondeterministic caching, no trust-scoring breaks"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4a2e1852-b897-4d5c-bdd0-12ea7d0cb831
---

# Phase 5: MAAL Conflict Audit Checklist

Before integration of cloud providers, verify optimization layers (Phases 1–5) preserve MAAL determinism.

---

## **Phase 1: Console Metrics Caching (10ms TTL)**

### File: [console.ts:46-48](../../dev/cic-ingestion/src/autonomy/routes/console.ts#L46-L48)

- [ ] **Contract shape**: `metricsCache` is local to route handler, not shared state. MAAL cannot observe TTL decay.
  - **Verify**: Grep for `metricsCache` usage outside `console.ts` — should be zero.
  - **Risk**: LOW (route-local, no impact on ExecutionPolicy)
  
- [ ] **Cache invalidation**: No explicit invalidation method. TTL-based only.
  - **Verify**: Confirm `getDocsManagerMetrics()` always returns fresh state if cache miss. Check [docsManagerJob.ts:425-439](../../dev/cic-ingestion/src/ingestion/jobs/docsManagerJob.ts#L425-L439).
  - **Risk**: LOW (metrics are observational, not routing inputs)

---

## **Phase 2: Docs-Manager JSONL Segmentation**

### File: [docsManagerJob.ts:154-181](../../dev/cic-ingestion/src/ingestion/jobs/docsManagerJob.ts#L154-L181)

- [ ] **Segment index determinism**: `getSegmentsToRead()` filters by `lastSeenSequenceId`. Order of segments returned must be stable.
  - **Verify**: Sort check in [docsManagerJob.ts:178-180](../../dev/cic-ingestion/src/ingestion/jobs/docsManagerJob.ts#L178-L180) — confirm stable sort or explicit order.
  - **Risk**: MEDIUM (if segment order differs, MAAL drift scoring sees out-of-order events)
  - **Fix if needed**: Add `.sort((a, b) => a.minSequenceId - b.minSequenceId)` before filter.

- [ ] **State persistence**: `saveState()` writes `lastSeenSequenceId`. Recovery after crash must resume from exact point.
  - **Verify**: Confirm state file path in [docsManagerJob.ts:101-105](../../dev/cic-ingestion/src/ingestion/jobs/docsManagerJob.ts#L101-L105) is singleton and never race-written.
  - **Risk**: MEDIUM (concurrent writes break determinism)
  - **Fix if needed**: Use fs.writeFileSync + exclusive lock or atomic rename.

- [ ] **Event validation**: No reordering or skipping of events based on cache state.
  - **Verify**: Trace [processEvent()](../../dev/cic-ingestion/src/ingestion/jobs/docsManagerJob.ts#L311-L326) — confirm sequenceId monotonic increase only.
  - **Risk**: MEDIUM (drift events out-of-order break MAAL state machine)

---

## **Phase 3: Canary Gate Governance Context Cache (500ms TTL)**

### File: [CanaryGateOrchestrator.ts:56-85](../../dev/cic-ingestion/src/core/maal/canary/CanaryGateOrchestrator.ts#L56-L85)

- [ ] **Cache affects routing decision**: `getGovernanceContext()` returns thresholds used in [line 132-135](../../dev/cic-ingestion/src/core/maal/canary/CanaryGateOrchestrator.ts#L132-L135) for `decideCohortGrowth()`.
  - **Verify**: Two identical proposals 300ms apart: first loads fresh context, second uses cache. Both must decide identically.
  - **Risk**: HIGH (cache hit ≠ cache miss → nondeterministic decision)
  - **Test**: Run same proposal twice at T=0 and T=250ms, capture decisions. Must match.

- [ ] **Cache invalidation trigger**: No explicit invalidation. 500ms TTL only.
  - **Verify**: Confirm no external code mutates `DEFAULT_GOVERNANCE_CAPS` or governance DB between cache hits.
  - **Risk**: MEDIUM (if governance rules change mid-execution, cached state is stale)
  - **Fix if needed**: Add cache invalidation hook at governance approval boundary.

- [ ] **Fallback to defaults**: Cache miss falls back to `DEFAULT_GOVERNANCE_CAPS` [line 75](../../dev/cic-ingestion/src/core/maal/canary/CanaryGateOrchestrator.ts#L75).
  - **Verify**: Confirm defaults are hardcoded constants and never mutated.
  - **Risk**: LOW (if constant, always deterministic)

---

## **Phase 4: TorqueQuery Fast-Path Optimization**

### File: [TorqueQueryClient.ts:38-95, 185-212](../../dev/cic-ingestion/src/services/torquequery/TorqueQueryClient.ts#L38-L95)

**Highest risk phase.** Fast-path skips MMR + diversity scoring used by MAAL drift detection.

- [ ] **Fast-path eligibility is deterministic**: `isEligibleForFastPath()` [line 62-69](../../dev/cic-ingestion/src/services/torquequery/TorqueQueryClient.ts#L62-L69) checks `!mmr_enabled && !diversify && k <= 50`.
  - **Verify**: Same queryParams → same eligibility. Test 100 random queries, confirm no randomness in check.
  - **Risk**: HIGH (if eligibility varies, MAAL sees inconsistent result shapes)
  - **Test**: Run identical query 10x, capture fast-path decisions. All must match.

- [ ] **Fast-path result shape matches full-path result shape**: Candidate pool reduction [line 84](../../dev/cic-ingestion/src/services/torquequery/TorqueQueryClient.ts#L84) reduces candidates by 50%.
  - **Verify**: Confirm fast-path returns same fields as full-path (vector, score, metadata, etc.).
  - **Risk**: HIGH (if shapes differ, MAAL drift scoring breaks)
  - **Test**: Run same query via fast-path and full-path, diff result schemas. Must be identical.

- [ ] **Embedding normalization is deterministic**: `normalizeEmbedding()` [line 38-56](../../dev/cic-ingestion/src/services/torquequery/TorqueQueryClient.ts#L38-L56) caches normalized vectors.
  - **Verify**: Same vector input → same normalized output + magnitude. Test 1000 random vectors.
  - **Risk**: MEDIUM (floating-point rounding could differ across runs)
  - **Fix if needed**: Use fixed-precision serialization (e.g., `toFixed(10)`) for cache key.

- [ ] **Query result cache doesn't hide semantic changes**: Cache [line 25-26, 190-195](../../dev/cic-ingestion/src/services/torquequery/TorqueQueryClient.ts#L25-L26) has 1s TTL.
  - **Verify**: If TorqueQuery backend changes mid-second, cache serves stale results. MAAL sees inconsistent data.
  - **Risk**: MEDIUM (if backend indexes shift during 1s window, MAAL drift detection skips the shift)
  - **Fix if needed**: Invalidate cache on TorqueQuery version change or explicit signal.

---

## **Phase 5: Warm Executor Pool (10min TTL)**

### File: [WarmPoolManager.ts:44-183](../../dev/cic-ingestion/src/services/WarmPoolManager.ts#L44-L183)

- [ ] **Warm vs cold startup doesn't change tool behavior**: `getWarmExecutor()` [line 118-148](../../dev/cic-ingestion/src/services/WarmPoolManager.ts#L118-L148) reuses containers.
  - **Verify**: Same tool executed on warm and cold container. Output must be identical (no state bleed).
  - **Risk**: HIGH (if warm container retains prior state, MAAL sees nondeterministic tool output)
  - **Test**: Run 10 sequential tasks on reused container, capture outputs. All must be deterministic w.r.t. inputs.

- [ ] **Trust scoring unchanged by reuse**: `isTrustedTool()` [line 154-156](../../dev/cic-ingestion/src/services/WarmPoolManager.ts#L154-L156) only affects initialization path.
  - **Verify**: Confirm reuse doesn't skip validation or trust checks. ExecutionPolicy routing must treat warm = cold.
  - **Risk**: MEDIUM (if warm path bypasses validation, MAAL trust scoring diverges)

- [ ] **Pool lifecycle doesn't alter metadata**: Container `execCount` and `lastUsed` tracked [line 126-127](../../dev/cic-ingestion/src/services/WarmPoolManager.ts#L126-L127), but not exposed to MAAL.
  - **Verify**: Grep for `execCount` or `lastUsed` usage in ExecutionPolicy or BridgeOrchestrator. Should be zero.
  - **Risk**: LOW (metrics are observational, not routing inputs)

- [ ] **Eviction is deterministic**: Cleanup interval [line 256-261](../../dev/cic-ingestion/src/services/WarmPoolManager.ts#L256-L261) evicts containers idle > 10min.
  - **Verify**: Same pool state → same eviction decision. No random selection.
  - **Risk**: LOW (eviction is deterministic by TTL)

---

## **Cross-Layer Audit**

### ExecutionPolicy ↔ Optimization Layers

- [ ] **No optimization layer adds fields to execution metadata** (e.g., `fast_path_used`, `cache_hit`).
  - **Verify**: Grep ExecutionPolicy for metadata contract. Confirm no new fields introduced.
  - **Risk**: HIGH (new metadata fields could break MAAL routing)

- [ ] **No optimization layer changes latency distribution shape**.
  - **Verify**: Capture P50, P95, P99 before and after optimization. Confirm P95/P99 don't spike (indicate cache misses causing queueing).
  - **Risk**: MEDIUM (if latency becomes bimodal, MAAL SLA thresholds may fire spuriously)

### BridgeOrchestrator ↔ Warm Pool

- [ ] **Warm pool doesn't mask tool initialization errors**.
  - **Verify**: Inject failure into tool init, confirm warm path still detects it (or re-runs cold).
  - **Risk**: MEDIUM (if warm path silently skips failure, MAAL rollback logic breaks)

### CanaryGateOrchestrator ↔ TorqueQuery

- [ ] **Canary metrics calculation uses consistent query path**.
  - **Verify**: Confirm growth decision [line 138](../../dev/cic-ingestion/src/core/maal/canary/CanaryGateOrchestrator.ts#L138) always queries TorqueQuery (never uses cached results if stale).
  - **Risk**: MEDIUM (if Canary uses stale metrics, promotion decision is nondeterministic)

---

## **Execution**

Run this checklist **before** canary rollout:

1. **Static audit** (15 min): Grep + code review for each risk item.
2. **Determinism test** (30 min): Run comparison harness on identical inputs, confirm outputs match.
3. **Conflict matrix** (optional): Document findings in Conflict Matrix table.
4. **Sign-off**: Verify all HIGH risks = PASS or MITIGATED before proceeding.

---

## **Outcome**

- **PASS**: All HIGH risks verified deterministic. Safe for cloud-provider integration.
- **FAIL**: Any HIGH risk uncertain. Fix before proceeding.
- **MITIGATED**: Risk identified, workaround documented. Acceptable if approved.

