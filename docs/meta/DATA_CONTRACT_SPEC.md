# Data Contract Specification Template

**Version:** 1.0  
**Status:** Tier 1 approval pending  
**Author:** Architecture (Chris)  

---

## Overview

Data Contracts define shared-state semantics for multi-agent flows. Enforce:
- **State ownership** (which agent authors/mutates what)
- **Threading rules** (when/how state is accessed, atomic boundaries)
- **Failure modes** (what happens if invariants break)
- **Recovery semantics** (resumption after drift/error)

---

## Template

### 1. Metadata
```yaml
contract_name: <name>
phase: <phase-wave>
agents: [agent1, agent2, ...]
shared_state: [StateA, StateB, ...]
threading_model: <sequential|parallel|mixed>
approval_tier: 1
approved_date: <YYYY-MM-DD>
```

### 2. Shared State Schema

**Per state object:**
```yaml
StateX:
  owner: <primary-agent>
  mutations: [agent1, agent2]  # agents allowed to write
  readers: [agent1, agent2, agent3]  # agents allowed to read
  schema:
    field1: type (invariant: constraint)
    field2: type (invariant: constraint)
  atomicity: <single-operation|multi-operation|none>
  versioning: <none|vector|timestamp>
```

**Example:** Phase 27 Wave E
```yaml
DriftSignal:
  owner: CodeLevelDriftDetector
  mutations: [CodeLevelDriftDetector]
  readers: [InstinctOps, ExecutionPolicyAutoHealing]
  schema:
    type: 'KS'|'WA'|'OP'|'RR' (invariant: non-null, enum)
    severity: 0.0-1.0 (invariant: severity >= 0.8 → hard drift)
    timestamp: ISO8601 (invariant: monotonic increasing)
    details: object
  atomicity: single-operation
  versioning: timestamp
```

### 3. Threading Rules

**Execution Model**
```
[ Upstream State ] → [Agent A] → [ Shared State ] → [Agent B] → [ Output State ]
                      acquire read lock (timeout T)
                                       acquire write lock
                                       [mutation]
                                       release write lock (broadcast event)
                      [read]
                      release read lock
```

**Per Agent:**
```yaml
Agent_A:
  reads: [StateX, StateY]
  writes: [StateZ]
  blocking: false  # if true, downstream waits for completion
  timeout_ms: 5000
  on_timeout: <halt|skip|fallback>
  retry_policy: <none|exponential|fixed>
  max_retries: 3
```

### 4. Invariants & Safety

**Pre-conditions** (must hold before agent executes):
```yaml
  - name: <invariant-name>
    condition: <expression>
    severity: <critical|high|medium>
```

**Post-conditions** (must hold after agent executes):
```yaml
  - name: <invariant-name>
    condition: <expression>
    severity: <critical|high|medium>
```

**Atomicity Boundaries:**
- Single-op: mutation is atomic (no intermediate state visible)
- Multi-op: define checkpoints where state is consistent
- None: state may be partially mutated; readers see stale/partial state

### 5. Failure Modes & Recovery

**Detection**
```yaml
Failure_Mode_X:
  signal: <condition that triggers>
  detector: <agent|external-monitor>
  latency_ms: <detection time SLA>
```

**Response**
```yaml
  action: <halt|rollback|compensate|retry>
  rollback_strategy: <none|undo-last-op|restore-checkpoint>
  approval_required: <true|false>
  timeout_before_escalate_ms: 30000
```

**Phase 27 Wave E Example**
```yaml
Runaway_Repair_Detected:
  signal: driftScore > 0.8 && type in [KS, RR]
  detector: CodeLevelDriftDetector
  latency_ms: 100
  action: halt
  rollback_strategy: restore-checkpoint (pre-repair state)
  approval_required: true
  timeout_before_escalate_ms: 5000
```

### 6. State Diagram

```
PHASE 27 WAVE E: SIX RULES FRAMEWORK

  [Plan Input]
         ↓
  [InstinctOps.beforePlan()]  ← Enforce: Define Done
         ↓
  [CodePlan] ──→ (owner: repairAgent)
         ↓
  [InstinctOps.beforeCode()]  ← Enforce: Plan Before Code
         ↓
  [CodeExecution]
         ↓
  [Code + Tests + Criteria] ──→ (owner: execAgent)
         ↓
  [CodeLevelDriftDetector.check()]
         ├─→ NO DRIFT: proceed
         ├─→ SOFT DRIFT (WA, OP): auto-heal
         └─→ HARD DRIFT (KS, RR): halt + escalate
         ↓
  [DriftSignal] ──→ (owner: detector)
         ↓
  [ExecutionPolicyAutoHealing.onDriftDetected()]
         ├─→ Shrink scope (KS)
         ├─→ Extract logic (WA)
         ├─→ Add error tests (OP)
         └─→ Freeze arch (RR)
         ↓
  [Healed Plan + Constraints] ──→ (owner: healer)
         ↓
  [Resume Gate] → approval or reject
         ↓
  [Output]
```

### 7. Integration Checklist

- [ ] Shared state defined with owners/readers/writers
- [ ] Threading rules documented (locks, timeouts, retry)
- [ ] Invariants (pre/post) formalized
- [ ] Failure modes enumerated + recovery actions
- [ ] State diagram hand-drawn or ASCII
- [ ] Example walkthrough (happy path + failure path)
- [ ] Test matrix covers all threading/failure combinations
- [ ] Agents acknowledge contract (code references data contract version)
- [ ] Tier 1 approval (CI gates block dispatch if contract missing)

### 8. Example: Phase 27 Wave E Integration

**Contract Version:** `six-rules-framework:1.0`

**Agents:**
- `CodeLevelDriftDetector`: detects drift, emits DriftSignal
- `InstinctOps`: enforces biases upfront, validates criteria
- `ExecutionPolicyAutoHealing`: generates healing plan, updates constraints

**Shared States:**
1. `CodePlan` (owner: repairAgent, readers: detector+healer)
2. `DriftSignal` (owner: detector, readers: healer, mutators: none after emit)
3. `HealingPlan` (owner: healer, readers: resumeGate)
4. `Constraints` (owner: detector, mutators: healer)

**Threading:** Sequential (detector → healer → resume gate)

**Critical Invariants:**
- `DriftSignal.type` must be enum (KS|WA|OP|RR)
- `DriftSignal.severity >= 0.8` iff hard drift
- Post-healing: `newConstraints ⊃ oldConstraints` (monotonic)
- No state mutation after emission (read-only replicas)

**Recovery:**
- Hard drift → manual approval required
- Soft drift → auto-heal up to 2 retries
- Checkpoint before each repair phase

---

## Governance Integration

**Gating Rule (ijfw-spec-phase):**
```
IF (spec.agents.count > 1) AND (spec.touches[shared_state])
  THEN require(data_contract_present)
  ELSE skip()
```

**Failure Mode:** Spec cannot dispatch without data contract. CI blocks merge.

**Update Cadence:** Monthly (review contracts for drift/obsolescence)

---

## Related Documents

- Phase 27 Wave E Six Rules Framework (implementation)
- CIC Global Operating Rules v1.3 (governance)
- ExecutionPolicy Architecture (existing execution model)
- Drift Detection & Response Playbook
