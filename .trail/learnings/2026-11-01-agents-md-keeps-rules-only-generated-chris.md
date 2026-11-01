---
title: AGENTS.md keeps rules only; generated blocks get fixed at their source
author: Chris
date: 2026-11-01
branch: fix/mcp-playwright-package
cost: { minutes: 1, tokens: 1252 }
id: l-1189596f
scope: repo
status: active
src: agent
touches:
  - AGENTS.md
  - sync-tools/agent-todo-sync.cjs
---

In the code: C:\dev\AGENTS.md, C:\dev\sync-tools\agent-todo-sync.cjs, C:\dev\sync-tools\lib\managed-region.cjs, C:\dev\docs\meta\contract-hubs.md.

## Decided
AGENTS.md holds rules only. Reference tables (contract hubs, morning ingestion, roadmap evidence) live under C:\dev\docs\meta and AGENTS.md links to them. IJFW is removed from AGENTS.md and CLAUDE.md.

## Tried and ruled out
Hand-editing the vault pointer and task table at the bottom of AGENTS.md: sync-tools regenerates them from MEMORY.md sources, so edits are overwritten. Fix stale rows (Wave D was resolved 2026-09-24 but still showed open) at the source or the sync config.

## Watch out
The IJFW "Last handoff" stub in AGENTS.md had a vault-pointer start marker with no end marker, probably why the pointer block was duplicated. Check AGENTS.md for a duplicate pointer after the next sync-tools run. Hub paths without a repo prefix resolve only inside that repo. About 40 tracked .ijfw telemetry files and the ijfw entries in C:\Users\soren\.claude\settings.json were left in place.
