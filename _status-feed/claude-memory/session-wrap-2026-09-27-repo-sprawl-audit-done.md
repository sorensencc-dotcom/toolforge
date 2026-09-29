---
name: session-wrap-2026-09-27-repo-sprawl-audit-done
description: "Full C:\\dev repo-sprawl audit complete — plan at docs/superpowers/plans/2026-09-27-repo-sprawl-audit.md, nothing executed yet"
metadata:
  node_type: memory
  type: project
  originSessionId: 1bdbcc8d-385a-4fed-983e-c9ed60f1abd9
  modified: 2026-09-28T12:24:17.220Z
---

Full recon-only repo-sprawl audit done, plan written to `C:\dev\docs\superpowers\plans\2026-09-27-repo-sprawl-audit.md`. Supersedes the "next session" ask in [[session-wrap-2026-09-27-repo-sprawl-dupe-governance-found]].

**Why:** Chris asked for dedicated audit of nested clones/dupe trees under C:\dev, checksum/freshness-compared, cleanup plan before any deletes.

**Findings:**
- SAFE tier (stale, clean, superseded): whole `_remote-wiki-audit-20260829/` tree + 3 scratch/dev-sandbox wiki clones, ~8M, zero risk.
- Prune-via-git: `.worktrees/delivery-guard-task3` (1.6G) — branch confirmed merged to main, contains a second rogue nested toolforge.git clone inside it (CIC-GOVERNANCE/, matches prior session's finding pattern one level deeper). Correct removal is `git worktree remove`, not rm -rf.
- CAUTION tier (real dupes, active uncommitted work, need Chris's call not a script): toolforge.git triple clone (root `.` + `./toolforge` 3.1G gitignored + the task3 worktree's inner clone), sigil.git double clone (`sigil` 37M vs `sigil-repo` 131M — sigil-repo is load-bearing as a local remote for dev-sandbox/sigil-agentmail-review, not orphaned), toolforge-marketplace (209M) vs viking-phase3 (3.9G, has the CIC-GOVERNANCE engine copy-pasted in with no sync, confirmed drift risk from prior session).
- `kb-sync/.wiki-publish-temp` (22M, 1730 dirty files) needs a look at `scripts/sync-github-wiki.mjs` before deciding — likely a script-generated staging clone that never got gitignored.
- Confirmed NOT sprawl: `.worktrees/*` (registered git worktrees, working as designed), `dev-sandbox/*` (documented reuse pattern), third-party vendored clones (markitdown, context-graph-engine, notebooklm-mcp-cli, open-notebook).

**Codex second-opinion review (same session) found real errors in the first draft** — corrections applied in the plan doc: task3 worktree has 389 tracked deletions + 5 untracked files (NOT safe to `git worktree remove` as originally written, merged branch ≠ clean working tree); TRM wiki audit clone has a commit (`3309b92`) missing from its supposed replacement (pulled from SAFE tier); "toolforge triple clone" was a false positive (third instance was just an incomplete `hooks/`-only dir, not a repo); toolforge/sigil "duplicate" clones own dependent worktree fleets not accounted for; viking-phase3's governance-engine copy has already diverged (5/196 files) and carries 866 commits unreachable from marketplace, not "matching by luck"; savings arithmetic was wrong (7.0G not 4.2G); `kb-sync/.wiki-publish-temp` is expected gitignored build scratch, not sprawl. Full corrected plan + codex's full verdict now live in the doc's "Codex review corrections" section.

**How to apply:** Steps 1-2 (5 dirs: 3 of original 4 `_remote-wiki-audit-20260829/*` sub-clones + `scratch/kb-sync-wiki-clone` + `dev-sandbox/sigil-wiki`) executed 2026-09-28, all confirmed clean immediately before delete. Step 3 executed 2026-09-28: cherry-picked missing commit `3309b92` from `_remote-wiki-audit-20260829/trm` onto `trm-wiki` master (pushed `4f03ae1`), then deleted the audit clone — `_remote-wiki-audit-20260829/` is now gone entirely. Step 4 executed 2026-09-28: `scratch/toolforge-wiki-clone` (HEAD `785285f`) confirmed ancestor of live `origin/master` (`14569df`) — no divergence, deleted. Step 5 executed 2026-09-28: `.worktrees/delivery-guard-task3/4/5/6` all confirmed merged into main, all uncommitted content (task3's 389 "deletions" = stale wiki-restructure artifact, all untracked files = superseded threshold snapshots) verified non-unique; removed all 4 via `git worktree remove --force`. Steps 6-8 remain open — need reconciliation work or Chris's call, not zero-risk deletes. Plan doc has ✅ DONE markers on completed steps.
