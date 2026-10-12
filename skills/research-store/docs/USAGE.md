# Research store operation

## Setup

1. Use verified Toolforge checkout on Node >=24. Install skill-local dependencies with `npm --prefix skills/research-store install --ignore-scripts`.
2. Inspect destination database schema and migration history before applying `sql/001-research-store.sql` then additive `sql/002-local-embeddings.sql`. Runtime clients use public schema; apply with explicit `search_path = public, extensions` and confirm public schema USAGE for authenticated/service_role. Tests override search_path to isolated temporary schema. Existing table/type names cause baseline migration failure; do not reset shared schemas or reapply baseline to installed public tables.
3. Provision writer service-role credential for sync only. For MCP, provision publishable/anon key and signed authenticated user JWT with trusted top-level project claim or `app_metadata.project`. `app_metadata.research_admin=true` grants cross-project reads only when trusted issuer supplies it. User-editable metadata does not grant project or admin access.
4. Set explicit source directory; Git and Drive exports remain authoritative. Run dry-run first, then live sync only after approving embedding egress and destination.
5. Register stdio MCP server in operator's client using absolute `src/mcp-server.mjs` path and reader credentials. Never include writer credential in MCP configuration.

## Dev/UAT lifecycle

Project `bhezixgmkhpndmezgsxk` is persistent dev/UAT and staging. Baseline migration `20261011000124_research_store.sql` and additive model-isolation migration `20261012000124_research_store_local_embeddings.sql` are installed. Real Auth/REST, sync CLI, and MCP acceptance use synthetic inputs. Rollback SQL regressions remain separate from persistent deployment.

Refresh source snapshots on demand before enhancements, acceptance runs, or rollout rehearsals. Optional weekly refresh needs no daily mirror or scheduler. Apply required schema migrations with application changes, independently of content-refresh cadence. Record application revision, migration revision, source snapshot, embedding configuration, and test date.

Use synthetic sources and dedicated test identities by default. Real research imports need source/egress approval. Preserve a baseline; isolate failure-test fixtures and clean up only run-owned data. Never copy production credentials or users into dev/UAT.

Before promotion, reconcile dev/UAT with approved production migration/configuration baseline and rerun real API acceptance. Promote reviewed code and migrations, not staging data. Production project `vbyfacretnyeptlilrfm` has separate CLI workdir `skills/research-store/environments/production`; CLI linking alone does not configure runtime credentials or authorize deployment.

## Environment

| Variable | Consumer | Contract |
| --- | --- | --- |
| RESEARCH_ROOT | Sync | Explicit local Markdown export directory |
| SUPABASE_URL | Both | Approved project URL |
| SUPABASE_SERVICE_ROLE_KEY | Sync | Writer credential; never fallback for readers |
| SUPABASE_ANON_KEY | MCP | Publishable/anon client key |
| SUPABASE_READER_JWT | MCP | Signed authenticated token, with expiration and trusted project claim |
| EMBEDDING_MODEL | Both | Explicit embedding model; verified local qwen3-embedding:4b |
| EMBEDDING_DIMENSION | Both | Only 1536 supported |
| EMBEDDING_PROVIDER | Both | ollama (default) or explicit freellm |
| OLLAMA_BASE_URL | Both | Loopback only; default http://127.0.0.1:11434 |
| FREELLM_BASE_URL | Both | Loopback only; default http://127.0.0.1:3001/v1 |
| FREELLM_API_KEY | Both, freellm only | Existing Docker router credential; never an OpenAI key |

Toolforge shared provider uses WhichLLM's explicit embedding purpose, separate from generation models. Existing local-only model-selection policy must validate; do not hand-edit generated selection evidence. Install embedding model explicitly (`ollama pull qwen3-embedding:4b`) and set `EMBEDDING_MODEL=qwen3-embedding:4b` for both sync and MCP. Ollama digest is pinned before/after requests; model or dimensions changing fails closed. No API key needed for Ollama. No redirects, retries, automatic provider fallback, or remote Ollama models.

FreeLLM lane requires authenticated `/v1/embeddings`, exact model echo, 1536 dimensions, and explicit immutable/versioned embedding model ID. Chat-only routes do not qualify. Docker loopback does not prove downstream inference stays local: inspect configured backend and obtain egress/cost approval before external routing. Current Docker API requires authentication; real FreeLLM embedding acceptance remains unverified. Adapter wire/error checks pass against synthetic fixture.

Every indexed chunk records provider/model identity; search filters identical identity before ranking and limiting. Older OpenAI or unidentified vectors remain stored but are excluded from current model search. Switching model requires explicit reindex from authoritative exports with approval; never copy old vectors or spoof metadata. Legacy RPC remains for compatibility; MCP uses new invoker RPC. Expired reader JWT requires replacement/restart; Supabase verifies signatures.

## Source example

```yaml
---
project: RewriteLabs
title: Synthetic Drive export
source_system: drive
drive_file_id: synthetic-export
source_uri: https://drive.google.com/file/d/synthetic-export
status: VERIFIED
confidence: 0.75
tags: [synthetic]
---
```

Supply body as Markdown paragraphs after frontmatter. Direct Drive downloads, claim extraction, and source-file deletion propagation are outside this integration. Relative exported path plus project supplies index identity; keep one consistent export root per indexed namespace.

## Indexing

```bash
node skills/research-store/src/sync.mjs --dry-run --project RewriteLabs
node skills/research-store/src/sync.mjs --project RewriteLabs
```

Dry run parses every selected file without cloud credentials or network calls. YAML must be a mapping with supported project/status, numeric confidence 0..1, string tags, and mapping metadata. Maximum paragraph length is 8000 characters; embedding batches contain at most 16 paragraphs. Split oversized source paragraphs explicitly.

Indexing embeds complete current document before atomic replacement. Unchanged body does not prevent metadata updates. Existing chunk indexes retain IDs. When indexed content changes or disappears, linked claims retain statement/document, clear research_item_id, and move to NEEDS_REVIEW; content cannot silently retarget evidence. Empty body removes prior chunks. Missing files leave existing indexed documents intact. Symlinks are skipped; checked file handles detect path replacement and concurrent content changes before embedding. Use operator-controlled export roots.

Any failed file increments failed count and yields exit 1 while remaining files continue. Embedding/write failure preserves previous committed document/chunk snapshot. Error output contains counts or public setup errors, never raw provider response or source body. To isolate failing input, dry-run smaller export batches.

## Rehearsal and evidence

```bash
timeout 60s npm --prefix skills/research-store test
timeout 180s npm --prefix skills/research-store run test:live
timeout 210s npm --prefix skills/research-store run test:uat
```

Local rehearsal generates synthetic Git/Drive exports, deterministic fake embeddings, ephemeral fake signed JWTs, and loopback HTTP services. It drives production sync CLI and MCP stdio via actual Supabase/MCP SDKs and native embedding HTTP adapter. It tests repeat indexing, metadata-only edits, shrinking chunks, provider/write failures, search, fetch with/without claims, pagination, denied foreign UUID, and unknown tool.

Live SQL harness checks linked project is `bhezixgmkhpndmezgsxk` before issuing queries. It creates isolated test schema inside a rollback transaction, runs 33 database assertions plus completion/cleanup checks, and uses a SECURITY DEFINER negative control to reproduce original leakage. Failed-control transaction also aborts. This harness does not apply persistent migrations or upload sources.

On-demand `test:uat` pins the same project, obtains credentials in memory through authenticated Supabase CLI, creates preconfirmed signed test users without email delivery, and drives real REST, sync CLI, and MCP stdio. It retains only synthetic `uat124/cic.md` and `uat124/rewrite.md` baseline documents; it cleans run-owned claims, users, and local exports. Never put real sources at these reserved test paths. Progress reports distinguish stages; abort after 60 seconds without output. CLI login, deployed schema, Node dependencies, and network access are required. Writer keys never enter MCP subprocesses.

Real API acceptance covers trusted Auth metadata, hostile user metadata, project/admin isolation, anonymous/forged-token denial, reader-write denial, idempotency, metadata edits, shrinking/empty bodies, claim invalidation, failed-write rollback, provider-failure preservation, and all three tools. Separate signed-expiry API test passes. Standard UAT uses deterministic loopback embeddings; separate approved real-provider harness supplies actual vector/ranking evidence.

With explicit temporary dev/UAT Auth-change approval, set `RESEARCH_UAT_AUTH_EXPIRY_APPROVED=1` and run `timeout 480s npm --prefix skills/research-store run test:jwt-expiry`. It changes only declared jwt_expiry, mints a signed 60-second token, restores/verifies original setting immediately, proves actual API expiry denial, and deletes its dedicated identity. Current live evidence passes; ordinary UAT never changes Auth settings.

For approved synthetic rehearsal, set `EMBEDDING_MODEL=qwen3-embedding:4b`, `EMBEDDING_PROVIDER=ollama`, and `RESEARCH_UAT_EMBEDDING_APPROVED=1`; run `timeout 180s npm --prefix skills/research-store run test:embedding-quality`. Seven fixed strings total at most 4096 bytes; actual sync CLI embeds four synthetic documents and actual MCP embeds three queries through same pinned lane. Real Supabase ranking must return intended authorized fixtures first at threshold 0 with 0.05 separation; matching foreign fixture stays invisible. It reports default-threshold recall, deletes run-owned documents/chunks/users/exports, and verifies cleanup. Local run: 3/3 rankings, default 0.7 recall 2/3. Representative-input calibration remains rollout gate. No real-source input accepted. Any FreeLLM external rerun requires separate backend/cost approval.

Fake HTTP authorization alone is simulation; `test:uat` supplies separate real Supabase issuance/PostgREST evidence. Production gate still requires approved real embedding availability/quality, production credentials, and explicit rollout approval. SQL fixture rollback is cleanup of disposable test state, not production migration rollback procedure.

## Provenance

Supabase JS (Supabase), MCP TypeScript SDK (Model Context Protocol contributors), and js-yaml (Nodeca) are external dependencies linked in README. Ollama supplies local inference. Toolforge supplies WhichLLM routing, native embedding adapters, parsing, validation, SQL boundaries, client wiring, and tests; it does not implement upstream services. OpenAI SDK/key no longer required.
