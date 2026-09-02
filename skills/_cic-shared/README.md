# CIC Shared Utilities

Internal shared utilities and constants for CIC skills (ingest, gate, repair, consolidate, orchestrate).

## Quick Start

```ts
import { findRepoRoot, writeResultJson, writeLineageEntry } from '_cic-shared';
```

## What it does

- Path resolution: `artifactPaths`, `reportPaths`, `lineagePaths`, `findRepoRoot`
- Run identity: `runId`, `governanceTag`
- Structured output writers: `writeResultJson`, `writeLineageEntry`, `writeReportEntry`

Internal-only — not distributed, not registered with Cowork. Consumed by `cic-consolidate-artifacts`, `cic-ingest-world`, `cic-orchestrate-flow`, `cic-repair-pipeline`, `cic-run-gate`.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
