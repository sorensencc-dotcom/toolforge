---
name: session-wrap-2026-10-02-unified-doc-sync-tasks-1-7
description: "Unified doc sync plan rev 4 committed; Tasks 1-7 of 11 built and pushed on two feature branches; one open leak decision (WhichLLM image) plus Tasks 8-11 blocked on Chris"
metadata:
  node_type: memory
  type: project
  originSessionId: c7a56356-8fd9-4f40-800b-79b0ebe9d952
  modified: 2026-10-03T03:02:56.474Z
---

Plan: `C:\dev\docs\superpowers\plans\2026-10-01-unified-doc-sync.md` rev 4, committed `4ee177f1` on `parkd821-20260908` (already on origin). Tasks 1-7 of 11 done, one fresh agent per task, each verified by re-running tests.

**Branches (pushed 2026-10-02, no PRs yet):**
- toolforge `feat/unified-doc-sync`, worktree `C:\dev\.worktrees\unified-doc-sync`: Task 1 `0ec2d8e3` registry (12 tests), Task 2 `b7b9bba4` stager, Task 3 `a09f1bef` sidebar guard, Task 4 `3015105b` publisher (local bare repos only), Task 6 `1a1e2d69` docs:sync CLI (33 tests total), Task 7 toolforge half `cec40c36` (committed on a detached HEAD, so it was NOT pushed at session end; branch fast-forwarded and pushed 2026-10-02 in a follow-up session). Check `git status -sb` for "no branch" before trusting a pushed claim.
- kb-sync `feat/doc-sync-cache-prefix`, worktree `C:\dev\.worktrees\kb-sync-doc-sync-prefix`: Task 5 `f8a7907d` per-product ID prefix, Task 7 kb-sync half `52f1dcbe` build-only + static footer.

- Review follow-up 2026-10-02 (local, NOT pushed): toolforge `e3929663` (loadProductCache refuses kb-sync without `SUPPORTS_ID_PREFIX`; sidebar guard accepts existing asset links + spaced/%20 links), kb-sync `8d58b286` (exports `SUPPORTS_ID_PREFIX`). **Merge kb-sync branch before toolforge or before any live sync**; live `C:\dev\kb-sync` main is refused by the guard (verified).

**Why:** one registry-driven `docs:sync`, product repo to its own wiki. See [[session-wrap-2026-10-02-unified-doc-sync-plan]].

**Open (blocks Task 7 being truly done):** Chris's decision on 14 page-map pages was promote only `toolforge-architecture-overview` (.html + .png), drop the other 12. But `OLLAMA_DEPLOYMENT_GUIDE.md:9` and `OLLAMA_PROVIDER_SETUP.md:5` still embed `wiki/research/whichllm-architecture-topology.png`, so the build leaks a `wiki/` folder into output. Options: drop the two image links (recommended), promote the image, or repoint. Awaiting Chris.

**Known follow-ups:**
- `generateSidebar` still links dropped pages (WhichLLM, TRM, parallel-search, tinyfish-search, Log) so they 404; Task 3 sidebar guard may block publish until fixed. Handle in Task 8/9.
- Task 6 Step 5 deferred by Chris to start of Task 9: `.wiki-sync-receipt.json` is NOT gitignored in all 8 repos (C:\dev, kb-sync, trm, sigil-repo, icf, helix, toolforge-marketplace, rewrite-mcp). Add + commit `chore(doc-sync): ignore wiki sync receipt` in each, preflight first.
- `run.mjs` builds the cache DB path from its own location: never run a live sync from the worktree, only from `C:\dev`.
- Pre-existing failure on kb-sync main: `tests/trm-cache-boundary.test.mjs` `parseGapItems` expects `GAP-01`, gets `GAP-01--pending-gap` (agent says fails without our change too; not re-verified on main). Unrelated to plan.
- Parallel Search and TinyFish skill writeups sit in the `C:\dev\wiki` quarantine; if the skills are real, publish from the skill folder later (outside this plan).
- kb-sync pre-commit flagged `wiki/entities/sync-github-wiki.mjs.md` needs a sibling doc update.
- Hooks modify `TODOS.md` / `.ijfw/memory/project-journal.md` in worktrees after commits; never stage them.

**How to apply (next session):**
- Get Chris's answer on the WhichLLM image leak, fix it in the toolforge worktree, rerun the build-only proof (expect SAME, no `wiki/` folder, no clone).
- Then Task 8 (fill registry, fix markdown registry). Tasks 8-11 need Chris: per-product deletion lists, helix plans/specs public?, rewrite-mcp keep generated pages or drop row, registry owners (Task 11), and Task 9 Step 0 (how `C:\dev` leaves `parkd821-20260908`). No live wiki push before Task 9.
- Session ran 2+ hours (Task 5 agent alone 56 min waiting on hooks); handed off per global session-length rule. Retro not run today.

Related: [[project-meridian-claude-isolation]] (unidentified auto-commit process), [[wiki-governance-batch2]].
