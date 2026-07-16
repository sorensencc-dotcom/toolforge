# Changelog

## Version 2.5.0
Date: 2026-07-16

### Changes
- 43f4f06 - fix(cic-run-gate): add SEC-AUDITOR exemption for child_process spawn (Chris Sorensen)
- 3abed4a - feat(toolforge): add PDF ingestion plugin + generic plugin exec system (Chris Sorensen)

## Version 2.4.0
Date: 2026-07-16

### Changes
- a9afc29 - chore(cic-tool-surface): Phase 2 validation pass (Chris Sorensen)
- f521e77 - feat(cic-tool-surface): cic-ingest-world writes lineage index entry (Chris Sorensen)
- 191a884 - feat(cic-tool-surface): cic-run-gate writes report index entry (Chris Sorensen)
- 8f054f5 - feat(cic-tool-surface): add lineage/report index path+writer helpers (Chris Sorensen)
- 3e1d9aa - Merge branch 'docs-meta-restructure' (Chris Sorensen)
- 5d7ccac - fix(cic-tool-surface): anchor artifactPaths at repo root, not process.cwd() (Chris Sorensen)
- c17211a - docs: fix stale phase-charter glob path in global operating rules (final review finding) (Chris Sorensen)
- f640482 - docs: point CLAUDE.md governance references at new docs/meta subfolder paths (Chris Sorensen)
- 7ce1d97 - docs: add docs/meta root index (Chris Sorensen)
- 66eea53 - docs: add docs/meta documentation policy (Chris Sorensen)
- a5cd501 - docs: archive orphaned parallelism-matrix draft and superseded governance manifest drafts (Chris Sorensen)
- 0bd545e - docs: fix Task 5 plan-doc self-corruption (same class as Tasks 1-4) (Chris Sorensen)
- 0c7a1ae - docs: move review docs into docs/meta/reviews/ (Chris Sorensen)
- 2fbb6e3 - docs: fix Task 4 reviewer findings + newly-discovered duplicate pair (ijfw-verify-parallelism-checks, parallelism-matrix-governance-rule) (Chris Sorensen)
- a10b847 - docs: fix Task 4 plan-doc self-corruption (same class as Tasks 1-3) (Chris Sorensen)
- 00ad5ce - docs: move implementation plans into docs/meta/plans/ (Chris Sorensen)
- c8d8a30 - docs: complete Task 3 plan-doc self-corruption fix (2 blocks the implementer missed) (Chris Sorensen)
- db76e4d - docs: move design/integration specs into docs/meta/specs/ (Chris Sorensen)
- f48d80e - docs: fix README wording implying phase-8-toolforge-marketplace/ is nested in phases/ (Chris Sorensen)
- fb62d48 - docs: fix Task 2 plan-doc self-corruption (same class as Task 1) (Chris Sorensen)
- fbb5d32 - docs: move phase charters/reports into docs/meta/phases/ (Chris Sorensen)
- e0f08ce - docs: apply Step 5 staging fix to the correct checkout (was mistakenly edited on main earlier) (Chris Sorensen)
- 34a1b11 - docs: fix 2 more doubled-path links from same sed root cause (re-review finding) (Chris Sorensen)
- 2b047db - docs: fix Task 1 reviewer findings (broken outgoing links, plan doc self-corruption) (Chris Sorensen)
- 4eb8b39 - docs: fix docs/meta/governance/ referrers outside the moved folder (Task 1 completion) (Chris Sorensen)
- 68513aa - docs: move governance docs into docs/meta/governance/ (Chris Sorensen)

## Version 2.3.2
Date: 2026-07-16

### Changes
- 44d3f99 - chore(retro): update handoff memory and shared skill tests (Chris Sorensen)

## Version 2.3.1
Date: 2026-07-16

### Changes
- c1cb3f2 - docs: add CIC tool surface Phase 2 implementation plan (Chris Sorensen)
- 346937e - docs: address caveman-review findings on Phase 2 spec (Chris Sorensen)
- 1a1ca42 - Merge remote-tracking branch 'origin/main' (Chris Sorensen)
- 1e9de63 - docs: add CIC tool surface Phase 2 design spec (Chris Sorensen)

## Version 2.3.0
Date: 2026-07-16

### Changes
- 4e98415 - Merge branch 'main' of https://github.com/sorensencc-dotcom/toolforge (Chris Sorensen)
- abf66c5 - Merge branch 'main' of https://github.com/sorensencc-dotcom/toolforge (Chris Sorensen)
- f2b0da1 - chore(retro): save 2026-07-16 session snapshots (Chris Sorensen)
- 64ec58c - chore(cic-tool-surface): remove test cache pollution (Chris Sorensen)
- f1df94c - chore(cic-tool-surface): gitignore per-skill cic/ artifact dirs, remove committed test pollution (Chris Sorensen)
- d919175 - feat(cic-tool-surface): add cic-ingest-world stub skill (Chris Sorensen)
- 168cdca - feat(cic-tool-surface): add cic-run-gate skill wrapping GATE-01 adapter (Chris Sorensen)
- 1d972cc - feat(cic-tool-surface): add run_gate_adapter.py for GATE-01 (Chris Sorensen)
- d096e2c - feat(cic-tool-surface): add cic-consolidate-artifacts stub skill (Chris Sorensen)
- b60f56b - feat(cic-tool-surface): add cic-repair-pipeline stub skill (Chris Sorensen)
- 5d3abe7 - chore: ignore .worktrees/ for local git worktree isolation (Chris Sorensen)
- 24ce78f - docs: add implementation plan for docs/meta restructure (Chris Sorensen)
- 2437724 - feat(cic-tool-surface): add _cic-shared helper module (Chris Sorensen)
- eab52fa - docs: fix precedence ambiguities and duplication in docs-structure design spec (Chris Sorensen)
- e50e87b - docs: mirror missing SKILL.md/README.md/INTEGRATION_DIAGRAM.md for toolforge-cli, toolforge-registry-manager, toolforge-submission-validator (Chris Sorensen)
- c11ab75 - docs: add docs/meta restructure + documentation policy design spec (Chris Sorensen)
- 0d571fa - docs: add CIC tool surface Phase 1 implementation plan (Chris Sorensen)
- e08af30 - fix: move CIC tool surface spec to docs/meta (repo convention) (Chris Sorensen)
- 1e80fd4 - docs: add CIC tool surface Phase 1 design spec (Chris Sorensen)

## Version 2.2.5
Date: 2026-07-16

### Changes
- 3e39dd0 - chore: update retros, copilot instructions, and deployment status reports (Chris Sorensen)

## Version 2.2.4
Date: 2026-07-16

### Changes
- 05406d6 - merge: sync v2.2.3 release-bot commit (Chris Sorensen)
- b3d4de3 - chore: log bun toolchain gap in TODOS, sync local settings permissions (Chris Sorensen)

## Version 2.2.3
Date: 2026-07-16

### Changes
- 877de43 - fix(kb-sync-nightly): restore missing execSync import, annotate suppressions (Chris Sorensen)
- ece5b53 - chore: add TODOS.md backlog file (Chris Sorensen)

## Version 2.2.2
Date: 2026-07-15

### Changes
- 275acae - chore: stop tracking .obsidian/workspace.json (UI-state churn, never meaningfully reviewed) (Chris Sorensen)

## Version 2.2.1
Date: 2026-07-15

### Changes
- 663b5e0 - fix(kb-sync-nightly): replace execSync git-root lookup with fs-based walk (Chris Sorensen)
- 82932f1 - chore: bump CIC submodule (work-summarizer automation wiring) (Chris Sorensen)

## Version 2.2.0
Date: 2026-07-15

### Changes
- c9f070f - fix: scope pre-push auditor to skills/utilities, fix stdout encoding crash (Chris Sorensen)
- caeb21c - fix: repair broken git hooks, consolidate skill-security-auditor, kb-sync cleanup (Chris Sorensen)
- 59ba62c - feat(post-seal): implement sealed ops workflows (Chris Sorensen)

## Version 2.1.0
Date: 2026-07-15

### Changes
- 1912907 - chore(security): add .gitattributes to allowed dotfiles list (Chris Sorensen)
- c65a838 - chore(security): whitelist child_process imports & ignore tests (Chris Sorensen)
- 81a5eac - fix(security): change auditor output to safe ASCII (Chris Sorensen)
- e631932 - perf(security): optimize auditor directory walking (Chris Sorensen)
- bbde733 - feat(security): integrate skill-security-auditor & standard categories (Chris Sorensen)
- a80a5fc - chore: cleanup test databases (Chris Sorensen)
- c774706 - feat: finalize Phase 2b - API harness + full test suite (7/11 api, 5/5 db, 4/4 telemetry PASS) (Chris Sorensen)
- 7098e9f - fix: Phase 2b Step 2 post-review FLAG remediation (4 fixes) (Chris Sorensen)
- dccec71 - test: Step 1-2 automated test suite (database, telemetry, API endpoints) (Chris Sorensen)
- 1a7df59 - fix: rebind API from port 3000 to 3001 (port 3000 contended by Python process) (Chris Sorensen)
- 9ae0fc8 - feat: Phase 2b Step 4 - status badge endpoints + Dashboard Badges tab (Chris Sorensen)
- 7d2ba9f - feat: Phase 2b Step 3 - semver automation + release workflow (Chris Sorensen)
- d6fa1b1 - feat(phase2b-step2): add G6 Errors tab JS module + wiring (Chris Sorensen)
- 41af61e - feat(phase2b-step2): add G5 Errors tab markup (Chris Sorensen)
- cdbc31c - feat(phase2b-step2): add G4 Errors tab CSS + severity ramp (Chris Sorensen)
- a5e203b - feat(phase2b-step2): add G3 errors/taxonomy/alerts routes + alert engine (Chris Sorensen)
- a86e25f - feat(phase2b-step2): add G2 error taxonomy + errors table writes (Chris Sorensen)
- a961cb0 - feat(phase2b-step2): add G1 alert-thresholds.json config (Chris Sorensen)
- 8fb856e - fix: CORS origin check must accept literal string 'null' for file:// (Chris Sorensen)
- fc4195e - feat: Phase 2b Step 1 F7/F8/F9 - Dashboard v2 Execution History tab (Chris Sorensen)
- 8a8f2c5 - feat: Phase 2b Step 1 F4/F5/F6 - Express telemetry read API (Chris Sorensen)
- 5eb2aab - fix: add YAML frontmatter to obsidian-ingest-wiki SKILL.md (Chris Sorensen)
- 3dcb854 - add: obsidian-ingest-wiki SKILL.md + INTEGRATION_DIAGRAM.md (Chris Sorensen)
- 70c24fd - feat: Phase 2b Step 1 F1/F2 - run-store.db schema + init script (Chris Sorensen)
- 0d65f86 - fix: Remove duplicate export in pre-wrap-audit (Chris Sorensen)
- 21c3632 - feat: Phase 3.B Cowork Gateway integration + mock server + real tests (Chris Sorensen)
- a13d959 - Phase 3.B Cowork Gateway Mock Integration — Complete (Chris Sorensen)
- 2db520d - Phase 3.B: Distributed sync pipeline + CI/CD wiring (Chris Sorensen)
- 3fe64f0 - Phase 3.A: Complete Cowork Gateway scaffolding (Chris Sorensen)
- 0dfd6f0 - Auto-checkpoint: Phase C governance wrap (Chris Sorensen)
- d921246 - feat(dashboard): add invocation + exports metadata to skill cards (Chris Sorensen)
- 6750f1f - docs: backfill CHANGELOG to v2.0.0 (198 commits since last update) (Chris Sorensen)
- 25a9b45 - feat(chat-agent): quality-metrics-driven model selection pipeline (Chris Sorensen)
- f815ca2 - feat: seal CIC governance runtime (Chris Sorensen)
- 8fc6911 - feat(wave-d): trending scheduler, E2E scenarios, load harness (code-level) (Chris Sorensen)
- 087d08e - feat(wave-c): ratings, trending, related skills, categories + semver fixes (Chris Sorensen)
- 9572e67 - feat(governance): close Gate-02 (Chris Sorensen)
- f3a9abb - fix(ui): uppercase button labels and back button symbol (Chris Sorensen)
- f1351bf - refactor(ui): align CSS with Cast Iron Charlie reference design (Chris Sorensen)
- 69c8e98 - fix(ui): category button active state and uppercase labels (Chris Sorensen)
- 3933791 - feat(governance): ratify gates 01 and 04 (Chris Sorensen)
- 3e61a6f - refactor(ui): dark theme for Cast Iron Charlie marketplace SPA (Chris Sorensen)
- e3dce5f - refactor(ui): apply Cast Iron Charlie design system to marketplace SPA (Chris Sorensen)
- db5c10e - fix(vite): correct script src path relative to root directory (Chris Sorensen)
- b958a23 - fix(vite): set root to src/ui for index.html resolution (Chris Sorensen)
- e398e6e - feat(wave-b-2): CLI integration (install, list, search commands) (Chris Sorensen)
- 192af8b - feat(wave-b-1): marketplace react spa + vite build (Chris Sorensen)
- cd77e6e - feat(wave-a-5): GATE-04 fairness stress test (concurrent writes validation) (Chris Sorensen)
- c3b42b9 - feat(wave-a-4): analytics ingestion service (install logging + trending metrics) (Chris Sorensen)
- 6c02947 - feat(wave-a-3): manifest validator + semver resolver (Chris Sorensen)
- cc5fc01 - feat(wave-a-2): REST API v1 endpoints (5 GET routes) (Chris Sorensen)
- 0cac857 - feat(wave-a-1): marketplace database schema + migrations (Chris Sorensen)
- 64bcabc - docs(phase-9): tier 1 approval signed off (Chris Sorensen)
- 354cb6f - docs(phase-9): team onboarding checklist + success criteria (Chris Sorensen)
- ede9903 - docs(phase-9): marketplace ui + discovery api charter (Chris Sorensen)
- e270eaa - docs(phase-8): add gate sign-off documentation (Chris Sorensen)
- 6dcdccc - fix(toolforge): integration test PowerShell syntax fixes (Chris Sorensen)
- ef1e39b - docs(toolforge): Wave D completion report (58/58 criteria, 5/5 integration tests) (Chris Sorensen)
- bad75bc - test(toolforge): Integration test suite (5/5 scenarios pass) (Chris Sorensen)
- e10dc00 - feat(toolforge): Deliverable 4 - Submission Validator (15/15 criteria) (Chris Sorensen)
- 9e1bb4b - feat(phase-8): Deliverable 3 - CLI (list, install, submit) (Chris Sorensen)
- 9a1fc13 - feat(phase-8): Deliverable 2 - Registry Service (Chris Sorensen)
- fecb92e - feat(phase-8): Deliverable 1 - Plugin Manifest Schema (Chris Sorensen)
- 80f2226 - feat(governance): add Toolforge Marketplace v1.0 specification and Phase 8 Wave D deliverables (Chris Sorensen)
- 13d40b9 - feat(governance): add CIC gate controls (Chris Sorensen)
- 825bdd4 - fix: correct governance claims and establish memory system (Chris Sorensen)
- 0c2a00f - chore: update session state and settings (2026-07-13) (Chris Sorensen)
- ca5933f - chore: exclude generated/lockfiles from linguist metrics (Chris Sorensen)
- 11acfa7 - fix: resolve high-effort code review findings (Chris Sorensen)
- ef2cc67 - chore: add 3 productivity habits + 3 improvements to CLAUDE.md (Chris Sorensen)
- 8f21221 - chore: add 3 productivity habits + 3 improvements to CLAUDE.md (Chris Sorensen)
- dc5c086 - chore: NodeNext tsconfig fixes + retro snapshot baseline (Chris Sorensen)
- d1b26d2 - fix: operator-image-build test + final Wave C validation (Chris Sorensen)
- bbf82f3 - fix: complete Wave C skill tests + resolve import/export conflicts (Chris Sorensen)
- 81497b6 - chore: rewrite governance rules as principle-driven (v2.0) (Chris Sorensen)
- 5197099 - fix: Wave C test runner issues and imports (Chris Sorensen)
- b5d9ff7 - chore: add Wave C skill configs (jest, tsconfig, package.json) + test scaffolds (Chris Sorensen)
- d3986de - docs: add embedded workflow checklists for drift prevention (DRIFT remediation) (Chris Sorensen)
- 59fd8c2 - docs: clarify skill vs project tool governance (DRIFT-2026-07-11-005 fix) (Chris Sorensen)
- b4a6e52 - chore: remove unused Tiny app and handoff documentation (Chris Sorensen)
- d7e581e - test: fix Wave C test imports and scaffolds (T9-T12) (Chris Sorensen)
- 29dbd9e - chore: add Wave C skill configs (jest, tsconfig, package.json) (Chris Sorensen)
- 6c7b6c6 - chore: add Wave B npm package-lock.json files (Chris Sorensen)
- a90ebc6 - chore: add Wave B skill configs (package.json, jest.config.js, tsconfig.json) (Chris Sorensen)
- 5ec5ef9 - test: Wave B test scaffolds — context-manager, cic-roadmap-updater, reconcile-vector-store, kb-sync-artifact-generator (Chris Sorensen)
- 88df111 - chore: update tool-lifecycle-manager scaffold to match Wave A test contract (Chris Sorensen)
- 2614810 - docs: Phase 2b Step 2 review verdict updated (CONDITIONAL → PASS) (Chris Sorensen)
- 9a9edc0 - test(skills): add regression suite for tool-lifecycle-manager (Chris Sorensen)
- e637ea3 - test(skills): add regression suite for permission-governor (Chris Sorensen)
- 3b01b40 - test(skills): add regression suite for rewrite-labs-orchestrator (Chris Sorensen)
- d033e30 - test(skills): add regression suite for rollback-phase (Chris Sorensen)
- 5d2f8ac - test(skills): add regression suite for scale-ingestion-service (Chris Sorensen)
- 2c5dae9 - docs: skill regression test backfill charter (Option B approved, Wave A dispatched 2026-07-12) (Chris Sorensen)
- 819cddd - fix: add null-guards for task properties in dashboard and copilot (Chris Sorensen)
- 516e7ae - docs: Toolforge Phase 2b Step 2 architecture design (Chris Sorensen)
- 72c81bc - docs: Toolforge Phase 2b Step 1 architecture design (Chris Sorensen)
- d85ba72 - docs: Toolforge Phase 2b implementation plan — detailed step-by-step specification (Chris Sorensen)
- 385d57e - doc: Phase 7 snapshot-capture pre-condition verification test (Chris Sorensen)
- 4724724 - chore: Toolforge Phase 2b charter — Dashboard v2, Execution History & Release Automation (Chris Sorensen)
- ddf0f3f - fix: Enhanced Windows Task Scheduler parser with triggers, actions, retry logic (Chris Sorensen)
- a008d6a - phase5: Exit complete — 7 builders, 76/25 tests PASS, Phase 6 ready (Chris Sorensen)
- aa5028d - feat: Phase 5 A/B Testing E2E Component (Chris Sorensen)
- e9475d5 - chore: add claude config, github workflows, ijfw layout, governance docs (Chris Sorensen)
- a090af6 - chore: ignore untracked project directories and build artifacts (Chris Sorensen)
- 8326c6a - plan: Phase 5 reuse claims corrected (65% not 95%) (Chris Sorensen)
- 4607bc7 - retrofit: Add Parallelism Matrix to Phase 4 charter (section 4.4) (Chris Sorensen)
- 92a60d1 - charter: Phase 7 Rollback Config + Feature Flag Validation (Chris Sorensen)
- 4aa22dc - governance: activate enforcement for 5 improvements (Phase 0, Audit-First, Data Contracts, Parallelism, Observability) (Chris Sorensen)
- e375a7d - deploy: Agent integration guide for ijfw v1.5 (Phase 0 + Audit-First + Data Contract + Parallelism + Observability) (Chris Sorensen)
- 2997425 - charter: Phase 6 Parallelism Matrix retrofit (ijfw-verify PASS) (Chris Sorensen)
- 9e6849b - charter: Phase 5 Parallelism Matrix retrofit (ijfw-verify PASS) (Chris Sorensen)
- 05735fd - charter: Phase 3 Parallelism Matrix retrofit (ijfw-verify PASS) (Chris Sorensen)
- 9d81801 - governance: adopt 5 process improvements into global rules v1.5 (Chris Sorensen)
- cb50edf - docs: TIER1_APPROVAL package reconciliation (status/caveat/citations fixed) (Chris Sorensen)
- 0de7f52 - docs: Phase 0 Pattern Research Gate — governance mandate + ijfw integration (Chris Sorensen)
- 9fdefe3 - docs: Tier 1 approval for Phase 3–6 charters (120/120 tests PASS) (Chris Sorensen)
- b90a015 - docs: Phase 6 scope charter (rollback execution engine) (Chris Sorensen)
- ca00fa6 - docs: Phase 5 scope charter (multi-cohort canary + A/B testing) (Chris Sorensen)
- 2857b89 - docs: Phase 4 Governance charter (scope locked, 67/67 tests PASS end-to-end) (Chris Sorensen)
- 25e2271 - docs: Phase 3 Cowork Gateway charter (scope locked, tests 49/49 PASS) (Chris Sorensen)
- 3ea747c - feat(phase4): add load test harness for cowork gateway hardening (Chris Sorensen)
- 982af81 - docs: Phase 3.C Kickoff Charter + Cowork mock API specification (Chris Sorensen)
- f63038b - chore: Phase 2.B scope charter + audit results (TIER1_APPROVED_DEFER) (Chris Sorensen)
- b481d23 - chore: update auto-sync and validator reports (Chris Sorensen)
- ba3835a - docs: add compliance files for html-visual-verify and update validation reports (Chris Sorensen)
- 07be220 - feat(skills): update ashfall category to automation and sync (Chris Sorensen)
- bc14b69 - feat(skills): update generated metadata and sync reports (Chris Sorensen)
- a8fc990 - feat(skills): migrate and validate 7 mystery skills (Chris Sorensen)
- 57b9517 - feat(skills): scaffold docs/ and tests/ for Rule 2 compliance; archive kb-sync workspace (Chris Sorensen)
- 38718ae - fix: Add missing 'name' field to SKILL.md frontmatter (Chris Sorensen)
- ab49659 - feat: Add SKILL.md frontmatter validation + timestamp fixes (Chris Sorensen)
- 9438122 - chore(manifest): Update timestamps after Cowork integration (Chris Sorensen)
- 1748a7b - feat(skills): Add Cowork plugin integration + description tooltips (Chris Sorensen)
- e4e78a4 - fix(toolforge): Resolve skill health check warnings — manifest + audit log (Chris Sorensen)
- 45e9ed3 - docs(pre-wrap-audit): operator runbook + harness implementation guide (Chris Sorensen)
- 746d3c2 - feat(pre-wrap-audit): 12-point blind-spot audit + ASHFALL integration (Chris Sorensen)
- cee1c5b - fix: ashfall code review findings (Chris Sorensen)
- ec0ac63 - feat: register ashfall skill v1.0.0 in cowork validator (Chris Sorensen)
- ec8e429 - docs: add environment timeout troubleshooting to USAGE.md (Chris Sorensen)
- 6bb96ef - feat: operator-image-build skill v1.0 - deterministic Docker build automation (Chris Sorensen)
- 297e3ff - chore: regenerate skillpack metadata after conformance sweep (Chris Sorensen)
- 4d45dda - feat: wire Ollama HTTP client for local LLM reasoning (Chris Sorensen)
- 7f3efe3 - feat: add pluggable reasoning provider layer (Claude, Ollama) (Chris Sorensen)
- 952a3da - docs: Update REVIEW.md — BLOCK findings resolved (Chris Sorensen)
- 8821594 - fix: Work Summarizer v4.0 BLOCK findings (Chris Sorensen)
- 8460481 - feat: Work Summarizer v4.0 with LLM reasoning synthesis (Chris Sorensen)
- 7137b52 - fix: critical schema_version + repo_deltas duplication bugs (Chris Sorensen)
- 80c246b - feat: work-summarizer v2→v3 Stage 1+2 migration (Chris Sorensen)
- ed042da - Resync: distributed Toolforge fully synced with canonical (v1.1.0) (Chris Sorensen)

## 2.0.0 - Governance rewrite, skill migration, Toolforge Marketplace, Phase 9 waves

- Rewrote governance rules as principle-driven v2.0 (5 principles, 3-tier authority, 3-class taxonomy, conformance gate) — 359→158 lines
- Migrated and validated 7 "mystery" skills; scaffolded docs/tests for Rule 2 compliance across skill set
- Added regression test suites for scale-ingestion-service, rollback-phase, rewrite-labs-orchestrator, permission-governor, tool-lifecycle-manager
- Added Wave A/B/C skill configs (jest, tsconfig, package.json) + test scaffolds; resolved import/export conflicts
- Added Cowork plugin integration, SKILL.md frontmatter validation, manifest health-check fixes
- Shipped Toolforge Marketplace (Phase 8 Wave D): plugin manifest schema, registry service, CLI (list/install/submit), submission validator — 58/58 criteria, 5/5 integration tests
- Locked Phase 9 charter (Marketplace UI + Discovery API); shipped Wave A (DB schema, REST v1 endpoints, manifest validator/semver resolver, analytics ingestion, fairness stress test), Wave B (React SPA + Vite build, CLI integration, Cast Iron Charlie design system), Wave C (ratings, trending, related skills, categories), Wave D (trending scheduler, E2E scenarios, load harness — code-level only, pending live PG validation)
- Added pluggable reasoning provider layer for Work Summarizer (Claude, Ollama); migrated Work Summarizer v2→v4 with LLM reasoning synthesis
- Added ASHFALL pre-wrap-audit (12-point blind-spot audit) integration
- Added operator-image-build skill v1.0 (deterministic Docker build automation)
- Added chat-agent quality-metrics-driven model selection pipeline
- Fixed critical schema_version + repo_deltas duplication bugs
- Established memory system; embedded workflow checklists for drift prevention (DRIFT-2026-07-11-005 and related fixes)

---

## 1.1.0 - Tools + comprehensive documentation

- Added `OPERATOR_GUIDE.md` and `TOOL_CREATION_GUIDE.md` for operational reference
- Added sync-tools category with `multiRepoRoadmapSync` drift detector + roadmap updater
- Added utilities with `setupTaskScheduler` for Windows Task Scheduler registration
- Added `scan-ownership.ps1` for tool ownership verification
- Updated `run-tool.ps1` with extended tool discovery and execution logic
- Updated manifest with extended metadata schema (schedule, lastRun, version tracking)
- Updated GOVERNANCE.md with comprehensive tool lifecycle rules
- Updated ROADMAP.md with Phase 1 completion + Phase 2-4 timeline

---

## 1.0.0 - Initial platform scaffolding
