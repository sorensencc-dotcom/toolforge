---
name: phase-26-torquequery-scope-decision
description: Phase 26 TorqueQuery scope locked to exact-match endpoints (Path A). Semantic search deferred.
metadata: 
  node_type: memory
  type: project
  originSessionId: 5e0ea76a-8d4f-4df7-aa1c-76655b71c3e6
---

# Phase 26 TorqueQuery Scope Decision (2026-07-06)

## Decision: Path A — Exact-Match Endpoints

**Chosen:** Use actual TorqueQuery exact-match API (by-agent, by-type, by-signal, by-correlation)
**Deferred:** Semantic search + vector embeddings (Week 3+ if budget allows)

## Rationale

- Phase 26 MVP viable without semantic search
- Phase 27 counterfactual MVP viable with confidence decay + memory fallback
- Semantic search is quality enhancement (10x reasoning), not MVP blocker
- Schedule: Week 1 on track if implementation uses exact-match

## Phase 26 Ingest Bridge Implementation

Phase 26 will implement push-based indexing (Phase 23 writes → TQ indexes immediately):

### TorqueQuery Exact-Match Endpoints

1. **POST /index/packets** — Bulk ingest memory packets
   - Input: array of MemoryPacket with agent_id, phase_id, signal_type
   - Output: indexed_count, batch_id
   - Called by: MemoryService on write-through-cache

2. **GET /by-agent/:agentId** — Query packets by agent
   - Returns: array of packets written by specific agent
   - Used by: Phase 27 counterfactual (actor replay)

3. **GET /by-type/:packetType** — Query by document type
   - Returns: reasoning_chain, state_snapshot, evidence, etc.
   - Used by: Phase 26 observability dashboard

4. **GET /by-signal/:signal** — Query by signal type
   - Returns: packets with specific signals (drift, cost_spike, auth_fail)
   - Used by: Phase 27 anomaly correlation

5. **GET /by-correlation/:correlationId** — Query by event correlation
   - Returns: all packets in same incident/transaction
   - Used by: Phase 27 incident reconstruction

6. **DELETE /packets/:packetId** — Remove on TTL expiry
   - Called by: OrphanDetectionService + MemoryService TTL sweep
   - Keeps TQ in sync with Phase 23 expiry

### Phase 27 Query Strategy (No Semantic Search)

When Phase 27 does counterfactual reasoning:

1. **Exact-match query:** `/by-agent/:targetAgent` → get all past states
2. **Filter in-memory:** Sort by timestamp, apply confidence decay
3. **Fallback:** If exact-match insufficient, query Phase 23 memory API directly (guaranteed fresh)
4. **Confidence:** Older scenarios decay exponentially (1-hour halflives)

Trade-off: Lower reasoning quality (no semantic similarity) but fully deterministic and testable.

## Status

- ✅ Blockers 2-3 resolved
- ⏳ Phase 26 ingest bridge implementation (Week 1)
- ⏳ Phase 27 CRO with exact-match queries (Week 3+)
- 📅 Semantic search review EOW2 if Phase 26 early

## Related

- [[phase-26-pipeline-complete]] — Phase 26 overall status
- [[phase-23-27-mitigation-status]] — Full mitigation matrix
