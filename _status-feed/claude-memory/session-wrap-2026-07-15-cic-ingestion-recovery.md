---
name: session-wrap-2026-07-15-cic-ingestion-recovery
description: "c:\\dev CHANGELOG backfill + cic-ingestion main->master rebase, qdrant removal, and recovery of 18 permanently-lost source files from stale dist/ output"
metadata: 
  node_type: memory
  type: project
  originSessionId: 77d54c09-1b77-4d8b-b6fa-44351f19c78d
---

**c:\dev:** CHANGELOG.md was stale since 2026-06-28 (v1.1.0), 198 commits behind. Backfilled to v2.0.0 grouped by phase/milestone (governance v2.0 rewrite, Toolforge Marketplace Phase 8, Phase 9 waves A-D, chat-agent pipeline). VERSION.md bumped, committed 6750f1f, pushed. See [[changelog_discipline_gap]].

**cic-ingestion:** Rebased local `master` onto `origin/master` (user's plan assumed branch name `main` — actual default is `master`, corrected before running). 98 commits rebased clean except 1 trivial conflict (cosmetic echo-line diff in `.github/workflows/phase-1-gate.yml`). Had to commit dirty Phase 7 rollback work first (rollback-executor.ts, snapshot-capture.ts, config/featureflag/health-check rollback modules) before rebase would run.

Follow-on: `npm install` broken — `qdrant-js` dependency was a squatted npm placeholder (only version ever published: `0.0.1-security`), never actually imported anywhere in the codebase (dead weight). Removed it entirely rather than version-bump or swap to `@qdrant/js-client-rest`.

Fixing that unblocked install but surfaced 18 failing test suites (of 35). Chased down and fixed:
- Widespread `.ts`-extension imports (44+ files, pre-existing convention) — added `tsconfig.jest.json` (allowImportingTsExtensions + noEmit) so ts-jest handles them without breaking the real `tsc` build.
- Missing deps: commander, uuid, fs-extra, @types/express, node-cron.
- `node-fetch` v3 (ESM-only) broke ts-jest's CJS transform — removed the package entirely in favor of Node 24's native `fetch` (6 files: 3 providers/adapters, HttpGetAdapter/HttpPostAdapter, 1 test).
- 3 real type bugs: `PromotionEngine.decide()` only typed for `CanaryResult` but its body already handled the older `CanaryMetrics` shape too (widened signature to match); `CanaryEngine.execute()` imported the wrong `GovernanceDecision` type from a cross-repo path (two legitimate call sites needed both shapes — widened to a union rather than picking one); `CohortDecision.metrics` wasn't typed `readonly` despite the type being explicitly documented "immutable audit trail."
- **Reconstructed 18 source files that were permanently lost from git** (never committed in this repo OR the prior monorepo it split from — confirmed via full `git log --all` search in both). Recovered from stale gitignored `dist/` build output (`.js` + `.d.ts`, comments intact since `removeComments` was never set). This was a full LLM provider-routing subsystem: model registry/router, 6 provider adapters (Anthropic/Azure/Google/Ollama/local/OpenAI-compatible), RAG cache, resilience patterns (circuit breaker/rate limiter/retry/timeout/fallback chain), a fire-drill test harness, observability events/metrics, a state store.
- Fixed a real runtime bug in `AutonomyAPIServer.stop()`: `server.close()` was hanging ~13s on keep-alive sockets from `fetch()` calls — added `server.closeAllConnections()` (Node 18.2+).
- Fixed an undersized test timeout (5s default vs. a legitimately-25s-long simulated-timeout drill) by bumping the two affected tests to 30s.

**Discovered mid-session:** `node_modules/` was tracked in git (11,504 files) despite being `.gitignore`d — pre-existing mess, disturbed by repeated `rm -rf node_modules && npm install` cycles during dependency debugging. Untracked it (`git rm -r --cached`) as part of the final commit.

**Result:** test suite 230/230-passing-with-18-dead-suites → 443/449 passing, 34/35 suites green. Remaining failure (`tool-execution-docker.test.ts`) is a pre-existing Windows-path-vs-Docker-mount bug, unrelated to anything touched — confirmed via `git status` that those files were never modified this session. Committed `dee298ff`, pushed to `origin/master` (upstream tracking was unset — repo had never been pushed with a tracking branch before, set it).

**Why this mattered:** the user's original ask was a deterministic 6-step rebase-and-fix plan; both "just fix qdrant" and "the fix will be quick" turned out false. Real value was in stopping at each fork (branch-name mismatch, dirty tree, scope-ballooning test failures, discovering the orphaned file tree, discovering node_modules was tracked) to confirm before proceeding rather than silently expanding scope or guessing.

**How to apply:** if cic-ingestion needs further work, the 25-file orphaned subtree is now fully recovered under `src/resilience/`, `src/observability/`, `src/providers/`, `src/core/`, `src/agents/`, `src/cache/`, `src/server/`, `src/tests/mocks/`, `src/tests/d-phase/` — treat these as first-class source now, not leftovers. If another repo in this workspace shows the same `../../../src/...` cross-repo-relative import pattern, it's very likely the same monorepo-split residue and worth checking `dist/` before assuming the code was never written.
