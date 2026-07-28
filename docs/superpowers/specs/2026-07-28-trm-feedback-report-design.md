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

**`validate.ts` error typing (review finding: prefix-matching free-text errors is fragile)**
`ValidationReport.errors`/`.warnings` change from `string[]` to `{ type: 'schema_error' | 'lineage_error' | 'hand_edited' | 'mock_source'; message: string }[]`. Each push site in `validateNode`/`checkScoreNotHandEdited`/`checkMockImageSources` already knows which case it is — tag at the source instead of re-deriving the type downstream from message text. `feedback-stats` tallies `warnings_count_by_type` by reading `.type` directly, no string matching. This is a breaking change to `ValidationReport`'s shape — any other `trm` caller of `runValidate` (CLI output formatting) updates to read `.message` where it currently prints the string directly.

**New subcommand: `trm feedback-stats <topicPath> [--recursive] [--latency-budget-ms N]`**
Pure aggregator, no side effects, no LLM/network calls. Reads:

- `extracts/extract.json` → confidence distribution, category histogram
- Source raw text via `readRawEnvelope` per source listed in `sources/metadata.json` (same call `extract.ts` already makes) → total source text KB, used for `fact_density` (facts per KB of source text — flags extraction gaps: a source with lots of text and few facts suggests the extractor missed things). Image-kind sources (no `envelope.text`) are excluded from the KB denominator, not counted as zero.
- `extracts/score.json` → promoted/rejected ratio
- `trm validate` output (now typed, see above) → error/warning list, `warnings_count_by_type` tallied directly from `.type`
- `.trm-ops/ocr-timing.jsonl` → p50/p90/p99, timeout rate, `over_budget` (compares p90 against `--latency-budget-ms`, default `90000` to match the current OCR client timeout)

Output shape:

```json
{
  "ocr_latency": { "p50": 0, "p90": 0, "p99": 0, "timeout_rate": 0, "latency_budget_ms": 90000, "over_budget": false },
  "extract_stats": { "fact_count": 0, "confidence_histogram": {}, "category_histogram": {}, "fact_density": 0 },
  "score_stats": { "promoted": 0, "rejected": 0 },
  "validate_stats": { "errors": [{ "type": "schema_error", "message": "" }], "warnings_count_by_type": { "mock_source": 0, "schema_error": 0, "lineage_error": 0, "hand_edited": 0 } },
  "completeness": { "has_ocr_timing": false, "has_extract": false, "has_score": false, "has_validate": false }
}
```

`completeness` lets the skill short-circuit missing sections without ad-hoc branching (e.g. pre-instrumentation topics have no `ocr-timing.jsonl`).

Tested the same way as the rest of `trm` — fixture `extract.json`/`score.json`/`ocr-timing.jsonl` in, assert the aggregated JSON out. No LLM/network dependency to mock.

**`Fact` type addition (review finding: `[VERIFY]` marker referenced below has no home in the data model)**
`scoring/types.ts` `Fact` interface gains an optional `flags?: string[]`. Extraction runners (`stubRunner`, `claudeCodeRunner`) may populate it with values like `"VERIFY"`; existing facts without the field are unaffected (optional, no schema-validation break — `extract.json`'s schema already treats unknown-but-typed fields as additive since nothing currently rejects extra `Fact` keys). The web-search cross-check step below selects on this field.

**`trm crosslink` tag support (review finding: no generic tag param exists today)**
`runCrosslink`'s `cliArgs` gains optional `tags?: string[]`. When present, appended to the `CROSSLINK` lineage operation as a `tags` field alongside the existing `related_topic`. Used by the feedback skill (see step 6 below) to write `trm-feedback-report:v1` without overloading `relatedTopic`.

### 2. Claude skill: `skills/trm-feedback-report/`

Standard layout per `skills/_TEMPLATE/` (`skill.json`, `SKILL.md`, `README.md`, `docs/USAGE.md`, `src/`, `tests/`).

**Flow:**

1. Run `trm validate <topic> --recursive` and `trm feedback-stats <topic> --recursive --latency-budget-ms <budget>`.
2. **New-topic candidates** (heuristic, no LLM call): read the full existing tag set once per run by recursively walking `topic.json` from the vault root (`readTopicMeta` + its `children` list, same recursive-walk pattern `runValidate`/`runScore --rollup` already use — not a new traversal mechanism) and collecting every topic's `tags`. Collect `categories` across the batch's facts, diff against that set. Flag a cluster as a candidate stub only if it clears all three guardrails:
   - ≥3 facts in the cluster
   - facts drawn from ≥2 distinct sources
   - average confidence ≥0.55

   These guardrails exist specifically to stop a single bad OCR page (one source, several garbage low-confidence facts sharing an accidental keyword) from generating a false-positive topic suggestion.
3. **Web-search cross-check**: select facts below a confidence threshold OR carrying `"VERIFY"` in their new `flags` field (see `Fact` type addition above), capped at the top 10 by `promotion_score` per batch. Run `WebSearch` per fact. Annotate each with `signal_strength: low | medium | high`, derived from corroborating-hit count and consistency across the top-N results — not a bare corroborated/contradicted/no-signal binary, since a single ambiguous hit shouldn't read the same as five consistent ones.
4. **Narrative synthesis** (the one genuinely judgment-requiring pass): writes the human-readable report, required to include three explicit risk labels (`low`/`medium`/`high`) — extraction risk, classifier drift risk, latency risk — plus a qualitative grouping of validate errors (e.g. "2 schema errors, 1 lineage error") built directly from `validate_stats.errors`/`warnings_count_by_type`, not a separately-invented severity taxonomy.
5. Write `reports/<topic>-feedback-v1-<stamp>.md` (reuses the existing `reports/` convention from `report.ts`). Top of file carries two independent flags (review finding: conflating "no latency data" with a genuine partial run made the flag noisy, since almost every topic lacks `ocr-timing.jsonl` until re-ingested post-ship):
   - `partial_report: true|false` — true only for a genuine degradation: `trm validate`/`feedback-stats` failed to run, or the web-search step was skipped (tool unavailable).
   - `latency_data_stale: true|false` — true when `completeness.has_ocr_timing` is false. Informational, doesn't imply the rest of the report is degraded.
6. Optionally call `trm crosslink --tags trm-feedback-report:v1` (using the new `tags` param above) to append a lineage-visible marker, so a future pass (or the TRM-to-treatment sync skill) can find prior feedback reports without scanning the `reports/` directory by filename convention alone.

## Error handling

- Missing `ocr-timing.jsonl` (topics ingested before this instrumentation existed) → `completeness.has_ocr_timing: false`, `latency_data_stale: true`, report states "no latency data available," does not fail, and does NOT set `partial_report`.
- `trm validate` returning schema/lineage errors → surfaced as the top finding in the narrative; does not abort the rest of the report.
- `WebSearch` tool unavailable → cross-check section skipped, noted explicitly, `partial_report: true`.

## Explicitly deferred (not this pass)

- Publishing `feedback-stats`'s JSON shape as a stable, versioned public contract for other consumers (e.g. a future TRM dashboard). Premature before a second real consumer exists; revisit if/when the TRM-to-treatment sync skill or a dashboard wants to read it directly.

## Testing

**`trm` side:**

- `feedback-stats` unit tests against fixture `extract.json`/`score.json`/`ocr-timing.jsonl` — percentile math, `fact_density` (with image-kind sources correctly excluded from the KB denominator), `warnings_count_by_type` counting off the typed `.type` field, `completeness` flags.
- Regression test: `feedback-stats` on a topic with no `ocr-timing.jsonl` at all (the realistic case for every topic ingested before this ships).
- `ingestDir.ts` instrumentation test: assert a real (mocked-OCR-call) ingest run appends one correctly-shaped line per file to `ocr-timing.jsonl`, including on a retried call (`retries` count reflects actual retry, not just success-path).
- `validate.ts` typed-error test: assert each of `checkSchema`/`validateChain`/`checkScoreNotHandEdited`/`checkMockImageSources` pushes the correct `.type` tag.

**Skill side:**

- Fixture-driven test invoking the skill against a canned `feedback-stats` JSON + mocked `WebSearch`, asserting all report sections populate and risk labels are present.
- Synthetic new-topic-cluster test: feed facts that clear/miss each of the three guardrails individually, assert candidate surfacing fires only when all three pass.
- Contradictory-WebSearch-results test: mocked search returns inconsistent hits for one fact, assert `signal_strength` reads `low` rather than the narrative asserting false confidence.
