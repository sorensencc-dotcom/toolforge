---
name: session-wrap-2026-07-18-trm-harvester-mock-wiring
description: "TRM Harvester mock-wiring shipped end-to-end (brainstorm -> spec -> plan -> SDD -> merge -> push); codex CLI hung silently twice mid-session, Task 3 finished by hand."
metadata:
  type: project
  originSessionId: 5eec4d43-33fc-4ebd-8523-e57970ebde53
  modified: 2026-07-19T01:24:55.215Z
---

## What shipped

**TRM Harvester mock-wiring** — `trm ingest --file <image>` (jpg/jpeg/png/webp/gif) now routes to a vendored mock `ReverseImageSearchExtractor`, writes a `mock`-flagged `sources/raw/SRC-###.json`, and `trm validate` surfaces a non-blocking WARN for any mock-flagged source. Merged to `trm` main (`e16d41a`), pushed. Full docs trail: design spec `docs/meta/specs/2026-07-18-trm-harvester-mock-wiring-design.md`, plan `docs/superpowers/plans/2026-07-18-trm-harvester-mock-wiring.md` (both in `c:\dev`, pushed).

**Why:** [[session-wrap-2026-07-18-trm-reporting-and-ingest]] flagged the CIC Harvester claim as unverified. This session verified it first — see next section — before any design work, per the memory system's own rule.

## Harvester claim verification — mostly false

Prior claim: "CIC Harvester exists, production-grade — `ImageAnalyzerV3` (scene/context/people/place/geolocation), `ReverseImageSearchExtractor` (full test coverage), queue/DLQ pipeline." Checked against live `c:\dev\cic-ingestion` code:
- `ImageAnalyzerV3`: does not exist anywhere.
- `ReverseImageSearchExtractor`: real file, registered in `ExtractorRegistry`, but **zero tests**, and its Vision API call is a hardcoded stub (2 fake URLs) — not production-grade.
- Queue/DLQ pipeline: real, confirmed substantive.

**How to apply:** if CIC Harvester/cic-ingestion comes up again, don't trust prior "production-grade" framing without re-checking — this is the second time in this project a capability claim in memory turned out overstated (see [[finding-cic-ingestion-gamed-pass-2026-07-17]] for the first).

## Process notes

- Two caveman-review passes (one on the design spec, one implicit via careful spec self-review) each caught a real gap before code existed — extract-before-addSource ordering wasn't stated explicitly, and the mock-flag object-spread order was fragile (`{ mock: X, ...result }` vs `{ ...result, mock: X }`). Consistent with [[feedback_verify_fix_by_running_not_reading]] — review before code, not after.
- Full brainstorm -> spec -> plan -> SDD cycle used, same as [[session-wrap-2026-07-18-trm-reporting-and-ingest]]'s two shipped features. Worked cleanly end to end.
- Final whole-branch review (Opus) caught a real integration bug no per-task review would: the vendored extractor's `log()` used `console.log`, polluting `trm ingest`'s JSON stdout contract on the image path only (docx/pdf path stayed clean since it doesn't log). Fixed in one commit (`e16d41a`) after the review, re-verified via live CLI smoke test (not just re-running unit tests) — stdout stayed clean JSON, stderr carried diagnostics.

## codex CLI reliability — new finding

Asked to have codex CLI do "most of" the SDD implementation work this session. Result:
- **Windows sandbox helper missing**: first dispatch failed outright — `codex-windows-sandbox-setup.exe` missing, `-s workspace-write` unusable on this machine. Fix: use `-s danger-full-access` instead (worktree isolation is the actual safety boundary, not codex's sandbox).
- **Silent hangs, 2 of 3 dispatches**: Task 2's first attempt sat at 0.30 CPU for ~2 hours before being caught; Task 3's first retry sat similarly for 45+ min. Both times `codex exec` returned exit 0 promptly from the Bash tool's perspective (backgrounded), giving zero signal that the actual codex agent process was stuck — only `Get-Process <pid> | Select CPU` (near-zero CPU after long wall-clock time) revealed the hang. Both stalls resolved by `Stop-Process -Force` + identical retry, which then completed in under a minute.
- **Net result**: 1 of 3 tasks (Task 1) went clean on first codex dispatch. Task 2 needed one kill+retry. Task 3 needed two kill+retries and was still stuck the third time when the user said "let's stop and just finish the work here" — implemented directly by hand from the same task brief, passed the same task review with zero required changes.

**How to apply:** on this machine, treat codex CLI as flaky for anything beyond quick single-file tasks. If delegating to codex again: (1) always pass `-s danger-full-access`, never `workspace-write`, (2) never trust a bare "still running" state — schedule a wakeup at a short interval (5 min, not 20+) and check `Get-Process <pid> -ErrorAction SilentlyContinue | Select CPU` against wall-clock elapsed; near-zero CPU after several minutes means hung, not "complex," (3) after 2 stalls in a row, stop retrying automatically and ask the user rather than burning a 3rd silent attempt — this session got that judgment call right only because the user interrupted, not because the process caught it proactively.

## git housekeeping surprise

`c:\dev` had a concurrent session/user actively committing in parallel throughout (15 commits landed on `main` between my design-spec commit at 15:04 and my push attempt at ~21:20 — skill migrations, security-scanner fixes, cowork-sync docs, a version release). My own 3 session commits were never lost — `git log --oneline -6` just didn't scroll back far enough to show them, which looked alarming for a moment. Lesson: on a shared/multi-session repo, use `git merge-base --is-ancestor <mine> <HEAD>` to check "is my work still here" instead of eyeballing a short `git log`.

Also confirmed live: [[learning-cowork-daemon-live-regen]] — the cowork auto-sync daemon re-dirties `audit/*.md`, `dashboard.html`, `skills/SKILLPACK-*` with fresh timestamps every time you look, mid-session. `git pull --rebase --autostash` still hit an autostash conflict against it once; resolved by dropping the conflicting autostash (verified via `git stash show -p --stat` that the only diff content was daemon timestamps, nothing real).

## Next session

No specific "next" task was named. Two candidates surfaced but not started: (1) fix the pre-existing unrelated `tests/reporting/renderHtml.test.ts` failure in `trm` (category-casing assertion broken by a prior main commit, verified via `git stash` to predate this session's work — flagged to user, not fixed), (2) the harvester's own documented Migration Path — replace the vendored mock extractor with a real HTTP call to `cic-ingestion` once it grows real Vision API integration (not started, cic-ingestion still has no real vision capability as of this session).
