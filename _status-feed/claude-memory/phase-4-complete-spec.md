---
name: phase-4-complete-spec
description: "Phase 4 MAAL–SPL Co-Design + Canary-Gated Structural Evolution — complete, locked, implementation-ready spec"
metadata: 
  node_type: memory
  type: project
  originSessionId: 73cdfa1e-2ae0-4d59-8622-49f4031ed8df
---

# PHASE 4 COMPLETE SPEC
### v0.4.0-maal-codesign-canary-foundation
**Freeze Tag:** `v0.4.0-maal-codesign-canary-foundation`
**Status:** LOCKED, READY FOR IMPLEMENTATION
**Date:** 2026-06-27

---

## SECTIONS

1. **Phase 4 Contract** (immutable, scope, DSL, validation, governance, canary, telemetry, promotion, rollback, safety rails)
2. **Phase 4 Implementation Order** (15 steps, scaffold → logic)
3. **Phase 4 Test Suite** (25 tests across 6 categories)
4. **Phase 4 Governance Playbook 2.0** (workflows, rules, audit)
5. **Phase 4 CI Gate** (10 hard-fail rules)
6. **Phase 4 Lint** (24 rules across 6 categories, error format, integration)
7. **BLOCK Gap Resolutions** (5 decisions: rollback, TTL, thresholds, hooks, persistence)
8. **Phase 4 Directory Tree** (canonical file structure, SQL schemas, tests, extensions)

---

## PHASE 4 CONTRACT (IMMUTABLE)

See: [[phase-4-contract]]

**Key Points:**
- SPL proposes structural MAAL deltas via high-level DSL only
- MAAL validates (invariants, bounds, safety)
- Governance approves (manual for structural, auto for minor)
- Canary executes (adaptive growth, governance-capped)
- Telemetry determines promotion or rollback
- All changes are reversible

---

## PHASE 4 IMPLEMENTATION ORDER (15 STEPS)

**Steps 1-12:** Scaffolds, interfaces, types (no logic)
**Steps 13-15:** Minimal logic implementation

**Critical Path:**
1. Scaffold directory structure + file structure
2. Implement Proposal DSL (high-level deltas only)
3. Implement ProposalValidator skeleton
4. Implement delta types (Regime, Constraint, Fallback, Reward, Simulator)
5. Implement GovernanceCaps
6. Implement GovernanceReview + GovernanceDecisions
7. Implement CanaryAssignment
8. Implement CanaryCohortController
9. Implement CanaryTelemetry
10. Implement CanaryGateOrchestrator skeleton
11. Implement SQL schemas (append-only)
12. Integrate Phase 4 hooks into BridgeOrchestrator
13. Implement ProposalValidator logic
14. Implement CanaryAssignment + CohortController logic
15. Implement CanaryGateOrchestrator logic

---

## PHASE 4 TEST SUITE (25 TESTS)

**Categories:**
- **A. Proposal DSL** (5 tests) — DSL validity, forbidden fields, bounded deltas, structured deltas, parse errors
- **B. ProposalValidator** (5 tests) — cost ceilings, latency ceilings, graph cycles, reward ranges, simulator coverage
- **C. Governance** (4 tests) — manual approval, auto-promotion, cohort caps, delta magnitude caps
- **D. Canary Assignment + Cohort** (4 tests) — deterministic, stable, growth curve, cap enforcement
- **E. Canary Execution** (4 tests) — candidate regime isolation, telemetry, rollback soft, rollback hard
- **F. Promotion Model** (3 tests) — manual approval, auto-promotion, drift blocking
- **Immutability** (2 tests) — Phase 1 unchanged, Phase 3 unchanged

**Total: 27 tests (25 + 2 immutability)**

---

## PHASE 4 GOVERNANCE PLAYBOOK 2.0

**Workflows:**
- **Proposal Review** (5 steps: validation → governance review → decision → logging → notification)
- **Canary Gate** (5 steps: approval → cohort 1% → adaptive growth → telemetry monitoring → promotion/rollback)
- **Promotion Rules** (manual for structural, auto for minor with conditions)
- **Rollback Rules** (8 triggers: divergence, cost, latency, correctness, drift, reward instability, simulator instability, governance override)
- **Audit Requirements** (proposal patterns, validation decisions, telemetry, promotion history, drift reports)

---

## PHASE 4 CI GATE (10 HARD-FAIL RULES)

1. **Phase 1 immutability** — checksums vs v0.1.0-maal-foundation
2. **Phase 3 immutability** — checksums vs v0.3.0-spl-integration-foundation
3. **Unauthorized file creation** — only Phase 4 paths allowed
4. **DSL + parser enforcement** — all proposals via ProposalParser + ProposalValidationEngine
5. **Global bounds source integrity** — import GlobalRoutingBounds only
6. **Canary telemetry requirement** — all promotions emit canary_gate_results
7. **Governance approvals table integrity** — required fields present
8. **Canary cohort cap enforcement** — growth never exceeds cap
9. **Simulator + reward gating** — no direct mutations, canary-only
10. **Phase 4 test suite** — all 25+ tests pass

---

## PHASE 4 LINT (24 RULES)

**Categories:**
- **IMMUT** (3 rules) — Phase 1/3 file immutability, no new files in core directories
- **SCOPE** (2 rules) — only Phase 4 paths, no new global bounds
- **DSL** (4 rules) — parser usage, forbidden fields, bounded deltas, structured deltas
- **VALIDATION** (4 rules) — validator usage, graph invariants, constraint invariants, reward/simulator invariants
- **GOVERNANCE** (3 rules) — structural approval requirement, approvals table, cap enforcement
- **CANARY** (5 rules) — all structural changes through canary, telemetry required, growth bounded, pause on soft violations, rollback on hard violations

**Error Format:** `P4-<CATEGORY>-<RULE_ID>: <problem>. <fix>.`

**Precedence:** IMMUT → SCOPE → DSL → VALIDATION → GOVERNANCE → CANARY

**Auto-fix:** ON for mechanical rules (SCOPE-001, DSL-002, GOV-002), OFF for semantic/safety rules

---

## BLOCK GAP RESOLUTIONS

### 1. Rollback State Machine
**Decision:** Fail-fast + Idempotent + No partial states
- Rollback is atomic
- If any step fails, system reverts to previous stable regime
- Rollback operations are idempotent (safe to retry)
- State: ACTIVE → ROLLBACK_PENDING → ROLLBACK_APPLY → ROLLBACK_VERIFY → ACTIVE
- On failure: ROLLBACK_RETRY (with retry limit → ROLLBACK_ESCALATE)

### 2. Governance Approval Timeout
**Decision:** 7-day TTL + SPL may resubmit
- Proposal marked `expired` after 7 days
- SPL receives `GOVERNANCE_TIMEOUT` error
- SPL may resubmit with new proposal_id
- Logged in governance_approvals

### 3. Metric Thresholds
**Decision:** GlobalRoutingBounds (Phase 1/2) + Phase 4 governance thresholds

**GlobalRoutingBounds (Phase 1/2, read-only):**
- max_cost_per_task
- max_latency_per_task

**Phase 4 governance_config.json:**
- divergence_threshold = 0.15
- cost_delta_threshold = 0.10 (±10%)
- latency_delta_threshold = 0.15 (±15%)
- correctness_delta_threshold = 0.02 (±2%)
- drift_threshold = 0.10 (simulator/live mismatch)

### 4. BridgeOrchestrator Hook Signatures
**Decision:** All 5 hooks return structured Result<T, E>

```typescript
submitProposal(): Result<ProposalAccepted, ProposalError>
validateProposal(): Result<ValidationPassed, ValidationError>
governanceReview(): Result<GovernanceApproved, GovernanceRejected>
executeCanary(): Result<CanaryTelemetry, CanaryError>
promoteOrRollback(): Result<PromotionSuccess, RollbackApplied | RollbackError>
```

### 5. CanaryGrowthConfig Persistence
**Decision:** Append-only database table (canary_growth_configs)
- New table: canary_growth_configs (cohort_cap, growth_curve, observation_windows, thresholds, timestamp, approver)
- CanaryCohortController reads latest row before each growth step
- Governance changes logged + read on next growth decision
- Auditable, reproducible, survives restarts

---

## PHASE 4 DIRECTORY TREE (CANONICAL)

### TypeScript Source
```
cic-os/src/core/maal/
├── codesign/
│   ├── Proposal.ts
│   ├── ProposalTypes.ts
│   ├── ProposalParser.ts
│   ├── ProposalParseError.ts
│   ├── ProposalValidationEngine.ts
│   ├── ProposalValidationEngineImpl.ts
│   ├── RegimeDelta.ts
│   ├── ConstraintDelta.ts
│   ├── FallbackDelta.ts
│   ├── RewardDelta.ts
│   ├── SimulatorDelta.ts
│   └── GlobalRoutingBounds.ts (import-only)
│
├── canary/
│   ├── CanaryGateOrchestrator.ts
│   ├── CanaryAssignment.ts
│   ├── CanaryCohortController.ts
│   ├── CanaryTelemetry.ts
│   ├── CanaryGrowthConfig.ts
│   └── CanaryError.ts
│
├── governance/
│   ├── GovernanceReview.ts
│   ├── GovernanceDecisions.ts
│   ├── GovernanceCaps.ts
│   ├── GovernanceError.ts
│   └── ProposalRejectionReason.ts
│
└── support/
    ├── ImmutabilityGuard.ts
    ├── ValidationResult.ts
    └── Result.ts
```

### SQL Schemas (Append-Only)
```
postgres/phase4/
├── regime_proposals.sql
├── constraint_proposals.sql
├── fallback_graph_proposals.sql
├── reward_adjustment_proposals.sql
├── simulator_drift_reports.sql
├── canary_gate_results.sql
├── governance_approvals.sql
└── canary_growth_configs.sql
```

### Test Suite
```
tests/phase4/
├── test_dsl_validity.ts (5 tests)
├── test_validation_*.ts (5 tests)
├── test_governance_*.ts (4 tests)
├── test_canary_assignment_*.ts (2 tests)
├── test_canary_growth_*.ts (2 tests)
├── test_canary_exec_*.ts (4 tests)
├── test_promotion_*.ts (3 tests)
├── test_immutability_phase1.ts
└── test_immutability_phase3.ts
```

### BridgeOrchestrator Extensions
```
cic-ingestion/src/orchestrator/
└── BridgeOrchestrator.ts
    (adds 5 Phase 4 hooks only, no other modifications)
```

---

## NON-NEGOTIABLE CONSTRAINTS

1. **No Phase 1 or Phase 3 files may be touched.** ImmutabilityGuard enforces.
2. **No new global bounds may be defined.** Import GlobalRoutingBounds only.
3. **No proposal may bypass ProposalParser or ProposalValidationEngine.**
4. **No structural change may bypass canary.**
5. **No simulator/reward change may auto-promote.**
6. **All governance decisions must be logged.**
7. **CanaryGrowthConfig must be read from DB, not config files.**
8. **All rollback operations are idempotent and atomic.**
9. **Governance approval TTL is 7 days.**
10. **Metric thresholds are sourced from GlobalRoutingBounds (cost/latency) + governance_config.json (divergence/correctness/drift).**

---

## REFERENCES

- [[phase-1-pr-template]] — Phase 1 validation model
- [[phase-1-implementation-order-fixed]] — Step-by-step methodology
- [[phase-2-simulation-harness-contract]] — SPL/RL foundation
- [[phase-3-integration-contract]] — SPL shadow mode + A/B testing
- [[phase-3-tests]] — 20 test contracts (carry forward)
- [[governance-playbook]] — Phase 3 governance model (Phase 4 extends)

---

## STATUS

**Phase 4 Contract:** FROZEN at v0.4.0-maal-codesign-canary-foundation
**Implementation:** READY (all 5 BLOCK gaps resolved)
**Code Status:** Awaiting implementation in separate session
**Review:** CONDITIONAL → UNLOCKED (all BLOCK remediation complete)

Next: Implementation Order execution in new chat.
