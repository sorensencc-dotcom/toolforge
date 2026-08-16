---
name: changelog_discipline_gap
description: CHANGELOG.md/VERSION.md exist at c:\dev root but go stale — last update 2026-06-28 sat 198 commits behind by 07-14
metadata:
  node_type: memory
  type: project
  originSessionId: 77d54c09-1b77-4d8b-b6fa-44351f19c78d
---

CHANGELOG.md + VERSION.md exist at repo root (not absent — corrected from earlier assumption). Last touched at commit ed042da (v1.1.0, 2026-06-28). By 2026-07-14, 198 commits had landed unlogged (governance v2.0 rewrite, skill migrations, Toolforge Marketplace Phase 8, Phase 9 waves A-D, chat-agent pipeline). Backfilled 07-14 as v2.0.0, grouped by phase/milestone (not commit-by-commit — too many to itemize).

**Why:** file existing isn't same as file maintained. Nobody bumps it mid-phase; only noticed 198 commits later.

**How to apply:** bump CHANGELOG.md/VERSION.md at phase/gate boundaries (matches existing Tier 1 gate cadence), not per-commit. Check staleness next time a phase closes — don't let another 190-commit gap accumulate.
