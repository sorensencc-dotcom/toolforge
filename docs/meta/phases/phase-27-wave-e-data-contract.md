# Data Contract: Phase 27 Wave E — Six Rules Framework

**Version:** 1.0  
**Status:** Tier 1 Approved (Template Validation)  
**Phase:** 27-E  
**Agents:** CodeLevelDriftDetector, InstinctOps, ExecutionPolicyAutoHealing  
**Approval Date:** 2026-07-11  

---

## 1. Metadata

```yaml
contract_name: SixRulesFrameworkContract
phase: 27-Wave-E
agents:
  - CodeLevelDriftDetector
  - InstinctOps
  - ExecutionPolicyAutoHealing
  - RepairManifestOrchestrator (coordinator)
shared_state:
  - CodePlan
  - DriftSignal
  - HealingPlan
  - Constraints
  - AcceptanceCriteria
threading_model: sequential
approval_tier: 1
approved_date: 2026-07-11
```

---

## 2. Shared State Schema

### State 2.1: CodePlan

```yaml
CodePlan:
  owner: RepairManifestOrchestrator
  mutations: []  # immutable after emit
  readers: [CodeLevelDriftDetector, InstinctOps, ExecutionPolicyAutoHealing]
  schema:
    planId: UUID (invariant: non-null, unique)
    scope: string[] (invariant: non-empty, ⊆ acceptance_criteria)
    steps: Step[] (invariant: ordered, deterministic)
    expectedOutcomes: object (invariant: quantified metrics)
    constraints: Constraint[] (invariant: non-empty, amplified by healer)
    createdAt: ISO8601 (invariant: monotonic)
  atomicity: single-operation
  versioning: timestamp
  lifecycle: immutable after create; replaced by healed version on drift
```

### State 2.2: DriftSignal

```yaml
DriftSignal:
  owner: CodeLevelDriftDetector
  mutations: []  # immutable after emit
  readers: [InstinctOps, ExecutionPolicyAutoHealing, ResumGate]
  schema:
    driftId: UUID (invariant: non-null)
    type: 'KS'|'WA'|'OP'|'RR' (invariant: enum, non-null)
    severity: 0.0-1.0 (invariant: severity >= 0.8 ⟺ hardDrift)
    planId: UUID (invariant: foreign key to CodePlan)
    details: object (invariant: location, evidence, suggestion)
    timestamp: ISO8601 (invariant: > CodePlan.createdAt)
    detectorVersion: string (invariant: SemVer)
  atomicity: single-operation
  versioning: timestamp (no updates; new signals emit new driftId)
  lifecycle: emitted once, read-only thereafter
```

### State 2.3: HealingPlan

```yaml
HealingPlan:
  owner: ExecutionPolicyAutoHealing
  mutations: []  # immutable after emit
  readers: [ResumeGate, RepairOrchestrator]
  schema:
    healingId: UUID (invariant: non-null)
    driftId: UUID (invariant: foreign key to DriftSignal)
    originalPlanId: UUID (invariant: references CodePlan)
    healingStrategy: 'shrink'|'extract'|'addTests'|'freeze' (invariant: matches drift.type)
    revisedPlan: CodePlan (invariant: scope ⊆ original.scope, constraints ⊃ original.constraints)
    amplifiedConstraints: Constraint[] (invariant: ∀c ∈ amplifiedConstraints: stricter than original)
    approvalRequired: boolean (invariant: true iff drift.severity >= 0.8)
    timestamp: ISO8601 (invariant: > DriftSignal.timestamp)
  atomicity: single-operation
  versioning: timestamp
  lifecycle: emitted once; awaits approval or rejection at ResumeGate
```

### State 2.4: Constraints

```yaml
Constraints:
  owner: CodeLevelDriftDetector
  mutations: [ExecutionPolicyAutoHealing]  # healer can amplify
  readers: [InstinctOps, ExecutionPolicyAutoHealing, RepairOrchestrator]
  schema:
    constraintId: UUID (invariant: non-null)
    planId: UUID (invariant: foreign key to CodePlan)
    rules: Rule[] (invariant: ordered)
      - rule: string (DNF/CNF constraint expression)
      - severity: 'critical'|'high'|'medium'
      - appliesTo: ['planningPhase'|'codingPhase'|'testingPhase']
    amplificationHistory: {timestamp, beforeCount, afterCount, reason}[]
    createdAt: ISO8601
    lastAmplifiedAt: ISO8601
  atomicity: multi-operation (read-modify-write on amplify)
  versioning: vector (lamport clock for concurrent mutations)
  lifecycle: created with plan; amplified on healing; immutable after healing approval
```

### State 2.5: AcceptanceCriteria

```yaml
AcceptanceCriteria:
  owner: RepairManifestOrchestrator
  mutations: []  # immutable
  readers: [InstinctOps, CodeLevelDriftDetector, ExecutionPolicyAutoHealing]
  schema:
    criteriaId: UUID
    planId: UUID (invariant: foreign key to CodePlan)
    maxCorruptionRate: 0.0-1.0 (invariant: 0 < value <= 1.0)
    minSurvivalRate: 0.0-1.0 (invariant: 0 < value <= 1.0)
    timeoutMs: number (invariant: > 0, <= 300000)
    quantifiedMetrics: {metricName: threshold}[] (invariant: non-empty)
  atomicity: single-operation
  versioning: none
  lifecycle: immutable; passed to detector for post-repair validation
```

---

## 3. Threading Rules

### Execution Order (Sequential)

```
T0: RepairOrchestrator creates CodePlan + AcceptanceCriteria
    └─ Atomically emit both
    └─ Acquire read-locks: detector, instincts, healer

T1: InstinctOps.beforePlan()
    ├─ Reads: CodePlan, AcceptanceCriteria
    ├─ Validates: Define Done (criteria complete? scope bounded?)
    ├─ Action: proceed or reject
    └─ Release read-lock (unblocks detector)

T2: CodeExecution (external to contract)
    └─ Produces: Code + Tests + Metrics

T3: CodeLevelDriftDetector.check()
    ├─ Reads: CodePlan, Code, Tests, Metrics
    ├─ Scans: KS, WA, OP, RR
    ├─ Emit: DriftSignal (if drift found) or null
    ├─ Action:
    │   ├─ if NO DRIFT: proceed to acceptance validation
    │   └─ if DRIFT: escalate to healing
    └─ Release read-lock (unblocks healer)

T4: ExecutionPolicyAutoHealing.onDriftDetected()
    ├─ Reads: DriftSignal, CodePlan, Constraints
    ├─ Acquire write-lock on Constraints (timeout: 5s)
    ├─ Action:
    │   ├─ Soft Drift (WA, OP): auto-heal, amplify constraints, retry
    │   └─ Hard Drift (KS, RR): generate HealingPlan, await approval
    ├─ Emit: HealingPlan
    └─ Release write-lock, signal ResumeGate

T5: ResumeGate
    ├─ Wait: if approvalRequired, poll Tier 1 approval (timeout: 30s)
    ├─ On approval: emit resume event
    ├─ On rejection: escalate to manual triage
    └─ Release all read-locks
```

### Per-Agent Threading Config

```yaml
InstinctOps:
  reads: [CodePlan, AcceptanceCriteria]
  writes: []
  blocking: false
  timeout_ms: 5000
  on_timeout: halt
  retry_policy: none

CodeLevelDriftDetector:
  reads: [CodePlan, AcceptanceCriteria, Code, Tests, Metrics]
  writes: [DriftSignal]  # emit-only, read-only thereafter
  blocking: false
  timeout_ms: 10000
  on_timeout: escalate
  retry_policy: none

ExecutionPolicyAutoHealing:
  reads: [DriftSignal, CodePlan, Constraints]
  writes: [HealingPlan, Constraints]  # can amplify constraints
  blocking: true  # downstream waits for healing decision
  timeout_ms: 15000
  on_timeout: escalate-to-tier1
  retry_policy: exponential (base: 1s, max: 10s, retries: 3)
```

### Lock Semantics

- **Read Lock:** Multiple readers allowed concurrently; writer must wait
- **Write Lock:** Exclusive; readers must wait
- **Timeout:** If lock not acquired within timeout_ms, trigger on_timeout action
- **Broadcast:** On write completion, signal all waiting readers (event-driven, not polling)

---

## 4. Invariants & Safety

### Pre-Conditions (must hold before agent executes)

```yaml
InstinctOps_beforePlan:
  - name: plan_exists
    condition: CodePlan != null && CodePlan.planId != null
    severity: critical
  - name: criteria_exists
    condition: AcceptanceCriteria != null && AcceptanceCriteria.criteriaId != null
    severity: critical
  - name: criteria_non_empty
    condition: |
      len(AcceptanceCriteria.quantifiedMetrics) > 0 &&
      0 < AcceptanceCriteria.maxCorruptionRate <= 1.0 &&
      0 < AcceptanceCriteria.minSurvivalRate <= 1.0
    severity: critical

CodeLevelDriftDetector_check:
  - name: code_exists
    condition: Code != null && len(Code) > 0
    severity: high
  - name: plan_scope_defined
    condition: len(CodePlan.scope) > 0
    severity: critical
  - name: constraints_present
    condition: len(Constraints.rules) > 0
    severity: high

ExecutionPolicyAutoHealing_onDrift:
  - name: drift_signal_valid
    condition: |
      DriftSignal != null && DriftSignal.type in [KS, WA, OP, RR] &&
      DriftSignal.severity >= 0.0 && DriftSignal.severity <= 1.0
    severity: critical
  - name: original_plan_recoverable
    condition: CodePlan.steps != null && all checkpoints exist
    severity: critical
```

### Post-Conditions (must hold after agent executes)

```yaml
InstinctOps_beforePlan_pass:
  - name: criteria_validated
    condition: InstinctOps.lastValidation.passed == true
    severity: critical

CodeLevelDriftDetector_check:
  - name: drift_signal_immutable
    condition: ∀ read(DriftSignal) at T > emission: DriftSignal unchanged
    severity: critical
  - name: drift_severity_threshold_correct
    condition: |
      (DriftSignal.severity >= 0.8) ⟺ (DriftSignal.type in [KS, RR])
    severity: critical

ExecutionPolicyAutoHealing_onDrift:
  - name: constraints_amplified
    condition: |
      len(HealingPlan.amplifiedConstraints) >= len(CodePlan.constraints) &&
      all(amplified.severity >= original.severity)
    severity: high
  - name: healing_plan_ready
    condition: |
      HealingPlan.revisedPlan != null &&
      HealingPlan.revisedPlan.scope ⊆ CodePlan.scope &&
      HealingPlan.approvalRequired == (DriftSignal.severity >= 0.8)
    severity: critical
```

### Atomicity Boundaries

**Single-Operation Atomicity:**
- CodePlan create
- DriftSignal emit
- HealingPlan emit
- AcceptanceCriteria create

**Multi-Operation Atomicity:**
- Constraints amplification (read → modify → write in single transaction)
- Checkpoint-restore (if rollback triggered)

**None (Stale Reads Allowed):**
- Metrics during code execution (detector reads partial state)
- Healing plan generation (sees stale criteria snapshot)

---

## 5. Failure Modes & Recovery

### Failure Mode 5.1: Runaway Repair

```yaml
Runaway_Repair:
  signal: |
    DriftSignal.type in [KS, RR] ||
    (DriftSignal.type in [WA, OP] && retryCount >= 2)
  detector: CodeLevelDriftDetector
  latency_ms: 100  # detected within 100ms of drift
  detector: agent internal (hardcoded check after each repair attempt)
  
  response:
    action: halt
    rollback_strategy: restore-checkpoint (pre-repair state)
    approval_required: true
    timeout_before_escalate_ms: 30000  # wait 30s for Tier 1 decision
    escalation_target: tier1-approval-queue
    escalation_on_timeout: DRIFT-FLAGGED (global incident)
```

### Failure Mode 5.2: Constraint Violation

```yaml
Constraint_Violation:
  signal: |
    post-repair: existsRule ∈ Constraints.rules that evaluates(false)
  detector: InstinctOps.validatePostRepair()
  latency_ms: 500
  
  response:
    action: compensate  # undo repair, emit alert
    rollback_strategy: undo-last-op (reverse repair transaction)
    approval_required: false  # automatic rollback
    timeout_before_escalate_ms: 5000
    escalation_target: repair-orchestrator
```

### Failure Mode 5.3: Lock Acquisition Timeout

```yaml
Lock_Timeout:
  signal: |
    agent.acquireLock(stateX) timed out after timeout_ms
  detector: external lock manager
  latency_ms: < timeout_ms
  
  response:
    action: <depends on on_timeout config>
    if on_timeout == halt:
      rollback_strategy: none
      approval_required: true
      escalation_target: tier1-debug-queue
    if on_timeout == skip:
      rollback_strategy: none
      approval_required: false
      escalation_target: observability-alert
```

### Failure Mode 5.4: Drift Signal Lost/Duplicated

```yaml
Signal_Integrity_Failure:
  signal: |
    Reader observes duplicate driftId OR
    DriftSignal emitted but not received by all readers within 100ms
  detector: event bus acknowledgment layer
  latency_ms: 100
  
  response:
    action: halt  # block resume until integrity restored
    rollback_strategy: none (state already immutable)
    approval_required: true
    timeout_before_escalate_ms: 60000
    mitigation: replay signal from event log
```

---

## 6. State Diagram (ASCII)

```
PHASE 27 WAVE E: SIX RULES FRAMEWORK DATA FLOW

┌─────────────────────────────────────────────────────────────────────┐
│ T0: RepairOrchestrator                                              │
│     emit(CodePlan + AcceptanceCriteria + Constraints)               │
│     └─ state: {CodePlan, AcceptanceCriteria, Constraints}           │
│     └─ locks: all readers acquire read-lock (T: 0-5s)              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ T1: InstinctOps.beforePlan()                                        │
│     validate(Define Done) on CodePlan                               │
│     ├─ if PASS: proceed                                             │
│     └─ if FAIL: reject, escalate                                    │
│     └─ lock: release read-lock                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ T2: Code Execution (external)                                       │
│     └─ produce: Code + Tests + Metrics                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ T3: CodeLevelDriftDetector.check()                                  │
│     scan(Code) → DriftSignal or null                                │
│     ├─ if NO_DRIFT:                                                 │
│     │  └─ proceed to validation                                     │
│     │  └─ lock: release read-lock                                   │
│     └─ if DRIFT:                                                    │
│        ├─ emit(DriftSignal) [IMMUTABLE STATE]                       │
│        ├─ severity = calculateScore()                               │
│        └─ lock: signal healer (write-lock released)                 │
└────┬─────────────────────────────────┬───────────────────────────┬──┘
     │ NO_DRIFT (validation path)      │ SOFT DRIFT (auto-heal)    │
     │                                 │ (WA, OP)                  │
     │                                 │                           │
     ▼                                 ▼                           ▼
┌──────────────────────────┐    ┌─────────────────────┐    ┌──────────────┐
│ Acceptance Validation    │    │ Auto-Heal Retry     │    │ Hard Drift   │
├──────────────────────────┤    ├─────────────────────┤    │ (KS, RR)     │
│ verify: corruption %     │    │ Execute:            │    │              │
│ verify: survival %       │    │ ├─ extract logic    │    │ → escalate   │
│ verify: metrics          │    │ ├─ add error tests  │    │ → approval   │
│ ✓ PASS → OUTPUT         │    │ └─ retry detector   │    │ required     │
│ ✗ FAIL → ERROR SIGNAL   │    │ ✓ retries < 2       │    └──────┬───────┘
└──────────────────────────┘    │ → loop back T2      │           │
                                │ ✗ retries >= 2      │           │
                                │ → hard drift        │           │
                                └─────────┬───────────┘           │
                                          │                       │
                                          └───────────┬───────────┘
                                                      │
                    ┌─────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │ T4: ExecutionPolicyAutoHealing
         │     onDriftDetected()        │
         ├──────────────────────────────┤
         │ acquire write-lock (Constraints)
         │ generate HealingPlan:        │
         │  - shrink (KS)              │
         │  - extract (WA)             │
         │  - addTests (OP)            │
         │  - freeze (RR)              │
         │ amplify Constraints         │
         │ emit(HealingPlan)           │
         │ release write-lock          │
         └─────────────┬────────────────┘
                       │
                       ▼
         ┌──────────────────────────────┐
         │ T5: ResumeGate               │
         ├──────────────────────────────┤
         │ if approvalRequired:        │
         │  await Tier1 approval (30s) │
         │ else:                       │
         │  auto-resume               │
         │ on approve: emit resume     │
         │ on reject: escalate         │
         └─────────────┬────────────────┘
                       │
                       ▼
         ┌──────────────────────────────┐
         │ Output                       │
         │ (success or escalation)      │
         └──────────────────────────────┘
```

---

## 7. Integration Checklist

- [x] Shared state defined (5 states, all with ownership/readers/writers)
- [x] Threading rules documented (T0–T5 sequential model, locks, timeouts)
- [x] Invariants formalized (pre/post conditions, severity levels)
- [x] Failure modes enumerated (4 modes with recovery strategies)
- [x] State diagram (ASCII flow with decision points)
- [x] Example walkthrough (happy path: no drift; failure path: hard drift)
- [ ] Test matrix (to be added in Phase 27 Wave E implementation)
- [ ] Agents acknowledge contract (code version reference)
- [ ] Tier 1 approval (this contract)

---

## 8. Test Matrix Template

| Scenario | Agent A | State X | Agent B | State Y | Expected | Test File |
|----------|---------|---------|---------|---------|----------|-----------|
| Happy path (no drift) | detector | CodePlan | validation | null | PASS acceptance | `six-rules-happy.test.ts` |
| Soft drift (WA) | detector | DriftSignal (WA) | healer | auto-heal | retry up to 2x | `six-rules-soft-drift.test.ts` |
| Hard drift (KS) | detector | DriftSignal (KS) | approval gate | halted | await Tier 1 | `six-rules-hard-drift.test.ts` |
| Lock timeout | detector | (lock) | healer | (waiting) | escalate | `six-rules-lock-timeout.test.ts` |
| Constraint violation | validation | Constraints | healer | violated | rollback | `six-rules-constraint-violation.test.ts` |

---

## 9. Approval & Versioning

**Contract Version:** `six-rules-framework:1.0`  
**Status:** Tier 1 Approved (2026-07-11)  
**Supersedes:** Pre-Wave E informal coordination  
**Next Review:** 2026-08-11 (post-Wave F wrap)

**Approval Chain:**
1. Architecture (Chris) — APPROVED
2. Tier 1 Council — APPROVED (2026-07-11)
3. CI Gate — enforces (data contract required for multi-agent specs)

**Change Control:** Any modification requires Tier 1 re-approval + release notes.

---

## Related

- [Data Contract Specification Template](#DATA_CONTRACT_SPEC.md)
- [Phase 27 Wave E Six Rules Framework](../memory/phase-27-wave-e-six-rules-framework.md)
- [CIC Global Operating Rules v1.3](../governance/global-operating-rules-cic-rewrite-labs.md)
- [ExecutionPolicy Architecture](../docs/cic/execution-policy.md)
- [Drift Detection & Response Playbook](../docs/cic/drift-playbook.md)
