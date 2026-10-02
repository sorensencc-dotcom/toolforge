---
name: project-meridian-claude-isolation
description: Meridian (screen-capture work journal) runs headless Claude Code in ~/.meridian; global hooks/auto-memory are disabled there to stop screen-text leaking into graft/IJFW/memory.
metadata:
  node_type: memory
  type: project
  originSessionId: 0a725368-bc5f-4339-a310-f665c6c37e9c
  modified: 2026-09-30T17:53:51.316Z
---

Meridian v1.91.0 is installed (data in `~/.meridian/`, plaintext SQLite `meridian.db` ~6.5 GB since 2026-09-29; encrypted backup alongside). Its LLM runs invoke Claude Code with cwd `~/.meridian`, so global hooks, plugins, and auto-memory fired on prompts built from screen text.

Found 2026-09-30: an auto-memory in `~/.claude/projects/C--Users-soren--meridian/memory/` held IronLedger account identifiers derived from screen text; graft cached 1,112 full Meridian prompts in `~/.meridian/graft/.cache/`. Both deleted. Added `~/.meridian/.claude/settings.json` (`disableAllHooks: true`, `autoMemoryEnabled: false`); a manual `claude -p` in that dir confirmed no graft/IJFW writes.

**Why:** screen text includes financial and secret material; it must not spread into other caches or memory.

**How to apply:** if `~/.meridian/graft/` or a `memory/` dir under that project reappears, Meridian's invocation bypasses project settings (e.g. `--setting-sources user`) — escalate. Any ICF/Meridian integration reads only `app_sessions` aggregates, `activity_context`, and `pm_worklog_hours`; never `capture_frames`/`capture_ui_events`. Still open: Meridian OTLP telemetry contents unaudited, `ignored_apps`/`ignored_urls` empty, analytics on.
