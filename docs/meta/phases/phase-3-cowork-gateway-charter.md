---
title: Phase 3 Scope Charter — Cowork Gateway Integration
date: 2026-07-10
status: TIER1_APPROVED
decision: APPROVED
approved_date: 2026-07-11
critical_path: true
deadline: 2026-07-15
---

# Phase 3 Scope Charter — Cowork Gateway Integration

## Executive Summary

Phase 3 bridges Phase 2 ingestion (routing + orchestration) with Phase 4 governance (proposals + canary). Gateway registers Phase 2 skills with Cowork platform, enabling skill-based enrichment workflows. Scope locked; no optional migrations. Critical path for Phase 4 entry.

---

## Phase 2 Recap (Locked ✅)

Phase 2 completed E2E ingestion pipeline:
- **Phase 2.A:** 22 skills validated (13 Phase 1 + 9 Phase 2.A Tier A) — production-ready ✅
- **Phase 2.B:** Deferred (0 production candidates found) ✅
- **Phase 2 Tests:** 33/33 E2E tests PASS (routing + adapter registry + policy engine) ✅

**Current Inventory:**
- 22 production skills staged for Cowork registration
- Full ingestion pipeline tested (entry → route → audit)
- Cost + telemetry aggregation verified

---

## Phase 3 Scope

### 3.1 Gateway Architecture

**Entry Point:** Phase 2 routed ingestion decisions → GatewayRequest

**Processing Pipeline:**
1. Format routed entry (profile, lane, extractors) for Cowork API
2. Call Cowork enrichment API (profile-specific enrichment)
3. Execute lane-specific orchestration (fast vs. deep analysis)
4. Record orchestration result + cost to audit manifest
5. Return gateway response (enriched data + execution telemetry)

**Exit Point:** Audit manifest record (ready for Phase 4 governance review)

### 3.2 Cowork Gateway Components

| Component | Purpose | Status |
|-----------|---------|--------|
| GatewayRequest | Format for Phase 2→3 boundary | ✅ Defined in test |
| MockCoworkAPI | Enrichment orchestration | ✅ Defined in test |
| MockGateway | Request routing + response formatting | ✅ Defined in test |
| E2E Harness | 16 test cases (request/enrichment/pipeline/error handling) | ✅ PASS |

### 3.3 Integration Points

**Phase 2 → Phase 3:**
- Input: RoutedIngestionDecision (profile, lane, extractors)
- Format: GatewayRequest (add mediaType, size)
- Preservation: Entry ID + metadata flow through boundary

**Phase 3 → Phase 4:**
- Output: Audit manifest record (orchestration status + cost)
- Governance trigger: Proposal + approval workflow
- Canary execution: Cost/latency/correctness metrics

### 3.4 Parallelism Matrix

| Wave | Spec | Dependencies | Parallelism Tag |
|------|------|--------------|-----------------|
| W1 | GatewayRequest (Component) | None | 4-wide |
| W1 | MockCoworkAPI (Component) | None | 4-wide |
| W1 | MockGateway (Component) | None | 4-wide |
| W2 | Gateway Request Formatting (Tests) | GatewayRequest | blocks-on W1 |
| W2 | Cowork API Enrichment (Tests) | MockCoworkAPI | blocks-on W1 |
| W2 | Gateway Error Handling (Tests) | MockGateway | blocks-on W1 |
| W2 | Cost & Telemetry (Tests) | MockCoworkAPI, MockGateway | 2-wide |
| W3 | Gateway Processing Pipeline (Tests) | GatewayRequest, MockGateway | blocks-on W2 |
| W3 | Phase 2→3 Integration (Tests) | Phase 2 output, GatewayRequest | blocks-on W2 |
| W4 | Full E2E Pipeline (Tests) | All W1-W3 components | sequential |

**Parallelism Analysis:**
- **W1 (Component Definition):** 4-wide parallel (3 independent components)
- **W2 (Unit/Integration Tests):** 2-wide parallel (4 test suites, grouped by dependencies)
  - Gateway Request + Cowork Enrichment (independent)
  - Error Handling + Cost/Telemetry (independent)
- **W3 (Cross-Component Tests):** Sequential per suite (Pipeline, Integration depend on W2)
- **W4 (E2E Tests):** Sequential (full pipeline depends on all earlier waves)

**Critical Path:** W1 (0) → W2 (16 tests, 2 batches) → W3 (4 tests) → W4 (2 tests)
**Test Parallelism Width:** 2-wide (W2 can split into 2 parallel batches)

---

### 3.5 Scope Locked

**In Scope:**
- Gateway request/response formatting
- Cowork API enrichment simulation (all profiles + lanes)
- Audit manifest recording
- Cost + telemetry aggregation
- E2E harness (16 tests, all PASS)
- Phase 2→3 integration verification

**Out of Scope:**
- Phase 4 governance/canary logic (separate charter)
- Actual Cowork API (mock implementation for Phase 3)
- Multi-tenant support (deferred to Phase 5+)
- Custom extraction plugins (Phase 4+)

---

## Execution Model

### Entry Criteria ✅

- [x] Phase 2 complete + tested (33 tests PASS)
- [x] Phase 3 E2E harness written (16 tests PASS)
- [x] Gateway architecture documented
- [x] Integration points defined

### Execution Flow

**Step 1: Gateway Harness** (COMPLETE ✅)
- Test entry formatting (GatewayRequest)
- Test Cowork API enrichment (all profiles)
- Test orchestration pipeline (lane-specific execution)
- Test audit recording
- Verify cost aggregation + telemetry

**Step 2: Phase 3 Charter** (THIS DOCUMENT)
- Define scope + integration points
- Lock decision + timeline
- Identify risks + mitigations

**Step 3: Run Full Test Suite** (PENDING)
- Phase 2 (33 tests) + Phase 3 (16 tests) combined
- Verify no cross-phase regressions
- Commit full pipeline

### Exit Criteria

- [x] Phase 3 E2E harness complete (16/16 PASS, 2026-07-10)
- [x] Phase 3 charter finalized + approved (Tier 1 approved 2026-07-11)
- [x] Full test suite run (Phase 2 + Phase 3, 49/49 PASS, 2026-07-11)
- [x] Ready for Phase 4 governance entry

---

## Test Coverage

### Phase 3 E2E Harness (16 tests, 100% PASS)

**Gateway Request Formatting (2 tests)**
- Format filesystem entry for gateway
- Format API entry with deep lane

**Cowork API Enrichment (4 tests)**
- Enrich filesystem entry
- Enrich API genealogy entry (deep)
- Enrich image entry (visual analysis)
- Enrich PDF entry (document analysis)

**Gateway Processing Pipeline (2 tests)**
- Route filesystem entry through gateway
- Route API entry through gateway

**Full E2E Pipeline (2 tests)**
- Process diverse batch (4 entries, all profiles/lanes)
- Record gateway results to audit manifest

**Cost & Telemetry Aggregation (2 tests)**
- Aggregate costs across profiles
- Track execution time per profile

**Gateway Error Handling (2 tests)**
- Handle unknown profile gracefully
- Handle missing extractors

**Phase 2→3 Integration (2 tests)**
- Convert Phase 2 routed entry to gateway format
- Preserve entry context across boundary

---

## Timeline

| Milestone | Target | Status |
|-----------|--------|--------|
| Phase 3 E2E Harness | 2026-07-10 | ✅ COMPLETE (16/16 PASS) |
| Phase 3 Charter | 2026-07-10 | ✅ APPROVED (2026-07-11, Tier 1) |
| Full Test Suite Run | 2026-07-11 | ✅ VERIFIED (49/49 PASS) |
| Phase 3 Entry | 2026-07-12 | ✅ READY |
| Phase 4 Readiness | 2026-07-15 | ✅ ON TRACK (critical path) |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Cowork API contract undefined | Phase 4 blocked if incompatible | Mock maintains compatibility; Phase 4 refines actual API |
| Cost calculation mismatch Phase 2→3 | Audit records incorrect | Verify cost flow in full test suite |
| Lane-specific behavior not tested | Deep lane failures in prod | E2E harness tests all lanes (fast/deep) |
| Audit manifest format drift | Phase 4 parsing fails | Define schema in Phase 3 charter |
| Phase 3 delays Phase 4 entry | Misses 2026-07-15 deadline | Hard stop on scope changes; Phase 3 locked |

---

## Decision Points

### Phase 3 Approval

**Question:** Proceed with Phase 3 as scoped (Cowork Gateway + 16 E2E tests)?

**Options:**
1. **Proceed** — Execute Phase 3 by 2026-07-12, Phase 4 entry by 2026-07-15
2. **Defer** — Skip Phase 3, move Phase 4 to Phase 3.5 (delays timeline)
3. **Scope Reduction** — Phase 3 tests only, defer actual gateway until Phase 4

**Recommendation:** Proceed (Option 1). E2E harness already complete + passing. Full test suite run (49/49 PASS) validates Phase 2→3 integration. No scope blockers identified.

---

## Approval & Governance

### Tier 1 Decision Required

**Approval Status:** ✅ APPROVED (2026-07-11)

- [x] Tier 1 approval of Phase 3 charter
- [x] Timeline lock (2026-07-15 deadline)
- [x] Risk acceptance (mock Cowork API scope acknowledged)

---

## Decision Log

- **2026-07-11 ✅ Tier 1 Approval:** Phase 3 charter APPROVED. Evidence: 49/49 tests PASS (Phases 2–3 cumulative, 2026-07-11). Gateway integration + Cowork API mock scope locked. Critical path confirmed: Phase 4 entry must complete by 2026-07-15 to maintain downstream deadlines. Risk acceptance: mock Cowork API integration (Phase 4 will refine actual contract). Commits: 075eac7 (P3 harness), 25e2271 (P3 charter).

---

**Charter Status:** DRAFT → PENDING APPROVAL

**Next Step:** Tier 1 review + decision (proceed/defer/modify)
