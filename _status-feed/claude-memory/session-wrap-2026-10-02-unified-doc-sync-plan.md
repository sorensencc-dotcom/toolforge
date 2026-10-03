---
name: session-wrap-2026-10-02-unified-doc-sync-plan
description: "Unified doc sync plan (one docs:sync command, repo → own wiki) at revision 4, Codex + Chris reviewed, uncommitted rev 4; 4 decisions waiting on Chris before execution"
metadata:
  node_type: memory
  type: project
  originSessionId: 376929dc-974f-49d6-88d4-86d8d2230012
  modified: 2026-10-02T12:16:47.956Z
---

Plan: `C:\dev\docs\superpowers\plans\2026-10-01-unified-doc-sync.md`, revision 4, 11 tasks, 8 registry products. Not started. Rev 3 was committed inside merge `6561d612` by an unknown auto-commit process; rev 4 is uncommitted.

**Why:** Chris wants one uniform doc sync instead of ~9 separate processes (toolforge/kb-sync/sigil/trm publishers, fleet reconciler, kb-sync CI every 4h, sigil CI, kb-sync pre-push, NotebookLM nightly Stage 3). Registry `docs/meta/governance/wiki-sync-registry.md` already says product repo → own wiki; kb-sync and `C:\dev\wiki` are quarantine, never a source. Chris confirmed that direction (not kb-sync-as-hub).

**How to apply:**
- Next session: commit rev 4, run Task 1 via subagent-driven-development in a worktree off `main`. No live wiki push before Task 9; Task 9 Step 0 needs Chris to decide how `C:\dev` leaves `parkd821-20260908`.
- Waiting on Chris: toolforge page-map promotions out of `C:\dev\wiki` (Task 7); per-product deletion lists; helix plans/specs public?; rewrite-mcp keep generated pages or drop row; registry owners (Task 11).
- cic-ingestion wiki stays quarantined (no row). rewrite-docs mkdocs site, the actually-stale KB, is out of scope and needs its own freshness plan.
- Marketplace live wiki holds 557 foreign pages (`wiki/`, `docs/`, `kb-sync/`) behind its cleaned sidebar; seed only its top-level pages.
- Lesson: `autoheal-sweeper.mjs` and `validate-staging-docs.mjs` ignore `--help` and run a full sweep. Read the arg parser before probing any kb-sync script.

Related: [[project-meridian-claude-isolation]] (unidentified auto-commit process), [[wiki-governance-batch2]].
