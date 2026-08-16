# Review: Phase 4 Contract Package

Reviewed: 2026-06-27T00:00:00Z
Reviewer: ijfw-review
Domain: software (architecture spec)

## Summary

Phase 4 spec is **architecturally sound and internally consistent**. Contract, Impl Order, Test Suite, Governance Playbook, CI Gate, and Lint layer form a coherent enforcement surface with zero drift. Five BLOCK gaps prevent implementation: rollback state machine (partial failure path undefined), governance approval timeout semantics, concrete metric thresholds, BridgeOrchestrator hook signature clarity, and CanaryGrowthConfig persistence model. Fix these before Step 1 scaffold.

---

## BLOCK findings (must-fix)

- **Phase 4 Rollback Logic**: Step 15 + Playbook 5 say "revert regime + constraints + fallback + rewards + simulator." No state machine defined if rollback partially fails (e.g., simulator revert fails, fallback succeeds). Need: rollback idempotency rules + partial-failure recovery path.

- **Governance Approval Timeout**: Governance Playbook Step 3 says "governance decides: approve/reject/request revision." No timeout defined. What happens if governance never responds? Does proposal remain pending? Can SPL resubmit? Need: approval TTL + timeout semantics in governance_approvals table.

- **Metric Thresholds Not Concrete**: CI Gate rules 6, 8, 9 + Playbook reference "divergence > threshold," "cost regression," "latency regression." No numeric values. Implementation needs: divergence threshold (e.g., 0.15), cost_delta_threshold (e.g., ±10%), latency_delta_threshold (e.g., ±15%). Source: Phase 1/2 config or Phase 4 governance_config.json?

- **BridgeOrchestrator Hook Signatures Undefined**: Steps 10, 12, 15 say "add submitProposal(), validateProposal(), governanceReview(), executeCanary(), promoteOrRollback()." No parameter/return types. Phase 1 contract requires explicit interface signatures. Need: concrete TypeScript signatures for all 5 hooks before scaffolding.

- **CanaryGrowthConfig Persistence Missing**: Step 14 implements "CanaryCohortController" with adaptive growth. No storage model defined. Can governance change growth config mid-canary? Is it in-memory, in database, or immutable? Need: explicit storage + read-after-write semantics + change-log requirements.

---

## FLAG findings (should-discuss)

- **SPL Proposal Rate Limiting Absent**: Phase 4 allows SPL to submit unlimited proposals. Playbook shows governance review per proposal, but no throttling. Risk: SPL spam creates governance backlog. Should rate-limit per regime_id or per SPL instance?

- **Governance Approver Identity Not Enforced**: governance_approvals.approver is a string field. No authz check that approver is actually a governance member. Proposal could be forged. Need: governance_approvals.approver must reference a governance_members table + signature verification.

- **Simulator Delta Coverage Threshold Undefined**: Test 10 says "rejects simulator deltas reducing coverage." What's "minimum threshold"? 80%? 95%? Phase 2 simulator has explicit coverage metrics — need explicit reference + threshold value.

- **Auto-Promotion Decision Logic in Code, Not Playbook**: Section 7.2 + Playbook section 4 define "auto-promotion allowed for minor deltas," but exact decision rule missing from Playbook. Implementation Order Step 14 must encode rule (e.g., "if delta_magnitude < 0.1 * governance_cap"), but Playbook should surface this to governance operators.

- **Canary Cohort Stability Window Undefined**: Impl Order Step 14 says "adaptive growth curve." Playbook section 3 references "stable metrics" but does not define N observations required for stability. Growth to 2% after how many tasks/minutes? Need: explicit observation_window_size in CanaryGrowthConfig.

---

## NIT findings (polish)

- **Governance Playbook Audit Frequency Vague**: Section 6 "Governance must audit..." lists what to audit (proposal patterns, telemetry, promotion history) but not cadence. Should specify: weekly audit? monthly? triggered on promotion? Need: audit_schedule in governance_config.json.

- **CI Gate Rule 10 References "Phase 4 tests" Without Framework**: "Run Phase 4 test suite: all 25 tests must pass." Framework not specified (Jest? Vitest? Both?). Impl Order Step 1 should define test framework + command (npm test vs jest vs vitest).

- **Lint Error Format Inconsistent Casing**: Lint spec uses "P4-DSL-001" (all caps with hyphens). Test assertions and governance playbook use mixed case. Should standardize: P4-DSL-001 everywhere, or P4_DSL_001? Pick one.

- **Implementation Order Step 11 Schema Definition Incomplete**: "Create schemas (append-only)." Does not specify PRIMARY KEY strategy. regime_proposals(proposal_id UUID PRIMARY KEY) or regime_proposals(id BIGSERIAL PRIMARY KEY, proposal_id UUID UNIQUE)? Second is safer for append-only immutability.

- **Test Suite Test 23 Assertion Unclear**: "Structural changes require manual approval." How does test assert this? Mock governance rejection? Query database to verify approval_type=manual? Need: explicit test assertion strategy in Phase 4 Test Suite spec.

---

## Confidence Gate

Phase 4 is **CONDITIONAL on BLOCK fixes**. Once the five BLOCK items are resolved:
- Rollback state machine defined
- Governance approval timeout semantics locked
- Metric thresholds concrete + sourced
- BridgeOrchestrator hook signatures explicit
- CanaryGrowthConfig persistence model locked

Status: **Ready for implementation with BLOCK fixes applied.**

---
