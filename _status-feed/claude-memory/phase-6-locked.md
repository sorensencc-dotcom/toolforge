---
name: phase-6-locked
description: Phase 6 autonomous cross-orchestration locked 2026-06-17; Redis queue backend + prod-critical scope (6.A + 6.B only for merge)
metadata: 
  node_type: memory
  type: project
  originSessionId: 7e25e57d-dc9f-4d18-89fc-dde5da0117a7
---

# Phase 6: Autonomous Cross-Orchestrated Operation — LOCKED 2026-06-17

**Status:** Specification locked. Execution in progress 2026-06-17 through 2026-06-22.

## Locked Decisions

- **Queue backend:** Redis (not SQLite)
  - Why: Horizontal scaling, durability, atomic ops, retry scheduling needed for 24/7 autonomy
  - How to apply: Use Redis sorted sets for priority; atomic ZPOPMIN for dequeue
  
- **Scope for merge:** Prod-critical only (Phase 6.A + 6.B)
  - Phase 6.A: Redis queue durability
  - Phase 6.B: Graceful shutdown (SIGTERM drain)
  - Phase 6.C: Integration tests
  - Why: Blocks task loss + enables safe deploys on Docker/K8s
  - Retry engine (6.D) + Auth/authz (6.E) come after merge
  
- **Merge target:** 2026-06-22
- **Stability soak:** 2026-06-22 through 2026-06-24
- **Retry engine live:** 2026-06-27 (post-merge, immediate priority)

## Scaffolding Complete

All config files + runtime components already generated 2026-06-17:
- 13 config/runtime/tools files (scheduler, router, orchestrators, telemetry, etc.)
- All in production-ready ESM format
- Ready to drop into castironforge/

## Execution Sequence

1. Phase 6.A (Redis queue) — 2026-06-17 to 2026-06-19
2. Phase 6.B (Graceful shutdown) — 2026-06-19 to 2026-06-20
3. Phase 6.C (Integration tests) — 2026-06-20 to 2026-06-21
4. Merge gate validation — 2026-06-22
5. Phase 6.D (Retry engine) — 2026-06-24 to 2026-06-27 (post-merge)

## Documentation

- Execution plan: `PLAN_PHASE_6.md` (root)
- Master roadmap: `docs/roadmap/MASTER_ROADMAP_v3.0.md` (updated to v3.1.0)
