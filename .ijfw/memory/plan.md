# Phase 7 Implementation Plan (Revised 2026-07-12)

**Status:** APPROVED, Wave A dispatched  
**Scope:** Extract Phase 5/6 test-only code to prod; implement Phase 7 config+flag rollback+health gate  
**Timeline:** 2026-07-19–2026-07-22 (4 days, 2 eng 100% FTE)  
**Tier 1 Gate:** Approved 2026-07-12 ✅

---

## Tasks (Dependency Order)

### Phase 1: Extract Test Code to Production (Days 1–2)

**T1: Extract Phase5SnapshotCapture to prod**
- Source: `src/tests/phase7-snapshot-capture-precondition.test.ts:26–72`
- Target: `src/governance/snapshot-capture.ts` (new)
- Deliverable: `Phase5SnapshotCapture` class with `capturePreDeploymentSnapshot()`, `hasSnapshot()`, `snapshotExists()` methods
- Success: Class compiles, interfaces match precondition test expectations

**T2: Wire Phase 5 snapshot capture into promotion engine**
- Target: `src/governance/multi-cohort-rollout-pipeline.ts` (modify)
- Deliverable: Call `Phase5SnapshotCapture.capturePreDeploymentSnapshot()` after variant promotion, before Phase 6 deploy
- Success: phase7-snapshot-capture-precondition tests PASS (18/18)
- Test count: 0 new tests (validated by precondition test)

**T3: Extract Phase 6 RollbackExecutor to prod**
- Source: `src/tests/phase6-rollback-execution-e2e.test.ts:233–409` (RollbackExecutor + dependencies)
- Target: `src/governance/rollback-executor.ts` (new)
- Deliverable: `RollbackExecutor`, `RollbackTargetDetector`, `StateStore`, `DatabaseRollback`, `CacheRollback` classes; replace mock config/flag branches with real composition points
- Success: Classes compile, E2E test still passes (26/26)

### Phase 2: Implement Phase 7 Core (Day 2–3)

**T4: Phase7ConfigRollback.ts — etcd integration**
- Target: `src/rollback/config-rollback.ts` (new)
- Deliverable: Class with `restoreConfigSnapshot(proposalId, variantId)` + `checkConfigConsistency()` (health check)
- Success: Restores config from etcd, checksum match, <1s latency
- Test count: 4 tests (capture, restore, consistency, failure)

**T5: Phase7FeatureFlagRollback.ts — Unleash integration**
- Target: `src/rollback/featureflag-rollback.ts` (new)
- Deliverable: Class with `restoreFeatureFlagSnapshot(proposalId, variantId)` + `checkFeatureFlagConsistency()` (health check)
- Success: Restores flags from Unleash, state match, <5s latency
- Test count: 4 tests (capture, restore, consistency, failure)

**T6: HealthCheckGate.ts — 5-layer validator**
- Target: `src/rollback/health-check-gate.ts` (new)
- Deliverable: Class with `validateRollback(proposalId, variantId, rollbackLog)` + 5 per-layer checks (state, DB, config, flags, lineage)
- Success: Blocks on any check failure, <10s total latency, detailed results returned
- Test count: 4 tests (pass path, per-layer failures, partial failures, recovery)

**T7: Compose Phase 7 into Phase 6 RollbackExecutor**
- Target: `src/governance/rollback-executor.ts` (modify from T3)
- Deliverable: Wire config → flags → health gate in topological order; remove mock branches; call Phase 7 classes
- Success: All rollback steps execute in correct order; health gate blocks on failure; no Phase 6 code modified
- Test count: 0 new tests (tested by E2E)

### Phase 3: E2E Tests (Day 3–4)

**T8: E2E: Config rollback — phase7-config-rollback-e2e.test.ts**
- Target: `src/tests/phase7-config-rollback-e2e.test.ts` (new)
- Deliverable: 12–16 tests (snapshot capture, restore path, consistency checks, failure modes)
- Success: All tests PASS; etcd mock working

**T9: E2E: Feature flag rollback — phase7-featureflag-rollback-e2e.test.ts**
- Target: `src/tests/phase7-featureflag-rollback-e2e.test.ts` (new)
- Deliverable: 12–16 tests (snapshot capture, restore path, consistency checks, failure modes)
- Success: All tests PASS; Unleash mock working

**T10: E2E: Health-check gate — phase7-health-check-gate-e2e.test.ts**
- Target: `src/tests/phase7-health-check-gate-e2e.test.ts` (new)
- Deliverable: 16–20 tests (pass path, per-layer failures, partial failures, recovery paths, latency gate)
- Success: All tests PASS; gate blocks correctly on any failure

**T11: Phase 7 integration E2E — full rollback cycle**
- Target: `src/tests/phase7-integration-e2e.test.ts` (new)
- Deliverable: End-to-end snapshot capture → deploy → health check → rollback → success flow (4 tests)
- Success: PASS; all 5 rollback layers verified; metrics exported

**T12: Ops runbook validation — docs/meta/ROLLBACK_RUNBOOK.md**
- Target: `docs/meta/ROLLBACK_RUNBOOK.md` (validate existing artifact)
- Deliverable: Manual procedures tested; all shell commands verified executable; troubleshooting paths walked
- Success: Runbook walkthrough PASS; no missing prerequisites or commands; escalation paths documented

---

## Test Summary
- Extraction + composition (T1–T7): 0 new tests (validated by existing tests)
- Config rollback (T4): 4 tests
- Flag rollback (T5): 4 tests
- Health gate (T6): 4 tests
- Config E2E (T8): 12–16 tests
- Flag E2E (T9): 12–16 tests
- Gate E2E (T10): 16–20 tests
- Integration E2E (T11): 4 tests
- Runbook (T12): 0 new tests
- **Total: 56–68 tests PASS**

---

## Phase 7 Exit Criteria
✅ 56–68 tests PASS  
✅ Composition-based architecture (Phase 6 unmodified)  
✅ Metrics exported (latency, pass/fail counters)  
✅ Ops runbook executable end-to-end  
✅ Phase 5 snapshots wired + Phase 6 composition wired  

---

## Dispatch Status
- **Wave A (T1–T3):** Extraction tasks — dispatched 2026-07-12, estimated 1 day
- **Wave B (T4–T7):** Implementation tasks — pending Wave A completion
- **Wave C (T8–T12):** E2E + validation — pending Wave B completion
