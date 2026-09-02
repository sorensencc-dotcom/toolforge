---
name: phases-23-27-autonomy-stack
description: Five-phase minimum viable autonomy stack (Memory → Skill Graph → Planner → Orchestrator → Knowledge Graph); foundation for CIC self-awareness and autonomous planning
metadata: 
  node_type: memory
  type: project
  originSessionId: d5df32a8-d2ad-4224-a1ad-ba12e0d3976b
---

# Phases 23 → 27 — CIC Autonomy Stack

**Scope:** Five-phase foundation transforming CIC from deterministic pipeline into self-aware, self-planning, multi-agent, semantically unified intelligence substrate.

**Current Status (2026-06-08):**
- Phase 23.1 — COMPLETE
- Phase 23.2–23.7 — READY FOR IMPLEMENTATION
- Phases 24–27 — SPEC READY, EXECUTION PENDING

---

## Phase 23 — CIC Memory Layer & Long‑Horizon Autonomy (MLA)

**Goal:** Durable, queryable memory enabling long-horizon reasoning, trend detection, autonomous roadmap evolution.

| Milestone | Status | Deliverable |
|-----------|--------|-------------|
| 23.1 — MLA Specification | ✅ COMPLETE | Event types, schemas, retention, archival, validation rules |
| 23.2 — MemoryStore Implementation | ⏳ READY | Append-only log, validator, checksum, atomic writes, retention, archival pipeline |
| 23.3 — Memory Harvester | ⏳ READY | Route ARPS, pipeline, agent, governance, APR, CRO events |
| 23.4 — Memory Synthesizer | ⏳ READY | Weekly summaries, monthly reports, drift trends, distillation |
| 23.5 — Memory Query API | ⏳ READY | `/memory/events`, `/memory/summaries`, `/memory/trends` + filters, pagination |
| 23.6 — Memory Explorer UI | ⏳ READY | Timeline, drift overlays, governance audit, APR/CRO traces |
| 23.7 — Memory‑Driven Autonomy | ⏳ READY | CIC proposes roadmap updates based on patterns |

**Outcome:** CIC gains long-horizon memory and becomes historically aware.

---

## Phase 24 — CIC Skill Graph & Cross‑System Doctrine (SGD)

**Goal:** Formal model of CIC's capabilities enabling skill-aware routing, capability detection, cross-system alignment.

| Milestone | Status | Deliverable |
|-----------|--------|-------------|
| 24.1 — Skill Graph Schema | ⏳ SPEC READY | Nodes (skills, instincts, hooks, rules, agents); Edges (depends_on, enhances, conflicts_with) |
| 24.2 — Skill Graph Store | ⏳ SPEC READY | Persistent capability graph with versioning |
| 24.3 — Skill Harvester | ⏳ SPEC READY | Extract from ARPS, Memory, APR, CRO, codebase |
| 24.4 — Skill Synthesizer | ⏳ SPEC READY | Summaries, gaps, redundancy, drift-aware scoring |
| 24.5 — Skill Graph API | ⏳ SPEC READY | `/skills/graph`, `/skills/capabilities`, `/skills/gaps` |
| 24.6 — Skill Explorer UI | ⏳ SPEC READY | Graph visualization, capability heatmaps, drift overlays |
| 24.7 — Cross‑System Doctrine Sync | ⏳ SPEC READY | Align CIC skills with Claude, Copilot, Antigravity doctrine |

**Outcome:** CIC understands what it can do, what it needs, and how to route tasks.

---

## Phase 25 — Autonomous Planner & Multi‑Agent Reasoning (APR)

**Goal:** CIC plans its own work, decomposes tasks, allocates agents, runs multi-agent reasoning loops.

| Milestone | Status | Deliverable |
|-----------|--------|-------------|
| 25.1 — Planning Model & Data Shapes | ⏳ SPEC READY | Tasks, dependencies, preconditions, outputs, risk levels |
| 25.2 — Autonomous Planner Engine | ⏳ SPEC READY | Goals → plans → tasks → agent routes |
| 25.3 — Multi‑Agent Reasoning Loop | ⏳ SPEC READY | Parallel calls, consensus routines, drift-aware reasoning |
| 25.4 — Task Allocation & Routing | ⏳ SPEC READY | Route based on Skill Graph + Memory performance history |
| 25.5 — APR Control‑Plane API | ⏳ SPEC READY | `/apr/plan`, `/apr/tasks`, `/apr/graph` |
| 25.6 — Planner Console UI | ⏳ SPEC READY | Plan graphs, timelines, agent routing visualization |
| 25.7 — APR Integration | ⏳ SPEC READY | ARPS, Memory, Skill Graph, CRO |

**Outcome:** CIC becomes self-directed planner with multi-agent reasoning.

---

## Phase 26 — CIC Runtime Orchestrator (CRO)

**Goal:** Execute APR plans in robust, multi-agent runtime with supervision, rollback, telemetry.

| Milestone | Status | Deliverable |
|-----------|--------|-------------|
| 26.1 — Execution Model & Data Shapes | ⏳ SPEC READY | Runs, steps, checkpoints, failures, retries |
| 26.2 — Runtime Executor | ⏳ SPEC READY | Execute tasks, parallel scheduling, resource allocation |
| 26.3 — Agent Runner | ⏳ SPEC READY | Launch agents, health monitoring, telemetry capture |
| 26.4 — Agent Supervisor | ⏳ SPEC READY | Failure detection, retry logic, rollback logic |
| 26.5 — CRO Control‑Plane API | ⏳ SPEC READY | `/cro/run`, `/cro/steps`, `/cro/checkpoints` |
| 26.6 — Execution Console UI | ⏳ SPEC READY | Live run view, logs, metrics, drift overlays |
| 26.7 — CRO Integration & Safety | ⏳ SPEC READY | APR → CRO execution, Memory → run history, Skill Graph → routing |

**Outcome:** CIC becomes real multi-agent execution environment.

---

## Phase 27 — CIC Knowledge Graph (CKG)

**Goal:** Unify CIC's knowledge into single semantic world model powering reasoning, planning, drift detection, cross-system intelligence.

| Milestone | Status | Deliverable |
|-----------|--------|-------------|
| 27.1 — CKG Schema | ⏳ SPEC READY | Entities, events, skills, memory events, APR plans, CRO runs, doctrine |
| 27.2 — CKG Store | ⏳ SPEC READY | Graph database with versioned nodes, provenance |
| 27.3 — CKG Harvester | ⏳ SPEC READY | Pull from Memory, Skill Graph, APR, CRO, ARPS |
| 27.4 — CKG Synthesizer | ⏳ SPEC READY | Distill knowledge, detect contradictions, drift, generate insights |
| 27.5 — CKG API | ⏳ SPEC READY | `/ckg/query`, `/ckg/entities`, `/ckg/relations`, `/ckg/insights` |
| 27.6 — Knowledge Explorer UI | ⏳ SPEC READY | Graph visualization, entity timelines, drift overlays, reasoning traces |
| 27.7 — CKG Integration | ⏳ SPEC READY | APR, CRO, Memory, Skill Graph |

**Outcome:** CIC gains unified semantic world model — foundation for autonomous reasoning and evolution.

---

## Combined Dependency Chain

1. **Phase 23 — Memory Layer** → CIC remembers
2. **Phase 24 — Skill Graph** → CIC understands its capabilities
3. **Phase 25 — Autonomous Planner** → CIC decides what to do
4. **Phase 26 — Runtime Orchestrator** → CIC executes its plans
5. **Phase 27 — Knowledge Graph** → CIC understands world and itself

This is **minimum viable autonomy stack**.

---

## Next Action

Begin **Phase 23.2 — MemoryStore Implementation**.
