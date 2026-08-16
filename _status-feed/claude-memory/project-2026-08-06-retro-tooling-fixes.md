---
name: project-2026-08-06-retro-tooling-fixes
description: loc-filtered.ps1 now auto-excludes chore(sync) commits; TODOS.md split Open/Completed + creation-date stamp convention added
metadata: 
  node_type: memory
  type: project
  originSessionId: 07668d9b-2ca5-4d16-970d-f99f58c246e5
  modified: 2026-08-06T13:03:56.547Z
---

Fixed 3 recurring retro-friction items in `c:\dev` on 2026-08-06:

1. `scripts/loc-filtered.ps1` excludes `chore(sync):`-tagged commits from the headline code LOC metric automatically now — previously only lockfiles were filtered, so sync-tagged commits (e.g. large `.ijfw/` regens) had to be subtracted by hand in every retro. Implementation: `git log --pretty=format:"@@COMMIT@@%x09%s"` marker line ahead of each `--numstat` block, parsed in the same pass (no second git invocation). Reports sync-commit churn on its own line, separate from code and lockfile metrics.
2. `TODOS.md` split into `## Open` (6 items) and `## Completed` (40+ items) — they were interleaved, making the real backlog hard to see. New items get closed via move-not-just-checkbox going forward (documented as a **Housekeeping** convention at the top of the file).
3. Added a `**Creation-date stamp**` convention to `TODOS.md`: new items get `(created YYYY-MM-DD)` in addition to any later resolved-date note, so backlog-added-this-period becomes derivable (previously only net open count was visible, no way to separate burn rate from add rate). Applies going forward from 2026-08-06, no retroactive backfill on existing items.

**Why:** all 3 surfaced as "3 things to improve" in a retro pass — the sync-commit exclusion had specifically needed manual correction 3 times before being scripted.

**How to apply:** when running LOC/retro metrics in `c:\dev`, use `scripts/loc-filtered.ps1` as-is — no more manual sync-commit subtraction needed. When adding new `TODOS.md` items, stamp `(created YYYY-MM-DD)`. When closing an item, move it from `## Open` to `## Completed` in the same edit.

Not yet actioned: TRM sync-treatment's fix-cluster note that test fixtures need to model real deployment conditions (scheduler exit codes, live vault dirs), not just unit-level logic — no active TRM work this session to attach it to. Flagged in `TODOS.md` log for next TRM touch. See [[project-trm-sync-treatment-shipped-2026-07-29]] if it exists, else next TRM session should pick this up.
