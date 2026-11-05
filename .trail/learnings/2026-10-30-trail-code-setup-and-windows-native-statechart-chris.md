---
title: "Trail Code setup and Windows native statechart runtime configuration"
author: Chris
date: 2026-10-30
id: l-71d3a902
scope: repo
status: active
touches:
  - AGENTS.md
  - scripts/intercept-grep.js
---

## Decided
- Upgraded repo context graph tooling from legacy Graft to Trail Code (`@trailhq/trail-code` v0.28.1). Use `trail ask`, `trail callers`, `trail skeleton`, and `trail map` instead of legacy `graft_*` commands.
- Standardized Antigravity and multi-agent global skills in `~/.agents/skills/trail` and registered MCP server `trail` in `~/.gemini/config/mcp_config.json`.
- Patched `statechart` runner for Windows compatibility: replaced POSIX `/bin/sh` janitor cleanup with native Node process cleanup and `taskkill.exe` process-tree termination.
- Provisioned standalone OpenJDK 21 LTS and `tla2tools.jar` v1.7.4 in `~/.tla/` with auto-discovery in `run.ts` so `statechart` runs out-of-the-box without requiring `mise`.
- Installed global `statechart.cmd` and `statechart.ps1` shims in `~/AppData/Roaming/npm/` on system PATH.

## Tried and ruled out
- Relying on `mise` to dynamically install Java/TLC on Windows: `mise` is not on Windows PATH and spawns POSIX shell constructs that fail in standard command shells.
- Spawning detached background janitor process with piped stdin on Windows: Node on Windows keeps stdio handles open, preventing the parent CLI from exiting.

## In the code:
- `~/.tla/`: contains OpenJDK 21 and `tla2tools.jar`.
- `AGENTS.md`: references `trail callers`, `trail skeleton`, and `trail map`.
- `scripts/intercept-grep.js`: redirects broad keyword searches to `trail` tools.
- `statechart` CLI wrapper: installed globally in `~/AppData/Roaming/npm/`.
