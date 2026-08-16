---
name: phase-3-tests
description: "Phase 3 test contracts (20 tests); safety verification for shadow mode, A/B testing, governance gates, rollback"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7868a049-3774-41db-ade2-dd9374785bc7
---

# **PHASE 3 TEST CONTRACTS (20 TESTS)**

These 20 tests form the safety and correctness gate for Phase 3. All must pass before tagging `v0.3.0-spl-integration-foundation`.

---

# **SHADOW MODE ISOLATION (Tests 1–3)**

## **Test 1: Shadow Mode Isolation**

**Goal:** SPL never affects execution.

**Setup:**
- Enable shadow mode with SPL inference.
- Run N tasks (N ≥ 100).
- Record MAAL routing decision and actual execution for each.
- Repeat with shadow mode disabled.

**Assertion:**
- MAAL decisions and actual execution are identical in both runs.
- No drift in routing behavior.

**Pass Criteria:**
- 100% match between shadow-enabled and shadow-disabled execution traces.

---

## **Test 2: Shadow Telemetry Correctness**

**Goal:** `shadow_decisions` table rows match in-memory computed samples.

**Setup:**
- Run shadow mode on test workload.
- Compute expected MAAL/SPL actions and divergence scores locally.
- Query `shadow_decisions` for same tasks.

**Assertion:**
- Every row matches expected values:
  - `maal_action` correct
  - `spl_action` correct
  - `divergence_score` computed correctly
  - `spl_confidence` matches policy entropy

**Pass Criteria:**
- 100% correctness on divergence and confidence metrics.

---

## **Test 3: Shadow Latency Budget**

**Goal:** SPL inference + shadow logging stay within latency budget.

**Setup:**
- Measure request latency with shadow mode disabled (baseline).
- Measure request latency with shadow mode enabled.
- Compute overhead = enabled - disabled.

**Assertion:**
- Overhead < configured threshold (default: 20ms).

**Pass Criteria:**
- 99th percentile latency overhead < 20ms.
- No request violates latency budget.

---

# **A/B TEST FRAMEWORK (Tests 4–7)**

## **Test 4: Cohort Assignment Stability**

**Goal:** 90/10 split is stable and deterministic.

**Setup:**
- Run CohortAssigner on N tasks (N ≥ 10,000).
- Count control vs shadow cohorts.

**Assertion:**
- Control ≈ 90% ± 2%
- Shadow ≈ 10% ± 2%
- Same task ID always maps to same cohort (deterministic).

**Pass Criteria:**
- Distribution within ±2% of target.
- No task changes cohorts across runs.

---

## **Test 5: A/B Telemetry Correctness**

**Goal:** `a_b_test_results` rows reflect correct metric deltas.

**Setup:**
- Inject synthetic tasks with known:
  - correctness outcomes
  - costs
  - latencies
- Compute expected deltas (SPL metric - MAAL metric).
- Log via ABTestRecorder and write to table.

**Assertion:**
- Every row in `a_b_test_results` has:
  - correctness_delta matching expected value
  - cost_delta matching expected value
  - latency_delta matching expected value

**Pass Criteria:**
- 100% correctness on all three deltas.

---

## **Test 6: A/B Framework Isolation**

**Goal:** A/B framework never changes routing behavior.

**Setup:**
- Run workload with A/B framework enabled.
- Run same workload with A/B framework disabled.
- Compare execution traces.

**Assertion:**
- MAAL routing decisions are identical.
- Only difference is telemetry writes (shadow_decisions, a_b_test_results).

**Pass Criteria:**
- 100% match in routing behavior.

---

## **Test 7: Holdout Evaluation Integrity**

**Goal:** Proper 70/15/15 split and no data leakage.

**Setup:**
- Split Phase 2 training data into 70/15/15.
- Verify no sample appears in multiple splits.
- Evaluate policy on holdout set.

**Assertion:**
- No sample in both training and holdout.
- No sample in both validation and holdout.
- Holdout metrics computed only on holdout data.

**Pass Criteria:**
- Zero overlap between splits.
- Holdout performance independently verifiable.

---

# **POLICY PROMOTION (Tests 8–10)**

## **Test 8: Promotion Evaluator – Happy Path**

**Goal:** Approves when all four criteria are met.

**Setup:**
- Feed PolicyPromotionEvaluator with:
  - shadow metrics: divergence_score < 0.15, latency < 5%
  - A/B metrics: cost ↓5%, latency ↓5%, correctness ↑2%
  - holdout metrics: no overfitting, stable entropy
- Call `evaluate()`.

**Assertion:**
- Returns "approved".

**Pass Criteria:**
- Decision is "approved".

---

## **Test 9: Promotion Evaluator – Rejection Path**

**Goal:** Rejects when any criterion fails.

**Setup:**
- For each criterion (shadow, A/B, holdout, audit):
  - feed metrics that fail that criterion
  - keep others passing
  - call `evaluate()`.

**Assertion:**
- Every configuration returns "rejected".

**Pass Criteria:**
- All rejection paths tested and working.

---

## **Test 10: Promotion Audit Logging**

**Goal:** Every promotion decision is logged.

**Setup:**
- Call PolicyPromotionEvaluator.
- Write decision via PolicyPromotionAuditWriter.
- Query `policy_promotion_audit`.

**Assertion:**
- Row exists with:
  - checkpoint_id
  - reviewer_id
  - decision ("approved" or "rejected")
  - metrics_snapshot (all metrics preserved)

**Pass Criteria:**
- 100% logging accuracy; no lost audits.

---

# **ROLLBACK TRIGGERS & APPLICATION (Tests 11–14)**

## **Test 11: Rollback Trigger – Latency Violation**

**Goal:** High SPL inference latency triggers rollback.

**Setup:**
- Configure RollbackMonitor with latency threshold (default: 50ms).
- Simulate SPL inference latency > threshold.

**Assertion:**
- RollbackMonitor.check() returns RollbackSignal with reason "latency".

**Pass Criteria:**
- Signal fires correctly on latency violation.

---

## **Test 12: Rollback Trigger – Drift Increase**

**Goal:** Increased drift triggers rollback.

**Setup:**
- Configure RollbackMonitor with drift threshold (default: 5%).
- Simulate drift increasing beyond threshold.

**Assertion:**
- RollbackMonitor.check() returns RollbackSignal with reason "drift".

**Pass Criteria:**
- Signal fires correctly on drift violation.

---

## **Test 13: Rollback Trigger – Cost/Latency/Correctness Degradation**

**Goal:** Any degradation in core metrics triggers rollback.

**Setup:**
- For each metric (cost, latency, correctness):
  - simulate that metric increasing/decreasing beyond threshold
  - call RollbackMonitor.check().

**Assertion:**
- For each metric, RollbackSignal fires with correct reason.

**Pass Criteria:**
- All 8 trigger types (latency, drift, cost, latency, correctness, rejection_rate, audit_failure, etc.) tested and working.

---

## **Test 14: Rollback Application**

**Goal:** Rollback actually disables SPL influence.

**Setup:**
- Enable `spl_influence_enabled = true`.
- Trigger rollback via RollbackMonitor.
- Flip config: `spl_influence_enabled = false`.
- Run workload.

**Assertion:**
- Routing returns to static MAAL only.
- SPL remains in shadow mode only.

**Pass Criteria:**
- Routing behavior reverts to pre-SPL-influence state.

---

# **INTEGRATION & ISOLATION (Tests 15–18)**

## **Test 15: BridgeOrchestrator Integration Isolation**

**Goal:** Integration hooks don't alter core orchestration logic.

**Setup:**
- Diff BridgeOrchestrator behavior:
  - before Phase 3 changes
  - after Phase 3 changes
- Track call sequences (MAAL → ModelRouter → execution).

**Assertion:**
- Sequences are identical.
- Only addition is ShadowModeHook and ABTestHook calls (no data modification).

**Pass Criteria:**
- Zero behavioral drift in core orchestration.

---

## **Test 16: Telemetry Schema Adherence**

**Goal:** All writes match schema contracts.

**Setup:**
- Insert rows into:
  - `shadow_decisions`
  - `a_b_test_results`
  - `policy_promotion_audit`
- Read them back.

**Assertion:**
- All required columns present.
- All data types match schema.
- No NULL in non-nullable columns.

**Pass Criteria:**
- 100% schema compliance.

---

## **Test 17: No Phase 1/2 Mutation**

**Goal:** Phase 3 changes don't touch MAAL core or SPL offline sandbox.

**Setup:**
- CI rule: no diffs in:
  - `cic-os/src/core/maal/`
  - `cic-os/src/core/ledger/`
  - `cic-os/src/learning/`
  - `postgres/ledgers/training_*.sql`
  - `postgres/ledgers/routing_history.sql`
  - `postgres/ledgers/drift_ledger.sql`

**Assertion:**
- CI blocks any merge that modifies these paths.

**Pass Criteria:**
- CI enforcement in place and verified.

---

## **Test 18: Config Gating**

**Goal:** SPL influence is fully controlled by config flags.

**Setup:**
- Toggle `spl_influence_enabled` on/off.
- Toggle `spl_shadow_only` on/off.
- Run workload in each combination.

**Assertion:**
- Routing behavior changes only when config explicitly enables/disables SPL.

**Pass Criteria:**
- All four config states tested; behavior matches expectations.

---

# **END-TO-END & FREEZE (Tests 19–20)**

## **Test 19: End-to-End Shadow + A/B Run**

**Goal:** Combined system behaves as designed under load.

**Setup:**
- Run realistic workload (≥1,000 tasks).
- Enable shadow mode + A/B testing + governance.
- Measure:
  - cohort distribution
  - shadow telemetry volume
  - A/B telemetry volume
  - latency overhead
  - no execution changes

**Assertion:**
- All metrics within expected ranges:
  - cohort distribution: 90/10 ± 2%
  - latency overhead: < 20ms (p99)
  - execution traces: unchanged
  - telemetry: complete and correct

**Pass Criteria:**
- Realistic load passes all checks.

---

## **Test 20: Freeze Verification**

**Goal:** Tag `v0.3.0-spl-integration-foundation` represents a stable, tested state.

**Setup:**
- CI pipeline runs all Phase 3 tests.
- If all pass, create tag.
- If any fail, block tag.

**Assertion:**
- Tag only exists if all 20 tests pass.

**Pass Criteria:**
- Tag is gated on full test suite.

---

# **SUMMARY**

| Category | Tests | Coverage |
|----------|-------|----------|
| Shadow isolation | 1–3 | Execution integrity, telemetry, latency |
| A/B testing | 4–7 | Cohort assignment, metrics, isolation, holdout |
| Promotion | 8–10 | Happy path, rejection, audit |
| Rollback | 11–14 | All 8 triggers, application |
| Integration | 15–18 | B.O. isolation, schema, Phase 1/2 protection, config |
| E2E + freeze | 19–20 | Realistic load, tag gating |

**Total: 20 tests**  
**Required pass rate: 100%**  
**Gating: All must pass before v0.3.0 tag**

End Phase 3 Tests.
