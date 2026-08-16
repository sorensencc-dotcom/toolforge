---
name: session-wrap-2026-07-17-skill-migration-runtool-repair
description: "Global skill triage/migration (3 retired, 3 shipped) + run-tool.ps1 was silently broken for all 34+ registered skills, 6 bugs found and fixed + verified end-to-end, plus a security-scanner false-positive fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: e4e14930-d8e9-4be4-ad89-e2a1859a4645
---

**What shipped, pushed to origin/main on both `c:\dev` and `c:\dev\toolforge`:**

1. Triaged 6 candidate global Claude Code skills (`~/.claude/skills/`) for
   overlap against gstack/toolforge. Retired 3 non-functional/duplicate
   ones (`retrospective-analyzer`, `idea-inbox-harvester`: regex stubs
   reinventing `/retro`+`/learn` with hardcoded canned output;
   `permission-audit`: duplicate of the built-in `fewer-permission-prompts`
   skill). Migrated 3 real ones into `toolforge/skills/` with actual
   rewrites, not copy-paste: `session-wrap` v1.1 (no more blind
   `git add -A` — that pattern already caused two documented concurrent-
   session collisions in this project), `skill-health-monitor` v1.0
   (ground-up rewrite — the global version returned hardcoded fake metrics
   regardless of input), `automation-audit` v1.0 (generalized off a
   hardcoded `C:\CIC_MEDIA_LIBRARY` path). 11/11 new tests pass. Registered
   4 orphaned skill directories that existed on disk but were never in
   `manifest.json`.

2. **`run-tool.ps1` was silently broken for `-Run`/`-Inspect` on every one
   of the 34+ registered skills** — found while tracing why newly-
   registered skills weren't showing in the dashboard. 6 real bugs: wrong
   `$TOOLFORGE_ROOT` (pointed at the script's own dir, `C:\dev`, not
   `toolforge/`), `Discover-Skills` reading `entrypoint`/`runtime`/
   `category` from a nonexistent `metadata.*` nesting, `Update-Manifest`'s
   merge matching display-name against id (dormant bug — next `-Refresh`
   would've duplicated all 34 entries), `Inspect-Tool`/`Invoke-Tool`
   matching lookups on display name instead of id, no manifest entry
   having a `path` field at all, and `api/telemetry/server.js`'s
   `DB_PATH` pointing at a nonexistent file. Fixed all 6, verified with a
   real recorded telemetry row in `run-store.db` (not just "tests pass").

3. Security scanner FS-BINARY false positive on `post_seal_ops/*.bin`:
   investigated, found it's an intentional immutable-storage naming
   convention (`publish_artifact.py` hardcodes `.bin`), not a naming
   accident — see [[feedback_verify_fix_by_running_not_reading]] for the
   mistake caught mid-fix. Real fix was a narrow path-exact allowlist in
   `skill_security_auditor.py`, applied to both tracked copies (see
   [[learning-two-skill-trees]]).

4. Fixed `.git/hooks/pre-commit` in `toolforge/` — was silently blocking
   every commit (pwsh `-File` requires a `.ps1` extension a git hook can
   never have; real logic lived in `pre-commit-impl.ps1` but the dispatcher
   had been regenerated wrong). `post-merge` has the identical bug, left
   unfixed (cosmetic-only failure, logged in `TODOS.md`).

5. Ran `/retro` (7d window): 228 commits, 60% of raw LOC was
   `package-lock.json` noise (real signal ~80.8k), test ratio jumped
   8.4%→17.3% this session, 10-day streak. Snapshot at
   `.context/retros/2026-07-17-3.json`.

**Open items logged in `TODOS.md`, not fixed this session:** `post-merge`
hook bug, the dual-clone architecture itself needs an owning decision
(document vs. collapse), `run-tool.ps1` has zero test coverage protecting
against this exact bug class recurring.

**Process note:** Every git operation in both clones this session was
slowed by two multi-minute security-audit/validator hooks that don't
respect the tool-call timeout — commands appeared to fail (SIGTERM) while
the underlying git/hook process kept running detached. Correct handling:
check for a live process + stale `.git/index.lock` before retrying, wait
for it to actually finish, don't race it with a second git command.
