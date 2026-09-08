---
name: session-wrap-2026-08-30-kb-sync-drift-autoheal
description: 2026-08-30 kb-sync drift-autoheal coverage fix shipped; three status-report follow-ups still open for next session
metadata: 
  node_type: memory
  type: project
  originSessionId: 8c44ad28-bc84-4bda-95ab-bfb006e88fb2
  modified: 2026-08-30T14:05:53.535Z
---

## Shipped (kb-sync, on origin/main)

- `f6f0bda fix(wiki): install drift autoheal as post-commit git hook` —
  the fail-soft drift autoheal was only wired to `post-merge` /
  `post-checkout`, so ordinary local commits that edit `core/*.json`
  between scheduled pipeline runs drifted the wiki with nothing to heal
  it. Added `post-commit` to the install loop in
  `scripts/install-git-hooks.mjs`.
- `f5b6a42 fix(wiki): skip drift autoheal hook during
  rebase/merge/cherry-pick` — guard for the bug the first fix exposed.
  See [[feedback-post-commit-hook-breaks-rebase]].

The original 8-file drift (categories, config, entities_cuban_seizures,
error_taxonomy, harvest_registry, property_entities,
property_input_modalities, research_pipeline) was healed locally and
verified `NO_DRIFT`, but those wiki-page commits were dropped — remote
already regenerated them via the fleet reconciler. The autoheal itself
never failed; it just was not wired to the commit path.

## Still open (from the session-start status report)

1. **`C:\dev\TODOS.md` and `C:\dev\.ijfw\memory\handoff.md` do not
   exist.** The daily status report references these paths. `TODOS.md`
   lives only in subrepos (`kb-sync/TODOS.md`, `sigil-repo/TODOS.md`);
   `.ijfw/memory/` holds only `project-journal.md` + `archive/`. Either
   fix the report's path config or create the root files. Recurrence of
   [[feedback_todos_md_decision]].
2. **MEMORY.md auto-memory index is stale** — last modified 2026-08-27
   (3 days), spans active work. Needs a refresh pass.
3. **kb-sync working tree churn** — the drift hook fired repeatedly during
   this session's git surgery and left ~195 uncommitted regen files.
   Told the user to `git restore . && git clean -fd obsidian/vault/wiki
   wiki/entities`. Persistent `stale_pages=1` (`install-git-hooks.mjs.md`
   sibling) will settle on the next scheduled `npm run kb:sync`.
