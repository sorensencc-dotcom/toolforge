---
name: phase-3-integration-contract
description: Phase 3 SPL integration (immutable); shadow mode → A/B testing → governance-gated promotion; SPL never bypasses MAAL
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7868a049-3774-41db-ade2-dd9374785bc7
---

# **PHASE 3 INTEGRATION CONTRACT (IMMUTABLE)**
### **SPL → MAAL → CIC Integration (Shadow Mode → Controlled Influence → Governance‑Gated Promotion)**

This contract defines the **only** allowed behaviors, data flows, boundaries, and integration points for Phase 3.
No component may exceed these boundaries.
No file outside this contract may be created or modified.

---

# **SECTION 1 — PHASE 3 SCOPE (NON‑NEGOTIABLE)**

Phase 3 introduces SPL into the live routing stack **without allowing SPL to control execution** until governance approves.

### **Allowed in Phase 3**
- SPL inference in **shadow mode**
- SPL inference in **A/B test cohorts**
- SPL inference in **MAAL‑aware suggestion mode**
- Logging SPL decisions to new telemetry tables
- Offline evaluation of SPL vs MAAL decisions
- Governance‑gated policy promotion

### **Not allowed in Phase 3**
- SPL cannot:
  - override MAAL
  - bypass MAAL
  - modify CIC pipeline
  - write to routing_history or drift_ledger
  - influence execution outside approved cohorts
- No SPL training from live data
- No SPL writes to policy registry without EvolutionLoop approval
- No modification of Phase 1 or Phase 2 components

---

# **SECTION 2 — SHADOW MODE HARNESS (MANDATORY FIRST STEP)**

### **Behavior**
- SPL receives `RouteState` for every task.
- SPL produces `RouteAction` / scaffold.
- MAAL **ignores** SPL output for execution.
- SPL output is logged to `shadow_decisions`.

### **Shadow Mode Data Flow**
```
CIC → MAAL → ModelRouter → Execution
       │
       └──→ SPLPolicy (shadow) → shadow_decisions (telemetry only)
```

### **Shadow Mode Telemetry Schema**
Table: `shadow_decisions`

Columns:
```sql
CREATE TABLE shadow_decisions (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  task_fingerprint JSONB NOT NULL,
  spl_action JSONB NOT NULL,
  maal_action JSONB NOT NULL,
  divergence_score FLOAT NOT NULL,
  spl_confidence FLOAT NOT NULL,
  regime TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Exit Criteria**
Shadow mode must run for **N tasks** (configurable) with:
- divergence_score stabilizing
- no pathological SPL behaviors
- no latency violations

---

# **SECTION 3 — A/B TEST FRAMEWORK (CONTROLLED EXPOSURE)**

### **Cohort Assignment**
- 90% → MAAL static routing (control)
- 10% → SPL shadow inference only (treatment)
- 0% → SPL influence (until governance approval)

### **A/B Test Telemetry Schema**
Table: `a_b_test_results`

Columns:
```sql
CREATE TABLE a_b_test_results (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  cohort_id TEXT NOT NULL,
  spl_action JSONB,
  maal_action JSONB NOT NULL,
  correctness_delta FLOAT,
  cost_delta FLOAT,
  latency_delta FLOAT,
  drift_delta FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **A/B Test Safety Rules**
- SPL cannot influence execution
- SPL cannot modify constraints
- SPL cannot modify fallback graphs
- SPL cannot modify model selection

### **Exit Criteria**
- SPL must outperform MAAL on:
  - cost (X% reduction)
  - latency (Y% reduction)
  - correctness (Z% improvement)
- SPL must not increase drift

---

# **SECTION 4 — HOLDOUT VALIDATION (OFFLINE ONLY)**

### **Data Split**
- 70% training (Phase 2)
- 15% validation (Phase 2)
- 15% holdout (Phase 3)

### **Holdout Evaluation Metrics**
- policy stability
- divergence from MAAL
- reward consistency
- no overfitting to synthetic simulator

### **Holdout Telemetry Schema**
Table: `evaluation_results` (extended)

Columns:
```sql
ALTER TABLE evaluation_results ADD COLUMN (
  dataset_split TEXT,     -- "train", "val", "holdout"
  phase_number INT
);
```

### **Exit Criteria**
- Holdout performance must exceed validation performance
- No collapse in entropy
- No mode collapse to single action

---

# **SECTION 5 — MAAL‑AWARE SUGGESTION MODE (CONTROLLED INFLUENCE)**

### **Behavior**
- SPL proposes scaffold
- MAAL validates:
  - constraints
  - fallback graph
  - cost ceilings
  - latency ceilings
- MAAL may:
  - accept
  - modify
  - reject

### **Data Flow**
```
SPL → ProposedScaffold
MAAL → ValidatedScaffold
CIC → Execution
```

### **Telemetry**
- `policy_promotion_audit` logs:
  - SPL proposal
  - MAAL modifications
  - MAAL rejections
  - audit outcomes

---

# **SECTION 6 — POLICY PROMOTION RULES (GOVERNANCE‑GATED)**

### **Promotion Requirements**
A policy checkpoint may be promoted only if:

1. **Shadow mode metrics**:
   - divergence_score < 0.15 (tunable)
   - latency impact < 5% (tunable)

2. **A/B test metrics**:
   - SPL improves cost by X% (tunable)
   - SPL improves latency by Y% (tunable)
   - SPL improves correctness by Z% (tunable)

3. **Holdout metrics**:
   - no overfitting (val_loss ≈ holdout_loss)
   - stable entropy (std < threshold)
   - stable reward trajectory (no collapse)

4. **GovernanceEvolutionLoop approval**:
   - human‑in‑the‑loop review
   - audit logs reviewed
   - drift analysis reviewed

### **Promotion Telemetry Schema**
Table: `policy_promotion_audit`

Columns:
```sql
CREATE TABLE policy_promotion_audit (
  id SERIAL PRIMARY KEY,
  checkpoint_id TEXT NOT NULL UNIQUE,
  reviewer_id TEXT NOT NULL,
  decision TEXT NOT NULL,  -- "approved", "rejected", "deferred"
  justification TEXT,
  metrics_snapshot JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# **SECTION 7 — ROLLBACK RULES (MANDATORY)**

### **Immediate rollback triggers**
- SPL inference latency > 50ms
- SPL proposes invalid scaffold
- MAAL rejects > 30% of SPL proposals
- Drift increases > 5% (tunable)
- Cost increases > 10% (tunable)
- Latency increases > 10% (tunable)
- Correctness decreases > 5% (tunable)
- Any audit failure

### **Rollback Behavior**
- SPL influence disabled
- MAAL static routing restored
- SPL remains in shadow mode
- Governance notified
- Incident logged to `rollback_incidents`

### **Rollback Telemetry Schema**
Table: `rollback_incidents`

Columns:
```sql
CREATE TABLE rollback_incidents (
  id SERIAL PRIMARY KEY,
  incident_id TEXT UNIQUE NOT NULL,
  trigger_reason TEXT NOT NULL,
  policy_version TEXT,
  rollback_time BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# **SECTION 8 — DATA FLOW DIAGRAM (IMMUTABLE)**

```
                ┌──────────────────────────────┐
                │        CIC Pipeline          │
                │    (MAAL routed tasks)       │
                └──────────────┬──────────────┘
                               │
                               ▼
                      ┌────────────────┐
                      │     MAAL       │
                      │   (Phase 1)    │
                      └───────┬────────┘
                              │
                  ┌───────────┴───────────┐
                  │ (shadow mode)         │ (active influence)
                  ▼                       ▼
         ┌──────────────────┐    ┌──────────────────┐
         │    SPLPolicy     │    │   ModelRouter    │
         │   (Phase 2)      │    │    (MAAL)        │
         └───────┬──────────┘    └────────┬─────────┘
                 │                        │
                 ▼                        ▼
         shadow_decisions         Execution → CIC
```

**Critical:** SPL never touches execution path directly. MAAL is always final arbiter.

---

# **SECTION 9 — INTEGRATION CHECKPOINTS (IMMUTABLE BOUNDARIES)**

Phase 3 must **not** modify:

- `cic-os/src/core/maal/` (Phase 1 MAAL core)
- `cic-os/src/core/ledger/` (Phase 1 ledger substrate)
- `postgres/ledgers/routing_history.sql` (Phase 1)
- `postgres/ledgers/drift_ledger.sql` (Phase 1)
- `cic-os/src/learning/` (Phase 2 simulator/training)
- `postgres/ledgers/training_*.sql` (Phase 2 telemetry)

Phase 3 may only create:

- `cic-ingestion/src/integration/` (shadow harness, A/B test framework, governance gates)
- `postgres/ledgers/shadow_decisions.sql`
- `postgres/ledgers/a_b_test_results.sql`
- `postgres/ledgers/policy_promotion_audit.sql`
- `postgres/ledgers/rollback_incidents.sql`

---

# **SECTION 10 — PHASE 3 TEST CONTRACTS**

By Phase 3 completion, these 20 tests must pass:

```
Shadow Mode (5 tests)
- [ ] Shadow harness runs without impacting execution
- [ ] divergence_score computed correctly
- [ ] spl_confidence matches policy entropy
- [ ] shadow_decisions telemetry schema valid
- [ ] No writes to execution ledgers from shadow mode

A/B Testing (5 tests)
- [ ] Cohort assignment is deterministic (90/10 split)
- [ ] A/B metrics computed correctly
- [ ] No crossover between cohorts
- [ ] a_b_test_results schema valid
- [ ] Cost/latency/correctness deltas bounded

Holdout Validation (3 tests)
- [ ] Holdout data isolated from training/validation
- [ ] Holdout metrics show no overfitting
- [ ] Entropy stability verified

Policy Promotion (4 tests)
- [ ] Promotion gates enforce all criteria
- [ ] GovernanceEvolutionLoop integration verified
- [ ] Audit logs complete and immutable
- [ ] Policy versioning correct

Rollback (3 tests)
- [ ] Rollback triggers on latency violation
- [ ] Rollback triggers on MAAL rejection rate
- [ ] Rollback restores static routing deterministically
```

---

# **SECTION 11 — FREEZE & HANDOFF**

After Phase 3 completion:

1. All shadow mode metrics collected
2. A/B test results analyzed
3. Holdout validation passed
4. Policy promotion decision made (governance-approved or rejected)
5. Tag: `v0.3.0-spl-integration-foundation`

If promotion approved:
- Policy moves to "active" status
- MAAL-aware suggestion mode enabled in controlled regimes
- Rollback procedures in place
- Governance monitoring active

If promotion rejected:
- SPL remains in shadow mode
- Root causes analyzed
- Phase 3 re-runs with tuned parameters

---

End Phase 3 Integration Contract.
