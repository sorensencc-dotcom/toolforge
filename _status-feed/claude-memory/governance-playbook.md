---
name: governance-playbook
description: "Phase 3 governance playbook; promotion/rollback workflows, roles, guardrails, cadence"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7868a049-3774-41db-ade2-dd9374785bc7
---

# **GOVERNANCE PLAYBOOK (PHASE 3)**

Operational runbooks for promotion, rollback, and oversight of SPL in live routing.

---

# **SECTION 1 — ROLES & RESPONSIBILITIES**

## **Governance Reviewer**
- **Owns:** Policy promotion decisions
- **Responsibilities:**
  - Reviews shadow/A/B/holdout metrics weekly
  - Approves or rejects promotion requests
  - Inspects divergence trends and drift behavior
  - Signs off on policy activations
- **Authority:** Can block promotions indefinitely; can demand retraining or parameter tuning

## **Ops Owner**
- **Owns:** Configuration, rollback, incident response
- **Responsibilities:**
  - Monitors rollback triggers continuously
  - Executes rollback (disables SPL influence) within 30 seconds of signal
  - Toggles `spl_influence_enabled` and `spl_shadow_only` flags
  - Logs all config changes with justification
  - Notifies governance reviewer on rollback
- **Authority:** Can trigger immediate rollback without approval; must notify reviewer

## **ML Owner**
- **Owns:** SPL training, evaluation, root cause analysis
- **Responsibilities:**
  - Trains new policy checkpoints
  - Runs holdout evaluation
  - Analyzes rejection reasons
  - Conducts RCA on rollback events
  - Proposes reward weight tuning or simulator adjustments
  - Monitors policy entropy and convergence
- **Authority:** Can request retraining cycle; can propose reward adjustments to governance reviewer

---

# **SECTION 2 — POLICY PROMOTION WORKFLOW**

### **Preconditions**
- Shadow mode has run for ≥ N tasks (default: 10,000)
- A/B test has run for ≥ M tasks (default: 100,000)
- Holdout evaluation completed on held-out 15% of data
- No rollback incidents in the last 7 days

### **Step 1: Metrics Collection & Aggregation**

**Owner:** ML Owner  
**Frequency:** Weekly  
**Inputs:** Latest checkpoint ID from Phase 2 training

**Actions:**
- Query `shadow_decisions` for latest checkpoint:
  - Compute mean/std of divergence_score
  - Compute latency overhead (p50, p95, p99)
- Query `a_b_test_results`:
  - Compute cost_delta, latency_delta, correctness_delta
  - Segment by regime (control vs shadow)
- Query `evaluation_results` (holdout split):
  - Extract holdout metrics (reward, entropy, success_rate)

**Outputs:**
- Metrics snapshot JSON (shadow, A/B, holdout)
- Timestamp and checkpoint_id

**Exit Criteria:**
- Snapshot contains all required metrics
- Data age < 7 days

---

### **Step 2: Automated Pre-Check**

**Owner:** Governance Reviewer (or automated policy)  
**Frequency:** Continuous (on new metrics)  
**Inputs:** Metrics snapshot from Step 1

**Actions:**
- Feed snapshot to `PolicyPromotionEvaluator.evaluate()`
- If decision == "rejected":
  - Stop workflow; document reason; notify ML owner
  - Return to training/retuning phase
- If decision == "approved":
  - Continue to Step 3 (human review)

**Outputs:**
- Promotion evaluator decision ("approved" or "rejected")
- Timestamp

**Exit Criteria:**
- Decision recorded (can be automated or manual)

---

### **Step 3: Human Review**

**Owner:** Governance Reviewer  
**Frequency:** Weekly (or on demand if auto-approved)  
**Inputs:** Metrics snapshot, evaluator decision

**Actions:**
Reviewer inspects:
- **Divergence trends:** Is SPL proposing actions systematically different from MAAL? Are trends stable or oscillating?
- **Cost deltas:** What is the magnitude? Positive (good) or negative (bad)?
- **Latency deltas:** Any p99 spikes? Any consistent overhead?
- **Correctness deltas:** How large? Positive or negative?
- **Drift behavior:** Is drift increasing, stable, or decreasing?
- **Entropy stability:** Is policy converging to a few actions, or exploring broadly?
- **Rejection rate:** How often does MAAL reject SPL proposals? (if known)
- **Incident history:** Any rollback events recently? Why?

**Checklist:**
- [ ] All four metric categories are present
- [ ] Metrics are within expected ranges (pre-defined thresholds)
- [ ] No pathological behavior (e.g., mode collapse, divergence explosion)
- [ ] Metrics show improvement or equivalence vs MAAL baseline
- [ ] Drift is not increasing
- [ ] Entropy is non-zero (policy is exploring)
- [ ] No incidents in the past 7 days
- [ ] Training data is representative (no major distribution shifts)

**Outputs:**
- Approval or rejection decision
- Justification (1–2 sentences)
- Timestamp
- Reviewer ID

**Exit Criteria:**
- Decision and justification documented

---

### **Step 4: Decision & Logging**

**Owner:** Governance Reviewer  
**Frequency:** On completion of Step 3  
**Inputs:** Decision and justification from Step 3

**Actions:**
- Record decision via `PolicyPromotionAuditWriter`:
  - `checkpoint_id`: from Phase 2 checkpoint
  - `reviewer_id`: reviewer's ID
  - `decision`: "approved" or "rejected"
  - `justification`: text
  - `metrics_snapshot`: full metrics JSON
- Write to `policy_promotion_audit` table
- Notify ML owner and ops owner of outcome

**Outputs:**
- Audit log row

**Exit Criteria:**
- Row exists in `policy_promotion_audit`
- Notifications sent

---

### **Step 5: Activation (if Approved)**

**Owner:** Ops Owner  
**Frequency:** On approval (may be deferred)  
**Inputs:** Approved checkpoint ID, scope (regime, cohort, or production)

**Preconditions:**
- All previous steps completed
- Ops owner confirms readiness
- On-call team is staffed
- RollbackMonitor is active

**Actions:**
- Set config flag: `spl_influence_enabled = true`
- Set scope via config:
  - `spl_influence_regimes`: ["low_cost_internal", "batch"] (start narrow)
  - OR `spl_influence_cohort_pct`: 5% (start small)
- Log config change with justification
- Alert ops team: "SPL influence activated on [scope]"

**Monitoring (first 24–48 hours):**
- Ops owner watches RollbackMonitor continuously
- Check:
  - latency overhead (p99 < 20ms)
  - rollback signals (should be zero or very low)
  - cost delta (should be negative or neutral)
  - correctness delta (should be positive or neutral)
- If any rollback signal fires → execute Step 6 (rollback)

**Outputs:**
- Config change logged
- Activation event recorded
- Alerts sent to on-call

**Exit Criteria:**
- Config updated
- Monitoring active
- No rollback in first 24 hours → proceed to gradual expansion

---

# **SECTION 3 — ROLLBACK WORKFLOW**

### **Preconditions**
- RollbackMonitor is active
- Ops owner is on-call
- Rollback decision can be made in < 1 minute

### **Step 1: Detection**

**Owner:** RollbackMonitor (automated)  
**Frequency:** Continuous  
**Inputs:** Live metrics (latency, drift, cost, correctness, rejection rate, etc.)

**Triggers:**
- SPL inference latency > 50ms (p99)
- Divergence score > 0.25 (or threshold)
- Drift increase > 5%
- Cost increase > 10%
- Latency increase > 10%
- Correctness decrease > 5%
- MAAL rejection rate > 30%
- Any audit failure

**Outputs:**
- RollbackSignal: { reason, timestamp }

**Exit Criteria:**
- Signal is emitted to alerting system

---

### **Step 2: Immediate Action**

**Owner:** Ops Owner  
**SLA:** < 30 seconds from detection  
**Inputs:** RollbackSignal from Step 1

**Actions:**
- **Immediate:** Disable SPL influence:
  ```
  spl_influence_enabled = false
  spl_shadow_only = true
  ```
- **Immediate:** Alert on-call team:
  - Slack: "@oncall SPL rollback triggered: [reason]"
  - Page if critical
- **Log:** Record rollback event with:
  - reason
  - timestamp
  - affected regime/cohort
  - metrics snapshot at time of rollback

**Outputs:**
- Config updated
- Alerts sent
- Incident logged

**Exit Criteria:**
- Config change applied within 30 seconds
- Alerts acknowledged

---

### **Step 3: Audit & Verification**

**Owner:** Ops Owner  
**Frequency:** Immediately after rollback  
**Inputs:** Rollback log and metrics snapshot

**Actions:**
- Verify routing returned to MAAL-only (static):
  - Sample 100 requests post-rollback
  - Confirm all use MAAL, zero SPL influence
- Check latency/cost/correctness post-rollback:
  - Should return to baseline immediately
- Document:
  - What was the exact trigger?
  - What metrics were affected?
  - Timeline of events leading up to rollback

**Outputs:**
- Verification report

**Exit Criteria:**
- Routing confirmed as MAAL-only
- Metrics returning to baseline

---

### **Step 4: Root Cause Analysis**

**Owner:** ML Owner  
**Frequency:** Within 4 hours of rollback  
**Inputs:** Rollback log, metrics snapshot, training history

**Actions:**
Investigate:
- Recent policy changes (reward weights, architecture)
- Simulator assumptions vs live data (did live routing differ significantly?)
- Reward function miscalibration (is penalty structure correct?)
- Data distribution shift (did live data change significantly?)
- MAAL constraint changes (did MAAL rules shift?)

**Outputs:**
- RCA report with findings and hypothesis

**Exit Criteria:**
- RCA documented; hypothesis identified

---

### **Step 5: Remediation**

**Owner:** ML Owner  
**Frequency:** Within 24 hours of rollback  
**Inputs:** RCA findings from Step 4

**Actions** (choose one or more):
- **Revert:** Revert to previous checkpoint (if available)
- **Retrain:** Retrain policy with:
  - Adjusted reward weights
  - New simulator assumptions
  - Different hyperparameters
- **Adjust thresholds:** Loosen rollback thresholds temporarily (if trigger was spurious)
- **Freeze:** Hold SPL in shadow-only indefinitely if root cause is unclear

**Outputs:**
- Remediation action taken
- New checkpoint (if retraining) or threshold change documented

**Exit Criteria:**
- Action completed; root cause addressed

---

### **Step 6: Re-Entry**

**Owner:** Governance Reviewer  
**Frequency:** After remediation complete  
**Inputs:** Remediation action, new checkpoint (if applicable)

**Actions:**
- Return to **Promotion Workflow, Step 1** (fresh collection)
- Do not re-enable SPL influence until a new promotion cycle completes
- Require new metrics collection and human sign-off

**Outputs:**
- Fresh promotion cycle initiated

**Exit Criteria:**
- Promotion workflow re-entered

---

# **SECTION 4 — GUARDRAILS**

### **No Auto-Promotion**
- Policies are never promoted without explicit human sign-off.
- `PolicyPromotionEvaluator` produces a *recommendation*, not a decision.
- Governance reviewer must review and approve.

### **No Silent Rollback**
- Every rollback is logged and auditable.
- Rollback reason is recorded.
- Incident is surfaced to governance reviewer within 4 hours.

### **Config as Circuit Breaker**
- `spl_influence_enabled` is a binary kill-switch.
- No nuanced "partial influence" without explicit governance approval.
- Ops owner can flip it off immediately without approval.

### **Telemetry as Source of Truth**
- All promotion/rollback decisions reference recorded metrics.
- Decisions are never based on intuition or informal reports.
- Every decision includes a metrics snapshot for audit.

### **Phase Isolation**
- Phase 3 never modifies Phase 1 (MAAL) or Phase 2 (training harness).
- SPL is always downstream of MAAL.
- MAAL constraints are always enforced.

---

# **SECTION 5 — CADENCE**

### **Weekly Governance Review**
- **Owner:** Governance Reviewer + ML Owner
- **Duration:** 30–60 minutes
- **Agenda:**
  - Review latest shadow/A/B metrics
  - Review any rollback events
  - Approve or reject pending promotion requests
  - Discuss ongoing training runs

### **Monthly Architecture Review**
- **Owner:** Governance Reviewer + ML Owner + Ops Owner
- **Duration:** 60–90 minutes
- **Agenda:**
  - Reassess thresholds and trigger levels
  - Discuss reward weight evolution
  - Review simulator assumptions vs live behavior
  - Plan next training cycle
  - Discuss expansion scope (more regimes, more agents)

### **Release Gating**
- **Before deploying any change to:**
  - SPL policy
  - MAAL constraints
  - Reward weights
  - Rollback thresholds
- **Required:** Governance review + approval + metrics audit

### **Incident Response**
- **Rollback:** Ops owner acts immediately; review within 4 hours
- **RCA:** Complete within 24 hours
- **Remediation:** Deploy within 48 hours
- **Re-entry:** Full promotion cycle (minimum 7 days)

---

# **SECTION 6 — DECISION TEMPLATES**

### **Promotion Approval Template**

```
Policy Checkpoint: <checkpoint_id>
Review Date: <date>
Reviewer: <name>

DECISION: APPROVED ✓

Metrics Summary:
- Shadow divergence_score: <value> (target: < 0.15) ✓
- Shadow latency overhead: <value> (target: < 5%) ✓
- A/B cost delta: <value> (target: ↓) ✓
- A/B latency delta: <value> (target: ↓) ✓
- A/B correctness delta: <value> (target: ↑) ✓
- Holdout performance: <value> (no overfitting) ✓
- Recent incidents: None ✓

Justification:
Policy demonstrates consistent improvement across all metrics. No pathological behavior observed. Ready for limited activation in [regime/cohort].

Recommended scope:
- Regimes: [list]
- Cohort: [X]%
- Monitoring: [duration]
```

### **Rollback Incident Template**

```
Incident ID: <id>
Rollback Timestamp: <time>
Trigger Reason: <reason>
Policy Version: <version>

Triggered Signal:
- Metric: <metric_name>
- Threshold: <threshold>
- Observed value: <value>
- Duration: <how long exceeded>

Response:
- Config disabled at: <time>
- Verification complete at: <time>
- Routing returned to MAAL-only: YES ✓

RCA Status: [In Progress / Complete]
Estimated remediation: [date]
```

---

# **SUMMARY**

| Event | Owner | SLA | Workflow |
|-------|-------|-----|----------|
| Metrics collected | ML Owner | Weekly | Aggregation |
| Pre-check | Auto / Reviewer | 1 day | Evaluation |
| Human review | Reviewer | 1 day | Inspection + checklist |
| Approval logged | Reviewer | Same day | Audit write |
| Activation | Ops | On approval | Config + monitoring |
| Rollback detected | RollbackMonitor | Immediate | Alert |
| Rollback executed | Ops Owner | < 30 sec | Config flip |
| RCA complete | ML Owner | < 24 hours | Investigation |
| Re-entry | Reviewer | After remediation | New promotion cycle |

End Governance Playbook.
