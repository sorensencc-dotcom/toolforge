Handoff: 2026-08-14
====================

Status
------
| NotebookLM ingest | all 6 notebooks | done | 0 remaining |

CIC-KB, CIC-Daily-Research, Willow Run Videos, Cast Iron Charlie - Research
Logs, Sorensen Photographic Archive, and CastIronCharlie-Facebook all fully
ingested + mined + synced. Sweep complete.

Decisions
---------
- Global `trm` link: `cd C:\dev\trm && npm run build && npm link` (was
  missing PATH entry; fixed in prior session).
- Always `$env:TRM_ACTOR = "ACTOR-001"` before any mutating trm command.
- Unsorted intake items are expected/normal; extend
  `C:\dev\trm\config\topic-routing.json` keywords only for confident
  clusters — don't invent new topic nodes without asking.
- **Run trm commands via PowerShell, not git-bash.** git-bash strips
  backslashes from Windows paths passed as CLI args, mangling
  `--narrative-root C:\dev\charlie-deep-research` into
  `C:devcharlie-deep-research` — broke sync-treatment's dependency-map
  lookup this session (live-caught, fixed by rerunning via PowerShell).

This Session's Results
-----------------------
- Willow Run Videos (`ef78168d-b7b9-4952-8e0f-fcb353a21181`): 24/25 sources
  ingested to `charlie/willow-run`, 1 unsorted (expected). mine-notebooklm:
  4 new research-gap entries.
- Cast Iron Charlie - Research Logs (`b8bc161d-495f-42f9-a7d1-ed8692141f6b`):
  2 sources staged, both unsorted (no topic-routing keyword match yet — no
  topic touched this run). mine-notebooklm: 4 new research-gap entries.
- Sorensen Photographic Archive (`fd0e0e4e-6890-4fb9-89bf-b9e568295e7a`): 1
  source staged, ingested clean to `charlie/willow-run`. mine-notebooklm: 4
  new research-gap entries.
- All committed to trm-vault locally (8efc585) — no remote, repo is
  local-only by design.

Modified Files (prior session, still relevant context)
--------------
See prior handoff entries in git log for `trm/src/notebooklm/stagingName.ts`,
`ingestNotebooklm.ts`, `extract.ts`, `topic-routing.json` fixes — all
committed + pushed to trm/charlie-deep-research origin already.

Follow-up: _staging-intake Bloat (6th real bug, found + fixed same day)
--------
`route-intake --apply` re-copies its entire vault-wide `doneEntries` history
into a fresh `topics/charlie/<topic>/_staging-intake-<runId>/` dir on every
`ingest-notebooklm` run, and nothing ever cleaned up the old ones. 11 runs
had left **16GB** of near-identical duplicates across 5 topics (willow-run
alone: 15.4GB across 11 snapshots). `trm ingest` reads each `stagedPath`
once and persists its content permanently via `writeRawEnvelope` — the
staged file is never needed again.

- Fixed in trm (`d8134c3`, pushed to origin): `ingestNotebooklm.ts` now
  deletes every `_staging-intake-<runId>` dir reachable from the run's
  `intake-routing-report.json` once ingest+extract finish, scoped to that
  run's runId across all topics the report touched (route-intake restages
  vault-wide on every call, not just the pulled notebook's topic). Best-
  effort, non-fatal. A standalone `trm route-intake --apply` (outside
  ingest-notebooklm) is unaffected — files staged for manual review persist.
  New test: `ingestNotebooklm.test.ts` "deletes this run's
  _staging-intake-<runId> directories after ingest...". Full suite green
  (696/707, 10 skipped, 1 pre-existing unrelated flaky timing test in
  `analyzeFrames.test.ts` — confirmed flaky via isolated rerun, not a
  regression).
- Backlog cleared in trm-vault (2 commits, local-only, no remote):
  removed all 51 existing `_staging-intake-*` dirs (16GB → working tree now
  ~12GB), then a corrective commit removing junk accidentally swept in by
  an overly-broad `git add topics/` — pre-existing untracked leftovers from
  the earlier topicPath double-prefix bug (`topics/topics/charlie/*/...`
  and `topics/cuba/extracts/...` missing the `charlie/` segment). Real
  content lives correctly at `topics/charlie/<topic>/`.
- Also cleared 209 untracked `.ijfw/scan-state.json.tmp.*` litter files
  (0 tracked in git, pure disk cruft from some process that never cleaned
  up its temp files — not investigated further, low priority).
- **Lesson:** don't `git add -A` or even a broad `git add <dir>/` on this
  vault without checking `git status`/`git diff --stat` first — it silently
  swept in unrelated historical bug leftovers on the first attempt. Add
  narrow, explicit paths.

Next Steps
----------
1. No remaining notebooks. Weekly Task Scheduler job `TRM-Notebooklm-Mine`
   (Mondays 6am) will keep mining registered notebooks going forward — will
   now also benefit from the staging-cleanup fix automatically.
2. Research Logs notebook's 2 unsorted sources resolved:
   - Source 1 (Cuba & CESOR Research Log): matched to `cuba` topic (keyword `willysresearchlog` added to `cuba` routing in `topic-routing.json`).
   - Source 2 (Later Life Research Log): created new topic `charlie/retirement` in `trm-vault` (`38c75ac`) with routing keywords `["retirement", "later life", "later-life", "post-willys", "laterliferesearchlog"]`. Ingested as `SRC-001` with 111 facts extracted. Treatment sync validated clean.
3. If Windows path args ever need to go through git-bash again (not
   PowerShell), remember to double the backslashes or use forward slashes.
4. Deeper inefficiency not fixed: `route-intake --apply` still re-copies
   the *entire* per-topic history on every call (not just new items) —
   wasteful I/O even though it's now cleaned up afterward. Not urgent; flag
   if `route-intake --apply` latency becomes noticeable as topics grow.

Blockers
--------
- None currently open.
