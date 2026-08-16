# Memory Index

## Phase 1, 2 & 3 Architectural Contracts (MAAL Foundation + SPL/RL + Integration)

- [Phase 1 PR Template](phase-1-pr-template.md) — strict validation; file contract enforcement; review gates; veto conditions
- Phase 1 File Contract (locked, immutable) — 4 sections: MAAL Core, Ledger Substrate, PostgreSQL schemas, BridgeOrchestrator integration
- [Phase 1 Implementation Order (Fixed)](phase-1-implementation-order-fixed.md) — 12 steps w/ explicit interface signatures Steps 6-11; ready
- [Phase 2 Simulation Harness Contract](phase-2-simulation-harness-contract.md) — Immutable; 14 sections: state/action/reward, policy learner, simulator, training loop, telemetry schemas, integration, no phase bleed, freeze v0.2.0-spl-rl-foundation
- [Phase 3 Integration Contract](phase-3-integration-contract.md) — Immutable; SPL never bypasses MAAL; 11 sections: scope, shadow mode, A/B testing, holdout validation, MAAL-aware suggestions, policy promotion (governance-gated), rollback rules, data flows, integration checkpoints, 20 test contracts, freeze v0.3.0-spl-integration-foundation
- Phase 3 File Contract (locked) — 6 components: ShadowRoutingMonitor, SuggestionBridge, CohortAssigner, ABTestRecorder, PolicyPromotionEvaluator, RollbackMonitor; 3 telemetry writers; 3 SQL schemas; 2 BridgeOrchestrator hooks
- Phase 3 Implementation Order (11 steps) — Scaffold → schemas → shadow mode → B.O. integration → A/B framework → promotion evaluator → rollback monitor → governance wiring → config flags → 20 tests → freeze v0.3.0-spl-integration-foundation
- [Phase 3 Tests](phase-3-tests.md) — 20 test contracts; shadow isolation (3), A/B testing (4), promotion (3), rollback (4), integration (4), E2E + freeze (2); 100% pass gate
- [Phase 3 Completion](phase-3-completion.md) — 30 files delivered, 20 tests pass, v0.3.0-spl-integration-foundation frozen, commit b5ef6f3
- [Governance Playbook](governance-playbook.md) — Runbooks; roles (reviewer, ops owner, ML owner); promotion (5 steps), rollback (6 steps); no auto-promotion, no silent rollback; weekly review, monthly arch review, release gates
- [Phase 4 Complete Spec](phase-4-complete-spec.md) — MAAL–SPL co-design + canary-gated evolution; contract + impl order + tests + playbook + CI gate + lint + directory tree; v0.4.0-maal-codesign-canary-foundation; ready

## Current Session — Roadmap Sync Daemon + Skill Wave (2026-06-28)

- [Roadmap Sync Daemon Setup](roadmap-sync-daemon-setup.md) — Multi-repo drift detector; daily 09:00 UTC; Windows Task Scheduler + Slack; registry + TypeScript scanner + setup guide ✅
  - Registry: `C:\dev\repo-registry.json` (7 repos)
  - Scanner: `C:\dev\tools\multiRepoRoadmapSync.ts` (drift detection + doc updates)
  - Scheduler: `C:\dev\tools\setup-task-scheduler.ps1` (Task Scheduler registration)
  - Guide: `C:\dev\tools\ROADMAP-SYNC-SETUP.md` (complete setup + troubleshooting)

## Prior Session — Skill Deployment Wave Complete (2026-06-27) ✅ WRAP

- [Session Summary — Skill Wave Complete](session-2026-06-27-skill-wave-complete.md) — All deliverables, operator artifacts, next steps for Phase 1.6 MAAL Router ✅
- [Skill Automation Schedule](skill-automation-schedule.md) — 11/11 skills; 6 auto (dev/daily/weekly), 5 manual; $1.24/month ✅
- [LOW Priority Skills Tested](low-priority-skills-tested.md) — 4/4 PASS: cost-optimizer-tuner, governance-playbook-automator, skill-health-monitor, retrospective-analyzer ✅
- [MEDIUM Priority Skills Deployed](medium-priority-skills-deployed.md) — 4/4 tested: mee-finding-assessor, phase-validator, helm-daily-brief, idea-inbox-harvester ✅
- **Wave Summary:** HIGH 3/3, MEDIUM 4/4, LOW 4/4 = **11/11 COMPLETE** ✅

## Prior Session — Cost System Integration & Dashboard (2026-06-27)

- [Step 5: Mount CostComputePanel Complete](step-5-mount-complete.md) — Panel wired into ConsoleV3 as Tier 1.5; keyboard nav + polling; APIs wired ✅
- [Step 4: Slack/Email Notifications Complete](step-4-notifications-complete.md) — CostNotifier module + cron integration; Slack + Email (SMTP + fallback); all compile ✅
- [Cost System Migration Complete](cost-system-migration-complete.md) — Moved 18 files from orphaned cic-ingestion to root src/; build fixed (124 errors, 0 cost-related); all modules compile
  - 8 core libs (cost, usage, report, charts, skills)
  - 2 autonomy routers (AutonomyAPIServer, routes)
  - 2 routing modules + tests
  - 1 React dashboard component
  - Fixed: stress-determinism syntax, component Props exports, import paths, puppeteer suppression

- [Phase 4 CI Gate + Migration Complete](phase-4-ci-gate-migration-complete.md) — 10-rule CI gate + 3-phase migration (shadow → canary → full); ready for Phase A activation
  - CI gate: Phase4CIGate.ts (10 hard-fail rules)
  - Verification: phase4-ci-gate-verification.test.ts (27 tests, intentional violations)
  - Migration config: phase4-migration-config.json (shadow/canary/full modes)
  - Runbook: PHASE4-MIGRATION-RUNBOOK.md (Pre-A checklist → Phase B → Phase C → rollback)
  - Reference: PHASE4-CI-GATE-README.md (quick guide + troubleshooting)
  - Status: ✅ READY FOR PHASE A ACTIVATION

- [Phase 4 E2E Integration Complete](phase-4-e2e-complete.md) — 8 E2E tests PASS; full workflow tested; 37/37 Phase 4 PASS; commit 240372f
  - E2E-1: Happy path (regime proposal → canary growth → promotion)
  - E2E-2: Hard rollback (correctness violation)
  - E2E-3: Soft pause (latency threshold)
  - E2E-4: Concurrent proposals (isolation)
  - E2E-5: Governance approval workflow
  - E2E-6: Rollback state machine (atomic, idempotent)
  - E2E-7: Auto-promotion (minor deltas)
  - E2E-8: Complete data flow (all logs)
  - Status: ✅ PASS (8 E2E + 29 unit + 2 immutability)

## Prior Sessions — E-Phase: SLO Enforcement (2026-06-26)

- [E-Phase Enforcement Complete](phase-e-enforcement-complete.md) — SLO enforcement → Phase-5 canary; 31/34 PASS; burn-rate done
- [D-Phase CIC Integration Complete](phase-d-integration-complete.md) — AutonomyAPIServer wired; 5/5 E2E PASS; production-ready
- [D-Phase Code Review Complete](phase-d-code-review-complete.md) — 6 findings fixed; 16/16 PASS (7+9); commit 9cea9ed

## Active Phase Work (2026-06-25)

- [Phase 3.6 Mount + Wiring](phase-3-6-mount-wiring.md) — TorqueQuery /console/* + useConsoleAPI wired; test script + docs; f2423a0, 2506ca5; Storybook ready
- [Agent Panel Backend Complete](agent-panel-backend-complete.md) — Agents API (port 3118) + 9 endpoints; mock data; frontend wired; 92a2a88; ready E2E
- [Tier 1 Dark Mode Complete](tier-1-dark-mode-complete.md) — 123/123 PASS, 52 snapshots (light+dark), zero drift; eb1027b
- [Phase 8 Cost Optimization](phase-8-cost-optimization-locked.md) — Dynamic model selection; 10 files, 11 Prometheus metrics, 5 audit types; ready
- [Phase 7 Autonomous Self-Healing](phase-7-autonomous-hardening.md) — 10 files; 6-state machine, drift detection, SLA enforcement; integration ready

## Prior Sessions — Recent Delivery (2026-06-20 to 2026-06-23)

- [M2 Execution Framework](m2-execution-framework-complete.md) — Canary gates + fire drills; target 2026-06-22 18:00 UTC
- [Phase 5 Production Hardening](phase-5-production-hardening.md) — 48/48 PASS; error taxonomy, timeouts, budget, telemetry; d3cb478
- [Phase 27.2 Output Validation](phase-27-2-output-validation-complete.md) — 607/638 PASS; Envelope + schemas + 5 adapters; c608c1f
- [CIC Runtime v0.2 Validation](cic-runtime-v0-2-validation-complete.md) — E2E; manifest loading + migrations + webhook signature verification; 1d1ed87
- [Console v3 Dashboard Layout](console-v3-dashboard-layout-complete.md) — 6-panel dashboard; localhost:5174; e119a7f
- [Repo Sweep: Phase 4](phase-repo-sweep-complete.md) — 22 services; single `docker-compose up`; 2f1d1e1
- [Guardrail Scripts Installed](guardrail-scripts-installed-2026-06-19.md) — Pre-commit hook active; 6 blocking rules
- [ESM Import Fix](session-esm-fix-2026-06-19-summary.md) — 51 TS files fixed; PORT 3116→3000; container live; 8ee327f

## Personal Skills (Installed ~/.claude/skills)

- [Cost Notifier Setup](cost-notifier-setup.md) — Configure Slack webhook + SMTP email digests; test CLI; cron integration ✅ (2026-06-27)
- [Cost Panel Console Mounting](cost-panel-console-mounting.md) — forwardRef accessibility pattern for dashboard panels; keyboard nav + ARIA ✅ (2026-06-27)
- [Deploy-Review Skill](deploy-review-skill.md) — 5-phase verify (preflight, startup, tests, E2E, risk); ~90s full stack
- [Phase-Milestone-Commit](skills/phase-milestone-commit.md) — Phase X → M# atomic + memory closure
- [Code-Review-Fix-All Gate](skills/code-review-fix-all-gate.md) — Blocks ship w/ known bugs; fix→verify→gate
- [Observability-SLO Pattern](skills/observability-slo-pattern.md) — Prometheus + Grafana + burn-rate SLOs as standard infra

## Feedback & Preferences

- [CAVEMAN MODE ACTIVE](caveman-mode.md) — Full: drop articles, filler, pleasantries, hedging; fragments OK; code/commits normal
- [Instruction Format](instruction-format-preference.md) — Always include full directory paths; `cd <path>` at start of sequences
- [Pre-commit Hook — /shared Exemption](pre-commit-hook-shared-exemption.md) — Logger + infra use console OK; regex `/shared/`
- [Docker on Windows: PowerShell](feedback_docker_wsL_approach.md) — PowerShell direct, not WSL bash (socket issues)
- [Token Monitoring](token_monitoring_preference.md) — Monitor context; /compact at limits
- [Full File Paths](user_preferences.md) — Absolute paths only; no relative

## Infrastructure & Architecture

- [Operator-Grade Image Builder](operator-grade-image-builder-system.md) — v1.0.0; manifest + parallel builder + drift detector; 18 services
- [30-Day Skill Audit](session-2026-06-21-30day-skill-audit.md) — Weekly automation ready; 3 new skills
- [Bootstrap Orchestrator](bootstrap-orchestrator-complete.md) — Multi-repo GitHub automation; 12/14 repos configured; snapshot rollback

## Prior Sessions — Phase Completions (Historical)

- [Phase 24 Governance](phase-24-governance-complete.md) — Council + vault + memory; 10 files, 928 LOC; 13/13 PASS
- [Phase 26 TorqueQuery](phase-26-torquequery-complete.md) — SQLite memory indexing; 10 files, 1100 LOC, 12 tests; 75e1556
- [Phases 23–27 Autonomy Stack](phases-23-27-autonomy-stack.md) — 5-phase minimum viable autonomy
- [Phase 0.9 TheFoundry](phase-0-9-thefoundry.md) — Deterministic Docker build; sealed, reproducible, CI-ready
- [Skills Policy Agent](skills-policy-agent-requirement.md) — Enforce shared library adoption w/ exception mechanism
- [Cybersecurity Skills Integration](cybersecurity-skills-integration.md) — 754-skill Anthropic repo → CIC extractor, Qdrant schema
- [Permission Audit Skill](permission-audit-skill.md) — Global; scans transcripts, updates allowlist

## Master Reference

- [CIC Master Roadmap](master-roadmap-location.md) — CIC_MASTER_ROADMAP.md single source of truth
- [Approval Infrastructure](approval-infrastructure-location.md) — Tool permissions, policy validation records
