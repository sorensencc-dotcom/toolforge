# Changelog

## Version 2.70.0
Date: 2026-09-25

### Changes
- bee3190 - Merge pull request #40 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- d7e68a9 - feat(benchmark): add CLI gate evaluation and benchmark runner entrypoint (Chris Sorensen)
- bd226a9 - feat(benchmark): add atomic artifact persistence and fixture hashing (Chris Sorensen)
- fa95c0d - fix(benchmark): support --expose-gc property assignment in runner tests and include stageName in timeout errors (Chris Sorensen)
- 609ec9e - feat(benchmark): add isolated monotonic benchmark runner harness (Chris Sorensen)
- 028029a - feat(benchmark): add statistical distribution and dynamic gate calculations (Chris Sorensen)

## Version 2.69.0
Date: 2026-09-25

### Changes
- 11fe083 - Merge pull request #39 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- 7149bc6 - docs(slop-grader-sweep): add reference link to skill operator guide (Chris Sorensen)
- e0d9e39 - docs(notebook-sync): add operator guide and implementation plan (Chris Sorensen)
- 0a9bd98 - feat(notebook-sync): add cell-targeted prompt sync engine and validator (Chris Sorensen)

## Version 2.68.0
Date: 2026-09-23

### Changes
- 01ecee0 - Merge branch 'parkd821-20260908' (Chris Sorensen)
- 0e7ec24 - fix(slop-grader-sweep): make the hook block reachable and the sweep workflow advisory (Chris Sorensen)
- 8aa844c - fix(slop-grader-sweep): correct the slop-grader CLI and JSON contract (Chris Sorensen)
- 3470438 - fix(slop-grader-sweep): sentence-case SKILL.md heading for heuristics lint Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com> (Chris Sorensen)
- 9c26be4 - feat(slop-grader-sweep): add scheduled workflow, SKILL.md, README, and usage docs (Chris Sorensen)
- 93a3c43 - feat(slop-grader-sweep): add scheduled workflow, SKILL.md, README, and usage docs (Chris Sorensen)
- b209c11 - docs(drive-it): add mobile-to-drive dual-channel operational specification (Chris Sorensen)
- 58a0144 - feat(slop-grader-sweep): add idempotent pre-commit hook installer (Chris Sorensen)
- b1bda56 - feat(slop-grader-sweep): add sweep-mode orchestrator with retry and DEGRADED reporting (Chris Sorensen)
- 77a421a - fix(slop-grader-sweep): catch sync collaborator errors in changed-mode orchestrator (Chris Sorensen)
- c8bbbfe - feat(slop-grader-sweep): add changed-mode orchestrator and CLI entrypoint (Chris Sorensen)
- e984acb - feat(slop-grader-sweep): add SLOP-REPORT.md formatter (Chris Sorensen)
- 5cfb2f8 - docs(report): add daily report for 2026-09-22 (Chris Sorensen)
- 461c5e6 - feat(slop-grader-sweep): add subprocess runner with 30s timeout (Chris Sorensen)
- cdeaaf6 - feat(slop-grader-sweep): add changed and sweep file-list resolvers (Chris Sorensen)
- 903ade9 - feat(slop-grader-sweep): add non-throwing OpenRouter credential adapter (Chris Sorensen)
- 5b90211 - feat(slop-grader-sweep): scaffold skill package (Chris Sorensen)
- d8dff66 - docs(meta): address caveman-review findings on slop-grader spec (Chris Sorensen)
- 844dd01 - docs(meta): add slop-grader integration design spec (Chris Sorensen)
- 6c6f928 - fix(ci-watchdog): filter superseded failures and add test coverage (Chris Sorensen)
- 2a64780 - test(notebooklm): add paired regression tests for consolidate-pack and dispatch-multi-notebook (Chris Sorensen)
- e354e2a - feat(notebooklm): persist dispatch status telemetry to notebook_ingester_report.json (Chris Sorensen)
- e787c20 - fix(consolidate-pack): exclude staging directories from source scanning (Chris Sorensen)
- 563bf57 - docs(trm): add KIS-P implementation plan documentation (Chris Sorensen)
- 964a0d6 - feat(ironbots): remediate code review findings across Standards and Spec requirements (Chris Sorensen)
- 46040a0 - chore(trm): register KIS-P validation and sync npm scripts with E2E test (Chris Sorensen)
- 583cf4c - feat(trm): implement asynchronous concurrent multi-notebook dispatcher (Chris Sorensen)
- f340a80 - refactor(nlm): refactor uploader to consume canonical config with fail-closed error handling (Chris Sorensen)
- 40df27f - feat(kb-sync): enforce 380 KiB serialized byte ceiling, deterministic chunking, and stale-pack purging (Chris Sorensen)
- 51562de - feat(kb-sync): add cross-notebook digest injector with word-boundary matching and dynamic target lookup (Chris Sorensen)
- fe502c3 - fix(kb-sync): enforce master-kb domain isolation, deduplicate provenance serialization, and respect category filters (Chris Sorensen)
- dc5a183 - feat(trm): implement Entity Topic Registry semantic validator with structured rule taxonomy (Chris Sorensen)
- 90341c8 - feat(trm): establish Entity Topic Registry schema and canonical manifest (Chris Sorensen)
- cd25a3f - docs(report): add daily report for 2026-09-21 (Chris Sorensen)
- 82528a9 - test(governance): add paired regression tests for scheduled task reconciler and weekly reporting scripts (Chris Sorensen)
- 7b93749 - feat(scheduler): add scheduled tasks reconciler and categorize fleet tasks under canonical folders (Chris Sorensen)
- 40f4c56 - fix(daemon-healer): delegate process lifecycle recovery to ensure-dashboard-server.ps1 (Chris Sorensen)
- 81a7bd5 - feat(ironbots): expand fleet with Notebook-Ingester, Watchlist-Miner, and SQLite FTS5 search (Chris Sorensen)
- 191dbd9 - docs: add dev-idea-pipeline.md for unbuilt dev ideas (Chris Sorensen)
- 8c0a69c - docs: update STATUS.md with Ironbots fleet status and documentation-first rule (Chris Sorensen)
- 8dfe301 - fix(daemon-healer): point target URL to ICF dashboard /dashboard and supervise ICF gateway (Chris Sorensen)
- 8723809 - feat(dashboard): register Ironbots autonomous fleet panel and test runner (Chris Sorensen)
- 8a9f822 - feat(bots): expand Ironbots fleet with Daemon-Healer and CI-Watchdog, tests, and unattended autonomy policy (Chris Sorensen)
- 699c628 - feat(bots): implement Ironbots autonomous KB sentinel and TRM triage bot pipelines with regression tests and docs (Chris Sorensen)
- d7359fc - feat(trm): implement cross-notebook gap deduplication and lifecycle engine (Chris Sorensen)
- c9d48af - feat(skills): add docker container image scanning to third-party-repo-auditor (Chris Sorensen)
- ea1e4b8 - feat: isolate serial merge validation (Chris Sorensen)
- 9fac3bf - feat: enforce repair tripwires (Chris Sorensen)
- eec81c1 - docs(memory): consolidate memory index, deprecate claude-memory, and update verification timestamps (Chris Sorensen)
- 42bb14e - feat(skills): add third-party-repo-auditor skill with validation passing (Chris Sorensen)
- bd007e5 - chore(sync): update status feed and wiki research property logs (Chris Sorensen)
- ac6ccde - refactor(toolforge): simplify CLI HTTP clients and ESM paths per Ponytail audit (Chris Sorensen)
- b9a054a - feat: request explicit retro actions (Chris Sorensen)
- 2460f4a - feat: publish retro through ICF bridge (Chris Sorensen)
- 1893cbf - docs(report): add daily report for 2026-09-19 (Chris Sorensen)
- f3ef7ca - chore(sync): update status feed, logs, and property extract timestamp (Chris Sorensen)
- 067961d - docs(report): add daily report for 2026-09-19 (Chris Sorensen)
- 728fcbc - docs(report): add daily report for 2026-09-18 (Chris Sorensen)
- b7773ee - docs(report): add daily report for 2026-09-17 (Chris Sorensen)
- 72e8717 - docs(report): add daily report for 2026-09-15 (Chris Sorensen)
- 53c7905 - docs(report): add daily report for 2026-09-14 (Chris Sorensen)
- 9f79ea0 - fix(nlm): default nlmCli to 'nlm' executable and record live pack generations (Chris Sorensen)
- 0c142d8 - feat(nlm): atomic upload-verify-purge replace gate for split knowledge packs (Chris Sorensen)
- 1604933 - chore(sync): update multi-agent memory journal (Chris Sorensen)
- 66e7220 - feat(architecture): partition knowledge plane, sync ecosystem architecture guide, and update notebook targets (Chris Sorensen)
- a4716dc - docs(report): add weekly report for 2026-W37 (Chris Sorensen)
- 591cda0 - docs(status): update WhichLLM status with empirical live benchmarking and Helix defense verification (Chris Sorensen)
- 71ac7f1 - docs: align STATUS evidence language with deterministic BFCL evaluator & atomic write updates (Chris Sorensen)
- 193252c - feat(scripts): add weekly retro automation wrapper (Chris Sorensen)
- ab263d4 - docs: update STATUS with verified WhichLLM evaluator implementation and Helix defense (Chris Sorensen)
- c62c0d3 - fix(delivery-guard): resolve Windows shell binary lookup in hook test and update STATUS (Chris Sorensen)
- cddc316 - docs(memory): verify retro slowdown as genuine, fix orphaned CLAUDE.md line citation (Chris Sorensen)
- 1033b98 - docs(governance): fix stale memory window, orphaned commit-hash citation, retro window drift (Chris Sorensen)
- a5da7ea - docs(status): register notebooklm-mcp in Unified MCP Matrix (Chris Sorensen)
- 5ff4600 - docs(status): register IronLedger and Headroom in Unified MCP Matrix (Chris Sorensen)
- 5157349 - docs(design-system): archive Cast Iron Charlie audit request and light-theme extension (Chris Sorensen)
- d14559b - feat(torquequery): add unified orchestrator, disk adapters, and pipeline test suite (Chris Sorensen)
- f5254d4 - fix(notebooklm): add pre-upload deduplication sweep and prune duplicate sources (Chris Sorensen)
- d48d4b3 - feat(sync-tools): wire STATUS.md into memory and todo sync engines (Chris Sorensen)
- 904a432 - feat(sync-tools): wire .ijfw/memory handoff and project journal into multi-agent sync (Chris Sorensen)
- 9ef8a76 - docs(report): add daily report for 2026-09-12 (Chris Sorensen)
- a347ce8 - feat(design): remediate CIC audit findings, add light theme extension and financial design guidelines (Chris Sorensen)
- f495663 - chore(sync): update multi-agent active task matrix (Chris Sorensen)
- a2d6360 - feat(sync-tools): add multi-agent todo and task list synchronization engine (Chris Sorensen)
- 0837b00 - chore(sync): update repository agent memory pointers (Chris Sorensen)
- 2fe015a - feat(automation): add scheduler setup script for background agent memory sync (Chris Sorensen)
- 9cc0eab - fix(sync-tools): ensure managed region replaces cleanly without duplicate appends (Chris Sorensen)
- bea425c - feat(sync-tools): add multi-agent memory synchronization to obsidian vault (Chris Sorensen)
- 37ee666 - docs(plan): add multi-agent memory sync implementation plan (Chris Sorensen)
- 3129462 - docs(spec): add strict receipt invariants, upward repo discovery, and collision-safe rollback (Chris Sorensen)
- 7794d6b - docs(spec): add atomic rollback, tilde guards, fail-closed validation, and receipt invariants (Chris Sorensen)
- 255b3d7 - docs(spec): finalize multi-agent memory sync spec addressing all codex review gaps (Chris Sorensen)
- 99af5ab - docs(spec): harden multi-agent memory sync spec with format-safe mutations, atomic writes, and discovery exclusions (Chris Sorensen)
- b323264 - docs(spec): add onboarding runbook, diagram standards, and codex review step to memory sync spec (Chris Sorensen)
- 58934af - docs(spec): add multi-agent memory sync to obsidian vault design spec (Chris Sorensen)
- 63135d1 - feat(mcp): register shared ironledger mcp server (Chris Sorensen)
- df71beb - docs(report): add daily report for 2026-09-11 (Chris Sorensen)
- 13e3be7 - docs(governance): consolidate global operating rules to canonical version (Chris Sorensen)
- 69204e1 - feat(dashboard): integrate headroom context optimization into icf dashboard and telemetry (Chris Sorensen)
- 8126cc0 - fix: preserve drift detector fallback target (Chris Sorensen)
- b35ce9b - fix: make drift detector paths portable (Chris Sorensen)
- 4ec705e - chore(sync): reformat code + resync daily_status/project-journal (Chris Sorensen)
- 81aea1c - docs(report): add daily report for 2026-09-10 (Chris Sorensen)
- e96dc1e - feat(ui): update Cast Iron Charlie design system palette and sync tokens (Chris Sorensen)
- 5f68dbf - docs(governance): allow scoped C dev repositories (Chris Sorensen)
- 9e572de - feat(mcp): add open-notebook mcp server to canonical registry and sync profiles (Chris Sorensen)
- 09d08ce - feat(dashboard): document Iron Command Forge integration and sync daily status feed (Chris Sorensen)
- 91a8040 - fix(mcp): configure sigil connector grants, credentials, and chrome-devtools global path (Chris Sorensen)
- 5a331f8 - chore(mcp-registry): update sigil connector env and chrome-devtools global bin path (Chris Sorensen)
- e22ba3e - fix(mcp-governance): add PYTHONPATH env injection for ironledger and multi-segment header support to registry parser (Chris Sorensen)
- 09e1855 - feat(mcp-governance): fold ironledger read-only mcp server into canonical registry and client profiles (Chris Sorensen)
- e3528f1 - docs(report): add daily report for 2026-09-09 (Chris Sorensen)
- 9e4f2c6 - chore(sync): update skillpack metadata and cowork audit artifacts (Chris Sorensen)
- 850c244 - docs(mcp): add architecture documentation and Cathryn Lavery diagram asset (Chris Sorensen)
- 3ab8545 - feat(mcp): add e2e integration and janitor cooperation test suite (Chris Sorensen)
- 4249b5c - feat(mcp): implement unified cli controller and profile manifest dashboard (Chris Sorensen)
- d245004 - feat(mcp): implement surgical ast compilers and atomic backup writers (Chris Sorensen)
- 8187a04 - feat(mcp): implement registry parser, budget validator, and exit codes (Chris Sorensen)
- 02e90fd - feat(mcp): add canonical mcp-registry.toml with registry_version (Chris Sorensen)
- 09bd52e - feat(mcp): add profile manifest dashboard, exit codes, and registry versioning (Chris Sorensen)
- 7e8c4ee - docs(plans): add multi-client mcp governance implementation plan (Chris Sorensen)
- 475bf9f - docs(specs): refine mcp governance spec with ast safety, exact token validation, and profile definitions (Chris Sorensen)
- 9b6f5f8 - docs(specs): add multi-client mcp governance and profile design spec (Chris Sorensen)
- d821fb4 - fix(skills): quote description in research-questions frontmatter (Chris Sorensen)
- d9ee1ab - chore(sync): add uncommitted claude-memory session wraps (Chris Sorensen)
- 6c4ee06 - chore(gitignore): ignore daemon artifacts and nested working repos (Chris Sorensen)
- c08b426 - chore(sigil): configure persistent postgresql store in mesh supervisor (Chris Sorensen)
- 7fa4323 - docs(governance): ratify hybrid provider policy (Chris Sorensen)
- ab18003 - feat(nlm-trm): automate source deduplication across pipelines and notebooks (Chris Sorensen)
- 2f32bab - docs(report): add daily report for 2026-09-07 (Chris Sorensen)
- 5a82a0f - fix(delivery-guard): handle unreachable or replaced base SHAs defensively in commitChangeSets (Chris Sorensen)
- 3c0ad6b - feat(governance): add intercept-grep hook with regression test suite and deterministic search policy (Chris Sorensen)
- 6cf00af - feat(mcp): mirror vfs_upsert_document to toolforge Viking VFS surface (Chris Sorensen)
- ab612ca - feat(sigil): add sigil mesh daemon scripts and grok bridge stdio adapter (Chris Sorensen)
- 3117d49 - docs(report): add weekly report for 2026-W36 (Chris Sorensen)
- 1db1aa0 - chore(registry): register sigil-grok-bridge in central skill manifest (Chris Sorensen)
- 15be2bf - docs(ironledger): fold Phase 3 eng-review decisions A4.1 + T3.1 into compiler spec (Chris Sorensen)
- 34e3b0d - feat(skills): add sigil-grok-bridge keyless MCP adapter and conformance suite (Chris Sorensen)
- 7521573 - docs(governance): correct false enforcement claim, refresh stale project memory (Chris Sorensen)
- 10121db - docs(ironledger): Phase 3 Beancount compiler and recovery journal design (Chris Sorensen)
- 86d1a9b - test(vfs): add vfs reporting telemetry contract test suite (Chris Sorensen)
- 51b6a2f - docs(report): add daily report for 2026-09-05 (Chris Sorensen)
- 67c61ef - feat(viking): add dynamic reporting and integrity check (Chris Sorensen)
- 38fc9f7 - docs(plan): refine implementation plan with schema versioning, strict boundaries, and test runbook (Chris Sorensen)
- 0bb3207 - docs(plan): add Toolforge Herdr TRM integration implementation plan (Chris Sorensen)
- 93993e6 - docs(report): add daily report for 2026-09-04 (Chris Sorensen)
- 35207ca - docs(spec): add Toolforge Herdr TRM integration design (Chris Sorensen)
- a13a062 - docs(trm): codify RFC GAPs 17-21 on assembly line origins and executive power struggles (Chris Sorensen)
- 4d40f47 - chore(metadata): update skillpack metadata and validation reports (Chris Sorensen)
- 183a0c6 - feat(trm): synthesize canonical RFCs for gaps 12 through 16 (Chris Sorensen)
- 4582042 - docs(trm): codify sovereign architecture and expanded historical treatments dossier (Chris Sorensen)
- e2d8e7c - feat(trm): synthesize canonical RFCs and deploy script claim linter (Chris Sorensen)
- d3779f1 - docs(diagrams): add diagram build scripts and enforce Cathryn Lavery wiki standards (Chris Sorensen)
- 3401e00 - docs(ironledger): Phase 2b execution handoff — plan approved, resume point (Chris Sorensen)
- 82f602b - docs(ironledger): fold plan-eng-review findings into Phase 2b spec and plan (Chris Sorensen)
- f69aaed - docs(governance): add third-party tool provenance policy and update wiki attribution (Chris Sorensen)
- ba1e1b2 - feat(trm): add rfc-gap-07 danish pipeline transatlantic telemetry (Chris Sorensen)
- e6e3c85 - docs(report): add daily report for 2026-09-03 (Chris Sorensen)
- da9007b - docs(ironledger): Phase 2b implementation plan (15 TDD tasks) (Chris Sorensen)
- 009a76e - docs(ironledger): amend Phase 2b spec for migration-runner and audit-envelope constraints (Chris Sorensen)
- 6af4dfb - docs(ironledger): Phase 2b review and categorization design (Chris Sorensen)

## Version 2.67.1
Date: 2026-09-20

### Changes
- f9296cd - docs(retro): clarify neutral placeholders for test inventory in 2026-09-14 retro (Chris Sorensen)

## Version 2.67.0
Date: 2026-09-20

### Changes
- 905912a - merge: integrate v2.66.4 release (Chris Sorensen)
- fcda28e - feat(retro): explain test ratio evidence (Chris Sorensen)

## Version 2.66.4
Date: 2026-09-20

### Changes
- 03936a8 - docs: reconcile weekly session audit (Chris Sorensen)

## Version 2.66.3
Date: 2026-09-14

### Changes
- 53f1a32 - Merge pull request #38 from sorensencc-dotcom/fix/nlm-closed-loop-pack-replace-gate (Chris Sorensen)
- 9f6cfd3 - fix(nlm): match politics/knowledge pack titles in replace gate (Chris Sorensen)
- 1f1d014 - fix(nlm): pre-upload pack replace gate for closed-loop push (Chris Sorensen)

## Version 2.66.2
Date: 2026-09-09

### Changes
- a653af3 - Merge pull request #37 from sorensencc-dotcom/chore/gitignore-daemon-artifacts (Chris Sorensen)
- 4434da9 - chore(gitignore): ignore daemon artifacts and nested working repos (Chris Sorensen)

## Version 2.66.1
Date: 2026-09-09

### Changes
- 97ca342 - Merge pull request #35 from sorensencc-dotcom/chore/serial-merge-queue-hardening (Chris Sorensen)
- c835354 - Merge pull request #36 from sorensencc-dotcom/ironledger/phase-3-docs (Chris Sorensen)
- a3076c3 - docs(ironledger): add Phase 3 Beancount compiler and recovery journal design (Chris Sorensen)
- 456859a - fix(merge-queue): validate on staging ref, not main (Chris Sorensen)

## Version 2.66.0
Date: 2026-09-08

### Changes
- 1471f6d - feat: wire validated Ollama routing (Chris Sorensen)
- bc2f4c8 - Merge origin/main into feat/trm-devops-path-safety-reconcile (Chris Sorensen)
- 7f4ce3d - feat: wire validated Ollama routing (Chris Sorensen)
- 6777187 - fix(runtime-owner): support health-only consumer checks (Chris Sorensen)
- f65f9e8 - feat(runtime-owner): add Phase B consumer harness (Chris Sorensen)
- 97a7f60 - chore: update runtime owner handoff (Chris Sorensen)
- 2535734 - docs: close runtime owner phase A (Chris Sorensen)
- 082ec31 - docs: record runtime owner verification (Chris Sorensen)
- d9125a0 - test: register runtime owner focused suite (Chris Sorensen)
- 552fd48 - fix: harden runtime owner process accounting (Chris Sorensen)
- 03b2ee2 - fix: harden runtime owner lifecycle (Chris Sorensen)
- 98b451c - feat: add Linux runtime owner Phase A (Chris Sorensen)
- 1ccc932 - docs: close runtime owner design review (Chris Sorensen)
- a7cbdf5 - docs: design Toolforge runtime owner phase A (Chris Sorensen)
- a6d8c35 - docs: prepare Open Notebook process handoff (Chris Sorensen)
- b485778 - feat: add isolated Open Notebook adapter (Chris Sorensen)
- 4b9d78b - feat: add research substrate contracts (Chris Sorensen)
- 352c29d - test: characterize TRM research script seam (Chris Sorensen)
- 1323d7f - docs: lock Open Notebook HTTP contract (Chris Sorensen)
- c0a7777 - docs: plan Open Notebook contract lock (Chris Sorensen)
- 57d2f26 - docs: block Open Notebook contract until locked (Chris Sorensen)
- 50c8935 - docs: record Open Notebook boundary prerequisite (Chris Sorensen)
- 61159db - docs: record Open Notebook review decisions (Chris Sorensen)
- 0fc115c - docs: define Open Notebook research substrate (Chris Sorensen)
- 93cb2e5 - feat(trm-devops): reconcile path safety checks into MCP server and export path-safety core (Chris Sorensen)

## Version 2.65.0
Date: 2026-09-07

### Changes
- 779bcb9 - feat(utilities): add conservative node process janitor (#32) (Chris Sorensen)

## Version 2.64.0
Date: 2026-09-07

### Changes
- 1134846 - feat(mcp): mirror vfs_upsert_document to toolforge Viking VFS surface (#31) (Chris Sorensen)

## Version 2.63.1
Date: 2026-09-05

### Changes
- 2609f81 - Feat/toolforge herdr trm integration (#30) (Chris Sorensen)
- 7016fd6 - docs(ironledger): Phase 2b handoff and resume point (Chris Sorensen)
- 373b44e - docs(ironledger): add Phase 2a spec and plan referenced by the exit evidence (Chris Sorensen)
- 7d221b0 - docs(ironledger): record Phase 2a exit-gate approval (Chris Sorensen)
- f4e9ae2 - docs(ironledger): Phase 2a dependency posture and exit-gate evidence (Chris Sorensen)
- d659625 - docs(plan): cross-federation directory implementation plan (#4) (Chris Sorensen)
- b895b31 - docs(spec): apply caveman-review to cross-federation directory spec (#4) (Chris Sorensen)

## Version 2.63.0
Date: 2026-09-03

### Changes
- fe29dd9 - docs(wiki): add root wiki page mappings and sidebar links for parallel-search and tinyfish-search (Chris Sorensen)
- 158b109 - feat(trm): resolve open research gaps GAP-02, GAP-03, GAP-06 with archival citations (Chris Sorensen)
- 46ad5fe - docs(wiki): add dedicated wiki documentation for parallel-search and tinyfish-search (#29) (Chris Sorensen)
- 3c471be - docs(spec): apply Codex review to cross-federation directory spec (#4) (Chris Sorensen)

## Version 2.62.1
Date: 2026-09-03

### Changes
- 50580ae - fix(toolforge): normalize entrypoint, add integration diagram, and resolve repository paths dynamically (Chris Sorensen)

## Version 2.62.0
Date: 2026-09-03

### Changes
- 86eabb4 - feat(tinyfish): add tinyfish-search skill — search and Markdown extract via @tiny-fish/sdk (#27) (Chris Sorensen)

## Version 2.61.1
Date: 2026-09-03

### Changes
- 983f7d8 - docs(plan): add TinyFish search skill implementation plan (Chris Sorensen)
- 76ffd4d - docs(spec): address review findings for client guard, types, and timeout semantics (Chris Sorensen)
- 9799ce6 - docs(spec): add provider hygiene, timeout semantics, and future-proofing to TinyFish spec (Chris Sorensen)
- 1f489f6 - chore(sync): register parallel-search skill, refresh skillpack metadata (Chris Sorensen)
- 935bdc5 - fix(skillpack): stop regen from clobbering timestamps and line endings (Chris Sorensen)
- 7a80dd0 - docs(spec): sigil cross-federation directory design (federation #4) (Chris Sorensen)
- bc5f02a - fix(validator): expand canonical skill category allow-list (Chris Sorensen)
- fc17eb2 - docs(meta): add Claude API caching + batch cost checklist, retire DCO-BIP padding engine (Chris Sorensen)
- 7037895 - docs(sigil): fold I1 fabb4fe + I4 MAX_ATTEMPTS=4 into routing plan/spec (Chris Sorensen)
- ef25b6a - chore(sync): bump handoff date to 2026-09-01, append session-end journal entries (Chris Sorensen)
- 099dc06 - docs(report): add weekly report for 2026-W36 (Chris Sorensen)

## Version 2.61.0
Date: 2026-09-02

### Changes
- 3e34488 - feat(trm): add unattended scheduled miner script and resolve GAP-06 dossier (Chris Sorensen)

## Version 2.60.0
Date: 2026-09-02

### Changes
- 8cbb9a2 - feat(graft): add mcp registration, pre-push hook, and ci audit workflow (Chris Sorensen)
- 0283413 - chore: ignore local regen artifacts, point workspace root at C:/dev (Chris Sorensen)
- 340084d - docs(report): add daily report for 2026-09-02 (Chris Sorensen)

## Version 2.59.1
Date: 2026-09-02

### Changes
- 10e17e4 - chore(gitignore): match .ijfw/scan-state.json.tmp.* temp files (Chris Sorensen)

## Version 2.59.0
Date: 2026-09-02

### Changes
- 1edb64c - merge: fold 31 authored commits (ironledger docs, trm GAP, sigil specs, kb-sync, toolforge) into restored main (Chris Sorensen)
- 13cba68 - revert(main): restore repo tree clobbered by runaway wiki-sync 0347469b (Chris Sorensen)
- a73d3d7 - chore: replace retired Claude model pins in work-summarizer and TRM research loop (Chris Sorensen)
- 68adb18 - docs(sigil): mark I1 resolved in the inter-relay routing spec (Chris Sorensen)
- 96c1118 - chore(parallel-search): clear deferred cleanup minors (#25) (Chris Sorensen)
- c4bce21 - chore(parallel-search): post-SDD cleanup — USAGE doc, gitignore + lockfile, test-count floor, task_result debug sink (#24) (Chris Sorensen)
- 80c9b5b - feat(parallel-search): Charlie adapter Task Run routing (#23) (Chris Sorensen)
- fae8f67 - feat(parallel-search): add parallel_task_result wrapper with run_id-preserving timeout handling (#22) (Chris Sorensen)
- d9d8866 - fix(parallel-search): address PR #19 review — guard onError, cover shape-failure path (#21) (Chris Sorensen)
- 72a4757 - refactor(parallel-search): extract defineOperation skeleton, no behavior change (#20) (Chris Sorensen)
- 8d256e7 - test(parallel-search): live smoke test + debug sink (defect 7) (#19) (Chris Sorensen)
- fdd92fd - docs(ironledger): record Phase 1 exit-gate approval (Chris Sorensen)
- a71e3d4 - chore: preflight accepts pyproject.toml, go.mod, or Cargo.toml (Chris Sorensen)
- f0ea493 - docs(sigil): close out inter-relay routing plan + spec (Chris Sorensen)
- 6e4a8e2 - docs(ironledger): submit Phase 1 implementation for operator review (Chris Sorensen)
- 31e419a - fix(parallel-search): SDK call paths, client typing, query cap, beta header, test runner, adapter regression (#18) (Chris Sorensen)
- d4d59b0 - docs(report): add daily report for 2026-09-01 (Chris Sorensen)
- 6d50371 - docs(parallel-search): recovery spec for shipped skill, v1.2 with resolved OQs (Chris Sorensen)
- 3b73964 - docs(ironledger): sentence-case 1.1 heading, note snapshot age (Chris Sorensen)
- cb7139c - docs(ironledger): tidy Phase 0 baseline after repo move (Chris Sorensen)
- b176ecb - docs(ironledger): set C:\dev\IronLedger as the operator-approved repo home (Chris Sorensen)
- 9ff6c01 - Merge pull request #16 from sorensencc-dotcom/codex/parallel-search-charlie-adapter-clean (Chris Sorensen)
- e6a8a08 - docs(ironledger): fold Phase 1 plan review findings into the draft (Chris Sorensen)
- fdd3e29 - docs(ironledger): add Phase 1 plan draft (task breakdown, no implementation) (Chris Sorensen)
- bff19bb - feat: add fail-closed charlie research adapter (Chris Sorensen)
- 842aa65 - docs(ironledger): relocate governed docs to typed subfolders, add Phase 0 baseline (Chris Sorensen)
- 1a6ec60 - docs(report): add daily report for 2026-08-31 (Chris)
- 4125119 - docs: approve IronLedger architecture and implementation plan (Chris)
- 658da2a - feat: sigil inter-relay routing spec & parallel-search skill integration (#15) (Chris Sorensen)
- 20a6031 - feat(trm): resolve GAP-03-CUBA with certified FCSC Decision CU-5843 / Claim CU-3440 (Chris)
- 92a34fd - feat(trm): resolve GAP-04 Dodge vs Ford and GAP-05 Harry Bennett Service Department (Chris)
- a5808fe - feat(trm): resolve GAP-03 B-17 mismatch, GAP-02 Al-Toy banquet, and track GAP-06 B-24 knock-down kits (Chris)
- 60118f9 - feat(trm): register stage 3 research directive for GAP-02 flying cow (Chris)
- a321ce0 - feat(trm): register stage 3 research directives for GAP-03 and FCSC Cuban estate (Chris)
- 2c817fd - fix(toolforge): remediate health warnings, sync manifest skills, and update project memory (Chris)
- aca181f - docs(toolforge): link parallel-search operator guide (Chris)
- b455563 - docs(report): add weekly report for 2026-W35 (Chris)
- f66cb97 - feat(toolforge): register parallel-search skill (5/5 tests passing) (Chris)
- 55f2d1c - docs(plan): sigil inter-relay routing implementation plan (federation #3) (Chris)
- 441a20d - fix(ci): update node-version to 24, fix sigil repo slug, and robust link in governance matrix (Chris)
- 4acee46 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 74ed129 - ci: enable workflow_dispatch on wave-d and governance matrix workflows (Chris)
- 22b7f29 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 9f92821 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 0347469 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- d70dfd8 - fix(ci): use npm install in wave-d and sparse-checkout toolforge in governance matrix (Chris)
- e493304 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 94e55ef - docs(spec): sigil inter-relay routing design (federation #3) (Chris)
- c40e9ce - test(governance): resolve @-referenced root in test read helper (Chris)
- 28e9781 - feat(kb-sync): add headless NotebookLM uploader and pack consolidation workflow (Chris)
- 61cc1fb - feat(trm): resolve GAP-04 with canonical Willow Run L-bend research note (Chris)
- aaf42b6 - feat(skills): add wiki-sync-recovery diagnostic + fixture-skip test pattern (Chris)

## Version 2.58.1
Date: 2026-08-30

### Changes
- fbf4ec4 - fix(ci): sanitize mock token, fix wave-d action tags, and checkout sibling governance repo in matrix (Chris)

## Version 2.58.0
Date: 2026-08-30

### Changes
- e2b38a6 - Merge branch 'feat/viking-harness-integration' (Chris)
- 4fa14ae - feat: integrate Viking VFS harnesses (Chris)
- 50e0f44 - docs(agents): correct stale roadmap-gate evidence in AGENTS.md (Chris)
- 945ddd5 - Merge branch 'main' into feat/viking-harness-integration (Chris)
- 9e146ed - fix(research): add missing title to frontmatter for validation compliance (Chris)
- 2382e6e - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- b0280dc - feat: complete Viking VFS phase 2 (Chris)

## Version 2.57.0
Date: 2026-08-30

### Changes
- a38c9e4 - feat(trm): register 4 new NotebookLM notebooks for closed-loop research (Chris)
- 46b9130 - docs(report): add daily report for 2026-08-30 (Chris)

## Version 2.56.1
Date: 2026-08-30

### Changes
- 83f4981 - chore(merge): conclude merge with origin/main (Chris)
- 15105d4 - chore(merge): sync remote tags and release commits (Chris)
- d9f0d4d - fix(wiki-sync): use unique temporary directory for wiki publisher clones (Chris)
- 9ee34e6 - chore(sync): update TRM research gaps, drift reports, and skill metadata (Chris)

## Version 2.56.0
Date: 2026-08-30

### Changes
- 0614058 - chore(merge): sync remote tags (Chris)
- 17bdc6f - feat(daily-miner): add Tor proxy health telemetry, daily multi-notebook orchestrator, and 9PM scheduler (Chris)

## Version 2.55.1
Date: 2026-08-30

### Changes
- 6ecf4cf - fix(wiki-sync): resolve root image references and add retry logic on Windows (Chris)
- 7afe782 - chore(merge): sync remote updates (Chris)
- ccbe648 - chore(audit): record test suite validation entries in wiki log (Chris)

## Version 2.55.0
Date: 2026-08-30

### Changes
- 8e7f560 - fix(wiki-sync): use SSH repository URL for automated wiki sync (Chris)
- 58457d8 - fix(property-extractor): refine candidate regex filtering and remove unparsed generic profile (Chris)
- cdbec91 - chore(merge): sync origin/main release v2.54.2 (Chris)
- 6a363a9 - feat(research-automation): add live web harvester, topic triage console, property deed extractor, and golden test suite (Chris)
- 3ab6f8c - feat(thematic-partitioning): register Cuban Seizures notebook, add dynamic placeholder lifecycle, and pack validator (Chris)
- a915ec5 - docs(report): add daily report for 2026-08-29 (Chris)

## Version 2.54.2
Date: 2026-08-29

### Changes
- 6972edc - chore(gbrain): configure local pglite engine pin and update status (Chris)

## Version 2.54.1
Date: 2026-08-29

### Changes
- e99aa58 - chore(triage): archive resolved DEV-001 and clear active queue (Chris)

## Version 2.54.0
Date: 2026-08-28

### Changes
- 7f75525 - fix(ci): make CI governance matrix dependency installation resilient across checkouts (Chris)
- 2de6526 - fix(release): align VERSION.md with latest release tag v2.53.0 (Chris)
- 3c29017 - chore(release): v1.1.0 (toolforge-release-bot)
- cfa6a81 - fix(ci): add root VERSION.md, claim DEV-001 in queue, and add paired wiki sync test (Chris)
- 715cc8b - feat(wiki): publish TRM DevOps Triage architecture diagram and specification page (Chris)
- e975ee3 - docs(skills): add Skill Operator Guide references to trm-devops-triage (Chris)
- d41dc2f - feat(skills): add trm-devops-triage skill with full toolforge specification (Chris)
- 3b89305 - chore(sync): update status feed and claude memory nodes (Chris)
- 015c422 - chore(mcp): register trm-devops MCP server in workspace config (Chris)
- 01a8334 - feat(trm-devops): initialize dev/triage queue state and gitignore (Chris)
- c514a92 - docs(status): record TRM DevOps sync and triage pipeline completion (Chris)
- 745aec9 - feat(trm-devops): implement MCP server adapter and tool handlers (Chris)
- f74fd33 - feat(trm-devops): implement CLI commands for sync, prune, and status (Chris)
- 7b2bab1 - feat(trm-devops): implement pruning manager and global index updates (Chris)
- f776eee - feat(trm-devops): implement queue reconciler and atomic markdown generator (Chris)
- 4dce7c8 - feat(trm-devops): implement offline fallback buffer and notebooklm client bridge (Chris)
- f2fa9ee - feat(trm-devops): implement schema validator and dead-letter chunk quarantine (Chris)
- ff2c4c9 - feat(trm-devops): implement concurrency file lock with stale recovery (Chris)
- 030aa5e - feat(trm-devops): implement error trace normalizer and signature hasher (Chris)
- 34dcde4 - feat(trm-devops): scaffold module package and core type interfaces (Chris)
- aabf570 - docs(plan): add TRM DevOps sync and triage pipeline implementation plan (Chris)
- eca1298 - docs(spec): embed simulation-verified normalizer transformation pipeline (Chris)
- b407309 - docs(spec): apply caveman review fixes (stale lock mtime, fallback mkdir, rawText notes, gz atomicity) (Chris)
- 0255311 - docs(spec): enhance TRM DevOps sync pipeline with fallback buffer, file locks, and lineage (Chris)
- 0b6f028 - docs(spec): add TRM DevOps sync and triage pipeline design spec (Chris)
- 5d30733 - feat(scripts): add on-demand TRM NotebookLM miner with daily status refresh (Chris)
- cc279c4 - Merge pull request #14 from sorensencc-dotcom/feat/viking-tier-index (Chris Sorensen)
- 316228c - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- f54e02e - feat: pin viking reads to verified snapshots (Chris)
- f1b73ad - feat: derive viking tier freshness (Chris)
- a7f607c - feat: expose standard viking MCP resources (Chris)
- c0f67c6 - feat: integrate viking sqlite tier metadata (Chris)
- 5ac7056 - feat: add sqlite viking tier index (Chris)
- 2713b4a - fix: validate viking snapshot identities (Chris)
- 01ce33f - feat: add viking protocol contract validation (Chris)
- 0e8a65e - fix: enforce viking manifest containment (Chris)
- 667317c - feat: bind viking tiers to snapshots (Chris)
- 4215a7e - fix: emit valid viking JSON-RPC errors (Chris)
- c7ca6e8 - feat: validate viking MCP requests (Chris)
- 15df610 - feat: bound viking directory listings (Chris)
- 4d2f5fd - feat: enforce viking snapshot manifests (Chris)
- 04b44e4 - test: harden viking URI failure handling (Chris)
- 7ca1064 - feat: add read-only viking MCP filesystem (Chris)
- c2b18ad - chore: synchronize workspace agent instructions (Chris)
- 7c0e15e - chore: add fail-closed repository preflight (Chris)
- 32a9807 - docs: specify viking MCP virtual filesystem (Chris)
- 543b2e2 - test: add gate baseline profiler (Chris)
- 955c4a4 - chore: centralize shared agent instructions (Chris)
- ae0ddc1 - ci: onboard wave 3 governance repositories (Chris)
- 09657c0 - ci: add cross-repo governance gate matrix (Chris)
- 17aaca2 - fix(wiki-qa): resolve live wiki inventory slugs, frontmatter collision, and timeout budget (Chris)
- ab1fdaf - feat(governance): bridge TorqueQuery to agent dispatch (Chris)
- 0825b92 - Merge pull request #13 from sorensencc-dotcom/feat/openrouter-oxalpha-integration (Chris Sorensen)
- 887d16a - test(dispatch): verify bounded fallback artifacts and overrides (Chris)
- 9298b23 - test(agent-dispatch): cover contract signing and verification (Chris)
- d6f16d7 - feat(docs): enforce publishing inventory and wiki QA discovery (Chris)
- 044a7ba - fix: scope wiki browser QA link and diagram checks (Chris)
- 60c10a9 - fix(dispatch): enforce single-run trace isolation and truncation (Chris)
- bac8092 - fix(wiki): correct addFrontmatterTitle function call in copyRecursive (Chris)
- cc8d74f - docs(wiki): add WhichLLM hardware-aware evaluator spec and sanitize frontmatter (Chris)
- b5d36c2 - Merge pull request #2 from sorensencc-dotcom/feat/openrouter-oxalpha-integration (Chris Sorensen)
- b300148 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 2eb1fbd - Merge remote-tracking branch 'origin/main' into feat/openrouter-oxalpha-integration-2 (Chris)
- 9dbb841 - fix(wiki): add trm-gap-triage-architecture diagram asset mappings to wiki publisher (Chris)
- 1136020 - chore(sync): update platform dashboard, journal, and skillpack metadata (Chris)
- 26ddc5a - docs(report): add daily report for 2026-08-27 (Chris)
- 4cadd5e - feat(skills): add trm-closed-loop-research skill package (Chris)
- 3d3fb9a - feat(trm): complete live multi-notebook mining and Layer 2 wiki synthesis round-trip (Chris)
- 537e4ca - fix(docs): colocate diagram PNG with design spec for wiki publisher image resolution (Chris)
- 551d593 - docs: add Cathryn Lavery TRM gap triage architecture diagram and update documentation (Chris)
- e922d1c - docs: update TRM query expansion design spec with eng review decisions (Chris)
- ae49ae6 - docs: add TRM cognitive query expansion design spec (Chris)
- 0d1a9cc - feat(trm): add test suite for frontmatter validator and wire test:trm script (Chris)
- 4b03244 - docs(plan): add TRM frontmatter validator test suite implementation plan (Chris)
- 8468acf - docs(spec): add TRM frontmatter validator test suite design (Chris)
- d00f6c8 - fix: restore retro audit and toolforge health (Chris)
- 7282a7e - docs(report): add daily report for 2026-08-26 (Chris)
- d9ff50e - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 183e5eb - Merge branch 'main' of https://github.com/sorensencc-dotcom/toolforge into feat/openrouter-oxalpha-integration-2 (Chris)

## Version 1.1.0
Date: 2026-08-28

### Changes
- cfa6a81 - fix(ci): add root VERSION.md, claim DEV-001 in queue, and add paired wiki sync test (Chris)
- 715cc8b - feat(wiki): publish TRM DevOps Triage architecture diagram and specification page (Chris)
- e975ee3 - docs(skills): add Skill Operator Guide references to trm-devops-triage (Chris)
- d41dc2f - feat(skills): add trm-devops-triage skill with full toolforge specification (Chris)
- 3b89305 - chore(sync): update status feed and claude memory nodes (Chris)
- 015c422 - chore(mcp): register trm-devops MCP server in workspace config (Chris)
- 01a8334 - feat(trm-devops): initialize dev/triage queue state and gitignore (Chris)
- c514a92 - docs(status): record TRM DevOps sync and triage pipeline completion (Chris)
- 745aec9 - feat(trm-devops): implement MCP server adapter and tool handlers (Chris)
- f74fd33 - feat(trm-devops): implement CLI commands for sync, prune, and status (Chris)
- 7b2bab1 - feat(trm-devops): implement pruning manager and global index updates (Chris)
- f776eee - feat(trm-devops): implement queue reconciler and atomic markdown generator (Chris)
- 4dce7c8 - feat(trm-devops): implement offline fallback buffer and notebooklm client bridge (Chris)
- f2fa9ee - feat(trm-devops): implement schema validator and dead-letter chunk quarantine (Chris)
- ff2c4c9 - feat(trm-devops): implement concurrency file lock with stale recovery (Chris)
- 030aa5e - feat(trm-devops): implement error trace normalizer and signature hasher (Chris)
- 34dcde4 - feat(trm-devops): scaffold module package and core type interfaces (Chris)
- aabf570 - docs(plan): add TRM DevOps sync and triage pipeline implementation plan (Chris)
- eca1298 - docs(spec): embed simulation-verified normalizer transformation pipeline (Chris)
- b407309 - docs(spec): apply caveman review fixes (stale lock mtime, fallback mkdir, rawText notes, gz atomicity) (Chris)
- 0255311 - docs(spec): enhance TRM DevOps sync pipeline with fallback buffer, file locks, and lineage (Chris)
- 0b6f028 - docs(spec): add TRM DevOps sync and triage pipeline design spec (Chris)
- 5d30733 - feat(scripts): add on-demand TRM NotebookLM miner with daily status refresh (Chris)
- cc279c4 - Merge pull request #14 from sorensencc-dotcom/feat/viking-tier-index (Chris Sorensen)
- 316228c - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- f54e02e - feat: pin viking reads to verified snapshots (Chris)
- f1b73ad - feat: derive viking tier freshness (Chris)
- a7f607c - feat: expose standard viking MCP resources (Chris)
- c0f67c6 - feat: integrate viking sqlite tier metadata (Chris)
- 5ac7056 - feat: add sqlite viking tier index (Chris)
- 2713b4a - fix: validate viking snapshot identities (Chris)
- 01ce33f - feat: add viking protocol contract validation (Chris)
- 0e8a65e - fix: enforce viking manifest containment (Chris)
- 667317c - feat: bind viking tiers to snapshots (Chris)
- 4215a7e - fix: emit valid viking JSON-RPC errors (Chris)
- c7ca6e8 - feat: validate viking MCP requests (Chris)
- 15df610 - feat: bound viking directory listings (Chris)
- 4d2f5fd - feat: enforce viking snapshot manifests (Chris)
- 04b44e4 - test: harden viking URI failure handling (Chris)
- 7ca1064 - feat: add read-only viking MCP filesystem (Chris)
- c2b18ad - chore: synchronize workspace agent instructions (Chris)
- 7c0e15e - chore: add fail-closed repository preflight (Chris)
- 32a9807 - docs: specify viking MCP virtual filesystem (Chris)
- 543b2e2 - test: add gate baseline profiler (Chris)
- 955c4a4 - chore: centralize shared agent instructions (Chris)
- ae0ddc1 - ci: onboard wave 3 governance repositories (Chris)
- 09657c0 - ci: add cross-repo governance gate matrix (Chris)
- 17aaca2 - fix(wiki-qa): resolve live wiki inventory slugs, frontmatter collision, and timeout budget (Chris)
- ab1fdaf - feat(governance): bridge TorqueQuery to agent dispatch (Chris)
- 0825b92 - Merge pull request #13 from sorensencc-dotcom/feat/openrouter-oxalpha-integration (Chris Sorensen)
- 887d16a - test(dispatch): verify bounded fallback artifacts and overrides (Chris)
- 9298b23 - test(agent-dispatch): cover contract signing and verification (Chris)
- d6f16d7 - feat(docs): enforce publishing inventory and wiki QA discovery (Chris)
- 044a7ba - fix: scope wiki browser QA link and diagram checks (Chris)
- 60c10a9 - fix(dispatch): enforce single-run trace isolation and truncation (Chris)
- bac8092 - fix(wiki): correct addFrontmatterTitle function call in copyRecursive (Chris)
- cc8d74f - docs(wiki): add WhichLLM hardware-aware evaluator spec and sanitize frontmatter (Chris)
- b5d36c2 - Merge pull request #2 from sorensencc-dotcom/feat/openrouter-oxalpha-integration (Chris Sorensen)
- b300148 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 2eb1fbd - Merge remote-tracking branch 'origin/main' into feat/openrouter-oxalpha-integration-2 (Chris)
- 9dbb841 - fix(wiki): add trm-gap-triage-architecture diagram asset mappings to wiki publisher (Chris)
- 1136020 - chore(sync): update platform dashboard, journal, and skillpack metadata (Chris)
- 26ddc5a - docs(report): add daily report for 2026-08-27 (Chris)
- 4cadd5e - feat(skills): add trm-closed-loop-research skill package (Chris)
- 3d3fb9a - feat(trm): complete live multi-notebook mining and Layer 2 wiki synthesis round-trip (Chris)
- 537e4ca - fix(docs): colocate diagram PNG with design spec for wiki publisher image resolution (Chris)
- 551d593 - docs: add Cathryn Lavery TRM gap triage architecture diagram and update documentation (Chris)
- e922d1c - docs: update TRM query expansion design spec with eng review decisions (Chris)
- ae49ae6 - docs: add TRM cognitive query expansion design spec (Chris)
- 0d1a9cc - feat(trm): add test suite for frontmatter validator and wire test:trm script (Chris)
- 4b03244 - docs(plan): add TRM frontmatter validator test suite implementation plan (Chris)
- 8468acf - docs(spec): add TRM frontmatter validator test suite design (Chris)
- d00f6c8 - fix: restore retro audit and toolforge health (Chris)
- 7282a7e - docs(report): add daily report for 2026-08-26 (Chris)
- d9ff50e - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 183e5eb - Merge branch 'main' of https://github.com/sorensencc-dotcom/toolforge into feat/openrouter-oxalpha-integration-2 (Chris)

