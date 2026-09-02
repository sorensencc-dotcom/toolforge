# CIC Ingest World

Ingest external data sources into the CIC pipeline and register in lineage graph.

## Quick Start

```bash
cic ingest-world --uri=s3://my-data --mode=full
```

## What it does

- Ingests data sources and worlds into CIC pipeline
- Registers entries in lineage graph for downstream tracking
- Supports full re-ingest and incremental delta modes

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
