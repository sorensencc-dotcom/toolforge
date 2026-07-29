# TRM-to-Treatment Sync Skill — Design

Status: DRAFT — pending user review
Opened from: `TODOS.md` "TRM-scan-to-treatment sync skill" item, sourced from
`memory/session-wrap-2026-07-28-benson-ford-close.md`.

## Problem

TRM ingest produces per-topic `extract.json` fact files under
`trm-vault/topics/charlie/<topic>/extracts/extract.json`. Reconciling new
facts into the CIC documentary treatment (a separate repo,
`charlie-deep-research/`, keyed by V-item beat IDs) is currently manual and
ad-hoc: someone reads the extract file, cross-references
`CIC_SOURCE_LIBRARY.md` and `CIC_SOURCING_DEPENDENCY_MAP_v1.json` by hand,
and updates the source library / treatment draft themselves. This doesn't
scale past a handful of topics and has no repeatable diff mechanism (no way
to know what's already been reconciled vs. new since last pass).

## Scope

Build a `trm sync-treatment` CLI subcommand that:

1. Diffs each topic's `extract.json` against a per-topic cursor to find
   facts not yet surfaced.
2. Suggests candidate V-item/beat matches via deterministic keyword/category
   scoring (no LLM call).
3. Writes a markdown reconciliation report into `charlie-deep-research/treatment/`.
4. Updates the cursor only after a successful report write.

**Out of scope (explicit non-goals for v1):**

- No automatic editing of treatment prose or `CIC_SOURCE_LIBRARY.md`. Human
  reviews the report and integrates by hand — this is a Tier 1 narrative
  decision, not a Tier 3 automation.
- No LLM-assisted matching. Deterministic scoring only, so runs are
  reproducible and unit-testable.
- No `--since <date>` partial-sync flag — cursor-based diffing already
  covers the "what's new" case; a date flag is redundant until a concrete
  need appears.
- No auto-trigger after `trm ingest-dir`. Manual invocation only.

## Architecture

New command file `C:\dev\trm\src\cli\commands\syncTreatment.ts`, registered
in `src/cli/index.ts` alongside the existing per-command pattern (`validate.ts`,
`report.ts`, etc.). Reads from `trm-vault` (owned by trm), writes only to
`charlie-deep-research/treatment/` (owned by the narrative repo) — no writes
back into trm-vault except the cursor file, which is sync-run bookkeeping,
not vault content.

The two repos stay decoupled: trm owns the vault/extract schema, the
narrative repo owns beat structure and prose. The sync command is the only
bridge, and it only ever produces a new report file — never mutates existing
narrative-repo files.

## Cursor state

One file per topic: `trm-vault/topics/charlie/<topic>/.sync-cursor.json`.

```json
{
  "cursorVersion": 1,
  "lastSyncedIds": ["FCT-001", "FCT-002"],
  "lastRunAt": "2026-07-28T18:00:00.000Z",
  "factCountAtLastSync": 2
}
```

- Diff: read `extracts/extract.json`, compare `facts[].id` against
  `lastSyncedIds`. Anything not present is "new this run."
- Cursor updates happen only after the report file is successfully written
  — a failed/aborted run leaves the cursor untouched so nothing is silently
  marked as synced without a report to show for it.
- For an `all`-topics run, the report is one file covering every topic, but
  each topic still has its own cursor. Cursors are updated only after the
  full report write succeeds, in a single pass over all touched topics
  immediately following that write — not interleaved per-topic during
  report generation. If the process crashes between the report write and
  finishing the cursor-update pass, some topics' cursors may lag; the next
  run detects this as extra "new" facts for those topics (safe — reprocessed,
  not lost) and the command logs which topics' cursors were confirmed
  updated vs. not, to stderr, on any interrupted run it can detect.
- Malformed/unreadable cursor JSON → treated as empty (all facts appear
  "new"), a warning is logged to stderr with the cursor file path, and the
  report includes a "cursor reset" note explaining why an unusually large
  batch of "new" facts appeared.

## Matching

Load `CIC_SOURCING_DEPENDENCY_MAP_v1.json` once per run (array of
`{ id, beat, claim, ... }`). The dependency-map file itself gains a top-level
`matchSchemaVersion` field (added as part of this work, defaulting to `1`);
the sync command reads and stamps this value into the report's
`matchVersion` field rather than hardcoding it — so a schema change to the
map is what bumps the report tag, not a manual edit in the sync command.

For each new fact:

1. Normalize text on both sides before scoring: lowercase, strip
   punctuation, collapse whitespace.
2. Score against every V-item by category overlap (fact `categories` vs.
   keywords derived from the V-item's `claim` text) plus simple token
   overlap between `claim` and fact `text`.
3. Bucket the raw score into `high` / `medium` / `low` confidence rather
   than exposing a raw number — keeps the report readable and triage-focused.
   Thresholds (implementation-defined constants, tunable without a design
   change): score >= 0.6 → high, >= 0.3 → medium, >= 0.1 → low, below 0.1 →
   no match (goes to "unmatched" bucket). These cutoffs are a starting point
   validated against real fixture data during implementation, not fixed by
   this design.
4. Cap suggested matches at 3 per fact (highest-scoring first, ties broken
   by V-item id ascending). Facts with no match at or above the low-confidence
   floor (0.1) go in an "unmatched" bucket.

Missing dependency-map file → hard error (exit code 1), error message
includes the expected file path. Matching cannot proceed without it, unlike
a missing per-topic `extract.json`, which is a per-topic skip.

## Report output

One file per run, never overwritten:
`charlie-deep-research/treatment/TRM_SYNC_REPORT_<topic>_<YYYYMMDDTHHMMSS>.md`
(or `_all_` when run across all topics). The full timestamp, not just the
date, disambiguates same-day reruns — no collision/overwrite risk even when
the command runs multiple times in one session. A `--dry-run` invocation
uses a `_DRYRUN_` infix in the filename (e.g.
`TRM_SYNC_REPORT_DRYRUN_<topic>_<timestamp>.md`) and sets `dryRun: true` in
the frontmatter, so preview output is never mistaken for a committed run
when scanning the treatment directory.

Frontmatter header:

```yaml
---
topic: <topic|all>
runAt: <ISO timestamp>
vaultSnapshot: <ISO timestamp of extract.json read>
matchVersion: 1
cursorVersion: 1
partialRun: false
dryRun: false
---
```

Body:

- If a cursor reset happened, a note immediately after the frontmatter
  (before any fact content) explaining it — kept grep-able at a fixed
  position rather than a loose "near the top."
- If zero new facts: single line, `No new facts detected.` — still writes
  the file, so run history stays complete (a topic with a real "nothing
  changed" run looks different from a topic that was never checked).
- Otherwise: new facts sorted by `source_id` then `id` (deterministic
  ordering → stable diffs between reports). In an `all`-topics report, each
  fact block is prefixed with its topic name (e.g. `[willow-run] FCT-001`)
  since fact ids restart at `FCT-001` per topic and are not globally unique
  — without the prefix, facts from different topics would be visually
  indistinguishable in a combined report. Each block: topic-qualified id,
  text, confidence, source_id, suggested V-item match(es) with confidence
  bucket, or "unmatched."
- Summary counts by topic and category at the end.

## CLI surface

- `trm sync-treatment` — all charlie topics.
- `trm sync-treatment <topic>` — single topic.
- `--dry-run` — runs the full diff/match/report pipeline but skips the
  cursor update (preview without marking facts as synced).

Exit codes:

- `0` — success, all topics processed cleanly.
- `1` — missing dependency-map JSON (hard error, can't match without it).
- `2` — partial success (one or more topics skipped, e.g. missing
  `extract.json`); report's `partialRun: true` reflects this.

## Error handling

- Missing `extracts/extract.json` for a topic → skip that topic with a
  warning, continue processing remaining topics, exit code 2 at the end.
- Missing dependency-map JSON → hard error, exit code 1, path included in
  the message.
- Malformed cursor → treated as empty, warning logged with cursor file
  path, "cursor reset" note written into the report.

## Testing

Unit tests (fixture `extract.json` + fixture dependency-map JSON, no real
vault/filesystem beyond fixtures):

- New-vs-cursor diff logic, including the all-already-synced case (zero new
  facts).
- Malformed-cursor fallback (treated as empty, reset note present).
- Missing dependency-map → hard error thrown cleanly.
- Matching/scoring function, including multiple-matches-above-threshold
  (cap-at-3 logic) and confidence bucketing.
- Report markdown generation, including deterministic sort order and the
  `[topic]`-prefix behavior in `all`-topics reports.
- `matchSchemaVersion` read from the dependency-map fixture propagates into
  the report's `matchVersion` field unchanged (no hardcoded value in the
  command).
- `--dry-run` produces a `DRYRUN`-infixed filename, `dryRun: true` in
  frontmatter, and leaves the fixture cursor file byte-for-byte unchanged.
