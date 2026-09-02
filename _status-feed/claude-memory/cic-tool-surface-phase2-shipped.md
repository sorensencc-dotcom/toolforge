---
name: cic-tool-surface-phase2-shipped
description: "CIC Tool Surface Phase 2 (workspace layout: lineage/reports index dirs) shipped via Codex, 20/20 tests, real repo-root path bug fixed along the way"
metadata: 
  node_type: memory
  type: project
  originSessionId: fe578398-e318-4b94-be55-9ab1dba919b0
---

Phase 2 of CIC Tool Surface shipped 2026-07-16. Spec:
`docs/meta/cic-tool-surface-phase2-design.md`, plan:
`docs/meta/cic-tool-surface-phase2-plan.md`. Commits `5d7ccac`..`a9afc29`.

Scope: added `cic/lineage/<kind>/<id>.json` and `cic/reports/<kind>/<id>.json`
as thin cross-reference indexes (not duplicate content) alongside existing
`cic/artifacts/<kind>/<id>/`. Only `cic-run-gate` (reports) and
`cic-ingest-world` (lineage) write index entries — `cic-repair-pipeline` and
`cic-consolidate-artifacts` untouched, no natural report/lineage content to
force. `agents/` and `configs/` dirs from the original 5-phase plan tree
deferred — no consumer, no spec yet.

Real bug found and fixed during design review (not part of original ask):
`_cic-shared/artifactPaths()` resolved paths off `process.cwd()`, not repo
root — fragile if a skill ran from a different cwd. Fixed via
`findRepoRoot()` walking up to nearest `.git` (bounded 20 levels, memoized).
This moved the artifact write location from `skills/*/cic/` to top-level
`/cic/` at repo root — required a `.gitignore` fix (`skills/*/cic/` didn't
cover the new location) that wasn't caught until Task 5 validation. **Any
path-resolution change that touches where files land should trigger an
immediate gitignore check, not a "verify at the end" step.**

Build executed by Codex per [[feedback_codex_verbatim_plan_code]] — verbatim
code-block copy from plan, TDD step order followed exactly. One reported
"test failure" was actually the plan's own expected failure (TS2307 module
not found + TS2554 arg-count mismatch, both predicted by Task 1 Step 2) —
Codex correctly halted per instructions to report before proceeding; this
is the right behavior, not a false alarm to avoid next time.

Next: Phase 3 (orchestration flows) unspec'd. Full 5-phase plan referenced
in [[cic-tool-surface-phase1-design.md]] context section.
