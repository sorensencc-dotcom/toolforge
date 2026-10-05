---
name: session-wrap-2026-10-01-ci-governance-merge-fixed
description: "PR #70 (ci-governance-matrix fix) merged to toolforge main after catching a real merge-resolution bug via delivery-guard tests"
metadata:
  node_type: memory
  type: project
  originSessionId: c0dead69-32b0-4662-9273-908904581bb4
  modified: 2026-10-01T16:37:52.580Z
---

Merged `be42ea89` (CI governance-matrix checkout fix) into `sorensencc-dotcom/toolforge` main as `b37b9fdd` via PR #70, 2026-10-01.

**What happened:** 33-file merge conflict (`main` ce880c3f vs branch be42ea89). Resolved 28 generated/wiki files to `main`'s side, 5 real files per-hunk. First pass on `.github/workflows/ci-governance-matrix.yml` was wrong — kept `continue-on-error: true` on both checkout steps (only picked the repo-name hunk), which is the opposite of what the original fix commit (`2512fede`) did. `CIC-GOVERNANCE/packages/delivery-guard`'s own test suite (`npm --prefix CIC-GOVERNANCE --workspace @cic/delivery-guard test`) caught it via `ci-wiring.test.js` asserting `doesNotMatch(workflow, /continue-on-error:\s*true/)`. Fixed, amended commit, force-pushed, re-verified 92/92 tests pass, merged.

**Why:** Manual multi-file merge resolution is error-prone even with careful per-hunk review — always re-run the real test suite against the final merged tree before committing, not just conflict-marker-absence checks.

**How to apply:** For any manual merge resolution touching a file with its own regression tests (workflows + their `ci-wiring.test.js`-style guards), run those tests against the merged worktree before finalizing, not just `node --check`/syntax validation.

**Known false-positive confirmed again:** `Delivery guard automation policy` fails on the `push`-triggered run because it audits every individual historical commit in the branch, not the PR's net diff — flagged pre-existing commit `0073622` (`kb-sentinel-bot.mjs` added without paired test, predates this session). Same root-cause class as [[session-wrap-2026-09-28-toolforge-pr64-delivery-guard-fixed-merged]]. The `pull_request`-triggered run (which actually gates merge) passed. No branch protection on `main` — `mergeable: MERGEABLE` was the real gate, not the check rollup.

Nothing open from this thread. Disposable worktree `/tmp/mergecheck2` removed, `node_modules` junction it created cleaned up with it.
