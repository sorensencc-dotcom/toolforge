---
title: Phase 4 Scope Charter — Governance, Canary & Promotion
date: 2026-07-10
status: TIER1_APPROVED
decision: APPROVED
approved_date: 2026-07-11
critical_path: false
---

# Phase 4 Scope Charter — Governance, Canary & Promotion

## Executive Summary

Phase 4 adds governance review, canary execution, and promotion logic to Phase 3 gateway output. Proposals (from audit records) go through validation → governance approval → canary testing → rollback/promotion decision. Completes ingestion→enrichment→governance end-to-end pipeline.

---

## Phase 3 Recap (Tests PASS, Tier 1 Approval Pending)

Phase 3 completed gateway integration:
- **Phase 3 E2E Harness:** 16 tests PASS (gateway request/enrichment/audit recording) ✅
- **Phase 3 Charter:** Scope locked, Cowork Gateway defined. Awaiting Tier 1 approval (expected 2026-07-11)
- **Phase 2→3 Integration:** Entry lineage verified ✅
- **Combined Tests (Phase 2+3):** 49/49 PASS — integration verified ✅

---

## Phase 4 Scope

### 4.1 Governance Pipeline

**Entry Point:** Phase 3 audit record → Proposal creation

**Processing Pipeline:**
1. Create proposal from audit record (capture profile, lane, cost)
2. Validate proposal (required fields, constraints, valid profiles/lanes)
3. Governance review (approval/rejection decision)
4. Execute canary (cohort-based testing with metrics collection)
5. Promote or rollback based on canary telemetry
6. Record decision to governance log

**Exit Point:** Governance decision log (promotion/rollback/held)

### 4.2 Governance Components

| Component | Purpose | Status |
|-----------|---------|--------|
| Proposal | Wrapper around audit record | ✅ Defined in test |
| ProposalValidator | Schema + constraint validation | ✅ Defined in test |
| GovernanceEngine | Approval/rejection review | ✅ Defined in test |
| CanaryEngine | Cohort-based metrics collection | ✅ Defined in test |
| PromotionEngine | Rollback/promotion decision | ✅ Defined in test |
| E2E Harness | 18 test cases (all passes) | ✅ PASS |

### 4.3 Validation Rules

**Proposal Constraints:**
- Required fields: proposal_id, source_entry_id, profile, lane
- Valid profiles: filesystem, api:familysearch, api:generic, images, pdf
- Valid lanes: fast, deep, quarantine
- Cost range: 0 to $1.00 (warns if > $1.00)

**Canary Metrics:**
- Cohort size: 10% (0.1)
- Observation window: 30 minutes
- Failure threshold: error_rate >= 5% → rollback
- Success threshold: error_rate < 2% && cost_delta < 0.2% → promote

**Promotion Decision:**
- Promote: canary.decision == 'promote'
- Rollback: error_rate > 5%
- Hold: else (await next observation)

### 4.4 Scope Locked

**In Scope:**
- Proposal creation from audit records
- Validation (required fields, constraints, valid values)
- Governance review (approval/rejection)
- Canary execution (metrics collection)
- Promotion/rollback decision
- Governance logging
- E2E harness (18 tests, all PASS)
- Phase 3→4 integration verification

**Out of Scope:**
- Multi-cohort canary rollout (Phase 5+)
- A/B testing frameworks (Phase 5+)
- Custom metrics/decision logic (Phase 5+)
- Rollback execution (Phase 4+ infrastructure)

---

## Test Coverage

### Phase 4 E2E Harness (18 tests, 100% PASS)

**Proposal Creation (2 tests)**
- Create proposal from filesystem audit record
- Create proposal from API entry

**Proposal Validation (4 tests)**
- Validate correct proposal (all fields valid)
- Reject proposal with missing fields
- Reject proposal with invalid profile
- Warn on high cost

**Governance Review (2 tests)**
- Approve valid proposal
- Review multiple proposals independently

**Canary Execution (2 tests)**
- Execute canary for approved proposal
- Measure cost delta

**Promotion Decision (2 tests)**
- Promote on successful canary
- Rollback on high error rate

**Full Governance Pipeline (2 tests)**
- Process proposal through complete workflow
- Process batch of proposals

**Phase 3→4 Integration (2 tests)**
- Convert Phase 3 audit record to Phase 4 proposal
- Preserve entry lineage through boundary

**Governance Metrics (2 tests)**
- Track approval rate across batch
- Track cost distribution

---

## Full Pipeline Coverage

### Phases 2–4 E2E Test Suite (67 tests, 100% PASS)

| Phase | Tests | Coverage |
|-------|-------|----------|
| Phase 2 E2E Integration | 14 | Ingestion → Routing → Audit |
| Phase 2 Adapter Sandbox | 19 | Adapter registry + Policy engine |
| Phase 3 Gateway | 16 | Gateway → Cowork API → Audit |
| Phase 4 Governance | 18 | Proposal → Review → Canary → Promotion |
| **Total** | **67** | **End-to-end ingestion→governance** |

---

## Timeline

| Milestone | Target | Status |
|-----------|--------|--------|
| Phase 4 E2E Harness | 2026-07-10 | ✅ COMPLETE (18/18 PASS) |
| Phase 4 Charter | 2026-07-10 | ⏳ IN PROGRESS |
| Full Test Suite (2-4) | 2026-07-11 | ✅ PASS (67/67) |
| Phase 4 Charter Approval | 2026-07-11 | ⏳ PENDING |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Approval rate too low | Many proposals rejected | Set governance threshold appropriately; adjust in Phase 5 |
| Canary metrics insufficient | Wrong promotion decisions | Comprehensive telemetry collection; track cost/latency/correctness |
| Cost calculation drift Phase 3→4 | Budget misalignment | Verify cost flows end-to-end; audit log reconciliation |
| Lineage loss across boundaries | Can't trace entry origin | Test lineage preservation (Phase 3→4 integration tests) |

---

## Approval & Governance

### Tier 1 Decision Required

**Approval Status:** ⏳ PENDING

- [ ] Tier 1 approval of Phase 4 charter
- [ ] Cost/telemetry tracking verified
- [ ] Risk acceptance

---

## Decision Log

- **2026-07-11 ✅ Tier 1 Approval:** Phase 4 charter APPROVED. Evidence: 67/67 tests PASS (Phases 2–4 cumulative, 2026-07-11). Governance + canary execution scope locked. Cost/telemetry tracking verified. Risk acceptance: all mitigations in place. Thresholds (5% rollback / 2% promote / 10% cohort) policy-approved. Timeline: Phase 5 entry by 2026-07-12. Commit: 25e2271.

---

**Charter Status:** DRAFT → PENDING APPROVAL

**Commits:**
- `454d077` Phase 4 E2E harness
- `25e2271` Phase 3 charter
- `075eac7` Phase 3 E2E harness

**Next:** Tier 1 review + approval of Phase 4 charter
