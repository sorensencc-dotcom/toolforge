---
name: session-wrap-2026-09-01-toolforge-charlie-adapter-recovery
description: "Recovered Codex-stalled Toolforge parallel-search \"charlie adapter\" push; landed bff19bbf to main, fixed cross-env pre-push hook, cleaned worktrees; parallel-search effort has NO in-repo spec and 5 shipped defects; next actions A-D defined."
metadata: 
  node_type: memory
  type: project
  originSessionId: 858160a2-7755-4c3d-addd-22e52d82ef9d
  modified: 2026-09-02T02:28:28.911Z
---

# Session wrap — Toolforge parallel-search / charlie adapter recovery (2026-09-01)

Codex got stuck trying to commit + push a Toolforge adapter across a WSL/Windows
Git boundary, then its session became unreliable ("porked"). This session took
the effort over, landed the commit, fixed the real blocker, cleaned up, and
reviewed the whole parallel-search effort.

## What shipped

- **`bff19bbf feat: add fail-closed charlie research adapter`** — MERGED to
  `github.com/sorensencc-dotcom/toolforge` `main` (via user, after PR).
  - Adds `skills/parallel-search/src/charlie-deep-research-adapter.ts` +
    `.test.ts` (2 files, 48 lines). `charlieDeepResearchSearch(topic, persona,
    options)`: disabled by default, normalizes `{title,url,snippet}` records,
    masks provider errors. 3 mocked tests.
  - Was built in worktree `C:\dev\dev-sandbox\toolforge-parallel-charlie-adapter`
    on branch `codex/parallel-search-charlie-adapter-clean`, cut from toolforge
    `origin/main` (`658da2aa` = PR #15).

## The real blocker + fix

`C:\dev` IS a clone of `github.com/sorensencc-dotcom/toolforge.git` ("Toolforge"
= the C:\dev monorepo). Its shared `.git/hooks/pre-push` ran
`node ./scripts/sync-github-wiki.mjs` unconditionally. That script exists only in
the C:\dev main working tree, **not on `origin/main`**, so any worktree cut from
toolforge `main` fails the push with `MODULE_NOT_FOUND` (`set -e` aborts).

**Fix applied:** rewrote `C:\dev\.git\hooks\pre-push` to guard both steps
(skill-doc validator + wiki sync) — each `[ -f ... ]` / `[ -d ... ]` checks its
target and skips cleanly when absent. Behavior unchanged when files present
(C:\dev main tree). Original saved at
`C:\dev\.git\hooks\pre-push.bak-20260831`. This is a LOCAL untracked hook —
other clones still carry the unconditional version. Proper fix = tracked hook
(`.husky/` or `core.hooksPath`).

Same class as the pre-commit failure Codex hit first: WSL git → shared hook →
`pwsh -File /mnt/c/...` → Windows PowerShell can't resolve WSL paths or WSL git.
Cross-env commits/pushes must run from a native Windows terminal.

## Cleanup done

- Removed worktrees `toolforge-parallel-charlie-adapter` (admin dir
  `.git/worktrees/toolforge-clean`) and `toolforge-downstream-adapter`
  (stale, nothing ahead of main). Local + remote branches deleted, pruned,
  verified clean. `git worktree remove` failed on a backslash/quoted `gitdir`
  path mismatch — needed manual `rm` of dir + `.git/worktrees/<name>` + prune.
  That malformed worktree entry was also what broke the user's review-task
  dispatch ("invalid project/worktree argument").

## Cleanup STILL PENDING (classifier blocked every rm/mutation this session — run in PowerShell)

```powershell
Remove-Item -Force C:\dev\.git\hooks\pre-push.bak-20260831
Remove-Item -Force "C:\dev\skills\parallel-search\{"
Remove-Item -Recurse -Force "C:\Users\soren\Documents\Codex\2026-08-31\resume-the-next-milestone-in-https\toolforge"
```

- `skills/parallel-search/{` — stray 0-byte file, shell-redirect botch. In the
  local working tree only, NOT on `origin/main`.
- `Documents\Codex\...\toolforge` — abandoned full clone, on main, no unpushed
  work, no stash. Safe to delete.

## parallel-search effort review

**NO SPEC EXISTS.** No design doc for parallel-search or the charlie adapter
anywhere in `docs/`. PR #15 bundled the code with the *sigil* inter-relay
routing spec. The "next milestone" Codex chased pointed at an external
`https://` Parallel docs URL, never captured in-repo. This is the core recovery
gap.

Built (on `origin/main`): `skills/parallel-search/src/index.ts` exports
`parallel_search` / `parallel_extract` / `parallel_task` — fail-closed wrappers
over `parallel-web@^0.3.0`, input validation before network, stable error codes
(`API_KEY_MISSING`, `INVALID_INPUT`, `INVALID_API_RESPONSE`,
`PARALLEL_API_ERROR`), no credential/exception leakage. 5 mocked tests pass via
`npm test` (`tsx --test src/index.test.ts`).

### Defects shipped to main by Codex

1. `README.md` + `tests/README.md` — literal `` `n`n `` PowerShell here-string
   escapes instead of newlines. Broken markdown. (`grep -c '`n'` on
   `origin/main:skills/parallel-search/README.md` = 1 line, multiple literals.)
2. No `tsconfig.json` anywhere in repo — "TypeScript checks passed" claims
   unverifiable; `tsx` strips types, nothing type-checks the `.ts`.
3. `npm test` script only references `src/index.test.ts` — charlie adapter test
   NOT wired in. `tsx --test fileA fileB` silently runs only the first file's
   tests. Green CI is misleading.
4. Zero real-API validation — every test uses `clientFactory` mocks.
   `TaskOutput` shape (`run_id`, `interaction_id`, `is_active`, ...) asserted
   against a hand mock, never `parallel-web@0.3.0`'s real response. High risk of
   `INVALID_API_RESPONSE` on first live call.
5. `parallel_search` hard-caps `search_queries` at 2–3 — arbitrary, not traced
   to any Parallel API constraint.

SKILL.md explicitly defers async task result retrieval ("belongs to a later
integration phase") — that's the actual unfinished milestone.

## Next actions (need a fresh session; A blocks the rest)

- **A** — Write the spec:
  `docs/superpowers/specs/2026-08-31-parallel-search-integration-design.md`.
  Scope (Search / Extract / Task Run / result polling), Charlie consumer
  contract, fail-closed guarantees, async task lifecycle (create → poll →
  retrieve). Fold in the external Parallel milestone URL.
- **B** — Fix-up PR off a `C:\dev\dev-sandbox` worktree: rewrite both README
  files with real newlines; add `skills/parallel-search/tsconfig.json` +
  `typecheck` script wired into `npm test` + pre-push; fix `npm test` to run
  both suites and assert the count.
- **C** — Live smoke test guarded by `PARALLEL_API_KEY` (skip when absent)
  hitting real Search + Task Run create, asserting real response shapes;
  reconcile `SearchOutput` / `TaskOutput` types with `parallel-web@0.3.0`;
  verify or cite the 2–3 query cap.
- **D** — Build the deferred milestone: `parallel_task_result(run_id)` polling
  wrapper, same fail-closed contract; wire `charlieDeepResearchSearch` to route
  deep research through Task Run vs Search (the `taskRun` option is already
  threaded through `RuntimeOptions`).

## Process note

All future parallel-search work: `feat/parallel-search-*` branches from a
`C:\dev\dev-sandbox` worktree, PR-per-task, human review before merge. Codex
track record this effort: no spec, `` `n `` corruption, stray `{` file,
misleading green tests, WSL/Windows hook confusion, unreliable session. See
[[feedback_codex_scope_creep_autopush_sigil]] and
[[feedback_verify_subagent_test_reports]].

## Unrelated, noted

Cross-session: dev-fc owns the `subagent-driven-development` resume for
`.superpowers/sdd/2026-08-30-sigil-inter-relay-routing` (Task 19 + final
whole-branch review). dev-93 and dev-88 stood down. Not this session.
