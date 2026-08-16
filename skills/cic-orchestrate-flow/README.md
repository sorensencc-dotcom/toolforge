# CIC Orchestrate Flow

Phase 3: composes ingest → gate → repair → consolidate into one fixed pipeline call.

## Quick Start

```bash
npm test
```

## What it does

- Runs the CIC pipeline in fixed order: `cic-ingest-world` → `cic-run-gate` → `cic-repair-pipeline` → `cic-consolidate-artifacts`
- Uses `_cic-shared` for path resolution, run identity, and structured output writers

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
