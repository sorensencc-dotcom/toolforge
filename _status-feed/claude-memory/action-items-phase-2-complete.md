---
name: action-items-phase-2-complete
description: "Next priorities after Phase 2 (Prompt Cache) shipped; Phase 2.5, Phase 29, CLI wiring"
metadata: 
  node_type: memory
  type: project
  date: 2026-06-15
  status: Phase 2 shipped; ready for Phase 2.5 or Phase 29
  originSessionId: 9692580d-38e5-4383-8340-759022fadf47
---

## Phase 2 ✅ Shipped

All 4 sub-phases complete, 373/377 tests passing.

Commits:
- `3d4bd4b` — Phase 2.3 Prometheus Metrics
- `63c022f` — Docs PROMPT_CACHE_WEEK2.md
- `0f83df7` — Phase 2.4 CLI Commands  
- `a3048eb` — Phase 2 memory updates

## Next Priorities

### 1. Phase 2.5: Config System (150 LOC, 8 tests)
Location: `src/prompt-cache/config/`

TTL, model selection, registry path configuration.

**Why:** CLI commands + Prometheus metrics need config-driven behavior.

### 2. Phase 2 CLI Wire-up (30 LOC)
Location: `src/cli/index.ts`

Register cache command in main CLI entry point:
```ts
program.addCommand(createCacheCommand());
```
Wire to package.json bin: `"cic": "node dist/src/cli/index.js"`

Test: `npm run build && node dist/src/cli/index.js cache --help`

### 3. Phase 29: Knowledge Graph (3-phase suite)
All starter code ready in memory:
- [Phase 29–31: Starter Code Skeletons](phase-29-starter-code-skeletons.md)
- [Phase 29–31: Test Matrices](phase-29-31-test-matrices.md)
- [Phase 29–31: Architecture ABB](phase-29-31-architecture-and-build-blueprint.md)

**Why:** Parallel track to Phase 2.5; independently valuable.

## Test Status

| Component | Tests | Status |
|-----------|-------|--------|
| Phase 2.1 (SQLite) | 15 | ✅ Passing |
| Phase 2.2 (Batch) | 12 | ✅ Passing |
| Phase 2.3 (Prometheus) | 22 | ✅ Passing |
| Phase 2.4 (CLI) | 13 | ✅ Passing |
| Full suite | 373/377 | ✅ 98.9% |

## Decision: Phase 2.5 vs Phase 29

- **Phase 2.5:** Sequential to Phase 2.4 (CLI depends on config). Quick 150 LOC, 1 hour.
- **Phase 29:** Independent track; blocks Phase 30-31 wiring. Larger scope (3 phases).

Recommend: **Phase 2.5 first** (completes CLI integration), then **Phase 29** (knowledge graph suite).
