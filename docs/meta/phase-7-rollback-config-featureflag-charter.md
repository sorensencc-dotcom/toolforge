---
title: Phase 7 Sub-Charter — Config & Feature Flag Rollback Validation
date: 2026-07-11
status: DRAFT
decision: PENDING_TIER1_REVIEW
approved_date: null
critical_path: true
deadline: 2026-07-22
review_status: CONDITIONAL_PASS
review_date: 2026-07-11
review_document: phase-7-rollback-config-featureflag-charter-REVIEW.md
---

# Phase 7 Sub-Charter — Config & Feature Flag Rollback Validation

## Executive Summary

Phase 7 addresses Tier 1 conditional caveat from Phase 6: config and feature_flag rollback targets were mocked in the Phase 6 harness, not production-tested. Phase 7 sub-charter adds real-world config store rollback and feature flag toggle rollback, integrating with Phase 6's RollbackExecutor. Extends rollback scope from transactional state/db/cache (Phase 6) to configuration and feature management layers. Expected test coverage: 8–12 E2E tests validating config/FF rollback scenarios against real stores. Completes Phase 6 rollback validation end-to-end.

---

## Phase 6 Recap & Caveat

Phase 6 completed transactional rollback execution for failed promotions:
- **Phase 6 E2E Harness:** 26 tests PASS (state_store, database, cache rollback) ✅
- **Phase 6 Charter:** Scope locked; Tier 1 approved CONDITIONAL (2026-07-11) ✅
- **Phases 2–6 Tests:** 120/120 PASS (ingestion → enrichment → governance → rollout → rollback) ✅

**Caveat:** Config and feature_flag targets are **mocked** in Phase 6 harness, not production-tested.
- RollbackTargetDetector includes config/feature_flag types in detection
- Mock implementations return hardcoded success; do not touch real config stores or FF toggle services
- Production rollback against real config + FF targets deferred to Phase 7

**Tier 1 Decision (2026-07-11):** Phase 6 APPROVED_CONDITIONAL. Charter scope should be narrowed OR Phase 7 sub-charter added for real-config/feature_flag rollback validation. → **This charter addresses the latter.**

---

## Phase 7 Sub-Charter Scope

### 7.1 Real Config Store Rollback

**Entry Point:** Phase 6 rollback executor attempts config rollback with real store connection

**Processing Pipeline:**

1. Connect to production config store (e.g., etcd, Consul, or project-specific KV store)
2. Retrieve config revision history for rollback target
3. Validate target revision exists and differs from current state
4. Execute atomic config update (set config to previous revision)
5. Verify config store consistency (timeout, retry logic, fallback)
6. Log rollback action for audit trail
7. Provide recovery path if store unreachable

**Exit Point:** Config rollback result (success / timeout / version_not_found / store_unreachable)

**Rollback Targets:**
- Runtime config key/value pairs (no code redeploy required)
- Multi-region config consistency (if applicable to deployment)
- Rollback deadline (e.g., revert to config snapshot from 30 min pre-deployment)

### 7.2 Real Feature Flag Toggle Rollback

**Entry Point:** Phase 6 rollback executor attempts feature_flag rollback with real FF service

**Processing Pipeline:**

1. Connect to feature flag management service (e.g., LaunchDarkly, Unleash, or custom FF API)
2. Query current flag state + rollout rules
3. Retrieve previous flag state from audit log or version history
4. Execute flag state toggle (disable if enabled, restore rollout rules if modified)
5. Verify flag state propagated to all clients (eventual consistency check or hard requirement)
6. Log flag toggle for audit trail + compliance
7. Provide recovery path if service unreachable or flag state diverged

**Exit Point:** Feature flag rollback result (success / timeout / flag_not_found / service_unreachable / consistency_error)

**Rollback Targets:**
- Feature flag enable/disable state
- Rollout rule modifications (targeting, rollout %, holdout groups)
- Flag default value changes
- Rollback deadline (revert to flag state snapshot from 30 min pre-deployment)

### 7.3 Integration with Phase 6 RollbackExecutor

Phase 7 extends Phase 6's RollbackExecutor (src/rollback/executor.ts, Phase 6) to handle real config + feature_flag targets:

**Executor Responsibilities:**
- Call ConfigRollback for each config target in rollback plan
- Call FeatureFlagRollback for each feature_flag target
- Execute in correct dependency order (Phase 6 topological sort; verify Phase 6 topological sort handles config → FF ordering)
- Collect results + health checks from both new rollback engines
- Report partial failures if config rollback succeeds but FF rollback times out (vice versa)
- Log all actions in unified audit trail

**Dependency Handling:**
- Config rollback often precedes feature_flag rollback (config may enable/disable features)
- Topological sort respects inter-layer dependencies
- Cyclic dependencies detected + safely skipped (consistent with Phase 6)

**Health Checks Post-Rollback:**
- Verify config store reflects previous state (sample key/value pairs)
- Verify feature flag service responds + flags match expected state
- Timeout thresholds: 30s config store, 15s FF service (tunable)
- Retry logic for transient failures (exponential backoff)

### 7.4 Scope Locked

**In Scope:**
- Real config store rollback (store choice TBD: etcd, Consul, or project-specific store)
- Real feature flag service rollback (FF service TBD: LaunchDarkly, Unleash, or project-specific API)
- Integration with Phase 6 RollbackExecutor (no Phase 6 changes; extend via composition)
- E2E test harness (8–12 tests covering config/FF rollback scenarios)
- Audit trail logging (config + FF rollback actions)
- Timeout + retry logic for transient failures
- Health checks post-rollback (config + FF state verification)
- Partial failure handling (one succeeds, other fails)
- Recovery recommendations (human-readable next steps on failure)
- Phase 6→7 integration verification

**Out of Scope:**
- Automatic config/FF state capture at deployment time (pre-deployment responsibility, Phase 5 captures; Phase 7 entry gate will verify Phase 5 snapshot capture exists)
- Distributed config store coordination (multi-region, multi-DC consistency)
- Feature flag A/B test rollback (rollback restores flag state only, not cohort assignment)
- Real-time flag propagation monitoring across client base (eventual consistency acceptable; Phase 7 spec phase will clarify consistency requirements for production rollback incidents)
- Config encryption/decryption (assume store handles at rest; transport TLS assumed)
- Config + FF schema validation (assume store provides or caller validates before rollback)
- Operations runbook (Phase 7 will document partial failure recovery steps; decision pending: Phase 7 deliverable or Phase 8 followup)

---

## Phase 7 Components

| Component | Purpose | Owner | Status |
|-----------|---------|-------|--------|
| ConfigRollback | Real config store rollback + health checks | TBD | 🟡 SPEC |
| FeatureFlagRollback | Real FF service rollback + state verification | TBD | 🟡 SPEC |
| RollbackExecutor (extended Phase 6) | Orchestrate config/FF rollback in order | Phase 6 code | 🟡 INTEGRATION |
| Config Store Connector | Abstract config store interface + adapters | TBD | 🟡 SPEC |
| Feature Flag Service Connector | Abstract FF service interface + adapters | TBD | 🟡 SPEC |
| E2E Harness | 8–12 test cases (config/FF rollback scenarios) | TBD | 🟡 SPEC |
| Audit Logger (extended) | Log config + FF rollback actions | TBD | 🟡 SPEC |

---

## Test Coverage

### Phase 7 E2E Harness (8–12 tests, target 100% PASS)

**Config Store Rollback (3 tests)**
- Roll back config key/value to previous state
- Return error for non-existent revision
- Health check verifies config store consistency

**Feature Flag Service Rollback (3 tests)**
- Roll back feature flag enable/disable state
- Roll back flag rollout rules (targeting, %)
- Return error for flag not found / service unreachable

**Config + FF Integration (2 tests)**
- Roll back config + feature flag together (both succeed)
- Detect partial failure (config succeeds, FF fails; vice versa)

**Phase 6→7 Integration (2 tests)**
- Phase 6 RollbackExecutor calls Phase 7 ConfigRollback + FeatureFlagRollback
- Preserve rollback lineage (Phase 5 promotion failure → Phase 6 detection → Phase 7 execution)

**Timeout + Retry Logic (1 test, optional)**
- Config store timeout; retry succeeds
- FF service transient error; exponential backoff recovers

**Error Handling & Recovery (1 test, optional)**
- Missing config revision gracefully fails with recovery recommendation
- FF service unreachable; log recovery path for human operator

**Full Phase 2–7 Integration (1 test, optional)**
- Chain Phase 5 promotion failure → Phase 6 rollback (state/db/cache) → Phase 7 rollback (config/FF) → verify all layers reverted

---

## Full Pipeline Coverage

### Phases 2–7 E2E Test Suite (128–132 tests, target 100% PASS)

| Phase | Tests | Coverage |
|-------|-------|----------|
| Phase 2 E2E Integration | 14 | Ingestion → Routing → Audit |
| Phase 2 Adapter Sandbox | 19 | Adapter registry + Policy engine |
| Phase 3 Gateway | 16 | Gateway → Cowork API → Audit |
| Phase 4 Governance | 18 | Proposal → Review → Canary → Promotion |
| Phase 5 Multi-Canary | 27 | Multi-cohort → A/B → Metrics → Decision |
| Phase 6 Rollback | 26 | Rollback → Execute → Verify (state/db/cache) |
| Phase 7 Config+FF | **8–12** | **Real config + FF rollback** |
| **Total** | **128–132** | **End-to-end ingestion→recovery (all layers)** |

---

## Timeline

| Milestone | Target | Status |
|-----------|--------|--------|
| Phase 6 TIER1_APPROVED | 2026-07-11 | ✅ CONFIRMED (conditional) |
| Phase 7 Charter Draft | 2026-07-11 | ✅ THIS DOCUMENT |
| Phase 7 Charter Review | 2026-07-11 | ✅ CONDITIONAL_PASS (see phase-7-rollback-config-featureflag-charter-REVIEW.md) |
| **Config/FF Store Decision** | **2026-07-15** | **🟡 NEW GATE (Tier 1 must lock choices)** |
| Phase 7 Charter Tier 1 Review | 2026-07-12 | 🟡 PENDING |
| Phase 7 Charter Approval | 2026-07-12 | 🟡 PENDING TIER1 |
| Phase 7 Entry Ready (contingent on store decisions) | 2026-07-19 | 🟡 ON TRACK (if store choices locked by 2026-07-15) |
| Phase 7 Component Spec | 2026-07-19 | 🟡 READY ON ENTRY |
| Phase 7 E2E Harness | 2026-07-21 | 🟡 SCHEDULED |
| Phase 7 Completion + Tests | 2026-07-22 | 🟡 SCHEDULED |
| Phase 7 Charter Approval Final | 2026-07-22 | 🟡 ON SCHEDULE |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Config/FF store choices not locked before Phase 7 entry | Schedule slip, scope creep | Tier 1 decision gate by 2026-07-15 with options ranked (BLOCK finding from review) |
| Phase 5 does not capture pre-deployment config/FF snapshots | Cannot roll back; feature unavailable | Phase 7 entry verification checklist: confirm Phase 5 captures config/FF snapshots, or add pre-condition test (FLAG finding from review) |
| Config store unreachable at rollback time | Rollback blocked; user-facing | Timeout + fallback to read-only mode; recovery playbook for ops team; retry with exponential backoff |
| Feature flag service rate-limited | FF rollback delayed or failed | Batch flag updates; implement retry queue; monitor service quotas; coordinate with FF vendor |
| Config revision history unavailable | Cannot roll back specific key | Enforce config snapshot capture at pre-deployment time; unit tests verify revision availability |
| Feature flag state diverged from expected | Rollback restores stale state | Log expected vs actual state pre-rollback; health check post-rollback; alert ops on divergence |
| Partial rollback (config succeeds, FF fails) | System inconsistency | Log partial failure + recovery steps; phase 7 tests cover; ops runbook provided (timing TBD: Phase 7 vs Phase 8) |
| Config + FF rollback takes >60s | User-facing outage | Measure + optimize; parallel execution where safe; timeout thresholds per target (config 30s, FF 15s) |
| Config rollback affects other services | Cascading failures | Dependency detection (Phase 6 topological sort); rollback plan validation pre-execution; monitor cross-service health |
| Eventual-consistency FF rollback insufficient for production | Silent rollback failure; users see old flag state | Phase 7 spec phase clarifies production consistency requirements; health check post-rollback gates remediation |

---

## Dependencies

### Phase 6 Integration
- Requires Phase 6 RollbackExecutor (src/rollback/executor.ts) to be extended (no Phase 6 rewrite; composition-based)
- Requires Phase 6 rollback lineage (proposal → variant → rollback) to propagate to Phase 7

### Phase 5 Dependency (Verification Required)
- Phase 7 entry gate: Verify Phase 5 captures pre-deployment config + FF snapshots
- If snapshots not available, add Phase 7 pre-condition test or defer snapshot capture to Phase 5 followup

### External Dependencies (TBD at implementation, Tier 1 decision by 2026-07-15)

- **Config Store:** etcd, Consul, or project-specific KV store (TBD; decision gate 2026-07-15)
- **Feature Flag Service:** LaunchDarkly, Unleash, or project-specific API (TBD; decision gate 2026-07-15)
- **Deployment System:** Must capture config + FF snapshots pre-deployment (Phase 5 responsibility, Phase 7 entry will verify)

### Prerequisite Knowledge
- Phase 6 RollbackExecutor implementation (code review required before Phase 7 spec phase)
- Config store semantics (versioning, atomic updates, timeout behavior)
- Feature flag service API + audit log access
- Rollback consistency requirements (eventual vs. strong; clarified in Phase 7 spec phase)

---

## Decision Points

### Phase 7 Approval

**Question:** Proceed with Phase 7 sub-charter (Real config + FF rollback validation, 8–12 E2E tests)?

**Options:**
1. **Proceed** — Execute Phase 7 by 2026-07-22, close Phase 6 caveat, full rollback stack (all layers) tested
2. **Defer** — Skip Phase 7, leave config/FF rollback untested in production (risk: incomplete rollback on promotion failure)
3. **Combine with Phase 6** — Reopen Phase 6 charter to include real config/FF (timeline slip to 2026-07-18, higher complexity)

**Recommendation:** Proceed (Option 1). Phase 6 caveat explicitly calls for Phase 7 sub-charter or scope reduction. Phase 7 is lower complexity than reopening Phase 6 (composition-based extension, no Phase 6 rework). Aligns with governance gate: "Phase 7 sub-charter must be added for real-config/feature_flag rollback validation." Timeline realistic (entry 2026-07-19, exit 2026-07-22, 1 week sprint), contingent on store choice decisions by 2026-07-15 and team resource commitment.

---

## Approval & Governance

### Tier 1 Decision Required

**Approval Status:** 🟡 DRAFT → CONDITIONAL_PASS (review by ijfw-review, 2026-07-11; see phase-7-rollback-config-featureflag-charter-REVIEW.md)

**Tier 1 Approval Checklist:**

- [ ] Approve Phase 7 sub-charter scope (composition-based extension)
- [ ] Lock config store choice by 2026-07-15 (etcd, Consul, or custom; ranked by implementation complexity + operational overhead)
- [ ] Lock feature flag service choice by 2026-07-15 (LaunchDarkly, Unleash, or custom; ranked by API maturity + audit log access)
- [ ] Confirm Phase 5 captures pre-deployment config/FF snapshots, OR defer to Phase 7 entry verification test
- [ ] Clarify eventual-consistency requirement for production rollback (hard gate or post-rollback health check?)
- [ ] Decide: Phase 7 ops runbook deliverable, or Phase 8 followup?
- [ ] Approve timeline (entry 2026-07-19, exit 2026-07-22, contingent on store decisions by 2026-07-15)
- [ ] Risk acceptance (config/FF transient failures, retry logic, partial failure handling)

---

## Decision Log

- **2026-07-11 🟡 Draft Charter Created:** Phase 7 sub-charter drafted in response to Phase 6 Tier 1 conditional approval (caveat: config + feature_flag targets mocked, not production-tested). Charter scope: real config store rollback + real feature flag service rollback, integrated with Phase 6 RollbackExecutor. Test coverage: 8–12 E2E tests. Timeline: entry 2026-07-19, exit 2026-07-22. Decision: Awaiting Tier 1 review. Rationale: Phase 6 decision log explicitly states "Charter scope should be narrowed OR Phase 7 sub-charter must be added for real-config/feature_flag rollback validation." This charter addresses the latter, maintains Phase 6 scope, and completes rollback stack validation.

- **2026-07-11 ✅ Charter Review Complete:** ijfw-review audit identified BLOCK finding (store choices must have decision deadline by 2026-07-15) and two FLAGs (Phase 5 snapshot capture verification needed; 1-week timeline aggressive without resource plan). Charter updated with Tier 1 checklist, entry gate verification items, and explicit decision dates. Status: CONDITIONAL_PASS, ready for Tier 1 review.

- **2026-07-11 ✅ Charter Review Complete:** ijfw-review audit identified BLOCK finding (store choices must have decision deadline by 2026-07-15) and two FLAGs (Phase 5 snapshot capture verification needed; 1-week timeline aggressive without resource plan). Charter updated with Tier 1 checklist, entry gate verification items, and explicit decision dates. Status: CONDITIONAL_PASS, ready for Tier 1 review.

---

**Charter Status:** DRAFT → CONDITIONAL_PASS (review complete, ready for Tier 1)

**Commits:**
- *None yet (awaiting Tier 1 approval)*

**Next:** Tier 1 review of Phase 7 charter scope + approval checklist → Lock store choices by 2026-07-15 → Phase 7 entry 2026-07-19 → Component spec + test design
