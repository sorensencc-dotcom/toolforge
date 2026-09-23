<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
<!-- TOOLFORGE-VAULT-POINTER-START -->
# Persistent System Memory Pointer
> Managed by Toolforge sync-tools. Auto-generated on sync. DO NOT manually edit this block.
- Canonical Knowledge Base Root: C:\dev\kb-sync\obsidian\vault\wiki
- Ingest Guidelines: docs/targets/obsidian.md
- Primary Architecture Graph: [[Index]]
- Active Conventions: [[wiki-schema]]
- Log Audit Trail: [[Log]]
- Repository Target: dev
<!-- TOOLFORGE-VAULT-POINTER-END -->
<!-- TOOLFORGE-VAULT-POINTER-START -->
# Persistent System Memory Pointer
> Managed by Toolforge sync-tools. Auto-generated on sync. DO NOT manually edit this block.
- Canonical Knowledge Base Root: C:\dev\kb-sync\obsidian\vault\wiki
- Ingest Guidelines: docs/targets/obsidian.md
- Primary Architecture Graph: [[Index]]
- Active Conventions: [[wiki-schema]]
- Log Audit Trail: [[Log]]
- Repository Target: dev
<!-- TOOLFORGE-VAULT-POINTER-END -->

<!-- MANAGED-REGION: AGENT-TODOS -->
### Active Multi-Agent Tasks
| Status | Priority | Task Description |
| :---: | :---: | :--- |
| ⏳ `[ ]` | **P1** | **[P1] Wave D full conformance gate** — code-level PASS only. Needs provisioned PostgreSQL 15+, `npm run migrate`, live E2E rerun (5 scenarios), live load test (assert p99 <200ms on list/search/trending/ratings), trending scheduler install verified. Blocked on infra (no PG in this dev environment; ad-hoc local PG rejected as fake-prod-signal). Tier 1 decision 2026-07-14. See `memory/wave-d-full-gate-requirement.md`. |
| ⏳ `[ ]` | **P2** | **[P2] Non-deterministic skillpack generators** (created 2026-09-02) — `SKILLPACK-VALIDATION.md` (~6 lines), `SKILLPACK-DEPENDENCY-GRAPH.md` (~65 lines), and `audit/COWORK-*.md` (~100 lines each) reorder their warning/log lines on every regen, so each pre-commit run that touches `skills/` or `utilities/` produces churn. Separate defect from the timestamp-clobber + LF-flip bug fixed 2026-09-02 in `toolforgeMetadataGenerator.ps1` / `toolforgeSkillValidator.ps1` (commits `bc5f02ac`, `935bdc5b`). Fix: stable sort (by skill id / finding key) before emit in `toolforgeDependencyGraph.ps1`, the validator's finding list, and the Cowork sync-report writer. Deferred — cosmetic churn, no data loss. |
| ⏳ `[ ]` | **P2** | **[P2] TorqueQuery CIC observability hooks** (deferred, low priority) — TorqueQuery determinism verified 2026-07-17. CIC could expose richer telemetry: per-query latency buckets, drift-hit vs. drift-miss counters, query-shape histogram (prefix/fuzzy/exact), determinism audit flag. Adapter-side only, no TorqueQuery core changes. Defer until CIC dashboard audit surfaces real observability gap. See discussion 2026-07-18. |
| ⏳ `[ ]` | **P2** | **[P2] xberg native build-out** (low priority) — `toolforge-pdf` plugin ran on a mock stub (`xberg-mock.exe`) that returned placeholder text regardless of input; swapped to real `pdf-parse` text-layer extraction 2026-07-16. Still open: OCR fallback for scanned/image PDFs (needs page-rasterization — `canvas`/native build tooling on Windows or a WASM-only path), and whether to compile a standalone cross-language binary if reused outside Node. Deferred until real need surfaces (e.g. scanned document in the CIC ingestion pipeline, or commercial research-business reuse outside this repo). See `memory/decision-xberg-real-extraction-2026-07-16.md`. |
| ✅ `[x]` | **P1** | **[P1] Skill Health Check Failures (wiki-sync-recovery)** (created 2026-08-30, resolved 2026-08-30) — Automatically logged by toolforgeSkillHealthCheck.ps1. Fixed and verified 100% PASS across all checks in SKILLPACK-RUNTIME-HEALTH.md. |
| ✅ `[x]` | **P2** | **[P2] kb-sync documentation drift remediation (batch)** (created 2026-08-23, resolved 2026-08-23) — Synthesized wiki and cleared documentation drift across workspace (`kb:drift` status: `NO_DRIFT`, 0 stale pages). |
| ✅ `[x]` | **P2** | **[P2] kb-sync documentation drift remediation (batch)** (created 2026-08-24, resolved 2026-08-24) — Synthesized wiki and cleared documentation drift across workspace (`kb:drift` status: `NO_DRIFT`, 0 stale pages). |
| ✅ `[x]` | **P2** | **[P2] kb-sync documentation drift remediation (batch)** (created 2026-08-25, resolved 2026-09-02) — Synthesized wiki and cleared documentation drift across workspace (`kb:drift` status: `NO_DRIFT`, 0 stale pages). <!-- todo-group: kb-sync-documentation-drift --> |
| ✅ `[x]` | **P2** | **[P2] Toolforge health warning group: AuditLog** (created 2026-08-19) (resolved 2026-08-30) — 3 skill(s): research-questions, retro-export, workspace-storage-cleaner. Source: SKILLPACK-RUNTIME-HEALTH.md. <!-- todo-group: toolforge-health-warning:AuditLog --> |
| ✅ `[x]` | **P2** | **[P2] Toolforge health warning group: DryRun** (created 2026-09-02) (resolved 2026-09-02) — 1 skill(s): tinyfish-search. Source: SKILLPACK-RUNTIME-HEALTH.md. <!-- todo-group: toolforge-health-warning:DryRun --> |
| ✅ `[x]` | **P2** | **[P2] Toolforge health warning group: Manifest** (created 2026-08-19) (resolved 2026-08-30) — 3 skill(s): research-questions, retro-export, workspace-storage-cleaner. Source: SKILLPACK-RUNTIME-HEALTH.md. <!-- todo-group: toolforge-health-warning:Manifest --> |
| ✅ `[x]` | **P2** | **[P2] Toolforge health warning group: Runtime** (created 2026-08-19) (resolved 2026-08-30) — 1 skill(s): research-questions. Source: SKILLPACK-RUNTIME-HEALTH.md. <!-- todo-group: toolforge-health-warning:Runtime --> |
| ✅ `[x]` | **P2** | **kb-sync drift remediation** (resolved 2026-09-02) — Knowledge base drift remediated (`kb:drift` status: `NO_DRIFT`, 0 stale pages, `scripts/install-git-hooks.mjs` entity doc synchronized). |
<!-- /MANAGED-REGION: AGENT-TODOS -->
