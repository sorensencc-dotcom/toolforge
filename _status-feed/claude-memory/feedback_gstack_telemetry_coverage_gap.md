---
name: feedback_gstack_telemetry_coverage_gap
description: gstack-upgrade skill was missing skill-usage.jsonl telemetry line; fixed by hand since bun toolchain is unavailable on this machine
metadata: 
  node_type: memory
  type: project
  originSessionId: de2ca311-9be7-4aba-9bcb-4e4a5a671e02
---

Checked telemetry coverage after [[feedback_push_discipline_hook]]-adjacent work on skill-usage.jsonl (see [[session-wrap-2026-07-15-retro-telemetry-fix]]): 53/71 dirs under `~/.claude/skills/gstack/` had the `>> ~/.gstack/analytics/skill-usage.jsonl` append line in `SKILL.md`. Of the 18 without it, 17 are non-skill support dirs (`bin/`, `lib/`, `test/`, `docs/`, etc. — no `SKILL.md` at all). Exactly one real skill was missing it: `gstack-upgrade`.

Added the standard telemetry block (copied verbatim pattern from `unfreeze/SKILL.md.tmpl`) to both `gstack-upgrade/SKILL.md.tmpl` and the rendered `gstack-upgrade/SKILL.md`, right after the title line.

**Why manual double-edit, not just `.tmpl` + regen:** `SKILL.md` files are marked "AUTO-GENERATED from SKILL.md.tmpl — do not edit directly, regenerate via `bun run gen:skill-docs`" — but **bun is not installed on this machine** (`bun`, `where bun`, `Get-Command bun` all fail; `.bun/bin/bun.exe` does not exist despite `Get-Command` claiming a path once). The generator script uses Bun-specific APIs, so it can't be run under plain node either. Had to hand-edit the rendered file to match what the generator would have produced.

**How to apply:** any future edit to a gstack `.tmpl` file needs the same manual mirror into the corresponding `SKILL.md` until bun is installed — otherwise `.tmpl` and rendered docs will silently drift. Logged as an open item in `TODOS.md`. If bun later gets installed and someone runs the real generator, diff the manually-edited files against generator output to confirm no formatting drift crept in.
