# CIC Repair Pipeline

**Detect and repair broken CIC pipeline stages.**

## Quick Start

```bash
cic repair-pipeline --stage=INGEST --mode=auto
```

## What It Does

Scans a pipeline stage, diagnoses failures, and applies repairs.

## Repair Modes

| Mode | Behavior |
|------|----------|
| auto | Automatic repair attempt |
| manual | Report only, no changes |

## Output

- repair diagnostics
- restored stage manifest

---

See [INTEGRATION_DIAGRAM.md](INTEGRATION_DIAGRAM.md) for pipeline stages.
