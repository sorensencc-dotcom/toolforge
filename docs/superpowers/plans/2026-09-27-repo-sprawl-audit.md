# Repo-sprawl audit — C:\dev

Recon only. Nothing deleted, moved, or merged. All figures live as of 2026-09-27.
Follow-up to `session-wrap-2026-09-27-repo-sprawl-dupe-governance-found.md`.

**Note (2026-09-29): this file disappeared from disk mid-session (untracked, never committed — suspect but unconfirmed: `modules/wiki/autoheal-sweeper.mjs` or `cleanup-staging-archives.mjs` cleanup pass). Recreated from conversation history. Consider committing this file so it can't vanish again.**

**Codex second-opinion review (2026-09-27) found real errors in the original draft below — corrections applied inline, full codex verdict at the bottom under "Codex review corrections." Do not act on any SAFE-tier item without reading that section first.**

## Method
1. `find . -name .git` → 40 nested git dirs found by the initial scoped scan under `C:\dev` (excl. node_modules). **Corrected by codex's independent re-scan: 46 `.git` dirs + 26 `.git` files (see corrections #9) — the true count is higher, original pass undercounted.**
2. Pulled `origin` remote for each → grouped by remote URL.
3. For each group with >1 clone of the same remote: compared last-commit date, branch, dirty-file count, size.
4. Cross-checked `.worktrees/*` against `git worktree list` to separate real worktrees (fine) from rogue full clones (not fine).
5. Independently re-verified by codex second-opinion review against live filesystem/git state — see "Codex review corrections" at the bottom. Findings above already reflect those corrections; read that section for the full verdict before acting.

## Findings, by risk tier

### SAFE TO DELETE — stale, clean, superseded by a newer copy of the same repo
No uncommitted work, no unique branch, a current canonical copy exists elsewhere.

| Dir | Remote | Last commit | Dirty | Size | Canonical replacement |
|---|---|---|---|---|---|
| `_remote-wiki-audit-20260829/kb-sync` | kb-sync.wiki | 2026-08-29 | 0 | 3.1M | `kb-sync-wiki` (09-27) |
| ~~`_remote-wiki-audit-20260829/trm`~~ | TRM.wiki | 2026-08-29 | 0 | 1.6M | **NOT SAFE — see corrections §2, has a commit missing from replacement** |
| `_remote-wiki-audit-20260829/cic-ingestion` | cic-ingestion.wiki | 2026-08-29 | 0 | 825K | `cic-ingestion-wiki` (09-27) |
| `_remote-wiki-audit-20260829/rewrite-mcp` | rewrite-mcp.wiki | 2026-08-29 | 0 | 2.6M | `rewrite-mcp-wiki` (09-27) |
| `scratch/kb-sync-wiki-clone` | kb-sync.wiki | 2026-08-19 | 0 | 79K | `kb-sync-wiki` |
| `scratch/toolforge-wiki-clone` | toolforge.wiki | HEAD `785285f`, 2026-08-23 | 0 | small | live toolforge wiki — **unverified against remote, see corrections §3** |
| `dev-sandbox/sigil-wiki` | sigil.wiki | 2026-09-09 | 0 | 526K | `sigil-wiki` (09-26, newer) |

**3 of the 4** `_remote-wiki-audit-20260829/` sub-clones (kb-sync, cic-ingestion, rewrite-mcp) are still safe — the **TRM one is not**, pulled from the SAFE table above pending history reconciliation (see corrections §2).

### PRUNE VIA GIT (not rm) — dead worktree, ~~SAFE~~ NOT SAFE AS-IS
| Item | Detail |
|---|---|
| `.worktrees/delivery-guard-task3` (1.6G), **389 tracked deletions + 5 untracked = 394 dirty paths** | Registered `git worktree`, branch `codex/delivery-guard-task3`, **confirmed merged into `main`** (558/0 ahead/behind). **BUT** those 394 changes (incl. `cic-vision-governance/artifacts/threshold/v106–110.json`) are uncommitted in the working tree — merged history does not cover uncommitted working-tree state. `git worktree remove` will correctly refuse a dirty worktree; forcing it discards that work. **Do not remove until someone reviews and either commits or intentionally discards those 394 changes.** Same caveat applies to delivery-guard-task4/5/6 (also merged, with 5/10/5 untracked files respectively — not yet inspected). The `CIC-GOVERNANCE/.git` inside task3 is **not actually a nested clone** — it's just an incomplete `hooks/`-only dir that makes `git -C` silently resolve to the parent worktree. Drop that finding from the audit; it was a false positive. |

### CAUTION — real dupes, but carry uncommitted/unmerged work; needs your call, not a script
| Cluster | Copies | Why it's not a simple delete |
|---|---|---|
| **toolforge.git double clone** — **RESOLVED 2026-09-28/29, see below** | root `.` (branch `parkd821-20260908`) vs `./toolforge` (branch `fix/governance-gate-and-wiki-alignments`) | **CLOSED.** All 5 branches associated with `./toolforge` and its worktree `toolforge-nlm-pack-gate` turned out already merged to `origin/main` (PRs #56, #57, #58, #38 — squash-merged, so branch tips weren't reachable from `origin/main` history, which is why the initial scan called them "unreachable"/"unmerged"). Two untracked files in root (`wiki-style-and-structure.md`, `wiki-sync-registry.md`) that looked like a diverging draft duplicate were confirmed byte-identical to the merged `origin/main` versions — false alarm. Deleted `toolforge-nlm-pack-gate` worktree (`git worktree remove --force` + manual `rm -rf` after a permission-denied retry, then `git worktree prune`) and the `./toolforge` subclone itself (3.1G). Root repo untouched. |
| **sigil.git double clone** — **IN PROGRESS 2026-09-29** | `sigil` (37M, branch `docs/home-portable-paths-2026-09-26`, clean) vs `sigil-repo` (131M, branch `main`, dirty `TODOS.md`) | Real structure is **two separate worktree fleets**, not one hub as originally stated: **Fleet A** (hub `sigil`) → `sigil-r2`, `.worktrees/sigil-live-pg-fix`. **Fleet B** (hub `sigil-repo`) → `dev-sandbox/sigil-pr8`, `.claude/worktrees/agent-abc149e6c4cf066fc`, `.worktrees/federation-approval-bypass-fix`, `.worktrees/sigil-contract-verifier`, `dev-sandbox/sigil-review-fix`. Per-worktree status: `sigil` own branch → merged PR #11. `sigil-r2` → merged PR #8, clean, **safe to delete**. `sigil-live-pg-fix` → merged PR #10, clean, **safe to delete**. `sigil-pr8` → merged directly to main (no PR), clean, **safe to delete**. `agent-abc149e6c4cf066fc` → merged to main; its 3 "dirty" files are pure CRLF line-ending noise, no real content, **safe to delete**. `federation-approval-bypass-fix` → merged to main; its 2 dirty files are AGENTS.md/CLAUDE.md auto-sync churn only, **safe to delete**. `sigil-contract-verifier` → **RESOLVED 2026-09-29.** branch `codex/sigil-contract-verifier`, PR #13, collided with main's existing `verify-contract` command (two competing implementations of the same name). Full-diff check confirmed PR #13's only real contribution beyond the naming collision was a revocation check (`entry.status === 'revoked'`) that main's `cmdVerifyContract` lacked. Ported that one guard directly into main's existing `cmdVerifyContract` in `sigil/cli/sigil.mjs` on new branch `fix/verify-contract-revocation-check`, opened as **PR #14** (1038/1038 tests pass), closed PR #13 as superseded (comment explains why), deleted branch `codex/sigil-contract-verifier` (local + remote) and the `sigil-contract-verifier` worktree. `sigil-review-fix` → branch `fix/devin-review-findings-7`, unmerged since 2026-09-19 — opened as **PR #12** 2026-09-29. Conflicts with main across 5 files in the approval/relay core (`sigil/cli/memory-repository.mjs` + test, `sigil/relay/v1/http-server.mjs` + test, `sigil/relay/v1/postgres-repository.mjs`), 8 conflict blocks total. **Currently being worked** — see "Active: PR #12 conflict resolution" section below. `sigil-repo` itself can't be retired — it's Fleet B's hub and has its own dirty, uncommitted `TODOS.md` (+15/-1). |
| **toolforge-marketplace vs viking-phase3** — **NOT YET STARTED** | `toolforge-marketplace` (209M, main, 7 status entries — **but 8,477 individual dirty paths under `-uall`**, mostly whole untracked dirs like `node_modules/`/`modules/`, not authored changes) vs `viking-phase3` (3.9G, `feat/viking-tier-index`, 31 dirty paths) | `viking-phase3`'s `CIC-GOVERNANCE/` copy has **already drifted**: byte-compare found 191 matching files but **5 differing** (incl. `evaluate-automation-policy.mjs` + 3 delivery-guard tests) — this is not "matching by luck," it's already-diverged, unreconciled duplication. `viking-phase3` HEAD also carries **866 commits unreachable from toolforge-marketplace's current refs** — reconciliation scope is a real merge/rebase project, not a 22-file cleanup. |
| **kb-sync/.wiki-publish-temp** | 22M, branch master, 1730 dirty paths, nested inside the live `kb-sync` repo | **Correction: this is not abandoned sprawl.** It's already gitignored (`kb-sync/.gitignore:23`), and `scripts/sync-github-wiki.mjs` deletes and re-clones it fresh on every publish run (line 240) — the dirty state is normal leftover from the last generation pass, not orphaned work. Do **not** run the publisher to "investigate" — it destroys the existing staging dir first. Downgrade this from a cleanup item to "expected, ignore." |

### CONFIRMED INTENTIONAL — leave alone
- `.worktrees/*` (other than task3) — all registered, active `git worktree` entries, matches documented workflow.
- `dev-sandbox/*` — documented multi-project reuse pattern per existing memory; `sigil-agentmail-review` pointing at local `sigil-repo` is by design.
- `graft/context-graph-engine`, `kb-sync/notebooklm-mcp-cli(/notebooklm-py)`, `dev-sandbox/open-notebook` — genuine third-party vendored clones (Microsoft/NanoNets/other GitHub orgs), not internal dupes.

## RESOLVED: PR #12 (sigil, 2026-09-29) — closed as superseded, not merged
PR #12 = `fix/devin-review-findings-7` → `main`, closes Devin review findings on the approval flow. Conflicted against `main` in 5 files, 8 conflict blocks (`memory-repository.mjs` x3, `memory-repository.test.mjs` x1, `http-server.mjs` x1, `http-server.test.mjs` x2, `postgres-repository.mjs` x1) — all in approval/relay core.

Investigated instead of mechanically resolving: main's commit `76040f8` ("fix(approvals): ALS txs, reject body.action, honor valid_until", 2026-09-20 — 1 day after PR #12's last commit) independently fixes the exact same 3 things PR #12 does, more thoroughly (covers memory-repository's valid_until gate too, which PR #12 didn't). PR #12 has nothing left unique to contribute. **Closed PR #12 without merging** (comment left explaining why, citing `76040f8`). `dev-sandbox/sigil-review-fix` worktree now safe to delete along with the rest of Fleet B's mergeable-clean set.

## Recommended order of operations (revised post-codex-review)
1. ✅ **DONE 2026-09-28.** Deleted `_remote-wiki-audit-20260829/kb-sync`, `/cic-ingestion`, `/rewrite-mcp` — 3 of the 4 SAFE-tier sub-clones, ~6.5M.
2. ✅ **DONE 2026-09-28.** Deleted the 2 remaining SAFE-tier stale scratch/dev-sandbox wiki clones (`scratch/kb-sync-wiki-clone`, `dev-sandbox/sigil-wiki`).
3. ✅ **DONE 2026-09-28.** Reconciled TRM wiki: cherry-picked commit `3309b92c3b30e4f76cbbe2fcdc9e1e93c427c378` onto `trm-wiki` master, pushed `6c1011d..4f03ae1`. Deleted `_remote-wiki-audit-20260829/trm`.
4. ✅ **DONE 2026-09-28.** Verified `scratch/toolforge-wiki-clone` is an ancestor of live `origin/master`. Deleted.
5. ✅ **DONE 2026-09-28.** Reviewed + removed task3-6 worktrees (`git worktree remove --force`) — all 4 branches merged, all untracked files superseded snapshots.
6. ✅ No action needed — `kb-sync/.wiki-publish-temp` is expected gitignored build scratch.
7. ✅ **DONE 2026-09-29.** Toolforge cluster closed 2026-09-28/29 (see CAUTION table). Sigil cluster: all 7 worktrees resolved — `sigil-r2`, `sigil-live-pg-fix`, then the `sigil` clone itself (Fleet A, all safe/merged, deleted); `sigil-pr8`, `agent-abc149e6c4cf066fc`, `federation-approval-bypass-fix`, `sigil-review-fix` (Fleet B, deleted, PR #12 closed as superseded); `sigil-contract-verifier` (Fleet B, PR #13 closed as superseded by PR #14, worktree + branch deleted). `sigil-repo` hub retained (dirty `TODOS.md`, pre-existing/unrelated, now hosts no other worktrees). Sigil cluster fully closed. toolforge-marketplace/viking-phase3 not started — last remaining cluster.
8. ✅ **DONE 2026-09-28/29, closed 2026-09-29.** Triaged `docs/archive/projects/castironforge/cic-ingestion`: same remote as canonical `cic-ingestion`, 1 dirty path (meaningless node_modules doc deletion), HEAD commit `1863187` (2026-07-08, "notebooklm adapter, config registry, Phase 1-2") was **not reachable** in canonical's history, and canonical had zero notebooklm-related commits anywhere — early standalone work that never merged in, not a stale mirror. Confirmed dead work (not reconciling into canonical). Safety-backed-up the 4 unique files (`NotebookLMAdapter.ts`, factory, tests, `config/cic_notebooks.yaml`) as a patch at `docs/archive/patches/0001-feat-notebooklm-Phase-1-2-complete-adapter-config-re.patch`, then deleted the dupe checkout at `docs/archive/projects/castironforge/cic-ingestion`.

No reliable "total reclaimable" number — codex's arithmetic check found the original 4.2G estimate wrong (should've been 7.0G of logical file size, ~3.8G of actual git-metadata, neither guaranteed recoverable without the reconciliation work in item 7).

## Codex review corrections (full verdict, 2026-09-27)
Independent codex review of this plan, run against live filesystem/git state, verdict: **"Do not execute plan as written. Two deletion recommendations lack safety evidence; task3 is dirty; several factual claims are wrong."**

1. Task3 removal unsafe as originally proposed — 389 tracked deletions + 5 untracked files in the worktree; merged branch history doesn't cover uncommitted work.
2. TRM audit clone contains commit `3309b92` absent from every ref in `trm-wiki` — the "SAFE, superseded" claim was unsupported.
3. `scratch/toolforge-wiki-clone`'s replacement was never verified against the live remote (network/proxy blocked the check) — "zero risk" was asserted, not verified.
4. The reported third toolforge clone (inside task3's `CIC-GOVERNANCE/`) is a false positive — it's an incomplete `hooks/`-only dir, not a repository; `git -C` there silently falls through to the parent worktree.
5. Retiring the toolforge or sigil "duplicate" clones would strand dependent worktrees (`toolforge-nlm-pack-gate`; `sigil-r2`, `sigil-live-pg-fix`, and 4 more under `sigil-repo`) not accounted for in the original plan. **Note: item 7 above found the "one sigil hub" framing itself was wrong — it's actually two independent fleets.**
6. Dirty-file counts in the original draft undercounted `toolforge-marketplace` badly (7 status entries vs 8,477 individual paths under `-uall`, mostly whole untracked dirs like `node_modules/` — not meaningful authored changes, but the estimate method was inconsistent across rows).
7. `kb-sync/.wiki-publish-temp` is expected build-script scratch (gitignored, regenerated every publish run), not orphaned work — original framing was wrong.
8. The viking-phase3/toolforge-marketplace governance-engine copy has already diverged (5 of 196 files differ) and viking-phase3 carries 866 commits unreachable from marketplace's current refs — "matching by luck" undersold the real reconciliation scope.
9. Repo inventory was imprecise: 46 `.git` dirs + 26 `.git` files scoped-scanned (not "40 repos" as stated), and missed one more dupe: `docs/archive/projects/castironforge/cic-ingestion`.
10. Savings arithmetic was arithmetically wrong (3.1G + 3.9G = 7.0G, not 4.2G) and conflated logical file size with reclaimable git-metadata size (~3.8G).

Positive verification from codex: the other 5 wiki-clone SAFE-tier candidates and the sigil-local-remote / toolforge-gitignore findings held up under direct check.
