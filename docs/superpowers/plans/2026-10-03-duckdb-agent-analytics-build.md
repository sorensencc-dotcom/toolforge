# Implementation plan: Embedded DuckDB agent analytics engine

- **Date**: 2026-10-03
- **Specification**: [`rewrite-mcp/docs/specs/duckdb-agent-analytics-spec.md`](file:///C:/dev/rewrite-mcp/docs/specs/duckdb-agent-analytics-spec.md)
- **RFC**: [`wiki/research/rfc-evaluate-embedded-duckdb-agent-analytics.md`](file:///C:/dev/wiki/research/rfc-evaluate-embedded-duckdb-agent-analytics.md)
- **Status**: Ready for execution

---

## 1. Overview and objective

Implement the Embedded DuckDB Agent Analytics Engine in `rewrite-mcp` to support real-time token expenditure calculation, tool execution latency profiling (P50, P95, P99), error rate clustering, and session trajectory mining across multi-agent logs without running external database services.

---

## 2. Work breakdown and tasks

### Task 1: Scaffolding and schema types
- **Files**:
  - `rewrite-mcp/src/analytics/types.ts`
  - `rewrite-mcp/src/analytics/schema.ts`
- **Responsibilities**:
  - Declare TypeScript interfaces: `AgentTelemetryEvent`, `ToolPerformanceMetric`, `TokenExpenditureMetric`, `ErrorDistributionMetric`, and `SessionTrajectorySummary`.
  - Export Zod validator schemas for runtime validation of incoming JSONL events.
- **Verification**: `npx tsx tests/analytics-types.test.ts` (100% schema validation coverage).

### Task 2: DuckDB engine connection and memory manager
- **Files**:
  - `rewrite-mcp/src/analytics/DuckDBAnalyticsEngine.ts`
- **Responsibilities**:
  - Implement ephemeral `:memory:` connection initialization with resource constraints (`SET max_memory = '512MB'`, `SET threads = 4`).
  - Implement dynamic query execution wrapper with query timeout safeguards.
  - Implement zero-native streaming fallback path routing to `evaluate-duckdb-analytics.mjs` when native C++ addons fail to bind.
- **Verification**: `npx tsx tests/duckdb-engine.test.ts` (connection pooling, memory constraint validation, and fallback verification).

### Task 3: Analytical query service
- **Files**:
  - `rewrite-mcp/src/analytics/AgentAnalyticsService.ts`
- **Responsibilities**:
  - Implement `getToolPerformanceMetrics(dateRange)`: Vectorized scan computing P50, P95, and P99 latencies using `QUANTILE_CONT`.
  - Implement `getTokenExpenditure(dateRange)`: Aggregate prompt and completion token counts and compute cost models.
  - Implement `getErrorDistribution(limit)`: Aggregate failure clusters by tool and error category.
  - Implement `getSessionTrajectory(sessionId)`: Retrieve step-by-step trace for specific session ID.
- **Verification**: `npx tsx tests/agent-analytics-service.test.ts` (aggregation precision and window function tests).

### Task 4: JSONL-to-Parquet compaction daemon
- **Files**:
  - `scripts/compact-agent-analytics.mjs`
  - `tests/compact-agent-analytics.test.mjs`
- **Responsibilities**:
  - Scan `data/analytics/raw/*.jsonl` for closed sessions.
  - Convert validated records into Zstandard-compressed Parquet files under `data/analytics/partitions/year=YYYY/month=MM/day=DD/`.
  - Enforce atomic file rename and delete processed raw files with receipt markers.
- **Verification**: `node --test tests/compact-agent-analytics.test.mjs` (compaction compression ratio $\ge 70\%$, zero data loss).

### Task 5: Planning console REST & WebSocket integration
- **Files**:
  - `rewrite-mcp/src/planning-console/server.ts`
- **Responsibilities**:
  - Expose `/api/analytics/tools`, `/api/analytics/tokens`, and `/api/analytics/trajectory/:sessionId` endpoints.
  - Expose live WebSocket event broadcaster for real-time telemetry streaming into the UI.
- **Verification**: `curl http://127.0.0.1:3000/api/analytics/tools` (HTTP 200 with structured JSON response).

---

## 3. Conformance and verification gates

1. **Gate 1 (Unit test coverage)**: All unit tests under `tests/` pass with zero failures.
2. **Gate 2 (Vectorized throughput benchmark)**: Aggregation query over 100,000 synthetic records completes in $< 25\text{ ms}$.
3. **Gate 3 (Windows multi-process isolation)**: 4 parallel write processes and 2 read workers run simultaneously for 10 seconds with 0 file-lock conflicts.
