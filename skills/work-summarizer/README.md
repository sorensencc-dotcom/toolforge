# Work-Summarizer

Daily/weekly development work reports from repo scans and transcript analysis, with optional LLM reasoning synthesis.

**Status**: Active  
**Version**: 4.0.0  
**Runtime**: Node.js

---

## What it does

- Scans repos for modified files and classifies by 17-category taxonomy
- Analyzes Claude Code transcripts for activity patterns and drift signals
- Aggregates weekly reports from last 7 daily snapshots
- Optionally synthesizes risk analysis and recommendations via Claude API

---

## Quick Start

```bash
node dist/index.js  # Daily report to C:\dev\CIP\CIC\logs\work-summaries

# With weekly aggregation
node dist/index.js { mode: "weekly" }

# With LLM reasoning (requires ANTHROPIC_API_KEY)
node dist/index.js { mode: "weekly", reasoningEnabled: true }
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation).

This skill requires:

- Node.js 18+
- C:\dev\repo-registry.json (repo manifest)
- ANTHROPIC_API_KEY env var (if reasoning enabled)

---

## Inputs & Outputs

See [SKILL.md](./SKILL.md) for complete input/output schema.

---

## Detailed Usage

For examples, configuration, testing, environment variables, and troubleshooting:

**→ See [docs/USAGE.md](./docs/USAGE.md)**

---

## Reference

→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for Setup, Requirements, Error Handling, Testing.
