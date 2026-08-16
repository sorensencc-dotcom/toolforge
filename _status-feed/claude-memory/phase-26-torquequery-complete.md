---
name: phase-26-torquequery-complete
description: Phase 26 TorqueQuery memory indexing engine complete; SQLite backend, fast semantic lookup
metadata:
  type: project
---

**Phase 26: TorqueQuery Memory Indexing Engine** ✅ Complete.

Commit: `75e1556` — Deployed SQLite-backed semantic search engine.

## What was built

**Service:** `services/torquequery/`

- **Schema:** 6 tables (memory_events, signals, correlations, agents, governance_history, agent_timeline)
- **MemoryIndexer:** Subscribes to ingestion events, normalizes into SQLite with transaction safety
- **MemoryQueries:** Operators for byType, byAgent, byCorrelation, bySignal, agentTimeline, governanceHistory
- **TorqueQueryServer:** Manages DB lifecycle (WAL mode, foreign keys, health checks)
- **Unified API:** Routes at `/api/torquequery/*` (6 endpoints)
- **Tests:** 12 integration tests covering indexing, querying, timeline tracking, health

## Technical decisions

1. **SQLite over in-memory:** Deterministic, persistent, zero-config. Aligns with CIC's reproducibility philosophy.
2. **Better-sqlite3:** Synchronous API simplifies testing; WAL mode ensures durability.
3. **Lazy agent indexing:** Agent records created on first event (no upfront registration).
4. **Correlation tracking:** Multi-way joins across events via correlationId.

## Integration points

- **Upstream:** Phase 23.2 (MemoryStore) — events flow in via append bridge
- **Downstream:** Phase 24.2 (Evolution Loop) — reads drift signals for amendments
- **Peer:** Phase 26 sits next to Vault (M3) as persistent layer duo

## Status

✅ Service created  
✅ Schema + indexes  
✅ Indexer + queries  
✅ Unified API wired  
✅ 12/12 tests passing  
✅ Deterministic (SHA256 digests)  
✅ Production-ready

## Next moves

- **Phase 4.4 (Repomix):** Bridges repo scanning → MemoryStore → TorqueQuery
- **M3 (Vault):** Complements TorqueQuery with governance record durability
- **Phase 24.2 (Evolution):** Reads from TorqueQuery/Vault, auto-generates amendments
