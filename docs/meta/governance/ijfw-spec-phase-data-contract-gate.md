# ijfw-spec-phase: Data Contract Gating Rule

**Version:** 1.0  
**Effective:** 2026-07-11  
**Tier:** 1 (mandatory enforcement)  

---

## Gating Rule

**IF** a spec touches multiple agent state boundaries  
**AND** more than one agent author/mutate shared state  
**THEN** require(DataContractSpecPresent) before dispatch

---

## Rule Definition

### Trigger Conditions (all must be true)

1. **Spec involves >1 agent**
   ```yaml
   len(spec.agents) > 1
   ```

2. **Spec touches shared state** (not purely local)
   ```yaml
   ∃ state ∈ spec.states: 
     ∃ agent_a, agent_b ∈ spec.agents:
       (agent_a writes state) AND (agent_b reads state)
   ```

3. **No formal data contract documented**
   ```yaml
   spec.dataContractVersion == null
   ```

### Action on Trigger

**Enforcement Level:** HARD GATE (blocks CI/dispatch)

```
spec-phase-dispatch() {
  if (trigger_conditions_met) {
    return {
      status: BLOCKED,
      reason: "Data Contract Required",
      message: "Spec touches multi-agent shared state but lacks formal Data Contract. Create contract before dispatch.",
      required_artifact: "DataContractSpec.md (per DATA_CONTRACT_SPEC template)",
      remediation: [
        "1. Identify all shared states (read by >1 agent)",
        "2. Document ownership, readers, writers per state",
        "3. Define threading rules (locks, ordering, timeouts)",
        "4. Enumerate failure modes + recovery",
        "5. Create state diagram",
        "6. Pass to Tier 1 review",
        "7. Reference contract in spec (e.g., dataContractVersion: 'six-rules-framework:1.0')"
      ],
      reference_template: "https://[repo]/DATA_CONTRACT_SPEC.md",
      approval_tier: 1,
      escalation_on_dispute: "tier1-architecture-review"
    }
  }
  return { status: PROCEED }
}
```

### Bypass Policy

Bypass only via **explicit Tier 1 waiver** with justification:
```yaml
bypass_reason: <string>  # "single-phase agent", "state is read-only", etc.
waived_by: <tier-1-approver>
waived_date: <ISO8601>
waiver_expires: <ISO8601>  # 60-day window
```

**Auto-expiring:** waivers must be renewed post-phase.

---

## Integration into CI Pipeline

### Pre-Dispatch Hook

```yaml
# In .claude/settings.json or CI config
hooks:
  spec_phase_pre_dispatch:
    - run: ijfw-spec-phase-gate
    - input: spec.md (raw or parsed)
    - check:
        - agents_count > 1
        - shared_state_exists
        - data_contract_present or bypass_waiver_valid
    - on_gate_fail:
        status: exit 1
        log: "DATA_CONTRACT_GATE_BLOCKED"
        output: "spec_gate_failure.txt"
```

### Error Output

```
❌ SPEC DISPATCH BLOCKED: Data Contract Required

Phase: 27-Wave-E
Spec: six-rules-framework.md
Agents: 3 (CodeLevelDriftDetector, InstinctOps, ExecutionPolicyAutoHealing)
Shared States: 5 (CodePlan, DriftSignal, HealingPlan, Constraints, AcceptanceCriteria)

REASON: Multi-agent spec lacks formal Data Contract.

REQUIRED:
  1. Create DataContractSpec.md using template
     → https://[repo]/DATA_CONTRACT_SPEC.md
  2. Document all 5 shared states (ownership, readers, writers, invariants)
  3. Define threading rules (sequential model, locks, timeouts)
  4. Enumerate failure modes (runaway repair, constraint violation, etc.)
  5. Submit for Tier 1 approval
  6. Add to spec: dataContractVersion: 'six-rules-framework:1.0'

APPROVAL PATH:
  → Chris (Architect, Tier 1) reviews contract
  → Contract merged to /docs/contracts/
  → Spec re-validated
  → Dispatch proceeds

ESCALATION:
  If contract needs waiver: request Tier 1 waiver with justification

For help: /ijfw-spec-phase --help
```

---

## Rule Application Examples

### Example 1: BLOCKED (Multi-agent, shared state)

```yaml
# Spec: phase-27-wave-e.md
agents:
  - CodeLevelDriftDetector
  - InstinctOps
  - ExecutionPolicyAutoHealing
shared_state:
  CodePlan:
    owner: RepairOrchestrator
    readers: [CodeLevelDriftDetector, InstinctOps, ExecutionPolicyAutoHealing]
  DriftSignal:
    owner: CodeLevelDriftDetector
    readers: [InstinctOps, ExecutionPolicyAutoHealing]

dataContractVersion: null  # missing

GATE RESULT: BLOCKED ❌
  → Require six-rules-framework:1.0 data contract
  → Link to contract in spec
  → Redispatch
```

### Example 2: PROCEED (Single-agent OR no shared state)

```yaml
# Spec: single-component-refactor.md
agents:
  - CodeLevelDriftDetector
shared_state: []  # no shared state between agents

GATE RESULT: PROCEED ✓
  → Shared state gate does not apply
  → Standard dispatch rules apply
```

### Example 3: PROCEED (Multi-agent, contract present)

```yaml
# Spec: phase-27-wave-f.md
agents:
  - CodeLevelDriftDetector
  - ExecutionPolicyAutoHealing
shared_state:
  DriftSignal: {...}
  HealingPlan: {...}

dataContractVersion: 'six-rules-framework:1.0'  # present

GATE RESULT: PROCEED ✓
  → Contract validates threading, invariants, failure modes
  → Dispatch proceeds with contract enforcement
```

### Example 4: BLOCKED → WAIVER → PROCEED

```yaml
# Spec: quick-hotfix.md
agents:
  - Agent1
  - Agent2
shared_state:
  StateX: {...}

dataContractVersion: null
bypass_reason: "Emergency hotfix; state is read-only during hotfix window"
waived_by: "Chris"
waived_date: "2026-07-11"
waiver_expires: "2026-09-10"

GATE RESULT: PROCEED ✓ (WAIVERED)
  → Hotfix allowed under 60-day waiver
  → Post-phase: require formal contract or new waiver
```

---

## Governance & Updates

### Review Cadence

- **Quarterly:** Contract inventory audit (arc obsolete, missing, or drifted)
- **On Phase Completion:** Review all contracts in phase for updates/archival
- **On Spec Change:** If spec modifies shared state, contract must be updated + re-approved

### Update Process

```
spec.dataContractVersion = "contract-name:X.Y"

If spec changes shared state:
  1. Update contract (increment minor version)
  2. Revalidate threading rules, invariants, failure modes
  3. Pass to Tier 1 re-approval (expedited)
  4. Update spec.dataContractVersion → new version
  5. Re-dispatch

If contract drifts from code:
  1. Flag via ijfw-memory-audit (auto-trigger on phase wrap)
  2. Tier 1 decides: update contract or waive
  3. Document decision in CONTEXT.md
```

### Contract Archive

Contracts superseded or unused after 3 phases move to:
```
/docs/contracts/_archive/
  contract-name:1.0.md
  contract-name:2.0.md
  ...
```

---

## Related Documents

- [Data Contract Specification Template](data-contract-spec.md)
- [Phase 27 Wave E Data Contract](../PHASE27_WAVE_E_DATA_CONTRACT.md) (example)
- [CIC Global Operating Rules v1.3](global-operating-rules-cic-rewrite-labs.md)
- [ijfw-spec-phase Skill](ijfw-spec-phase.md)
