# Skill Regression Test Backfill Charter

**Phase:** Phase 8 Pre-Gate (Option B - Comprehensive)  
**Scope:** 18 untested skills → full regression test coverage  
**Duration:** ~2 weeks (14 calendar days)  
**Start:** 2026-07-12  
**Target Completion:** 2026-07-26 (Phase 8 entry gate)  
**Deliverable:** All 18 skills pass regression test suite (min 80% coverage per skill)

---

## Executive Summary

Phase 8 entry requires skill ecosystem reliability. Current state: 18/23 custom skills (78%) lack regression tests. Risk: rollback/orchestration failures cascade undetected. **Decision:** Implement comprehensive backfill (Option B) to gate Phase 8 entry on full coverage.

**Constraint:** 2-week window → parallel dispatch required (4-5 wave builders, 3 skills per builder).

---

## Skill Inventory & Categorization

### Category A: Pipeline Orchestration (5 skills) — CRITICAL PATH
Must test orchestration, state transitions, error recovery.

| Skill | Purpose | Risk Level | Test Complexity |
|-------|---------|-----------|-----------------|
| rollback-phase | Revert CIC to checkpoint | CRITICAL | High (state mgmt, rollback semantics) |
| rewrite-labs-orchestrator | Multi-stage pipeline coord | CRITICAL | High (stage progression, blocker handling) |
| scale-ingestion-service | Ingest scaling orchestration | HIGH | Medium (load scenarios, backpressure) |
| tool-lifecycle-manager | Skill lifecycle mgmt | HIGH | Medium (registration, distribution, deprecation) |
| permission-governor | Access control enforcement | HIGH | Medium (permission validation, audit) |

### Category B: Data/State Management (4 skills) — HIGH PRIORITY
Must test data integrity, recovery, consistency.

| Skill | Purpose | Risk Level | Test Complexity |
|-------|---------|-----------|-----------------|
| context-manager | Session state persistence | HIGH | Medium (state serialization, recovery) |
| reconcile-vector-store | Vector DB consistency | MEDIUM | High (vector ops, embedding validation) |
| cic-roadmap-updater | Roadmap state sync | MEDIUM | Medium (CRUD, sync conflicts) |
| kb-sync-artifact-generator | Knowledge base generation | MEDIUM | Medium (artifact generation, versioning) |

### Category C: Support/Monitoring (5 skills) — MEDIUM PRIORITY
Must test instrumentation, diagnostics, health checks.

| Skill | Purpose | Risk Level | Test Complexity |
|-------|---------|-----------|-----------------|
| pre-wrap-audit | Pre-wrap validation (HAS TESTS: 2) | — | — |
| ashfall | Observability/drift detection (HAS TESTS: 1) | — | — |
| work-summarizer | Session work summary (HAS TESTS: 1) | — | — |
| toolforge-drift-monitor | Drift monitoring | LOW | Low (metrics, detection rules) |
| run-adapter-diagnostic | Adapter diagnostics | LOW | Low (diagnostic reporting) |
| html-visual-verify | Visual regression checking | LOW | Low (screenshot comparison, diffs) |
| agent-drift-detector | Agent behavior drift | LOW | Low (pattern matching, thresholds) |
| analyze-token-burn | Token usage analysis | LOW | Low (metrics calculation, forecasting) |
| kb-sync-nightly | Scheduled KB sync | LOW | Low (cron trigger, sync logic) |

### Category D: Integrations (4 skills) — MEDIUM PRIORITY
Must test external integration points, fallbacks.

| Skill | Purpose | Risk Level | Test Complexity |
|-------|---------|-----------|-----------------|
| cic-section-summarizer | Section summarization | MEDIUM | Medium (text processing, summaries) |
| plan-extractor-integration | Plan extraction from text | MEDIUM | Medium (NLP-lite, extraction accuracy) |
| operator-image-build | Docker image building | MEDIUM | High (Docker interaction, determinism) |

---

## Test Coverage Targets

**By Category:**
- **A (Pipeline):** 12-18 tests per skill; unit (state/logic) + integration (E2E workflow)
- **B (Data):** 10-15 tests per skill; data integrity scenarios + recovery paths
- **C (Support):** 6-10 tests per skill; metric/diagnostic accuracy
- **D (Integrations):** 8-12 tests per skill; happy path + error modes

**Overall Target:** 200+ new tests across 18 skills (avg 11 per skill)

---

## Parallel Builder Wave Plan

**Wave Structure:** 4 builders × 3-4 skills per builder = 14 days (with 3-day buffer)

### Wave A (Days 1–4): Category A Critical Path
- **Builder 1:** rollback-phase (18 tests) + tool-lifecycle-manager (12 tests)
- **Builder 2:** rewrite-labs-orchestrator (16 tests) + permission-governor (10 tests)
- **Builder 3:** scale-ingestion-service (12 tests)

### Wave B (Days 3–7): Category B Data/State (start day 3, parallel with Wave A tail)
- **Builder 4:** context-manager (13 tests) + cic-roadmap-updater (10 tests)
- **Builder 5:** reconcile-vector-store (14 tests) + kb-sync-artifact-generator (10 tests)

### Wave C (Days 7–11): Category C Support (start day 7)
- **Builder 6:** toolforge-drift-monitor (8 tests) + run-adapter-diagnostic (7 tests) + html-visual-verify (8 tests)
- **Builder 7:** agent-drift-detector (8 tests) + analyze-token-burn (7 tests) + kb-sync-nightly (8 tests)

### Wave D (Days 11–14): Category D Integrations (start day 11)
- **Builder 8:** cic-section-summarizer (11 tests) + plan-extractor-integration (11 tests) + operator-image-build (13 tests)

**Overlap by day:**
- Days 1–2: Wave A only (builders 1–3)
- Days 3–6: Wave A + B (builders 1–5)
- Days 7–10: Wave B + C (builders 4–7)
- Days 11–14: Wave C + D (builders 6–8)
- Days 14+: Merge + integration testing

---

## Test Template by Category

### Category A: Pipeline Orchestration

```typescript
// rollback-phase.test.ts
describe("Rollback Phase", () => {
  // Unit tests
  test("parses checkpoint manifest", () => { /* */ });
  test("validates rollback preconditions", () => { /* */ });
  test("generates rollback plan", () => { /* */ });
  test("handles missing checkpoint", () => { /* */ });
  
  // Integration tests
  test("E2E rollback Phase 5→4", () => { /* */ });
  test("recovers state after partial rollback", () => { /* */ });
  test("validates postconditions after rollback", () => { /* */ });
  test("audit trail records rollback reason", () => { /* */ });
});
```

### Category B: Data/State Management

```typescript
// context-manager.test.ts
describe("Context Manager", () => {
  // Serialization
  test("serializes session context to disk", () => { /* */ });
  test("deserializes context with integrity check", () => { /* */ });
  
  // Recovery
  test("recovers context after crash", () => { /* */ });
  test("handles corrupted state gracefully", () => { /* */ });
  
  // Consistency
  test("detects concurrent mutations", () => { /* */ });
  test("merges parallel updates", () => { /* */ });
});
```

### Category C: Support/Monitoring

```typescript
// toolforge-drift-monitor.test.ts
describe("Drift Monitor", () => {
  // Metric collection
  test("tracks drift metrics per phase", () => { /* */ });
  test("detects regression vs noise", () => { /* */ });
  
  // Alerting
  test("triggers alert on threshold breach", () => { /* */ });
  test("suppresses duplicate alerts", () => { /* */ });
});
```

### Category D: Integrations

```typescript
// operator-image-build.test.ts
describe("Image Builder", () => {
  // Build determinism
  test("produces identical image on rebuild", () => { /* */ });
  test("caches layers correctly", () => { /* */ });
  
  // Error handling
  test("rolls back on build failure", () => { /* */ });
  test("reports build diagnostics", () => { /* */ });
});
```

---

## Acceptance Criteria

✅ All 18 skills have test files under `tests/`  
✅ Minimum 8 tests per skill (low-risk) to 18 tests (critical)  
✅ 80%+ code coverage per skill (`npm test -- --coverage`)  
✅ All tests pass in isolation and in parallel  
✅ Pre-commit hook validates test structure (no skipped tests)  
✅ Each test has descriptive name + passes independently  
✅ No flaky tests (deterministic, isolated, <1s per test)  

---

## Success Metrics

- **Test Count:** 200+ new tests across 18 skills ✅
- **Pass Rate:** 100% ✅
- **Coverage:** 80%+ per skill ✅
- **Schedule:** Complete by 2026-07-26 ✅
- **Quality:** Zero flaky/skipped tests ✅

---

## Risk Mitigation

**Risk:** Tests take longer than 2 weeks  
→ **Mitigation:** Reduce coverage target to 70% for Category C+D; prioritize Category A+B critical path

**Risk:** Tests reveal missing implementations  
→ **Mitigation:** Lock test scope to existing behavior (no new features); file impl-gap issues separately

**Risk:** Integration between skills breaks  
→ **Mitigation:** Add 2-3 E2E cross-skill tests in final merge phase (days 13–14)

---

## Handoff Checklist

- [ ] All test files created + committed
- [ ] Pre-commit hook passing (80%+ coverage)
- [ ] E2E integration tests green
- [ ] Tier 1 approval for Phase 8 entry
- [ ] Skill ecosystem health check passed
