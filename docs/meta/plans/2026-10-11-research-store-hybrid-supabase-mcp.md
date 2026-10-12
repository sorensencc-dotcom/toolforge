# Hybrid research store implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one-way Markdown indexing into Supabase and three project-scoped, read-only MCP tools, with regression coverage for issue #124.

**Architecture:** Package integration under `skills/research-store/`. Treat Git and exported Drive Markdown as authoritative sources; Supabase holds derived documents, chunks, and claims. Use service-role credentials only for indexing and authenticated user JWTs for MCP reads.

**Tech stack:** Node.js >=24.0.0, ESM, Node test runner, PostgreSQL 15+ with pgvector, Supabase JS client, MCP JS SDK, OpenAI SDK, and js-yaml.

**Spec:** [Issue #124 and attached artifacts](https://github.com/sorensencc-dotcom/toolforge/issues/124). Read all six artifact comments before execution. This draft proposes corrections to those artifacts; it is not an approved charter.

## Current rehearsal status (2026-10-11)

Operator authorized candidate implementation and synthetic whole-stack rehearsal for future rollout. Real parser, embedding/Supabase adapters, sync CLI, MCP handlers, registration, and operator docs now exist. Production rollout remains pending. Historical checkpoints below describe earlier red baselines; this section defines current status.

| Evidence | Latest result | Scope |
| --- | --- | --- |
| `timeout 60s npm --prefix skills/research-store test` | 28/28 pass, zero skips | Unit contracts, migration/schema equality, and actual CLI/MCP stdio through loopback fake HTTP services |
| `timeout 180s npm --prefix skills/research-store run test:live` | 2/2 pass | PostgreSQL 17.11 role/RLS and atomic-write behavior on dev/UAT, SECURITY DEFINER negative control, and synthetic enhancement recovery rehearsal |
| `timeout 180s npm --prefix skills/research-store run test:uat` | Real API acceptance passes | Signed Supabase Auth users, REST, sync CLI, all three MCP tools, and cleanup; synthetic embeddings |
| Dev/UAT migration | Applied 20261011000124; subsequent dry-run reports up to date | Persistent public research schema, extension, grants, RLS, and RPCs |
| SECURITY DEFINER negative control | Expected cross-project-search failure reproduced | Live isolation test detects original defect |
| Root `timeout 90s npm test` | 232 pass, 1 skipped, zero fail | Historical dependency/setup failures are not active in current origin/main after fresh `npm install --ignore-scripts --legacy-peer-deps` |
| `timeout 480s npm --prefix skills/research-store run test:jwt-expiry` | 1/1 pass | Actual signed 60-second JWT accepted before expiry and denied afterward; original 3600-second Auth lifetime restored and verified |
| `timeout 180s npm --prefix skills/research-store run test:embedding-quality` | 1/1 pass; default recall gap found | Seven actual 1536-dimensional vectors, 3/3 correct rankings at threshold 0, default 0.7 recall 0/3, RLS and fixture cleanup verified |

Live SQL fixtures and isolated test schemas roll back. Persistent dev/UAT migration remains installed, with two reserved synthetic baseline documents. Real API tests use actual signed Supabase users and delete run-owned users/claims afterward. Standard UAT uses deterministic loopback embeddings; separate approved quality harness now verifies actual OpenAI vectors. No real research uploads or production operations occurred. Genuinely signed expired-token API denial passes under explicit operator approval for a temporary dev/UAT Auth expiry change; the original setting was restored before waiting for token expiration. Default-threshold retrieval quality remains an open rollout risk.

Installed versions for rehearsal: Node 24.18.0; MCP SDK 1.32.1; Supabase JS 2.117.3; OpenAI SDK 4.104.0; js-yaml 4.3.2. Record/rescope any dependency change before rollout reproduction.

Delivery follow-up (2026-10-12): implementation and YAML-auditor regression changes
are committed locally. Normal push initially failed on two existing
slop-grader-sweep command-execution import findings. Operator authorized separate
review/remediation: fixed Git filename decoding and grader option injection,
made shell:false explicit, and documented scoped reviewed import exemptions.
All 53 offline slop-grader tests, build, TypeScript check, and focused security
audit pass. Preserve this regression coverage in delivery checks; no hook bypass
or auditor-rule relaxation occurred. Original-branch push then blocked on missing
wiki publisher. Operator authorized clean delivery from current origin/main
ae190062, which includes the publisher and existing import exemptions. Preserve
main's review notes and hostile-input tests, transfer only scoped changes, and
exclude inherited wiki edits. Reinstall and rerun focused checks before normal
push. Root-suite and external-provider rollout gates remain open.

Clean-checkout evidence (2026-10-12): fresh dependency installation matches the
recorded research-store versions. All 28 research-store tests, three auditor
regressions, and 55 slop-grader tests pass. Slop build and TypeScript checks,
both focused security audits, and scoped whitespace checks pass. The two extra
slop tests preserve current-main hostile-input coverage. No credentials, local
Supabase link state, live-service reruns, or production operations transferred.
Commit b5d877f8 pushed to codex/research-store-delivery and remote hash verified.
Normal security gates pass and wiki gate skips unchanged inputs. Repository
documentation validation passes. Governance CI passes all five jobs on run
38255482501, including Graft freshness and skill docs compliance. Scoped checks
do not establish repository-wide rollout readiness.

Dev/UAT continuation (2026-10-12): latest `origin/main` at 2b7d9480 was checked
out in isolated sandbox `C:\dev\dev-sandbox\research-store-124-dev-uat`; dirty
canonical checkout and existing worktrees were not modified. Repository preflight
passed for the sandbox branch. Fresh root install needed
`npm install --ignore-scripts --legacy-peer-deps` because current `vite@8` and
`@vitejs/plugin-react@4` peer ranges conflict under strict npm resolution. After
that setup, root `timeout 90s npm test` passed 232 tests with one optional
external PDF fixture skipped. `timeout 60s npm --prefix skills/research-store
test` passed 28/28. Sandbox Supabase CLI link was refreshed to dev/UAT
`bhezixgmkhpndmezgsxk`. Serial live SQL `test:live` now runs both the original
33 SQL assertions and a transaction-scoped enhancement recovery rehearsal:
synthetic failed DDL rolls back, benign enhancement applies, fixture schemas are
dropped, and the baseline migration reruns in a second isolated schema. Real
dev/UAT `test:uat` passed again through Auth, REST, sync CLI, MCP tools, cleanup,
and retained only the two synthetic baseline documents. Real embedding
provider/quality was unrun pending separate egress/cost approval at that checkpoint;
the final-gate continuation below records subsequent approval and credential blocker.
Production remains untouched.

Final-gate continuation (2026-10-12): PR #132 merged. Fresh isolated checkout
`C:\dev\dev-sandbox\research-store-124-final-gates` starts at latest
`origin/main` 395a06a5; repository preflight passes and existing worktrees/audit
files remain preserved. Fresh root and skill dependency installs completed.
Root suite reproduced one active stale documentation assertion at
`src/governance.test.js:32`: it claimed a live line-limit/duplicate-section CI
gate while current AGENTS marks that gate planned. Updated the test to match
the current documented boundary without changing governance. Root rerun passes
232 tests, zero failures, one optional external vault fixture skipped. Focused
suite passes 28/28. Live SQL/recovery passes 2/2, including 33 assertions and
the SECURITY DEFINER negative control; real API/sync/MCP UAT passes afterward.

Operator approved temporary dev/UAT Auth change and synthetic real embedding
egress capped at $0.10. Dedicated `test:jwt-expiry` fails closed without
`RESEARCH_UAT_AUTH_EXPIRY_APPROVED=1`, previews exactly one declared config
change, temporarily sets jwt_expiry to 60, and obtains an actual signed CIC
token. Positive control retrieves authorized data through real REST. The test
then restores original jwt_expiry=3600, verifies no unrelated remote config
changed, waits for the untouched signed token to expire, and verifies HTTP 401
with PGRST303 and an expiry message. Test passes; synthetic identity deletion
and temporary config cleanup verified. A repeated run exposed delayed remote
config visibility; added bounded convergence polling and reran successfully.
Failure recovery also restored the original setting and deleted its identity.
No shared Auth change remains active.

Dedicated `test:embedding-quality` requires
`RESEARCH_UAT_EMBEDDING_APPROVED=1` and an approved OpenAI credential. Planned
workload is one direct OpenAI request with seven synthetic strings totaling at
most 4096 bytes, text-embedding-3-small, 1536 dimensions, no retries. At
[$0.02 per million input tokens](https://developers.openai.com/api/docs/models/text-embedding-3-small),
verified 2026-10-12, conservative input-token cost bound is $0.00008192.
Initial invocation failed before network because no OpenAI key was available.
Operator then supplied a credential, consumed through masked in-memory input
without file storage or command-line exposure. Two successful provider requests
returned seven validated vectors each. Conservative combined cost bound is
$0.00016384, below approved $0.10; actual billing was not independently queried.
Final real Supabase retrieval ranks the correct synthetic fixture first for
3/3 queries at explicit match_threshold=0. Similarities: 0.4014, 0.5539, 0.5840;
separation margins: 0.1533, 0.3213, 0.3254. Identical foreign-project fixture
remains invisible. Run-owned documents/chunks/identities deleted and absence
verified after both runs. Default RPC threshold 0.7 returns none of these
three paraphrases: default recall 0/3. Harness passes ranking/isolation checks
and reports default recall diagnostically; this is not a production-quality
PASS. Preserve issue's specified default until threshold/calibration decision
is approved with representative inputs. No credentials committed, real sources
uploaded, production changes, or refresh scheduler introduced.

## Review failures and regression gates

| Finding | Required behavior | Observed regression and correction |
| --- | --- | --- |
| P1: BOM bypasses frontmatter | Preserve declared project/status and reject malformed YAML | sync.test.mjs reproduced CIC misrouting; parser strips leading BOM; now passes |
| P1: positional IDs retarget claim evidence | Changed/deleted content cannot preserve linked VERIFIED evidence | live-assertions.sql reproduced retained link after content edit; SQL detaches linked claims and sets NEEDS_REVIEW inside transaction; now passes |
| P2: validation/read path race | Never embed outside-root content after path replacement | sync.test.mjs reproduced outside read during junction swap; checked file handles now reject identity/path changes |
| P2: fake search ignores vectors/threshold | Rehearsal must detect ranking, serialization, and threshold mistakes | config.test.mjs discriminating-vector test failed before fix; fixture computes cosine ranking and strict threshold; stdio test checks query vector and threshold=1 empty result |
| P1: standard Auth project claim inaccessible | Accept trusted app_metadata.project, never user_metadata.project | Live SQL test failed on trusted Auth project read; corrected three RLS policies, verified SQL and real signed-user API/MCP paths |

Each finding has observed red-to-green evidence. Retain these cases; do not duplicate them. Recheck removed-chunk claim review state and failed-write preservation whenever replacement semantics change.

## Repository baseline failures

Resolve these separate failures through owning setup/test contracts before repository-wide rollout:

- src/api/providers.test.js and src/api/server.test.js: isolated root dependency setup lacks express/pg. Install repository dependencies, then rerun to expose any remaining behavior failures.
- toolforge-pdf/ingest.test.js: missing pdf-parse in isolated root dependency setup.
- src/governance.test.js:28: instruction-document assertion expects different CI documentation claim. Reconcile with verified current workflow and policy owner; do not amend governance solely to satisfy assertion.
- src/providers/model-selection.test.js:6, :16, and :21: MODEL_SELECTION_REJECTED from routing record. Provision/validate authoritative fixture through owning process; do not hand-edit generated selection evidence.

Root command does not discover research-store tests. Future CI acceptance must run root suite and explicit skill-local suite; live test-project SQL and real JWT/PostgREST checks remain separately labeled gates.

## Dev/UAT lifecycle decision (2026-10-11)

Operator selected project `bhezixgmkhpndmezgsxk` as persistent dev/UAT and staging environment, not a disposable daily mirror, then explicitly approved execution. Persistent migration and synthetic real-service acceptance now pass there; production promotion remains gated.

- Default maintenance: refresh on demand before enhancements, acceptance runs, or rollout rehearsals. Optional weekly refresh is a manual maintenance cadence, not an installed scheduler. No daily synchronization required.
- Keep schema and application revision together. Apply reviewed migrations when testing a release; do not delay a required schema change until weekly content refresh. Record application commit, migration revision, source snapshot, embedding configuration, and test date for each acceptance run.
- Start with synthetic Git/Drive exports and dedicated test identities. Real research imports require separate source/egress approval; do not copy production credentials, users, or sensitive data into dev/UAT.
- Retain a known synthetic baseline between runs. Use an isolated namespace for destructive/failure tests; remove only run-owned fixtures and identities. Keep transaction-only SQL regressions alongside persistent API acceptance tests.
- Allow dev/UAT to lag production between rehearsals. Before accepting a change, reconcile migrations/configuration with production's approved release and refresh selected source snapshot. Older staging content cannot establish current production freshness or retrieval quality.
- Promote the same reviewed application revision and migrations, not dev/UAT database contents. Provision production credentials separately and require explicit production approval after acceptance evidence and recovery procedure pass.

### Dev/UAT acceptance sequence

- [x] Inspect dev/UAT schema and migration history; verify project ref before every remote write. Fail closed on collisions or unexpected existing state.
- [x] Apply versioned persistent migrations to dev/UAT; verify public-schema/PostgREST exposure, grants, and RLS without resetting shared schema.
- [x] Provision dedicated signed CIC, RewriteLabs, and admin test users using trusted authorization claims; verify user-editable metadata cannot grant project/admin access.
- [x] Run sync CLI and all three MCP tools through real Supabase APIs with synthetic exports. Verify isolation, missing/forged JWT denial, repeat ingest, metadata changes, shrinking/empty content, claim invalidation, and failure atomicity. Separate signed-expiry API test now passes with original Auth settings restored.
- [x] Verify approved real embedding provider with synthetic input; distinguish deterministic fixture correctness from provider availability and retrieval quality. Actual provider/vector/ranking/isolation/cleanup checks pass; default 0.7 threshold recall is 0/3 on tested paraphrases and requires calibration before rollout.
- [x] Rehearse an enhancement migration and recovery, then rerun scoped, live SQL, and real API checks. Record evidence and remaining root-suite failures before production promotion.

Real API acceptance proves isolation, anonymous/forged-token denial, repeat ingest, metadata edits, shrinking/empty content, claim invalidation, failure atomicity, and all tools. Separate signed-expiry test proves the same actual issuer-signed token succeeds before expiry and receives explicit expiry denial afterward. Local startup tests separately reject missing/expired JWTs; tampered-token denial alone is not signed-expiry evidence.

## Remaining rollout gates

Production CLI preparation completed under explicit operator login/init/link request. Project `vbyfacretnyeptlilrfm` is linked in separate workdir `skills/research-store/environments/production`; repository-root Supabase workdir remains linked to test project `bhezixgmkhpndmezgsxk`. Every production CLI operation must specify absolute production workdir explicitly. This establishes CLI binding only: runtime SUPABASE_URL, reader/writer credentials, migrations, and activation remain unconfigured/unverified. Local `.temp` link metadata is ignored by Supabase's generated .gitignore; re-link explicitly on another checkout.

- [x] Reproduce four review failures and verify fixes with local/SQL regressions.
- [x] Drive actual sync CLI and MCP stdio with synthetic Git/Drive exports and SDK-compatible fake embedding/HTTP services; verify failures, repeat ingest, metadata edits, shrinking content, authorization, pagination, and child shutdown.
- [x] Verify test-database RLS/views/RPC, chunk/claim integrity, idempotency, and rollback using 30 SQL assertions and negative control.
- [x] Reproduce installation and scoped suites in clean delivery checkout; record exact dependency versions, docs validation, whitespace checks, and review outcome.
- [x] Resolve seven root baseline failures and rerun repository suite; do not treat focused skill pass as root pass. Current origin/main root suite passes after fresh dependency install with legacy peer resolution; the historical failures are not active.
- [x] On provisioned dev/UAT project, verify persistent migration history and intended public-schema/PostgREST exposure. Existing table/type collisions must fail closed; never reset shared schema.
- [x] Exercise actual signed CIC, RewriteLabs, and admin JWTs through Supabase HTTP API and all three MCP tools; verify missing/forged tokens and foreign UUID denial. Signed CIC, RewriteLabs, admin, hostile-metadata users, and genuinely signed expired-token denial pass; original Auth configuration and run-owned cleanup verified.
- [x] Run controlled writer ingestion through real Supabase client/API using synthetic exports. Verify metadata edits, shrinking/empty body, claim review state, and failed-write snapshot preservation.
- [x] Approve and verify real embedding provider/model/dimension with synthetic input and explicit egress approval. Actual text-embedding-3-small/1536 availability, 3/3 rankings at explicit threshold 0, project isolation, and cleanup pass within $0.10 cap; default recall separately measured.
- [ ] Calibrate retrieval threshold against representative approved inputs. Current default 0.7 suppresses all three tested semantic paraphrases (0/3 recall); correct ranks and margins at threshold 0 do not establish useful default retrieval. Threshold/model contract changes require explicit approval; real-source evaluation requires source/egress authorization.
- [ ] Add explicit scoped suite commands to approved delivery/CI path, obtain production target/configuration approval, and verify a reversible migration/delivery procedure before rollout. Scoped live recovery and signed-expiry rehearsals pass; real embedding availability verified, default retrieval calibration remains open, and production target/configuration approval remains separate.

## Execution rulings

- Ruling: implement candidate and synthetic rehearsal now; retain production gates. User explicitly authorized fake whole-stack implementation/testing; cost if mistaken is insufficient real-service evidence, which remains pending above.
- Ruling: use linked Management API transactions instead of unimplemented password-based DB fixture. Existing CLI login supports real SQL role tests; cost is inability to infer JWT/PostgREST verification from SQL results.
- Ruling: split local and live commands so local tests never implicitly contact Supabase. Cost is requiring both commands in future acceptance wiring.
- Ruling: preserve chunk IDs by index but invalidate linked claims when content changes/disappears. Cost is manual evidence review before reattaching claims; silently changing claim evidence is unacceptable.

Fresh review reported four actionable findings; all four now have regression coverage and verified corrections. No deferred minor findings. Commit/delivery checkboxes remain open because this checkpoint covers local candidate/rehearsal work rather than publication.

## Global constraints

- Issue scope: "one-way hybrid research store"; Git and Drive remain sources of truth.
- Projects: `CIC`, `RewriteLabs`, `other`.
- Status values: `VERIFIED`, `INFERRED`, `UNKNOWN`, `NEEDS_REVIEW`.
- Semantic search defaults: threshold 0.7, count 10; threshold range 0..1, count range 1..50.
- Status list defaults: limit 20, offset 0; limit range 1..100, offset nonnegative integer.
- Document fetch requires UUID; `include_claims` defaults false.
- Source artifact dependency ranges: MCP SDK ^1.0.0, Supabase JS ^2.45.0, OpenAI ^4.60.0. Resolve compatible versions at execution and record actual versions; these are not evidence of installed versions.
- Repository Node floor: >=24.0.0. Keep dependencies local to skill package; declare js-yaml explicitly.
- Run tests through GNU `timeout 60s` in Git Bash, plus Node `--test-timeout=10000` locally. Actual CLI/stdio rehearsal uses 30-second per-test ceiling; linked SQL harness uses 55 seconds for two Management API round trips. Verify GNU timeout exists before first test.
- No source writes, production migrations, credential provisioning, live source uploads, scheduling, or external publication during implementation without corresponding authorization.

## Proposed decisions requiring review

1. Replace issue's service-role MCP reads with authenticated JWT reads. Provision project claim through trusted issuer configuration; callers cannot mint or edit access claims.
2. Fix embedding model to `text-embedding-3-small` and dimension to 1536. Reject other model/dimension settings before network calls; 384-dimensional indexing requires separate migration and full reindex.
3. Index Drive exports supplied under explicit local research root, preserving `drive_file_id` and `source_uri`. Direct Drive API fetching is outside supplied artifacts and requires its own authorization/export contract.
4. Preserve source deletion semantics conservatively: shrinking an existing document removes obsolete indexed chunks; missing source files do not delete indexed documents automatically.
5. Keep claims as existing structured records returned by document fetch. No automatic claim extraction or invented claim ingestion format.

Execution gate: operator authorized candidate implementation and synthetic rehearsal in conversation. Persistent deployment, real-source egress, and production acceptance remain separate. If direct Drive fetching or another embedding/auth model is required, revise plan before changing scope.

## Review focus

- Anonymous or wrong-project reads, including views and RPCs: fail closed (Task 1).
- Embedding timeout or database rejection mid-update: preserve prior complete document/chunk snapshot (Tasks 1 and 2).
- Unchanged body with changed frontmatter, or empty/shrinking body: update metadata and exact current chunk set (Task 2).
- Malformed frontmatter, oversized paragraph, invalid UUID, and invalid numeric tool values: reject predictably before writes or retrieval (Tasks 2 and 3).
- Missing/expired reader JWT or secrets in provider errors: deny access without disclosing credentials or corrupting stdio protocol (Task 3).

## File map

All paths below are repository-relative and proposed new files unless marked Modify.

- `skills/research-store/sql/001-research-store.sql`: tables, constraints, indexes, invoker views/RPC, RLS, grants, atomic replacement RPC.
- `skills/research-store/src/store.mjs`: embedding validation and Supabase document replacement.
- `skills/research-store/src/config.mjs`: fixed embedding configuration, SDK construction, reader JWT startup checks, and credential separation.
- `skills/research-store/src/sync.mjs`: frontmatter, paragraph chunks, traversal, CLI exit status.
- `skills/research-store/src/mcp-server.mjs`: three tool schemas, runtime validation, handlers, and stdio startup.
- `skills/research-store/package.json`: local dependencies, start/sync/test entrypoints.
- `skills/research-store/skill.json`, `README.md`, `SKILL.md`, `docs/USAGE.md`: registration metadata and operator documentation.
- `skills/research-store/tests/schema.test.mjs`, `sync.test.mjs`, `mcp.test.mjs`, `package.test.mjs`: focused behavioral tests.
- `skills/research-store/tests/config.test.mjs`, `rehearsal.test.mjs`, and `fake-services.mjs`: adapter checks, actual-process synthetic rollout, and test-only HTTP services.
- `skills/research-store/tests/live-assertions.sql` and `live-readiness.sql`: role-scoped synthetic SQL assertions and read-only readiness probes. `schema.test.mjs` runs these through linked Supabase CLI in rollback transactions; no direct-password database fixture required.
- Modify `manifest.json`: single skill registration using existing research skill metadata shape.
- Modify `STATUS.md`: scoped progress/evidence entry only.

No existing TRM, kb-sync, dashboard, or context-cache callers change. Integration is standalone until a downstream caller contract exists.

## Task 1: Enforce database boundaries and atomic replacement

**Interfaces**
- Consumes: issue table fields and authorized test database URL `RESEARCH_TEST_DATABASE_URL`.
- Produces: issue-compatible `match_research_items(query_embedding, match_project, match_status, match_threshold, match_count)`.
- Produces: `replace_research_document(p_document jsonb, p_items jsonb) -> uuid`, executable only by service_role.
- Produces: linked-CLI schema test harness pinned to explicitly authorized test project `bhezixgmkhpndmezgsxk`. Each run creates isolated `research_store_test_124` schema inside BEGIN/ROLLBACK; no existing public tables change.

- [ ] **Step 1: Write failing database tests.** Seed CIC and RewriteLabs documents, chunks, and claims. Assert authenticated CIC reader cannot fetch RewriteLabs rows through tables, all three views, or match RPC with omitted/foreign project. Assert anon cannot execute RPC; authenticated reader cannot write or execute replacement. Assert document/chunk/claim project mismatches fail. Assert failed replacement preserves old hash, metadata, chunks, and claim links.
- [ ] **Step 2: Run red test.** `timeout 60s node --test --test-timeout=10000 skills/research-store/tests/schema.test.mjs`. Expected failure: schema objects absent. Missing database is a blocked live gate, not a passing test.
- [ ] **Step 3: Implement migration and fixture.** Use SECURITY INVOKER for read RPC and PostgreSQL 15 security_invoker views. Revoke default PUBLIC/anon function execution and explicit table/view access; grant authenticated SELECT under RLS. Policies read signed project claim and trusted `app_metadata.research_admin` for admin access; missing claims deny reads. Add relational constraints preventing project drift. Validate vector dimensions explicitly in RPC and rows.
- [ ] **Step 4: Implement replacement transaction.** Upsert and lock document by non-null normalized `(project, git_path)`; upsert current chunk indexes and delete absent indexes in same SQL transaction. Preserve stable IDs for surviving indexes. Keep claims when obsolete chunks disappear, clearing chunk references according to documented FK behavior. Empty chunk array clears prior chunks. Set metadata/hash/timestamps only inside transaction. Grant replacement only to service_role and revoke PUBLIC/anon/authenticated execution.
- Current correction to Step 4: preserve claim statement/document, detach research_item_id, and set NEEDS_REVIEW whenever linked chunk content changes or disappears. Ordinary metadata-only changes retain evidence links.
- [ ] **Step 5: Run green tests.** Same bounded command; all role, view, dimension, atomicity, and chunk-shrink assertions pass on real PostgreSQL. Assert admin reader sees both projects, without promoting ordinary reader to admin. Record database/extension versions.
- [ ] **Step 6: Commit scoped SQL and database tests.** Stage SQL migration, schema.test.mjs, live-assertions.sql, and live-readiness.sql only; `git commit -m "test: enforce research store isolation and atomic replacement"`.

## Task 2: Index local research exports safely

**Interfaces**
- Consumes: Task 1 replacement RPC.
- Produces: `parseResearchMarkdown(raw: string, relativePath: string, projectFilter: string | null) -> {document, chunks} | null`; null means filtered out.
- Produces: `syncResearch({root, project, dryRun}, {supabase, embed}) -> Promise<{processed, skipped, failed}>`.
- Produces: `replaceDocument(supabase, document, chunks, embed) -> Promise<string>` returning UUID after complete replacement.
- Embedding dependency: `embed(texts: string[]) -> Promise<number[][]>`; exactly one finite 1536-element vector per input, preserving response index order.

- [ ] **Step 1: Write failing sync tests.** Cover LF/CRLF YAML; scalar/invalid YAML rejection; project/status/confidence validation; source URI and Drive id provenance; filtered projects; empty documents; shorter replacement; same body with changed title/status; repeat-run row counts and stable surviving IDs. Assert embedding failure makes zero replacement calls. Dry run needs no credentials and calls neither Supabase nor embedding provider. One failed file yields failed=1 and CLI exit 1.
- [ ] **Step 2: Run red test.** `timeout 60s node --test --test-timeout=10000 skills/research-store/tests/sync.test.mjs`. Expected missing exports/behavior.
- [ ] **Step 3: Implement parsing and sync.** Use js-yaml JSON schema, validate mapping types, normalize relative paths, reject escapes, and skip symlinks. Preserve issue defaults CIC/archive/UNKNOWN and RewriteLabs/trend_brief. Preserve source_system from validated Git/Drive provenance; local exported path supplies document identity. Split paragraphs, omit empty paragraphs, cap individual chunk length at 8000 characters and embedding batches at 16; reject larger paragraphs with actionable error rather than silently truncating.
- [ ] **Step 4: Implement write/embedding path.** Generate and validate every embedding before replacement RPC; validate provider response count/index/dimensions/finite values. Hash body for provenance, but do not skip metadata updates based on body hash alone. Initialize cloud clients only for live mode. Continue remaining files after failure, summarize counts on stderr, and return nonzero if any file failed. Do not log payloads or raw provider errors.
- [ ] **Step 5: Run green tests.** Same bounded sync command. Reuse Task 1 database fixture to prove three chunks become one with no stale search result; inject database failure and verify old snapshot remains. Confirm source files remain byte-identical.
- [ ] **Step 6: Commit sync deliverable.** Stage only store/sync source, sync tests, and package dependencies required by this task. `git commit -m "test: add safe one-way research indexing"`.

## Task 3: Serve authenticated research retrieval over MCP

**Interfaces**
- Consumes: Task 1 read RPC/tables and Task 2 validated embedding contract.
- Produces: `createResearchServer({supabase, embed}) -> Server` with issue's three tools, no listening socket.
- Produces: executable stdio server using `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_READER_JWT`, and `OPENAI_API_KEY`. Reader JWT travels as Authorization bearer token; service key is never fallback.

- [ ] **Step 1: Write failing handler and transport tests.** Assert tool names and defaults exactly match issue. Assert bad UUID, missing arguments, whitespace-only query, query >8000 characters, unknown fields, fractional counts, out-of-range threshold/limit, and negative offset return errors before any dependency call. Assert fetch returns ordered chunks and claims only when requested. Assert all Supabase reads use reader client. Test omitted project and foreign UUID through actual RLS database fixture. Test expired JWT and sanitized upstream errors.
- [ ] **Step 2: Run red test.** `timeout 60s node --test --test-timeout=10000 skills/research-store/tests/mcp.test.mjs`. Expected missing factory/handlers.
- [ ] **Step 3: Implement handlers and startup.** Use MCP SDK types/stdio transport from issue. Validate tool arguments at runtime as well as advertised schemas. Use reader JWT client with session persistence and automatic refresh disabled; operator replaces expired token explicitly. Missing reader credentials fail startup without loading writer credentials. Validate embedding as Task 2 defines. Apply issue filters/defaults; list order uses created_at descending then id for deterministic ties. Foreign/absent document UUIDs share one not-found response.
- [ ] **Step 4: Run green tests.** Same bounded MCP command. Add SDK client stdio smoke: initialize, tools/list, all three tools/call, unknown tool, and shutdown. Assert stdout contains only protocol messages and child process closes within timeout. Unit mocks establish routing; role-scoped SQL tests establish database isolation; credentialed disposable Supabase smoke establishes JWT/PostgREST wiring separately.
- [ ] **Step 5: Commit MCP deliverable.** Stage only MCP source/tests and needed package declarations. `git commit -m "test: add authenticated research MCP retrieval"`.

## Task 4: Package, document, and verify complete skill

**Interfaces**
- Consumes: completed Tasks 1-3 and existing root manifest shape.
- Produces: skill id `research-store`, MCP entrypoint `skills/research-store/src/mcp-server.mjs`, standalone sync command, operator documentation, and evidence record.

- [ ] **Step 1: Write failing packaging tests.** Assert clean local install can import all runtime modules including js-yaml; metadata names valid entrypoints; manifest contains exactly one matching id; package start/sync entrypoints resolve; dry run exits 0 without cloud environment. Assert docs never recommend service-role MCP reads or claim 384/local-provider support.
- [ ] **Step 2: Run red test.** `timeout 60s node --test --test-timeout=10000 skills/research-store/tests/package.test.mjs`. Expected missing registration/docs.
- [ ] **Step 3: Implement metadata/docs.** Follow existing skill schema and root manifest conventions; declare actual outbound capabilities without labeling integration loopback-only or runtime healthy before evidence exists. README <100 lines; SKILL <150 lines with trigger/I/O metadata; workflow, authentication provisioning, disposable SQL setup, Drive export mapping, embedding egress, limits, failure behavior, claims detachment, and startup examples in docs/USAGE.md. Link Skill Operator Guide; attribute Supabase, OpenAI, and MCP SDK to upstream organizations. No automatic installer or scheduler.
- [ ] **Step 4: Verify package from clean delivery checkout.** Install skill-local dependencies with lifecycle scripts disabled. Run `timeout 60s npm --prefix skills/research-store test` and `timeout 60s npm --prefix skills/research-store run test:live` separately. Local command explicitly lists five files: sync, MCP, package, config, and rehearsal; live command runs schema harness. Close fixtures/connections/children. Run `git diff --check` and `pwsh -NoProfile -File utilities/skill-doc-validator.ps1 -Path skills/research-store -Recursive`. Current isolated candidate passes these scoped checks; clean delivery reproduction remains pending.
- [ ] **Step 5: Complete authorized live acceptance.** On disposable Supabase project, apply migration, index two synthetic exported documents, repeat unchanged, shrink one, change frontmatter only, and inject embedding/write failure. Verify exact chunk counts, metadata, preserved snapshot, and all tools as CIC reader, RewriteLabs reader, and admin reader; anon/expired token fail. No real source uploads needed. Record local/unit, SQL-role, stdio, and Supabase-wire evidence separately.
- [ ] **Step 6: Commit package and evidence.** Update STATUS.md with results/blockers; stage only package metadata/docs, package tests, manifest row, and scoped status entry. `git commit -m "test: package research store skill and acceptance checks"`. Push or create PR only under explicit delivery authorization; deployment remains separately gated.

## Historical checkpoints and preparation

### Test-first checkpoint (2026-10-11)

Operator requested tests. Added 21 executable test cases in the four planned test files; syntax checks pass. Bounded suite discovered 21 cases and failed all 21 on missing implementation modules, package metadata, or db-fixture.mjs. This records discovery/import baseline only; behavioral assertions and live database isolation have not executed yet.

Initial schema tests referenced an unimplemented direct-connection fixture. Subsequent live checkpoint replaces that fixture contract with linked Supabase Management API SQL execution, using the CLI's existing authentication. Expected SQL failures execute inside PL/pgSQL exception subtransactions so the enclosing test transaction can continue.

MCP tests consume SDK Client and InMemoryTransport through public transport interfaces. Sync CLI accepts `RESEARCH_ROOT` plus issue flags; public missing-reader-credential error identifies `SUPABASE_READER_JWT`. Existing task checkboxes remain open because full per-task red/green contracts are incomplete.

### Live SQL checkpoint (2026-10-11)

Operator confirmed linked project is test database and authorized additional tests. Proposed corrected migration now exists locally. On PostgreSQL 17.11, 29 live SQL assertions pass, including RLS through tables/views/RPC, missing claims, trusted versus user-editable admin metadata, role privileges, dimensional consistency, project FK integrity, idempotency, stale-chunk deletion, claim detachment, empty replacements, and failed-write rollback. A negative control changes search function to SECURITY DEFINER and fails specifically on cross-project search; corrected invoker version passes afterward. Harness additionally asserts all 29 checks executed and temporary schema disappeared.

SQL fixture, pgvector extension, and all synthetic data roll back; final read-only probe confirms public research tables count 0 and pgvector absent. This verifies proposed SQL implementation through role/claim simulation on real Supabase PostgreSQL, not signed JWT issuance, PostgREST access, MCP transport, embedding provider, or JavaScript ingestion. Current four-file suite contains 19 Node tests: live SQL harness passes; remaining 18 fail on missing source/package files. Live harness uses per-test 55-second limit plus 60-second process wrapper because it makes two Management API round trips; local tests retain 10-second target. No persistent migration, commit, push, or deployment performed.

- Resolve isolated execution checkout from verified Toolforge root; current confirmed root is C:\dev, origin sorensencc-dotcom/toolforge, branch parkd821-20260908. Recheck these drift-prone facts before executing.
- Use superpowers:using-git-worktrees at execution time. Run repository preflight against resulting absolute Git root, and read its AGENTS.md and STATUS.md.
- Complete conformance check against PATTERNS.md, project memory, existing MCP/skill patterns, and provisioned database capabilities before charter lock or builder dispatch. Current graft search establishes related patterns only; it does not establish duplication percentage or infra readiness.
- Do not mark issue complete unless real SQL role tests and disposable Supabase JWT wire checks pass. If credentials/infra unavailable, finish local code and record live gate as blocked.
- Self-review: six initial findings map to Tasks 1-4; all three MCP tools covered; source/provenance coverage explicit; auth/dimension changes exposed for review; no production operation or downstream consumer integration implied.
