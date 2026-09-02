# KB Sync Nightly

Automated knowledge base sync to NotebookLM and Obsidian, with interactive artifact generation.

**Status**: Active  
**Version**: 1.0.2  
**Runtime**: bash

---

## What it does

- Syncs CIC and project docs to NotebookLM and Obsidian on nightly schedule
- Generates interactive HTML reports with broken link detection and impact scoring
- Supports fail-soft pipeline; partial failures continue to artifact generation

---

## Quick Start

Scheduled via Cowork automation. Manual invocation:

```bash
bash C:\dev\skills\kb-sync-nightly\src\run.sh
```

For artifact generation, use the `kb-sync-artifact-generator` skill.

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation).

This skill requires:

- bash 4.0+
- Node.js 18+, npm
- Cowork automation (for scheduling)

---

## Integration

See [SKILL.md](./SKILL.md) for execution metadata and [docs/USAGE.md](./docs/USAGE.md) for workflow examples.

---

## Reference

→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for Setup, Requirements, Error Handling, Testing.
