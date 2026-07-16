# TODOS

Backlog of open work. Source of truth for "what's outstanding" — context/rationale lives in memory (linked per item). Update at session end when scope changes; retro reads this for Backlog Health.

## Open

- [ ] **Wave D full conformance gate** — code-level PASS only. Needs provisioned PostgreSQL 15+, `npm run migrate`, live E2E rerun (5 scenarios), live load test (assert p99 <200ms on list/search/trending/ratings), trending scheduler install verified. Blocked on infra (no PG in this dev environment; ad-hoc local PG rejected as fake-prod-signal). Tier 1 decision 2026-07-14. See `memory/wave-d-full-gate-requirement.md`.
- [ ] **Uncommitted files at repo root** (as of 2026-07-15): `AI_NEWS_SUMMARY_DEPLOYMENT_STATE.md`, `KB_SYNC_STATUS.md`, `SESSION_WRAP_20260715.md` — untracked, need commit-or-discard decision.
- [ ] **CHANGELOG/VERSION staleness watch** — bump at phase/gate boundaries, not per-commit. Last gap: 198 commits unlogged before 07-14 backfill. Check staleness at next phase close. See `memory/changelog_discipline_gap.md`.
- [ ] **bun not installed on this machine** — `gstack` skill-doc toolchain (`bun run gen:skill-docs`) can't run at all. Found 2026-07-15 fixing `gstack-upgrade`'s missing telemetry line: had to hand-edit both `SKILL.md.tmpl` and rendered `SKILL.md` in lockstep since regen is unavailable. Any future `.tmpl` edit needs the same manual double-edit until bun is installed — install it, or the two files will drift.

## Process (recurring, not one-shot)

- [x] **Push discipline** — Stop hook (`~/.claude/hooks/check-push-discipline.js`) now auto-checks c:\dev, cic-ingestion, CIC submodule for unpushed commits every session end. Live 2026-07-15. See `memory/feedback_push_discipline_hook.md`.
- [ ] **Session continuity notes** — multi-drop sessions (hour+ gaps between commits) should end each drop's commit message with a one-line "next: X" pointer. No tooling enforces this yet — manual discipline only. See `memory/session_continuity_gap.md`.

## Log

- 2026-07-15: File created. Backlog had been memory-only since 07-12; flagged twice in retro (07-12, 07-15) as a recurring gap. Decision: create real file instead of deferring again.
