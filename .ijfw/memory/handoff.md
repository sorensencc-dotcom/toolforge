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

Update 2026-10-04 (session ~2.6h, stopped per session-length rule)
==================================================================
Done
- Task 8 shipped. toolforge PR #81 and kb-sync PR #31 both MERGED. Delivery-guard fix: `tests/doc-sync-toolforge-build.test.mjs` pairs with the `sync-github-wiki.mjs` change in the same commit.
- Registry has 7 rows, all `enabled:false`. rewrite-mcp row dropped on purpose (generated dump, live wiki untouched; same as cic-ingestion). The markdown registry still lists a rewrite-mcp row; Task 11 restructures that table.
- Live `C:\dev\kb-sync` (`feat/notebook-cluster-question-manifests`) contains origin/main and has `SUPPORTS_ID_PREFIX`.
- `.wiki-sync-receipt.json` ignore is already on every repo's default branch. Nothing to do for Task 9 Step 5.
- Seed branches already exist and are pushed, each one commit off default branch: icf `docs/icf-wiki-seed` (`c1b6073`), toolforge-marketplace `docs/marketplace-wiki-seed` (`20c3d8c`, 21 files, byte-identical to a fresh clone of live wiki `5c15009` minus wiki/, docs/, kb-sync/, trm-gap), helix `docs/helix-wiki-seed` (`ce31a5d`, Home, README, helix-architecture.html/.svg).

Decisions (Chris)
- helix-phase-8-authority-lock.md stays OFF the public wiki (names internal hosts). Also off: superpowers/, the draft, the 3 contract requests. icf-v1/sigil-v1/contracts README are "candidate" docs; not seeded.
- Leave `C:\dev` on `parkd821-20260908`. No stash, reset, or switch. No fast-forward yet. TRM dry run and any live `docs:sync` wait for that.
- Never commit on checked-out feature branches; seed from default branch in a new worktree under `C:\dev\.worktrees\`.

Open / needs Chris
1. helix seed gaps (found, not fixed): the seed omits live `_Sidebar.md` and `_Footer.md`, so the first mirror run deletes them. Home.md also links `contracts/README` and `superpowers/*`, which are excluded, so those become dead links. Fix = add `_Sidebar.md` and `_Footer.md` to the seed and trim those Home.md lines. Needs go-ahead: it edits content beyond a straight copy.
2. toolforge-marketplace seed is the Toolforge Platform wiki's top-level pages ("Toolforge Platform" Home, whichllm topology image, OLLAMA guides), not marketplace-specific content. The registry's "23 curated pages" note was wrong. Chris reviews the deletion list (wiki/ 372, docs/ 183, kb-sync/ 2, trm-gap-triage-architecture.*) before anything live.
3. Seed PRs for icf, marketplace, helix are not opened.
4. `C:\dev` fast-forward onto merged main, then Task 9 Step 1 (trm dry run). Step 0 questions: what removed 8 `.trm/inbox/outbox/receipt-*` files in the `C:\dev` working tree.
5. icf default branch is `origin/codex/weekly-retro-reporting`, not main. Confirm before merging seed there.
6. Still unrun for 2026-10-02 and 2026-10-04: retro.

Update 2026-10-04 (later)
-------------------------
- helix seed fixed + pushed: `docs/helix-wiki-seed` `a430d74` (added `_Sidebar.md`/`_Footer.md`, removed 5 dead Home.md links). No PR yet. Leftover: `wiki/README.md` has 5 repo-relative `docs/superpowers|contracts` links (already dead live); trim only if Chris asks.
- marketplace seed `docs/marketplace-wiki-seed` (`20c3d8c`): Chris says do NOT open a PR. Seed is the Toolforge Platform wiki, so the deletion list is not ready. Needs a real marketplace page set first.
- icf seed already merged as #3 onto `codex/weekly-retro-reporting` (default). Item 5 above is closed.
- `C:\dev` stays parked on `parkd821-20260908`; trm dry run and live docs:sync wait.
