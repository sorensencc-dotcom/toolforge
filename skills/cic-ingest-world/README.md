# CIC Ingest World

**Ingest external data sources and worlds into the CIC pipeline.**

## Quick Start

```bash
cic ingest-world --uri=s3://my-data --mode=full
```

## What It Does

Ingests a world (data source) and registers it in the CIC lineage graph.

## Ingestion Modes

| Mode | Behavior |
|------|----------|
| full | Complete re-ingest from source |
| delta | Incremental ingest since last marker |

## Output

- ingestion manifest
- lineage index entry for downstream lineage tracking

---

See [INTEGRATION_DIAGRAM.md](INTEGRATION_DIAGRAM.md) for pipeline context.
