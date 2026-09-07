# Research Questions - Usage Guide

Generate and resolve TRM research questions from a curator-approved batch. This is a prompt-only skill: there is no code entrypoint inside the skill folder. The agent follows SKILL.md and calls the harvester scripts on disk.

**Version**: 1.0.0
**Runtime**: prompt (agent + Node harvester scripts)
**Status**: active
**Category**: research-ops

---

## Purpose

After a curator batch lands as `curator-decisions-final.json`, this skill:

1. Drafts research questions with `scan-gaps.mjs`
2. Resolves open questions (vision-read local archive photos first, WebSearch fallback)
3. Writes `research-questions.json` with closed / escalated / still-open state
4. Recomputes `focus-areas.json` with `update-focus-areas.mjs`
5. Reports counts and ranked focus areas to the operator

Reruns are incremental: questions whose `id` + `question_origin_hash` already match a `closed` entry are carried forward unchanged.

---

## When to use

- Trigger: `/research-questions <topic>` (example topic: `willow-run`)
- Right after `curator-decision-processor` finishes a batch
- When you need a topic's research queue refreshed without re-asking settled questions
- During a scheduled multi-topic sweep (per-topic failures must not stop later topics)

Do not use this skill to invent a curator batch. If `curator-decisions-final.json` is missing, stop.

---

## Prerequisites

- Topic ingest directory exists:
  `C:\Users\soren\trm-vault\topics\charlie\<topic>\trm-ingest\`
- `curator-decisions-final.json` already present in that directory
- Harvester scripts on disk:
  - `C:\dev\src\harvester\external\scan-gaps.mjs`
  - `C:\dev\src\harvester\external\update-focus-areas.mjs`
- For vision-first resolution: matching photo variants under
  `<topic>/analyzed/variants/` (glob by `fact_id`, including letter suffixes like `_a`, `_c`)
- Agent tools: image Read, WebSearch, Node

---

## How to run

### Agent invoke

```text
/research-questions willow-run
```

### Step 1 - Draft questions

```powershell
node C:\dev\src\harvester\external\scan-gaps.mjs `
  --decisions=C:\Users\soren\trm-vault\topics\charlie\willow-run\trm-ingest\curator-decisions-final.json `
  --topic=willow-run
```

Writes `draft-questions.json` into the same `trm-ingest/` directory.

### Step 2 - Load prior state

If `research-questions.json` already exists:

- Carry forward any entry whose `id` + `question_origin_hash` match a closed question
- Process new or changed hashes as open work

### Step 3 - Resolve each open question needing processing

**Vision-read first** for `low-confidence` and `gap` questions:

- Glob local variants under `<topic>/analyzed/variants/` for the question `fact_id`
- Content check: does the photo match the topic label?
- ID-integrity check: if a stamped negative number in-frame disagrees with `fact_id`, set `id_mismatch_flagged` / `id_mismatch_observed`
- Clear vision verdict -> `status: closed`, `confidence: high`, `sources: ['local-archive-visual-read']`
- Unresolvable ID mismatch -> `status: escalated`
- No matching photo -> fall through to WebSearch

**WebSearch fallback** for `curator-flagged` questions and any vision miss:

- Record exact queries in `search_terms_used`
- Increment `search_attempt_count` only when WebSearch actually runs
- Clear answer -> `closed` / high confidence / URL sources
- Thin or contradictory -> `escalated` with `escalation_reason`
- Failed/empty search -> leave `open` (do not force a verdict)
- Surface unexpected unknowns in `new_leads` (do not create new top-level questions in this pass)
- Always set `last_attempt` to an ISO timestamp

### Step 4 - Write research-questions.json

Write the full open/closed/escalated list to the topic `trm-ingest/` directory. Carry `deterministic_id` and `created_at` from draft unchanged. Overwrite top-level `llm` provenance each run:

```json
{ "model": "claude-sonnet-5", "run_at": "<ISO timestamp>" }
```

### Step 5 - Recompute focus areas

```powershell
node C:\dev\src\harvester\external\update-focus-areas.mjs `
  --questions=C:\Users\soren\trm-vault\topics\charlie\willow-run\trm-ingest\research-questions.json
```

Writes `focus-areas.json` beside the questions file.

### Step 6 - Report

Tell the operator how many questions closed / escalated / still open, plus ranked focus areas.

---

## Inputs and outputs

### Inputs

| Field | Type | Notes |
| --- | --- | --- |
| `topic` | string | Required. Example: `willow-run` |
| `curator-decisions-final.json` | file | Must already exist in topic `trm-ingest/` |

### Outputs

| Artifact | Location |
| --- | --- |
| `draft-questions.json` | topic `trm-ingest/` (from scan-gaps) |
| `research-questions.json` | topic `trm-ingest/` |
| `focus-areas.json` | topic `trm-ingest/` (from update-focus-areas) |

Question statuses used: `open`, `closed`, `escalated`.

---

## Examples

### Fresh topic after curator approval

```text
1. Confirm curator-decisions-final.json exists for willow-run
2. /research-questions willow-run
3. Review closed vs escalated counts
4. Open focus-areas.json for ranked next work
```

### Incremental rerun

Same invoke. Closed questions with unchanged origin hashes skip re-search. Only new or changed hashes run vision/WebSearch again.

### Scheduled multi-topic sweep

Process topics one by one. If one topic fails (missing decisions file, script non-zero exit), log it and continue to the next topic.

---

## Troubleshooting

**Missing curator-decisions-final.json**

Stop. Do not fabricate a batch. Run curator-decision-processor first, or point at the correct topic.

**scan-gaps.mjs or update-focus-areas.mjs exits non-zero**

Surface the exact stderr and stop. Do not hand-write the JSON as a substitute for a script failure.

**Vision never fires**

Check that variants exist under `<topic>/analyzed/variants/` and that the `fact_id` glob matches (suffixes like `_c` are common).

**Questions keep reopening**

Origin hash changed (draft regenerated with different source facts). That is intentional; treat them as new work.

**Search failed but question was closed**

That violates the design rule. Empty/error searches must stay `open` with updated attempt metadata only.

---

## See also

- [Skill Operator Guide](../../../docs/meta/skill-operator-guide.md)
- [SKILL.md](../SKILL.md) / [README.md](../README.md) / [SKILL.json](../SKILL.json)
- Related: `trm-closed-loop-research`, curator-decision-processor, harvester `scan-gaps.mjs` / `update-focus-areas.mjs`
