---
name: feedback-post-commit-hook-breaks-rebase
description: A post-commit hook that regenerates files breaks git rebase/merge replay; guard it and never commit generated wiki output locally in kb-sync
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8c44ad28-bc84-4bda-95ab-bfb006e88fb2
  modified: 2026-08-30T14:05:31.144Z
---

On 2026-08-30 I added a `post-commit` git hook to kb-sync
(`scripts/install-git-hooks.mjs`) that runs the drift autoheal
(`ingest-obsidian.sh --incremental` + `ingest-wiki.sh --provider
offline-template`). It fired after each successful step of a `git rebase`,
regenerated untracked wiki files, and those collided with the next queued
patch — every `git rebase --skip` / `--continue` aborted with "untracked
working tree files would be overwritten". Recovery required force-skipping
three commits and cost the session's backup branch and stash.

**Why:** Hooks that mutate the working tree during replay operations
(rebase, merge, cherry-pick) fight the operation that invoked them.

**How to apply:**
1. Any working-tree-mutating hook must early-exit when
   `.git/rebase-merge`, `.git/rebase-apply`, `MERGE_HEAD`, or
   `CHERRY_PICK_HEAD` exists. This guard shipped in kb-sync `f5b6a42`.
2. In kb-sync specifically: **do not commit regenerated
   `wiki/entities/*.md` or `obsidian/vault/wiki/**` locally.** The remote
   fleet reconciler (`feat(wiki): synthesize 190 entity pages`, live to
   GitHub Wiki) owns those. Local regen commits are dead on arrival —
   they conflict with 20+ remote commits and must be dropped. Only commit
   real source changes (`scripts/`, `modules/`, `core/`); let the
   scheduled master pipeline (`npm run kb:sync`) own wiki output.
3. Before committing in kb-sync, `git fetch` first — this repo's remote
   moves fast (fleet wiki automation, sibling-drift TODOS.md autosync).
4. When git surgery is needed and the safety classifier blocks
   `rm`/`git clean`/`git reset --hard`, hand the exact commands to the
   user rather than fumbling partial states. Related: [[incident_git_reset_data_loss_2026-07-16]].
