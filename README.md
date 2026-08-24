# Toolforge

Local-first platform for tools, daemons, scaffolds, and adapters used across Rewrite Labs and CIC. Unified discovery, execution, and lifecycle management.

## Directory Structure

| Category | Purpose | Entry Point | Examples |
| --- | --- | --- | --- |
| **sync-tools/** | Multi-repo sync, drift detection, automation | `.cjs` or `.ps1` | multiRepoRoadmapSync |
| **daemons/** | Long-running services, background tasks | `.ps1` script | toolforge-manifest-sync |
| **kb-sync/** | TRM closed-loop synthesis, context cache, competitor drift monitoring | `.mjs` / `.ts` | watch-competitors-v2.mjs, mcp-memory-server.mjs |
| **scripts/** | Evaluation runners, closed-loop orchestrators, reporting | `.py` / `.mjs` | run-closed-loop-research-v2.py, whichllm-bfcl-evaluator.py |
| **adapters/** | External data transformers | `.ts` or `.js` | (reserved for future) |
| **mcp-servers/** | MCP protocol implementations | `server.ts` or similar | (reserved for future) |
| **utilities/** | Helper scripts, setup, configuration | `.ps1` or `.sh` | setup-task-scheduler |
| **scaffolds/** | Template generators, boilerplate | `.ts` generator | (reserved for future) |
| **prototypes/** | Experimental, early-stage tools | Any language | (reserved for future) |
| **_TEMPLATE/** | Base template for new tools | README.md, VERSION.md | Reference only |

## Quick Start

### Discover tools

```powershell
toolforge.ps1 -List
```

### Run a tool

```powershell
toolforge.ps1 -Run multiRepoRoadmapSync -Config config.json
```

### View tool details

```powershell
toolforge.ps1 -Inspect multiRepoRoadmapSync
```

### Run research & model evaluation pipelines

```powershell
# Run controlled evidence pipeline feedback loop & batch ingestion
python tests/pilots/willow-run-1941/run_feedback_loop.py
python tests/pilots/willow-run-1941/run_batch_ingestion.py

# Scaffold new research topic pilot testbed
python trm/scaffold_topic.py --topic-slug <topic-slug>

# Run TRM 3-tier topic coverage & completeness auditor
python trm/topic_coverage_auditor.py --topics-dir ./tests/pilots --corpus-dir ./tests/pilots/willow-run-1941/corpus

# Run closed-loop research with WhichLLM v2.4.0 dynamic model benchmark sweep
python scripts/run-closed-loop-research-v2.py

# Run standalone WhichLLM BFCL evaluator (Python or ESM Node)
python scripts/whichllm-bfcl-evaluator.py
node scripts/whichllm-bfcl-evaluator.mjs

# Run competitor watchlist drift and Sigil approval integration test
npm run test:watchlist
```

## Tool Metadata

Each tool registers in `manifest.json` with:

- **name**: unique identifier
- **category**: sync-tools, daemons, adapters, etc.
- **description**: one-line purpose
- **entrypoint**: run.ps1, runner.cjs, server.ts, etc.
- **status**: active, beta, archived
- **version**: semantic version

## Documentation

- **ROADMAP.md** — Evolution phases (Foundation complete, Operationalization in progress)
- **GOVERNANCE.md** — Naming, versioning, lifecycle rules
- **INDEX.md** — Auto-generated tool index
- **CLAUDE_WORKSPACE.json** — VSCode multi-folder workspace config
- **ControlledEvidencePipeline.md** — Workflow diagram & architecture spec ([`ControlledEvidencePipeline.md`](file:///c:/dev/wiki/ControlledEvidencePipeline.md))

See subdirectories (e.g. [`kb-sync/README.md`](file:///c:/dev/kb-sync/README.md), [`trm/README.md`](file:///c:/dev/trm/README.md)) for subsystem-specific guides.
