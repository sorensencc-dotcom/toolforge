---
name: session-wrap-2026-07-29-sync-treatment-shipped
description: "trm sync-treatment CLI shipped via subagent-driven-development, real vault run found benson-ford dup facts + missing michigan-flight-museum extract"
metadata: 
  node_type: memory
  type: project
  originSessionId: bfa349d7-255c-4670-b61b-8d21f54dac3b
  modified: 2026-07-30T02:08:15.577Z
---

TRM-to-treatment sync skill (backlog item from [[session-wrap-2026-07-28-benson-ford-close]]) fully implemented and shipped: 10-task plan executed via superpowers:subagent-driven-development, one implementer subagent per task + task review + final whole-branch review. 16 commits merged to `trm` main (7575559..37d136d, pushed), 1 commit to `charlie-deep-research` main (a546a16, pushed — dependency-map envelope migration).

**Why:** manual TRM-extract-to-treatment reconciliation didn't scale past a handful of topics ([[project-trm-ingest-scale-problem-2026-07-25]] adjacent gap).

**Real bugs found in the plan's own reference code during execution** (not implementer errors — plan/spec authored code had defects, caught by per-task review + independent reproduction before fixing):
- readCursor crashed on literal JSON `null` (missing typeof guard)
- lock acquisition had a TOCTOU race (raw fs.writeFileSync instead of exclusive-create)
- YAML frontmatter had unescaped topic names; first regex fix for timestamp-slug generation itself introduced a filename-collision regression, caught by re-review and fixed in a second round
- orchestrator's reference cursor-update logic unconditionally rewrote `lastRunAt` every run, breaking its own no-op-rerun byte-identity test — fixed to only write when factKey set changes (user-approved: `lastRunAt` now means "last content change" not "last run attempt")
- CLI had no try/catch around lock errors, crashed with raw stack traces

**How to apply:** when executing a plan built by a prior spec/design session, don't assume the plan's own verbatim reference code is correct — the per-task reviewer independently re-derives/reproduces flagged issues (e.g. reverting to brief's literal code and running it) rather than trusting the implementer's claim. This caught real defects across 5 of 10 tasks. Plan-mandated deviations (test fixture data wrong, cursor semantics changed) get surfaced to the user via AskUserQuestion before accepting, not silently adjudicated.

**Real-vault first run result** (`trm sync-treatment --narrative-root C:\dev\charlie-deep-research` from `C:\Users\soren\trm-vault`): 105 new facts (85 cuba, 20 willow-run) reconciled into a report. Found genuine pre-existing data issues, not tool bugs:
- `benson-ford` extract.json has real duplicate facts (same source_id+text, different FCT-### ids) — factKey collision detection correctly refused to silently merge them, topic skipped, needs upstream extract cleanup
- `michigan-flight-museum` has no `extracts/extract.json` yet — needs a `trm extract` run
- `topics/charlie/{crosslinks,extracts,lineage,sources}` are stray near-empty dirs, not real topics — correctly skipped as missing-extract, harmless vault housekeeping if cleaned up later

**How to apply:** benson-ford dedup and michigan-flight-museum extraction are now visible next-session TODOs; sync-treatment tool itself needs no further code changes from this run.
