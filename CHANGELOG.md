# Changelog

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
