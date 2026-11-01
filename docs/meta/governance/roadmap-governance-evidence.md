# Roadmap governance evidence

Moved from `AGENTS.md` on 2026-11-01. The rule itself stays in `AGENTS.md`.

Roadmaps belong in `docs/meta/` (global) or project roots (cic-ingestion/, rewrite-docs/, rewrite-mcp/, kb-sync/ only).

All other locations are forbidden:

- .claude/worktrees/
- Nested clones / temp workspaces
- archive/ (historical only)
- Sync artifacts / node_modules / backups

Local pre-commit hook (`.git/hooks/pre-commit.ps1`, Gate 2) blocks violations on every commit — verified 2026-08-09 and 2026-08-30 by running `pre-commit.ps1` directly (force-staged a `roadmap.md` under `.claude/worktrees/`, `Test-RoadmapLocations` wrote "ROADMAP.md creation blocked outside allowed locations" and the hook exited 1). Until 2026-10-04 the installed `.git/hooks/pre-commit` shim did not call `pre-commit.ps1` (an IronLedger-only shim had overwritten it), so Gate 2 did not run on real commits; the canonical shim `CIC-GOVERNANCE/scripts/pre-commit-shim.sh` now chains IronLedger, secret-scan, and `pre-commit.ps1`, and an end-to-end block via `.git/hooks/pre-commit` was verified 2026-10-04. The hook lives in `.git/hooks/`, which Git does not track: a fresh clone has only the `*.sample` files until the hooks are installed locally, so this gate cannot be confirmed from the committed tree alone — inspect `.git/hooks/pre-commit.ps1` in a configured checkout, or run it against a staged test file, to corroborate. Hook is gitignore-scoped: `.claude/worktrees/` files must be `git add -f`'d to even reach the gate, since the dir itself is gitignored. A CI job (`governance.yml` `roadmap-location`) now scans tracked files for roadmap-location violations; separately, `.github/workflows/retro-full-audit.yml` does run on a `schedule:` trigger (added 2026-08-03 as `cron: '30 7 * * 5'` Fridays; changed to daily `cron: '30 7 * * *'` on 2026-08-26 — verify current value at `.github/workflows/retro-full-audit.yml:5` directly, since history rewrites can orphan cited commit hashes) but doesn't check roadmap placement; `docs/meta/roadmap-consolidation-design.md` does not exist in this checkout. CI enforcement of roadmap location: `governance.yml` job `roadmap-location` (added 2026-10-04) fails on tracked ROADMAP.md outside allowed roots.
