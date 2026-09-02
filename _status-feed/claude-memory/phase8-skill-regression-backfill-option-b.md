---
name: phase8-skill-regression-option-b-approved
description: "User approved comprehensive skill regression backfill (Option B). Charter created, 4-wave parallel dispatch plan locked, 200+ tests targeted by 2026-07-26."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2c047833-a9dd-49b9-9c7f-f6cbe419fbd3
---

## Decision: Option B Approved — Full Skill Regression Backfill

**Date:** 2026-07-12  
**Decision:** Implement comprehensive backfill (Option B) for Phase 8 entry gate  
**Scope:** 18 untested custom skills → 200+ tests across 4 parallel waves  
**Timeline:** 2026-07-12 to 2026-07-26 (14 calendar days)  
**Effort:** 4-8 builders, parallel dispatch  

**Why:** Rollback/orchestration untested = production risk unacceptable for Phase 8. Comprehensive backfill locks confidence for phase entry.

**How to apply:** Dispatch 8 builders (Wave A–D) per charter. Tests locked in `skills/*/tests/` directories. Pre-commit hook validates 80%+ coverage. Merge target: main (Phase 8 branch) 2026-07-26.

---

## Charter Committed

📄 **Location:** `C:\dev\docs\meta\skill-regression-backfill-charter.md`

**Sections:**
1. 18 skills categorized by risk (A: pipeline critical, B: data/state, C: support, D: integrations)
2. Test templates by category (orchestration, data recovery, monitoring, integration)
3. 4-wave parallel builder plan (Wave A: days 1–4, B: days 3–7, C: days 7–11, D: days 11–14)
4. Acceptance criteria (80%+ coverage, 0 flaky, 100% pass)
5. Risk mitigation (scope reduction, impl-gap filing, E2E cross-skill tests)

---

## Builder Dispatch Status

**Wave A (Category A: Pipeline Critical)** — START IMMEDIATELY
- Builder 1: rollback-phase (18 tests) + tool-lifecycle-manager (12 tests)
- Builder 2: rewrite-labs-orchestrator (16 tests) + permission-governor (10 tests)
- Builder 3: scale-ingestion-service (12 tests)

**Wave B (Category B: Data/State)** — START DAY 3
- Builder 4: context-manager (13 tests) + cic-roadmap-updater (10 tests)
- Builder 5: reconcile-vector-store (14 tests) + kb-sync-artifact-generator (10 tests)

**Wave C (Category C: Support)** — START DAY 7
- Builder 6: toolforge-drift-monitor (8 tests) + run-adapter-diagnostic (7 tests) + html-visual-verify (8 tests)
- Builder 7: agent-drift-detector (8 tests) + analyze-token-burn (7 tests) + kb-sync-nightly (8 tests)

**Wave D (Category D: Integrations)** — START DAY 11
- Builder 8: cic-section-summarizer (11 tests) + plan-extractor-integration (11 tests) + operator-image-build (13 tests)

---

## Success Metrics for Tier 1 Approval

✅ 200+ new tests (avg 11/skill)  
✅ 80%+ code coverage per skill  
✅ 100% test pass rate (no skipped/flaky)  
✅ E2E cross-skill integration tests green  
✅ Pre-commit hook + CI green  
✅ Charter items checked off  

---

## Phase 8 Entry Gate (2026-07-26)

- Tier 1 review skill regression results
- Approve Phase 8 entry IF: all metrics ✅
- Defer IF: coverage gaps or flaky tests
- Phase 8 launch contingent on this gate

---

## Metadata

- **Charter Created:** 2026-07-12
- **Approval:** User (Option B)
- **Dispatch Ready:** YES
- **Phase Gate:** Phase 8 entry (2026-07-26)
- **Tier 1 Review:** Post-completion
