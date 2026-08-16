---
name: project-notebooklm-ingest-live-bugs-2026-08-13
description: NotebookLM ingest feature hit 6 real bugs across 2 sessions (4 initial, git-bash path mangling, unbounded staging-dir disk growth); all 5 registered notebooks fully ingested+mined, 16GB backlog cleared.
metadata: 
  node_type: memory
  type: project
  originSessionId: 1e8e68d7-e38d-48b1-be86-3a7570d8ddcd
  modified: 2026-08-14T02:39:43.717Z
---

Ran `trm ingest-notebooklm`/`mine-notebooklm` live against real notebooks beyond the original CIC-KB smoke test (which only exercised `mine-notebooklm`, never a real keyword-matched `ingest-notebooklm` path). Found and fixed 4 real bugs, all invisible to the shipped unit-test suite because tests mocked `spawn` and never asserted exact CLI argument values:

1. `stagingName.ts` slugifyTitle had no length cap — a full legal-citation source title produced a >260-char path, ENOENT on Windows MAX_PATH. Fixed: cap at 80 chars.
2. `ingestNotebooklm.ts` passed `topics/charlie/<topic>` to `trm ingest`/`trm extract`, but `nodeDir()` already prepends `topics/` — every keyword-matched item silently failed with a double-prefixed ENOENT. This was the big one: it meant the entire ingest→extract chain never worked for any notebook whose content actually matched a topic, since the feature shipped.
3. `extract.ts` had no dedup — a single extraction pass could emit the same claim twice from one source, producing exact-duplicate factKeys that made `sync-treatment`'s collision check skip the whole topic on every future run (was silently blocking benson-ford/helene long before this session).
4. `charlie-deep-research/treatment/CIC_SOURCING_DEPENDENCY_MAP_v1.json` had two independent id-numbering schemes (beat-based vs sourcing-packet-based) both using `V-7.x`, colliding and crashing `loadDependencyMap`. Renamed the newer packet-based block to `P7-1..P7-5`.

**Why:** live-verification against real data/network caught what mocked tests structurally couldn't — the tests checked that `spawn` was called with `args[1] === 'ingest'` but never checked `args[2]`'s exact value.

**How to apply:** trust live runs over test-suite-green when a feature's tests mock the boundary it's supposed to exercise (subprocess calls, network calls). See also [[feedback_verify_subagent_test_reports]].

Handoff for the remaining 3 notebooks (Willow Run Videos, Cast Iron Charlie - Research Logs, Sorensen Photographic Archive) is in `C:\dev\.ijfw\memory\handoff.md`. Registry: `C:\Users\soren\trm-vault\notebooklm-registry.json`. Always set `$env:TRM_ACTOR = "ACTOR-001"` before mutating trm commands; `trm` needed `npm link` from `C:\dev\trm` to resolve on PATH (was missing).

**2026-08-14 follow-up — 5th bug, sweep closed:** Ran the remaining 3 notebooks. Hit a 5th real bug: **running `trm ingest-notebooklm ... --narrative-root C:\dev\charlie-deep-research` through the Bash tool (git-bash) strips backslashes from Windows path args**, turning `C:\dev\charlie-deep-research` into `C:devcharlie-deep-research` and crashing `sync-treatment`'s dependency-map lookup. Not a trm bug — a shell-quoting mismatch. Fix: run trm commands needing Windows path args via the **PowerShell tool**, not Bash/git-bash. Rerunning `trm sync-treatment` via PowerShell with the same path fixed it immediately.

Also hit an orphaned `.git/index.lock` in trm-vault after a `git add -A` got killed by a Bash-tool timeout mid-run (6500+ changed files, mostly `.ijfw` housekeeping churn + thousands of junk `.ijfw/scan-state.json.tmp.*`). Verified no live process held it (a coincidentally-reused PID was a harmless `git fsmonitor--daemon`, not the add) before removing the stale lock — then staged only the ingest-relevant paths explicitly instead of `-A`, per [[feedback_check_git_add_a_embedded_repo_warnings]]-style caution.

All 5 registered notebooks (CIC-KB, CIC-Daily-Research, Willow Run Videos, Cast Iron Charlie - Research Logs, Sorensen Photographic Archive) are now fully ingested + mined + synced. trm-vault committed locally (8efc585, no remote by design, see [[project-trm-vault-deliberately-local-only]]). No notebooks remain in the sweep; only the weekly `TRM-Notebooklm-Mine` scheduled task continues.

**2026-08-14 follow-up — 6th bug, unbounded disk growth (16GB), fixed + backlog cleared:** User flagged "prune old junk" as optional cleanup; investigation found it was a real bug, not cosmetic litter. `route-intake --apply` re-copies its entire vault-wide `doneEntries` history into a fresh `topics/charlie/<topic>/_staging-intake-<runId>/` dir on **every** `ingest-notebooklm` run (not just the pulled notebook's topic — route-intake restages the whole vault regardless of trigger). Nothing ever cleaned up the old dirs. 11 accumulated runs left 16GB of near-identical duplicates across 5 topics (willow-run alone: 15.4GB / 11 snapshots). `trm ingest` reads each `stagedPath` exactly once and persists the content permanently via `writeRawEnvelope` — the staged file is dead weight the instant ingest succeeds.

Fixed in trm (`d8134c3`, pushed): `ingestNotebooklm.ts` now deletes every `_staging-intake-<runId>` dir reachable from the run's `intake-routing-report.json`, once ingest+extract finish. Best-effort/non-fatal. Scoped correctly: a standalone `trm route-intake --apply` invocation (outside the automated notebooklm pipeline) is untouched, since a human may still need those staged files for manual `trm ingest`. New regression test added (TDD, not retrofitted) asserting dirs from *other* topics in the same report also get cleaned, not just `extractTopics`. Full suite 696/707 green; only failure across two full runs was `analyzeFrames.test.ts` (pre-existing, confirmed flaky via isolated rerun — 57/57 pass alone).

Backlog cleared in trm-vault: deleted all 51 existing `_staging-intake-*` dirs. **Caught my own mistake mid-cleanup:** used `git add topics/` (broad, not `-A`, but still too broad) to stage the deletions — it silently swept in unrelated pre-existing untracked junk from the *original* topicPath double-prefix bug (`topics/topics/charlie/*/...` and `topics/cuba/extracts/...` missing `charlie/`), which had been sitting on disk untracked since before that bug was fixed. Caught it by reading the commit's file list before considering the task done, not by trusting `git add` output — see [[feedback_check_git_add_a_embedded_repo_warnings]]. Corrective follow-up commit removed the junk.

**Why:** "prune old junk" from the user was a vague ask; taking it at face value and just deleting files would have missed that this was an active, ongoing bug that would keep re-accumulating. Investigating scope *before* acting turned a disk-cleanup request into a real fix.

**How to apply:** when asked to "clean up" something that keeps recurring, check whether it's actively being regenerated by running code before treating it as one-time cleanup. And per [[feedback_check_git_add_a_embedded_repo_warnings]]: any `git add <path>` broader than individually-named files on this vault needs a `git status`/`git diff --stat` review before commit, not just before `-A` — this vault has accumulated untracked bug-leftover junk before.
