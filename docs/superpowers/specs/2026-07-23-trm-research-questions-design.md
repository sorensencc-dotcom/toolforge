# TRM Research Questions — Design

**Date:** 2026-07-23
**Status:** Approved for implementation

## Purpose

After curator-decision-processor approves a batch of TRM evidence, some facts remain
gaps, low-confidence, or explicitly flagged by the curator as needing more research.
This project generates research questions from those facts, resolves the quick ones
via web search, escalates the rest, and rolls open items up into a per-topic
focus-area list. That focus-area list is the future input to a separate deep-research
harvester agent (see roadmap doc, out of scope here).

## Components

1. **`scan-gaps.mjs`** (`src/harvester/external/scan-gaps.mjs`)
   Reads a topic's `curator-decisions-final.json` + associated TRM fact files.
   Emits `draft-questions.json` in the topic's `trm-ingest/` dir: one entry per
   gap / low-confidence fact / curator-flagged item, each tagged with
   `source_type` (`gap` | `low-confidence` | `curator-flagged`), the `fact_id`
   it's tied to, and a plain-language question string. Hard error (exit 1) on
   missing/malformed input — no partial output written.

2. **`research-questions` skill** (`skills/research-questions/`)
   Claude-driven. Reads `draft-questions.json`. For each open question: runs
   WebSearch, judges result quality itself (LLM judgment call, not a fixed
   rule), and either:
   - closes it with an `answer`, `confidence: high`, and `sources`, or
   - escalates it (`status: escalated`) with `escalation_reason` and whatever
     partial info was found.
   Any new unknowns surfaced mid-search (a search turning up a name/date not
   in the original fact) get appended as new draft questions (`new_leads`),
   not dropped. Writes results into `research-questions.json` alongside the
   draft file (same shape, augmented).
   Web search failures / no results: question stays `open` with a
   `last_attempt` timestamp, retried on next run — never force-closed or
   force-escalated on a failed search.

3. **`update-focus-areas.mjs`** (`src/harvester/external/update-focus-areas.mjs`)
   Re-aggregates all `open` + `escalated` questions for a topic into
   `focus-areas.json`: ranked themes/entities by open-question count
   (recency-weighted, and weighted by `fact_confidence` where present —
   lower-confidence facts push their theme up in priority). Overwritten each run. Always written, even when empty
   (`focus_areas: []`) — absence of the file must mean "never run," not
   "nothing to research."

## Trigger modes

- **Manual:** `/research-questions <topic>` runs the full chain for one topic.
- **Chained-after-curator:** curator-decision-processor.mjs's final console
  output prints "Next: run /research-questions <topic>." No code coupling —
  the judgment step needs Claude, not the script, so this is a documented
  handoff, not an automated call.
- **Scheduled sweep:** `/loop` or a cron entry re-invokes `/research-questions`
  per topic on an interval, picking up any topic whose
  `curator-decisions-final.json` is newer than its `research-questions.json`.
  One topic erroring must not abort the sweep for other topics — log and
  continue.

## Data formats

**`draft-questions.json`** (vault, per topic `trm-ingest/`):
```json
{
  "topic": "willow-run",
  "generated": "2026-07-23T00:00:00Z",
  "questions": [
    {
      "id": "q-0001",
      "source_type": "low-confidence",
      "fact_id": "78626",
      "fact_confidence": 0.72,
      "question": "Was photo 78626 taken at Willow Run or a different Ford plant?",
      "question_origin_hash": "sha256:...",
      "status": "open"
    }
  ]
}
```
`fact_confidence` is copied from the source fact when available (omitted if
the fact carries no confidence score, e.g. curator-flagged items with no
model score). `question_origin_hash` is a hash of the fact content +
curator-decision content that produced this question — if either changes on
a later curator run, the hash no longer matches and `scan-gaps.mjs`
regenerates the question instead of treating it as already-answered.

**`research-questions.json`** (same dir) — same shape, each question augmented
with, once processed:
```json
{
  "status": "closed",
  "answer": "...",
  "confidence": "high",
  "sources": ["https://..."],
  "escalation_reason": null,
  "new_leads": [],
  "search_attempt_count": 1,
  "search_terms_used": ["Willow Run 1943 photo 78626", "..."],
  "last_attempt": "2026-07-23T00:00:00Z"
}
```
`search_attempt_count` increments each time the skill re-attempts an `open`
question (helps future runs/agents prioritize stubborn, repeatedly-failing
questions). `search_terms_used` records the actual query strings tried, for
reproducibility and debugging why a question closed/escalated the way it did.

**`focus-areas.json`** (vault, per topic, overwritten each run):
```json
{
  "topic": "willow-run",
  "updated": "2026-07-23T00:00:00Z",
  "focus_areas": [
    {
      "theme": "MFM photo provenance for 1943-44 batch",
      "open_question_count": 4,
      "priority": "high"
    }
  ]
}
```
Cross-topic rollup (e.g. `trm-vault/focus-areas-index.json`) is out of scope
for this project — the per-topic files are the ready-made input for it later.

## Storage split

- **Vault** (`C:\Users\soren\trm-vault\topics\<topic>\trm-ingest\`): all data
  files — `draft-questions.json`, `research-questions.json`,
  `focus-areas.json`. Vault stays single source of truth for TRM content.
- **Repo** (`C:\dev\src\harvester\external\`): the two mechanical scripts.
  The skill lives in `C:\dev\skills\research-questions\`.

This matches the existing `curator-decision-processor.mjs` convention
(script in repo, output in vault).

## Error handling

- `scan-gaps.mjs`: missing/malformed `curator-decisions-final.json` → exit 1,
  no partial `draft-questions.json`.
- Web search failure/no results: question stays `open`, retried next run.
- `update-focus-areas.mjs`: always writes `focus-areas.json`, even when empty.
- Scheduled sweep: per-topic failures logged and skipped, not fatal to the
  sweep.

## Testing

- `scan-gaps.mjs` and `update-focus-areas.mjs` are pure file-in/file-out —
  unit-testable with fixture JSON (one gap, one low-confidence, one flagged
  item → assert `draft-questions.json` / `focus-areas.json` shape).
- The skill's web-search/judgment step is not unit-testable (LLM reasoning).
  Verified by a manual run against the real willow-run batch, checked by eye.

## Out of scope

- The deep-research harvester agent that consumes `focus-areas.json` across
  all TRM topics and self-learns query strategy — see
  `docs/meta/trm-deep-harvester-roadmap.md`.
- Cross-topic focus-area rollup/index.
