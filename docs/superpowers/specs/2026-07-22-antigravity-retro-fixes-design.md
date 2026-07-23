# Design: Antigravity Retro Fixes (2026-07-22)

**Status:** v3 — reviewed, open questions resolved, ready for implementation plan.

## Source

6 retro items from Antigravity's 2026-07-21 22:41 coding session (3 "things to improve", 3 "habits for next session"). Verified against live repo state on 2026-07-22 rather than taken at face value.

## Scope

Repos: `C:\dev` (root), `cic-ingestion`, `rewrite-docs`, `rewrite-mcp`, `kb-sync` — all standalone git repos under `C:\dev`.

## Findings (verified against live repo state, v2)

| # | Retro item | Status |
|---|---|---|
| 1 | WSL2 I/O: skip node_modules/.git in filesystem crawls | **Gap** — 2 scripts (not 3; `cic-log-archival.sh`'s 4 `find` calls are already `-maxdepth 1`-scoped to specific log dirs, no fix needed there) |
| 2 | Hook installers: dynamic SCRIPT_DIR / git-root resolution | **Already correct** in the scripts that use it — no fix needed |
| 3 | Telemetry files (`.performance-report.json`, `.validation-report.json`) in .gitignore | **Gap** — missing in 4 of 5 repos |
| 4 | Pre-flight script before commit/PR | **Gap** — missing in 4 of 5 repos |
| 5 | Migration/backfill scripts dry-run capable | **Already correct** — existing script already supports it |
| 6 | Pre-commit secret/leak scanner | **Gap** — enforced in only 1 of 5 repos (rewrite-mcp, via husky). rewrite-docs has the script file but nothing calls it. Root, cic-ingestion, kb-sync have no scanner at all. |
| 7 (new, found during review) | Root pre-commit hook topology | **Bug** — two competing installers overwrite the same `.git/hooks/pre-commit`; the currently-active one silently dropped retro-schema and roadmap-location enforcement that CLAUDE.md documents as active |

## Fixes

### 1. Root hook installer collision (new — item 7, do this first)

`setup-git-hooks.ps1` (repo root) and `CIC-GOVERNANCE/scripts/setup-git-hook.mjs` both write `.git/hooks/pre-commit`. Currently installed: the mjs version (contract validation + sibling-leak scan only). The ps1 version's content (retro-schema validation, roadmap-location check, skills/utilities CI gate) is stranded in `.git/hooks/pre-commit.ps1`, which nothing currently invokes — **those two checks are not running**, contradicting CLAUDE.md ("Pre-commit hook blocks violations" for roadmap governance).

Fix: merge into one hook. `setup-git-hook.mjs`'s generated shim should chain both scripts:

```bash
#!/usr/bin/env bash
if [ -f "CIC-GOVERNANCE/scripts/governance-validate-precommit.sh" ]; then
  bash CIC-GOVERNANCE/scripts/governance-validate-precommit.sh || exit 1
fi
pwsh -NoProfile -File "$(dirname "$0")/pre-commit.ps1" "$@"
```

Edit the `hookContent` template inside `setup-git-hook.mjs` (source of truth), then re-run both installers so `pre-commit.ps1` and the merged shim are both current. Do not hand-edit `.git/hooks/pre-commit*` directly — regenerated content is silently discarded per [[learning-hooks-generator-source-of-truth]].

### 2. Telemetry gitignore (item 3)

Add to `.gitignore` in root, `cic-ingestion`, `rewrite-docs`, `rewrite-mcp`:

```
.performance-report.json
.validation-report.json
```

Bare filename pattern (no leading `/`) already matches at any directory depth — confirmed empirically with `git check-ignore -v` against a nested test file; kb-sync's existing entries rely on the same behavior. No `**/` prefix needed.

`kb-sync/.gitignore` already has both — no change there.

Verify: `git check-ignore -v .performance-report.json` and `git check-ignore -v some/nested/dir/.performance-report.json` in each repo, confirm both resolve to the new gitignore line.

### 3. Secret-scan hook (item 6)

Current state is worse than "copy to 3 repos" — the two existing copies (rewrite-docs, rewrite-mcp) have **already drifted** (differing credential regex: rewrite-mcp allows `_-` in the `sk-` pattern, rewrite-docs doesn't), and rewrite-docs' copy isn't wired to anything.

Canonical regex (confirmed): `sk-[a-zA-Z0-9_-]{20,}` — rewrite-mcp's version wins. Update rewrite-docs' copy to match when establishing the canonical source.

Verified live (resolves all three open questions from v2):

- **rewrite-docs**: `core.hooksPath` unset, no `.husky`, `.git/hooks/pre-commit` is only the `.sample` stub — **no hook installed at all**. Needs a fresh installer, not a wire-in.
- **kb-sync**: no installer exists. Confirmed language: **PowerShell installer, with a `bash`/git-bash call inside for the scanner** — same shape as the cic-ingestion fix below.

Fix:

- Establish one canonical copy at `C:\dev\scripts\secret-scan-hook.sh`, using rewrite-mcp's regex (`sk-[a-zA-Z0-9_-]{20,}`). Update rewrite-docs' existing copy to match — it's currently the stricter/wrong one.
- Each repo keeps its own copy (independent repos, not a monorepo — no cross-repo relative path works). Add a parity check: a script or pre-flight step that diffs each repo's copy against the canonical one and fails if they differ.
- Per-repo wiring, matching each repo's actual hook mechanism (verified live, not assumed uniform):
  - **root**: add invocation to the merged shim from fix #1 (bash context — natural fit).
  - **cic-ingestion**: hook is PowerShell (`core.hooksPath = .githooks`, `pre-commit.ps1`). Add a `bash scripts/secret-scan-hook.sh` invocation line inside that ps1.
  - **rewrite-docs**: no hook exists — write a new installer (recommend matching root's pattern: PowerShell installer generating `.git/hooks/pre-commit`, git-bash call inside for the scanner, consistent with cic-ingestion and kb-sync rather than introducing a 3rd installer style).
  - **kb-sync**: no installer exists — write new PowerShell installer with a bash call inside for the scanner (confirmed pattern).
  - **rewrite-mcp**: already correct via husky — no change.

### 4. Pre-flight npm script (item 4)

Add `"pre-flight"` script to each `package.json`, composed only from scripts that already exist:

| Repo | `pre-flight` command |
|---|---|
| root | `npm run lint && npm test` |
| cic-ingestion | `npm test` |
| rewrite-docs | `npm run lint && npm test` |
| rewrite-mcp | `npm run validate-design && npm run policy:check` |

`kb-sync` already has `kb:pre-flight` — no change.

Acceptance evidence per repo: exit code 0 on a clean checkout, and `git status --porcelain` shows no new/modified tracked files after the run (catches scripts that mutate generated files in place).

### 5. WSL2 find scope (item 1)

Only 2 scripts need the fix (not 3 — see Findings table):
- `claude-skills/scripts/convert.sh` (line 434) — add `-not -path './node_modules/*'` alongside the existing `-not -path './.git/*'`.
- `claude-skills/scripts/review-new-skills.sh` (line 49) — add `-not -path '*/node_modules/*'` alongside existing exclusions.

Note: no `node_modules` currently exists within either script's scan depth, so this is a defensive/future-proofing fix, not a measured perf win today.

### 6. Script authoring conventions doc (items 2, 5 — policy only, no code change)

New file: `docs/meta/governance/script-authoring-conventions.md`, with a status header:

```text
Status: proposed
Owner: <user>
Effective date: pending Tier 1 review
```

Contents:
- **Hook path resolution**: any new git hook installer must resolve paths dynamically — bash via `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`, Node via walk-up-to-`.git` (see `CIC-GOVERNANCE/scripts/setup-git-hook.mjs::findGitRoot` and `CIC-GOVERNANCE/scripts/governance-validate-precommit.sh` as reference implementations).
- **One hook installer per repo**: exactly one mechanism may write `.git/hooks/pre-commit` (or equivalent). Document which one, in the repo's own README/CLAUDE.md, before adding a second — this design's item #1 fix exists because that rule was violated silently.
- **Migration dry-run**: any new backfill/migration script must accept a dry-run flag before it can write. See `utilities/roadmap-migration-helper.ps1` (`-DryRun`) as reference.

Add one reference line under "Governance & Design Standards" in `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md` pointing to the new doc. Do not phrase that reference as a "must" until the doc's status moves from `proposed` to `effective`.

## Out of scope

- No new test infrastructure — `pre-flight` only composes existing scripts.
- No repo-wide sweep for other unscoped `find` crawls beyond the 2 identified.
- Reconciling *why* two hook installers exist at root (history/intent) — fix #1 only resolves the collision going forward.

## Verification

- Per-repo expected-diff matrix (not one aggregate `git diff --stat`, since root already has substantial unrelated dirty state):
  - root: `.gitignore`, `CIC-GOVERNANCE/scripts/setup-git-hook.mjs`, regenerated `.git/hooks/pre-commit*` (untracked, expected).
  - cic-ingestion: `.gitignore`, `package.json`, `.githooks/pre-commit.ps1`, `scripts/secret-scan-hook.sh` (new).
  - rewrite-docs: `.gitignore`, `package.json`, hook wiring file (TBD per open question 2), `scripts/cic-log-archival.sh` unchanged (removed from find-fix scope).
  - rewrite-mcp: `.gitignore`, `package.json`.
  - kb-sync: new installer script (TBD per open question 3).
- `git check-ignore -v` for both telemetry filenames, root + one nested path, in each of the 4 repos getting the gitignore change.
- `pre-flight` run in each of the 4 repos: exit 0, `git status --porcelain` clean after.
- Secret-scanner test **without a real commit**: `git add` a temp file containing a matching credential pattern in a disposable location (or a throwaway worktree), run the hook script directly (not via actual `git commit`), confirm nonzero exit; repeat with a safe placeholder, confirm zero exit; `git reset` the temp file afterward regardless of outcome.
- Confirm merged root hook (fix #1) still runs retro-schema validation and roadmap-location check by staging a deliberately-violating retro JSON and a misplaced ROADMAP.md in a scratch commit test, same disposable-worktree approach as above.

## Revision Notes (v2)

External review (LunaLight) caught real defects in v1: wrong root hook file path, secret-scanner "identical copies" claim false (verified drift), overstated `find`-fix scope (cic-log-archival.sh wasn't a real gap), and unsafe verification plan (real commits). All confirmed against live repo state and incorporated above. One v1 suggestion rejected after empirical test: `**/`-prefixing the gitignore patterns is unnecessary — bare filename patterns already match at any depth in git.
