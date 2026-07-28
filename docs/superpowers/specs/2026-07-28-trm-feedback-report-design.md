# TRM Feedback/Report Skill — Design

**Date:** 2026-07-28
**Status:** Approved for planning
**Backlog item:** `TODOS.md` — "TRM feedback/report skill"
**Origin:** [[session-wrap-2026-07-28-benson-ford-close]] retro — classifier accuracy, OCR latency, and new-topic surfacing were all done manually/ad-hoc during the Benson Ford batch; this closes that gap as a standing, repeatable skill.

## Purpose

After any TRM ingest batch, produce a feedback/report pass covering:
1. Fact quality and classifier accuracy (validate output, confidence distribution, extraction gaps)
2. OCR latency data (percentiles vs. budget, timeout rate)
3. Candidate new TRM topics to stub (heuristic clustering on unmapped categories)
4. A web-search cross-check pass on low-confidence / `[VERIFY]`-tagged facts

Currently all four are manual, per-batch, and undocumented (e.g. batch1's classifier verdict was a one-off written into a session memory file, not a repeatable process).

## Architecture

Split across two repos:

- **`trm` (TypeScript CLI)** — supplies raw, mechanical stats. No LLM calls, no web access. Testable in isolation like the rest of the `trm` suite.
- **`skills/trm-feedback-report/` (Claude skill, this repo)** — orchestrates: shells out to `trm`, does the two judgment-requiring passes (new-topic heuristic + web-search cross-check use LLM/tool calls the CLI can't make), synthesizes the narrative report.

This mirrors the existing split in `trm` itself — e.g. `report.ts`/`exportBundle`/`renderHtml` do mechanical bundling, while extraction (`claudeCodeRunner`) is the LLM-calling side.

## Components

### 1. `trm` repo changes

**OCR timing instrumentation** (`src/cli/commands/ingestDir.ts`)
Wrap each OCR call with start/end timestamps. Append one line per file to `<root>/.trm-ops/ocr-timing.jsonl`:

```json
{"schema_version": 1, "topic": "charlie/benson-ford", "source_id": "SRC-016", "source_type": "jpg", "ms": 3421, "retries": 0, "outcome": "success", "ts": "2026-07-28T12:00:00.000Z"}
```

Append-only, not lineage-tracked (internal telemetry, not a validated artifact — no schema entry needed in `schemas/`). `schema_version` lets future OCR pipeline changes (multi-page, image-analyzer v2) add fields without breaking old readers. `source_type` is the file extension; latency distributions differ sharply by type (a 5.7MB HEIC vs. a text-layer PDF), and without it p90/p99 numbers are meaningless averages across incomparable populations.

**New subcommand: `trm feedback-stats <topicPath> [--recursive] [--latency-budget-ms N]`**
Pure aggregator, no side effects, no LLM/network calls. Reads:
- `extracts/extract.json` → confidence distribution, category histogram, `fact_density` (facts per KB of source text — flags extraction gaps: a source with lots of text and few facts suggests the extractor missed things)
- `extracts/score.json` → promoted/rejected ratio
- `trm validate` output → error/warning list, `warnings_count_by_type` (tally by matching existing warning message prefixes from `validate.ts` — `mock_source`, plus counts for schema errors and lineage errors as they already exist, no new taxonomy invented)
- `.trm-ops/ocr-timing.jsonl` → p50/p90/p99, timeout rate, `over_budget` (compares p90 against `--latency-budget-ms`, default `90000` to match the current OCR client timeout)

Output shape:

```json
{
  "ocr_latency": { "p50": 0, "p90": 0, "p99": 0, "timeout_rate": 0, "latency_budget_ms": 90000, "over_budget": false },
  "extract_stats": { "fact_count": 0, "confidence_histogram": {}, "category_histogram": {}, "fact_density": 0 },
  "score_stats": { "promoted": 0, "rejected": 0 },
  "validate_stats": { "errors": [], "warnings_count_by_type": { "mock_source": 0, "schema_error": 0, "lineage_error": 0 } },
  "completeness": { "has_ocr_timing": false, "has_extract": false, "has_score": false, "has_validate": false }
}
```

`completeness` lets the skill short-circuit missing sections without ad-hoc branching (e.g. pre-instrumentation topics have no `ocr-timing.jsonl`).

Tested the same way as the rest of `trm` — fixture `extract.json`/`score.json`/`ocr-timing.jsonl` in, assert the aggregated JSON out. No LLM/network dependency to mock.

### 2. Claude skill: `skills/trm-feedback-report/`

Standard layout per `skills/_TEMPLATE/` (`skill.json`, `SKILL.md`, `README.md`, `docs/USAGE.md`, `src/`, `tests/`).

**Flow:**

1. Run `trm validate <topic> --recursive` and `trm feedback-stats <topic> --recursive --latency-budget-ms <budget>`.
2. **New-topic candidates** (heuristic, no LLM call): collect `categories` across the batch's facts, diff against existing `trm-vault/topics/**` tag set. Flag a cluster as a candidate stub only if it clears all three guardrails:
   - ≥3 facts in the cluster
   - facts drawn from ≥2 distinct sources
   - average confidence ≥0.55

   These guardrails exist specifically to stop a single bad OCR page (one source, several garbage low-confidence facts sharing an accidental keyword) from generating a false-positive topic suggestion.
3. **Web-search cross-check**: select facts below a confidence threshold or carrying a `[VERIFY]` marker, capped at the top 10 by `promotion_score` per batch. Run `WebSearch` per fact. Annotate each with `signal_strength: low | medium | high`, derived from corroborating-hit count and consistency across the top-N results — not a bare corroborated/contradicted/no-signal binary, since a single ambiguous hit shouldn't read the same as five consistent ones.
4. **Narrative synthesis** (the one genuinely judgment-requiring pass): writes the human-readable report, required to include three explicit risk labels (`low`/`medium`/`high`) — extraction risk, classifier drift risk, latency risk — plus a qualitative grouping of validate errors (e.g. "2 schema errors, 1 lineage error") built directly from `validate_stats.errors`/`warnings_count_by_type`, not a separately-invented severity taxonomy.
5. Write `reports/<topic>-feedback-v1-<stamp>.md` (reuses the existing `reports/` convention from `report.ts`). Top of file carries `partial_report: true|false`, set true if any `completeness.*` is false or the web-search step was skipped (tool unavailable).
6. Optionally call `trm crosslink` to append a lineage-visible marker tagged `trm-feedback-report:v1`, so a future pass (or the TRM-to-treatment sync skill) can find prior feedback reports without scanning the `reports/` directory by filename convention alone.

## Error handling

- Missing `ocr-timing.jsonl` (topics ingested before this instrumentation existed) → `completeness.has_ocr_timing: false`, report states "no latency data available," does not fail.
- `trm validate` returning schema/lineage errors → surfaced as the top finding in the narrative; does not abort the rest of the report.
- `WebSearch` tool unavailable → cross-check section skipped, noted explicitly, `partial_report: true`.

## Explicitly deferred (not this pass)

- Publishing `feedback-stats`'s JSON shape as a stable, versioned public contract for other consumers (e.g. a future TRM dashboard). Premature before a second real consumer exists; revisit if/when the TRM-to-treatment sync skill or a dashboard wants to read it directly.

## Testing

**`trm` side:**
- `feedback-stats` unit tests against fixture `extract.json`/`score.json`/`ocr-timing.jsonl` — percentile math, `fact_density`, `warnings_count_by_type` counting, `completeness` flags.
- Regression test: `feedback-stats` on a topic with no `ocr-timing.jsonl` at all (the realistic case for every topic ingested before this ships).

**Skill side:**
- Fixture-driven test invoking the skill against a canned `feedback-stats` JSON + mocked `WebSearch`, asserting all report sections populate and risk labels are present.
- Synthetic new-topic-cluster test: feed facts that clear/miss each of the three guardrails individually, assert candidate surfacing fires only when all three pass.
- Contradictory-WebSearch-results test: mocked search returns inconsistent hits for one fact, assert `signal_strength` reads `low` rather than the narrative asserting false confidence.
