---
name: research-questions
description: Generate and resolve TRM research questions from a curator-approved batch. Runs scan-gaps, does web search + confidence judgment per question, then recomputes focus areas. Trigger: /research-questions <topic>, or after curator-decision-processor finishes a batch.
---

# Research Questions

## Input

A topic name, e.g. `willow-run`. Locate the topic's ingest directory:
`C:\Users\soren\trm-vault\topics\charlie\<topic>\trm-ingest\`.
Requires `curator-decisions-final.json` to already exist there (output of
curator-decision-processor.mjs).

## Steps

1. **Generate draft questions.** Run:
   `node C:\dev\src\harvester\external\scan-gaps.mjs --decisions=<path to curator-decisions-final.json> --topic=<topic>`
   This writes `draft-questions.json` into the same directory.

2. **Load existing state.** If `research-questions.json` already exists in
   that directory, read it. Any question whose `id` + `question_origin_hash`
   matches an existing `closed` entry is already resolved — carry it
   forward unchanged, do not re-search it. Any question with a new or
   changed `question_origin_hash` (or not present before) needs processing
   as below. This is what makes reruns incremental instead of re-asking
   settled questions.

3. **For each `open` question needing processing:**
   - Run WebSearch using the question text (and `fact_id`/topic as
     context) as the query. Record the exact query string(s) tried in
     `search_terms_used`.
   - Increment `search_attempt_count` (starts at 0, so first attempt = 1).
   - Judge the search results yourself:
     - If results clearly and specifically answer the question with a
       source you'd trust: set `status: 'closed'`, `answer` (your
       synthesized answer), `confidence: 'high'`, `sources` (the URLs that
       support it).
     - If results are thin, contradictory, or off-topic: set
       `status: 'escalated'`, `escalation_reason` (why — e.g. "no sources
       mention this photo directly" or "two sources disagree on date"),
       keep any partial `answer` you can offer with `confidence: 'low'`.
     - If the search errored or returned nothing at all: leave
       `status: 'open'`, just update `search_attempt_count`,
       `search_terms_used`, and `last_attempt`. Do not force a
       closed/escalated verdict on a failed search — that's a rule from
       the design spec, not a judgment call.
   - If a search result surfaces a new unknown not covered by any existing
     question (e.g. a name or date mentioned that raises its own
     question), append it to that question's `new_leads` array as a plain
     string. Do not silently drop it, and do not create a new top-level
     question entry for it in this pass — `new_leads` is picked up as
     input the next time `scan-gaps.mjs`-equivalent triage happens on this
     topic (future enhancement; for now it's just recorded).
   - Set `last_attempt` to the current ISO timestamp regardless of outcome.

4. **Write `research-questions.json`** in the topic's `trm-ingest/`
   directory: the full question list (open, closed, and escalated),
   matching the augmented shape from the design spec.

5. **Recompute focus areas.** Run:
   `node C:\dev\src\harvester\external\update-focus-areas.mjs --questions=<path to research-questions.json>`
   This writes `focus-areas.json` into the same directory.

6. **Report to the user:** how many questions were closed / escalated /
   still open, and the resulting focus areas ranked by priority.

## Error handling

- If `curator-decisions-final.json` is missing, tell the user and stop —
  do not fabricate a batch.
- If `scan-gaps.mjs` or `update-focus-areas.mjs` exit non-zero, surface
  the exact stderr to the user and stop; do not attempt to hand-write the
  JSON yourself as a substitute for a script failure.
- Per-topic failures in a scheduled sweep (multiple topics processed in
  one invocation) must not stop the remaining topics — log which topic
  failed and continue to the next.
