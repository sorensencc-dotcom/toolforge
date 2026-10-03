<!-- TOOLFORGE-VAULT-POINTER-START -->
# Persistent System Memory Pointer
> Managed by Toolforge sync-tools. Auto-generated on sync. DO NOT manually edit this block.
- Canonical Knowledge Base Root: C:\dev\kb-sync\obsidian\vault\wiki
- Ingest Guidelines: docs/targets/obsidian.md
- Primary Architecture Graph: [[Index]]
- Active Conventions: [[wiki-schema]]
- Log Audit Trail: [[Log]]
- Repository Target: dev
<!-- TOOLFORGE-VAULT-POINTER-END -->

Handoff: 2026-10-03
====================
Status
------
Unified doc sync: Tasks 1-7 of 11 done and reviewed. Review fixes and the WhichLLM image decision are done. Everything is pushed; no PRs yet. Plan: `C:\dev\docs\superpowers\plans\2026-10-01-unified-doc-sync.md` rev 4.

| Branch | Worktree | Head | State |
|---|---|---|---|
| toolforge `feat/unified-doc-sync` | `C:\dev\.worktrees\unified-doc-sync` | `242153d2` | pushed, 6 commits past `main` plus 3 review fixes plus image drop |
| kb-sync `feat/doc-sync-cache-prefix` | `C:\dev\.worktrees\kb-sync-doc-sync-prefix` | `8d58b286` | pushed |

Decisions
---------
- Task 7 had been committed on a detached HEAD, so it was never pushed. Fixed by fast-forwarding the branch. Check `git status -sb` for "no branch" before trusting a pushed claim.
- `loadProductCache` in `scripts/doc-sync/run.mjs` refuses a kb-sync whose `sync-cache.mjs` lacks `SUPPORTS_ID_PREFIX` (error `KB_SYNC_NO_ID_PREFIX`). Live `C:\dev\kb-sync` is on `main` and is refused. **Merge the kb-sync branch before any live `docs:sync`.**
- Result shape: `status` describes the wiki only (SYNCHRONIZED, UP_TO_DATE, DRY_RUN, FAILED). New `cache` field is LOADED, FAILED, or SKIPPED, with `cacheError`. The drift receipt follows `status`; the run `ok` is false if either failed. (Chris chose option 3.)
- WhichLLM image: Chris chose drop. Removed the "Provider topology" section from both OLLAMA guides, and removed the OLLAMA_PROVIDER_SETUP, OLLAMA_DEPLOYMENT_GUIDE, and whichllm-model-selection-evaluator entries from `tools/wiki-browser-qa/diagram-policy.json` and `wiki-page-rules.mjs`. Policy now covers only toolforge-architecture-overview and GOVERNANCE.
- Sidebar guard now accepts existing asset links and resolves spaces and %20 to hyphens.

Verification
------------
- Doc-sync suite 44/44, kb-sync prefix tests 3/3 (before the image drop).
- After the image drop: 103/105 across doc-sync and wiki-browser-qa. The 2 failures are BrowserOS Neo audit tests; Neo was not running at `127.0.0.1:9010`.
- Build-only proof from the toolforge worktree: two builds identical, no `wiki/` folder, no clone.

Modified Files
--------------
- `scripts/doc-sync/run.mjs`, `publish.mjs`, `sidebar-guard.mjs` plus matching `tests/doc-sync-*.test.mjs`
- `OLLAMA_DEPLOYMENT_GUIDE.md`, `OLLAMA_PROVIDER_SETUP.md`
- `tools/wiki-browser-qa/diagram-policy.json`, `wiki-page-rules.mjs`
- kb-sync `modules/cache/sync-cache.mjs` and `tests/sync-cache-prefix.test.mjs`
- Hooks keep modifying `.ijfw/*`, `STATUS.md`, `AGENTS.md`, `GEMINI.md`, `TODOS.md` in the worktrees. Never stage them.

Next Steps
----------
1. Fix two things the build exposed, as part of Task 8: built `Home.md` links to dead `wiki/Index.md` and `wiki/ControlledEvidencePipeline.md` (`generateHome`), and `generateSidebar` still links the WhichLLM evaluator, WhichLLM, TRM, parallel-search, tinyfish-search, and Log pages, which 404 and will trip the sidebar guard.
2. Task 8: fill the registry (`docs/meta/governance/wiki-sync-registry.json` is `products: []`) and fix the markdown registry.
3. Task 9 Step 5 (deferred by Chris to the start of Task 9): add `.wiki-sync-receipt.json` to `.gitignore` in all 8 repos (C:\dev, kb-sync, trm, sigil-repo, icf, helix, toolforge-marketplace, rewrite-mcp), commit `chore(doc-sync): ignore wiki sync receipt` in each. Run the repo preflight first.
4. Open PRs for both branches when ready. Merge kb-sync first.
5. Never run a live sync from the worktree; `run.mjs` builds the cache DB path from its own location. Run it from `C:\dev`.

Blockers / Open Questions (need Chris)
--------------------------------------
- Tasks 8-11: per-product deletion lists, whether helix plans/specs are public, rewrite-mcp keep generated pages or drop the row, registry owners (Task 11).
- Task 9 Step 0: how `C:\dev` leaves `parkd821-20260908`.
- No live wiki push before Task 9.
- Not yet decided: whether a first wiki page must be created by hand for products with an empty wiki (cloning a wiki with no pages fails with `CLONE_FAILED`).

Known Issues (not ours)
-----------------------
- kb-sync main: `tests/trm-cache-boundary.test.mjs` `parseGapItems` expects `GAP-01`, gets `GAP-01--pending-gap`. Not re-verified on main.
- kb-sync pre-commit flagged `wiki/entities/sync-github-wiki.mjs.md` needs a sibling doc update.
- Parallel Search and TinyFish skill writeups sit in the `C:\dev\wiki` quarantine.
- Session ran several hours; retro not run for 2026-10-02 or 2026-10-03.
