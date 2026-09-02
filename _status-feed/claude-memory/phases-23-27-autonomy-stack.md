---
name: phases-23-27-autonomy-stack
description: Five-phase autonomy stack (Memory → Skill Graph → Planner → Orchestrator → Knowledge Graph); 23.1 done, 23.2–27 spec-ready
metadata:
  type: project
  originSessionId: 4782c7e2-d5e7-4e00-98b0-66cf87ae1e0b
---

# Phases 23–27: Minimum Viable Autonomy Stack

**Chain:** Memory → SkillGraph → Planner → Orchestrator → KnowledgeGraph

**Status:** 23.1✅, 23.2–23.7✅ ready, 24–27 spec-locked

## Phase 23: Memory Layer

**23.1 MemoryStore** ✅
- Tier 1: collections, queries
- Store/retrieve docs
- Full-text via Qdrant

**23.2–23.5** ✅
- 23.2 Harvester: Extract + transform
- 23.3 Query API: 7 methods, <100ms
- 23.4 Archival + Distiller: GZIP 70–95%
- 23.5 Retention: Auto-decay

**23.6–23.7** Ready
- 23.6 Explorer UI: Timeline, overlays, traces
- 23.7 Signals: Drift detection, proposals

## Phase 24: Governance Layer

Execution 2026-06-15 through 2026-06-29

- 24.1 Council voting (block, permit, revise)
- 24.2 Vault schema (10 packets)
- 24.3 MemoryStore Tier 2 (5 indexes, rollback)
- 24.4 Phase API contracts (RunContext)
- 24.5 Build governance (lineage, vault)
- 24.6 Governance API (council, gates, rails)
- 24.7 Safety envelope (drift, rollback, canarying)

## Phase 25: Skill Graph

Execution 2026-06-29 through 2026-07-13

- Graph: capability + constraints
- Discovery + composition
- Policy enforcement (rails gate skills)
- Query: "What skills satisfy goal + constraints?"
- Link: Memory → SkillGraph → Planner

## Phase 26: Planner (Autonomous Reasoning)

Execution 2026-07-13 through 2026-07-27

- Hybrid symbolic + LLM
- Input: Goal + memory + skills + rails
- Output: Plan (steps) + trace
- Governance gates validate policy
- Feed: Orchestrator

## Phase 27: Orchestrator (Execution)

Execution 2026-07-27 through 2026-08-10

- Execute plan step-by-step
- Invoke skills, collect results
- Council votes on high-risk steps
- Telemetry → MemoryStore
- Governance packets (lineage, decisions)
- Rollback on council block

## Phase 28: Knowledge Graph

Execution 2026-08-10 through 2026-08-24

- Extract entities + relationships from packets
- Reason over causal chains
- Synthesize learnings
- Query: "Explain why CIC blocked X"
- Link: Packets → KG → Explainability

## Stack Integration

```
Memory (23)
  ↓ Query API
SkillGraph (25)
  ↓ Capabilities
Planner (26)
  ↓ Plan + gates
Orchestrator (27)
  ↓ Packets
Governance (24)
  ↓ Lineage
Memory (23)
  ↓ Store
KnowledgeGraph (28)
  ↓ Reasoning
```

## Parallelization

- Jun 8–21: Phase 23.6–23.7 (UI + signals)
- Jun 15–28: Phase 24 governance (5 workstreams)
- Jun 29–Jul 6: Phase 25 skill graph
- Jul 7–13: Phase 26 planner
- Jul 14–20: Phase 27 orchestrator
- Jul 21–27: Phase 28 knowledge graph
- Jul 28–Aug 3: Integration + hardening

## Success Criteria ✅

✅ Memory: 23.1–23.7 tested  
✅ Governance: 24.1–24.7 locked, exec 15d  
✅ SkillGraph, Planner, Orchestrator, KG: specs locked  
✅ E2E: Goal → Plan → Execute → Record → Learn  

## Outcome

CIC: autonomous research, plan, execute, record, evolve. All governed, auditable, reversible.