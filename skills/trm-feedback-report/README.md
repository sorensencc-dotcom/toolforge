# TRM Feedback/Report

Post-ingest-batch feedback pass for TRM: classifier/extraction quality, OCR latency vs. budget, candidate new-topic surfacing, and a web-search cross-check on low-confidence facts.

## Quick Start

```bash
npm test
```

## What it does

- Runs `trm validate`/`trm feedback-stats` and surfaces classifier accuracy, extraction gaps, and OCR latency vs. a configurable budget
- Clusters repeated proper-noun phrases in fact text into candidate new-topic stubs, guarded against single-source/low-confidence false positives
- Cross-checks low-confidence or `VERIFY`-flagged facts against a web search, scoring corroboration as low/medium/high signal strength
- Writes a versioned markdown report and tags it into the topic's lineage via `trm crosslink --tags`

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For detailed workflow:** See [docs/USAGE.md](docs/USAGE.md).
