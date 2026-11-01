# Contract hubs

Run `trail skeleton <file>` on these files instead of reading them whole. Paths are relative to `C:\dev`; a bare path (for example `src/api/server.js`) lives at the `C:\dev` root. Moved from `AGENTS.md` on 2026-11-01 and re-verified on disk the same day.

## High-gravity architectural contract hubs

When inspecting system boundaries or routing tasks across the multi-repo workspace, default to `trail skeleton <file>` on these verified contract hubs instead of reading whole source files:

| Subsystem | Primary Hub / Contract Targets | High-Value Interfaces Skimmed |
| :--- | :--- | :--- |
| **`sigil-repo`** | `sigil-repo/sigil/relay/v1/room-routes.mjs`<br>`sigil-repo/sigil/relay/v1/accept-envelope.mjs`<br>`sigil-repo/sigil/relay/v1/stream-server.mjs` | Room message dispatch, federation envelope verification, and SSE stream session lifecycle. |
| **`icf`** | `icf/src/server.mjs`<br>`modules/TorqueQueryOrchestrator.mjs` | Port 8080 telemetry hub, action dispatcher, and memory search hooks. |
| **`IronLedger`** | `IronLedger/src/ironledger/compile/journal.py`<br>`IronLedger/src/ironledger/ingest/acquire.py` | Compilation state machines, hashing algorithms, and ingestion acquisition pipelines. |
| **`kb-sync`** | `kb-sync/watch-competitors-v2.mjs`<br>`build-kb-sync-diagrams.mjs`<br>`kb-sync/server.mjs` | Competitor watchlist monitor, diff computation, and wiki sync servers. |
| **`trm`** | `trm/src/notebooklm/chatArchiver.ts`<br>`trm/src/core/topicRouting.ts`<br>`trm/src/notebooklm/nlmCli.ts` | Chat transcript synthesis, topic routing classification, and NotebookLM CLI wrappers. |
| **`toolforge`** | `openrouter-transport.ts`<br>`utilities/toolforgeSkillValidator.ps1` | LLM concurrency pools, retry policies, and skill manifest validation. |
| **`marketplace`** | `src/api/server.js`<br>`src/services/analytics.js`<br>`src/services/ratings.js` | Registry API endpoints, install telemetry, and trending calculation batches. |

> [!TIP]
> When executing in read-only sandbox or subrepo environments, pass `--no-refresh` (e.g. `trail skeleton --no-refresh <file>`) to extract AST symbol definitions immediately from the graph without checking git freshness.

## Second-pass contract and engine hubs

The second tier of high-friction contract files (20KB–80KB) where agents frequently skim handler signatures, schema validators, or CLI options:

| Subsystem | Target File (Second Pass) | Size / Est. Tokens | Verified AST Symbols & Benefits |
| :--- | :--- | :--- | :--- |
| **`sigil-repo`** | `sigil-repo/sigil/relay/v1/accept-federated-envelope.mjs` | 21 KB (~5,390 tok) | 98% reduction (129 tok). Multi-hop federation crypto verification & audit handlers. |
| **`sigil-repo`** | `sigil-repo/sigil/relay/v1/room-dispatch.mjs` | 18 KB (~4,490 tok) | 89% reduction (481 tok). Multi-agent room invocation queue, lock acquisition, and fan-out. |
| **`icf`** | `icf/reporting/src/snapshot-store.mjs` | 47 KB (~11,850 tok) | 90% reduction (1,240 tok). Snapshot serialization, SQLite migrations, and carry-forward actions. |
| **`icf`** | `icf/reporting/src/category-contract.mjs` | 27 KB (~6,740 tok) | 94% reduction (402 tok). Telemetry taxonomy validation, schema quality gates, and normalization. |
| **`IronLedger`** | `IronLedger/src/ironledger/connectors/registry.py` | 14 KB (~1,120 tok) | 81% reduction (215 tok). Financial connector registry, OAuth providers, and sync protocols. |
| **`IronLedger`** | `IronLedger/src/ironledger/governance/migrations.py` | 16 KB (~2,150 tok) | 87% reduction (280 tok). Forward-only migration engine, checksum verification, and foreign-key gates. |
| **`kb-sync`** | `modules/wiki/validate-staging-docs.mjs` | 36 KB (~8,960 tok) | 95% reduction (487 tok). Frontmatter validators, markdown linters, and alias disambiguation. |
| **`kb-sync`** | `modules/wiki/pipeline-runner.ts` | 23 KB (~5,830 tok) | 91% reduction (504 tok). Multi-stage pipeline orchestrator, lock management, and status evaluator. |
| **`trm`** | `trm/src/notebooklm/nlmResearch.ts` | 15 KB (~1,150 tok) | 79% reduction (246 tok). Research start/status/import primitives and NotebookLM CLI spawners. |
| **`trm`** | `trm/src/notebooklm/registry.ts` | 11 KB (~1,490 tok) | 61% reduction (579 tok). NotebookLM vault registration state, quarantine lists, and queue mutations. |
| **`toolforge`** | `skills/toolforge-submission-validator/src/validate.ts` | 12 KB (~1,860 tok) | 90% reduction (182 tok). Manifest validation, test pass verification, and conformance reporting. |
| **`marketplace`** | `src/services/recommendation.js` | 14 KB (~900 tok) | 89% reduction (95 tok). Related-skill scoring, blend heuristics, and recommendation algorithms. |
