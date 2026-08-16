---
name: session-wrap-2026-07-15-retro-telemetry-fix
description: "Fixed gstack skill-usage telemetry (missing analytics dir) and confirmed retro's TODOS.md/telemetry graceful-skip behavior"
metadata: 
  node_type: memory
  type: project
  originSessionId: b33a0fd9-b60d-4de4-9f89-2c8040789800
---

Root cause found for two blank retro data sources ([[MEMORY]] session 2026-07-15): `~/.gstack/analytics/` directory never existed, so the `>> skill-usage.jsonl` append lines already present in 53/69 gstack skills were failing silently (redirected to `2>/dev/null || true`). Fixed with `mkdir -p ~/.gstack/analytics` — one-time, global, non-destructive. Skill-usage telemetry should start populating from the next gstack skill invocation.

TODOS.md (repo-root backlog file retro reads for "Backlog Health") was deliberately NOT created this session — user confirmed backlog stays in memory system + docs/meta, not a competing single-file convention. **Superseded 2026-07-15 (later session)**: flagged twice in retro (07-12, 07-15) as a recurring gap, user reversed the decision and had it created. See [[feedback_todos_md_decision]].

**Why:** retro's SKILL.md is gstack-managed (auto-generated from `.tmpl`, regenerated via `bun run gen:skill-docs`) — editing it directly would get clobbered on `/gstack-upgrade`. The actual gaps were environmental (missing dir) and a deliberate convention choice, not a skill defect.

**How to apply:** if skill-usage telemetry still looks empty in a future retro, check `~/.gstack/analytics/skill-usage.jsonl` exists and has recent entries before assuming the skill is broken again.

End of session 2026-07-15: working tree had 11 modified + 5 untracked files uncommitted (kb-sync-nightly refactor: CHANGELOG.md, src/index.ts new, run.sh deleted; skill-security-auditor.py; FIX-KB-SYNC-NIGHTLY-PATH.md; docs/meta draft docx; 2 retro JSON snapshots) — none touched this session, left uncommitted pending user decision on scope/readiness.
