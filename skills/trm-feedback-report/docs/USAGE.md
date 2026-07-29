# TRM Feedback/Report — Usage

## Prerequisites

- `trm` CLI installed and on `PATH` (or invoked from `trm/` with `npx ts-node src/cli/index.ts`, adjusting `runTrmCommand`'s binary name accordingly for local dev).
- A `trm-vault` root containing the target topic, already ingested via `trm ingest-dir`.

## Running

Invoke via whichever agent runs this skill, passing `topicPath` and `trmRoot`. The skill's own exported functions (`findNewTopicCandidates`, `deriveSignalStrength`, `buildReportMeta`, `reportFilename`, `runTrmCommand`) are deterministic and unit-tested in isolation — the orchestration in `SKILL.md`'s Flow section (running `WebSearch`, writing the narrative prose) is performed by the invoking agent directly, since those steps require tool access this package's plain Node code does not have.

## Troubleshooting

- **`TRM_CLI_NOT_FOUND`**: confirm `trm` resolves on `PATH` inside `trmRoot`, or pass an absolute path to the `trm` binary by adjusting the first argument to `execFileSync` in `src/trmCli.ts`.
- **Every report shows `latency_data_stale: true`**: expected for any topic ingested before the OCR-timing instrumentation (`trm`'s `.trm-ops/ocr-timing.jsonl`) shipped — re-run `trm ingest-dir --retry-failed` or a fresh batch to populate it.
- **New-topic candidates never fire**: the three guardrails (≥3 facts, ≥2 distinct sources, ≥0.55 avg confidence) are intentionally conservative — a quiet batch with few repeated proper nouns across sources is expected to produce zero candidates, not a bug.
