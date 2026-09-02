---
name: project-trm-route-intake-shipped-2026-08-05
description: "trm route-intake command shipped (topic classification for triage-intake output); ingestion paused before --apply, willys-overland topic node missing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 17f40157-001a-4f15-b3b9-af17f31e1644
  modified: 2026-08-14T15:13:50.879Z
---

Built and shipped `trm route-intake` — brainstorm → spec (2 external review rounds) → plan → subagent-driven implementation (5 tasks) → final whole-branch review → fix wave → merged to trm `main`, pushed (8de25df..8709a24 in C:\dev\trm).

**What it does:** reads `intake-manifest.json` (from `triage-intake`), classifies each file's likely vault topic via filename/path keyword matching against `config/topic-routing.json`, writes `intake-routing-report.json`. Dry-run by default; `--apply` stages matched files into `topics/charlie/<topic>/_staging-intake-<runId>/` for a later manual `ingest-dir` pass.

Real dry-run against `C:\Users\soren\trm-vault` intake/dump (702 physical paths): willow-run 589, unsorted 101, willys-overland 9, helene 2, cuba 1, ambiguous 0.

**Why:** [[project-trm-ingest-scale-problem-2026-07-25]] flagged the per-photo pipeline doesn't scale; this closes the missing "which topic does this file belong to" step between triage and ingest that was blocking any real batch ingestion of intake/dump.

**How to apply:** Config resolves relative to the tool (C:\dev\trm), not the vault, so it works from any vault root with no setup. `--apply` requires `topics/charlie/<topic>/topic.json` to already exist for every matched topic — aborts the whole run with a clear report if any are missing. `willys-overland` topic node does NOT exist yet in trm-vault (9 files blocked on this).

**Next steps (left for a future session, see .ijfw/memory/handoff.md in C:\dev):**
1. `trm create topics/charlie/willys-overland` in trm-vault first.
2. `route-intake --apply` to stage the ~590 classified files.
3. `ingest-dir` per topic against each staged batch.
4. 101 unsorted files need manual review / new keywords in `config/topic-routing.json`.

**Process notes worth remembering:** the brainstorm→spec cycle caught 18 real design defects across 2 review rounds before any code was written (duplicate-path routing, path-traversal safety, locking, crash-report truthfulness, keyword precedence ties). Subagent-driven implementation caught 2 more test-fixture bugs I introduced while writing the plan's own test cases (a typo — "helene 1" vs "Helene I" — and a config fixture that the previous task's own validation correctly rejected before reaching the code under test). The final whole-branch review caught one real Critical the entire task-by-task process missed: the default config path resolved relative to the vault, but the seed config only exists in the tool's repo — the command couldn't run out of the box until fixed. Every implementer/reviewer claim was independently re-run and verified before being trusted; more than one "should be fine" self-report understated a real failure (Task 1's implementer called a real, fixable test failure a "jest limitation").

**Perf fix (2026-08-14):** `--apply` used to re-classify+re-copy every file ever staged on every call (earlier fix closed a leak, not this). Fixed: added `intake-routing-state.json` (sourcePath -> {topic, stagedPath, runId, stagedAt}); `--apply` now skips re-copy when a prior staged file still exists on disk, falls back to re-copy if it was removed (e.g. consumed by `ingest-dir`). New `already-staged` report status. 2 new tests, 20/20 pass, tsc clean.
