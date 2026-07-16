# ijfw-plan Integration: Observability Contract Output Section

**Scope:** Add "Observability Contract" section to ijfw-plan output format, inserted after Prerequisites, before Parallelism Matrix / Wave Assignments.

**Rationale:** Observability must be specified upfront (Phase D/Phase 4 entry) to prevent metric discovery mid-rollout (Phase 5+). Feeds directly into governance decision gates.

---

## New Output Section: Observability Contract

**Triggered by:** `/ijfw-plan [phase description]` — automatically generated for all phases with operational dispatch requirements.

**Format:** Structured Markdown with YAML validation block.

### Location in ijfw-plan Output

```
# [Phase X] Implementation Plan

## 1. Overview
...

## 2. Architecture
...

## 3. Prerequisites
...

## 4. OBSERVABILITY CONTRACT  ← NEW SECTION (Phase D+)
   [metrics, routing, thresholds, audit trail]

## 5. Parallelism Matrix
...

## 6. Wave Assignments
...

## 7. Success Criteria
...
```

---

## Section Content Template

```markdown
## 4. Observability Contract

### Metrics Definition
| Metric | Purpose | Definition | Aggregation | Threshold |
|--------|---------|-----------|-------------|-----------|
| error_rate | Canary health | Errors / total operations | avg per cohort | < 2% |
| cost_delta | Budget drift | (Phase N cost - baseline) / baseline | avg per cohort | < 0.2% |
| latency_p99 | Performance | 99th percentile response time | per cohort | < 500ms |
| [custom] | [domain-specific] | [definition] | [method] | [threshold] |

**Requirement:** All metrics must be defined before Phase D dispatch. Custom metrics must be pre-approved by governance.

### Routing Behavior

**Cohort Progression:**
- Cohort 1: 10% (window: 30 min)
- Cohort 2: 25% (window: 45 min)
- Cohort 3: 50% (window: 60 min)
- Cohort 4: 100% (full rollout)

**Progression Logic:**
- Serial: Each cohort must complete observation window before next
- Parallel: [if applicable, describe] (Phase 5 default: serial)

### Heal Thresholds

**Auto-Promote Condition:**
- All registered metrics pass threshold evaluation
- Next cohort exists in progression

**Auto-Rollback Condition:**
- Any metric exceeds threshold OR error detected
- Immediate rollback + incident logging

**Manual Hold Condition:**
- Metrics pass thresholds but ambiguous signal (e.g., latency high but error_rate low)
- Requires manual governance review

### Telemetry Routing

- **Metrics Collector:** [System/service responsible for aggregating observations]
- **Decision Engine:** [System evaluating thresholds + making promotion decisions]
- **Audit Trail:** [Location of decision logs; retention policy]
- **Alert Path:** [On-call notification if rollback triggered]

### Phase Gate Dependencies

| Phase | Requirement |
|-------|-------------|
| Phase D Entry | Observability spec locked; metrics defined; thresholds approved |
| Phase 5 Entry | Observability contract finalized; routing behavior verified |
| Phase 6 Entry | Real-time metrics streaming validated (if applicable) |
```

---

## ijfw-plan Agent Changes

The `ijfw-plan` agent will:

1. **Extract observability requirements** from phase scope:
   - Identify canary metrics from governance rules
   - Map metrics to threshold definitions
   - Check Phase D/Phase 5 charters for pre-approved metrics

2. **Build Observability Contract section:**
   - Populate metrics table (definition, aggregation, threshold)
   - Derive cohort progression from phase charters
   - Document routing behavior (serial vs. parallel)
   - Include heal threshold conditions (auto-promote/rollback/hold)

3. **Inject into output** after Prerequisites, before Parallelism Matrix

4. **Generate verification YAML** (passed to ijfw-verify on handoff)

5. **Flag observability gaps:**
   - If metrics table is empty → FLAG
   - If thresholds not numeric → WARN
   - If routing behavior ambiguous → FLAG
   - If Phase D checklist item "Observability spec locked" not checked → BLOCK handoff

---

## YAML Output Format (for ijfw-verify)

After the markdown Observability Contract, include validation block:

```yaml
---
metadata:
  phase: 4
  version: "1.0"
  
observability_contract:
  phase_d_checklist_status: "LOCKED"  # or "PENDING"
  
  metrics:
    - id: error_rate
      purpose: Canary health
      definition: "Errors / total operations"
      aggregation_method: "avg per cohort"
      threshold:
        operator: "<"
        value: 0.02
      required_for_phase: "4"
      
    - id: cost_delta
      purpose: Budget drift
      definition: "(Phase N cost - baseline) / baseline"
      aggregation_method: "avg per cohort"
      threshold:
        operator: "<"
        value: 0.002
      required_for_phase: "4"
      
    - id: latency_p99
      purpose: Performance
      definition: "99th percentile response time (ms)"
      aggregation_method: "per cohort"
      threshold:
        operator: "<"
        value: 500
      required_for_phase: "5"
  
  routing_behavior:
    cohort_progression:
      - cohort: 1
        size: 0.10
        observation_window_minutes: 30
      - cohort: 2
        size: 0.25
        observation_window_minutes: 45
      - cohort: 3
        size: 0.50
        observation_window_minutes: 60
      - cohort: 4
        size: 1.00
        observation_window_minutes: 0
    
    progression_type: "serial"  # or "parallel"
  
  heal_thresholds:
    auto_promote:
      condition: "all metrics pass threshold evaluation && next cohort exists"
      action: "promote to next cohort"
    
    auto_rollback:
      condition: "any metric exceeds threshold || error detected"
      action: "immediate rollback + incident logging"
    
    manual_hold:
      condition: "metrics pass but signal ambiguous"
      action: "require manual governance review"
  
  telemetry_routing:
    collector: "[system name]"
    decision_engine: "[system name]"
    audit_trail: "[location]"
    alert_path: "[on-call system]"
  
  phase_gates:
    phase_d_entry: "Observability spec locked; metrics defined; thresholds approved"
    phase_5_entry: "Observability contract finalized; routing behavior verified"
    phase_6_entry: "Real-time metrics streaming validated"
  
  verification:
    - check: metrics_table_populated
      status: pass
      
    - check: thresholds_numeric
      status: pass
      
    - check: routing_behavior_defined
      status: pass
      
    - check: phase_d_checklist_locked
      status: pass

---
```

---

## Acceptance Criteria for ijfw-plan Output

✅ Observability Contract section present  
✅ All metrics have definition, aggregation method, and threshold  
✅ Cohort progression clearly documented  
✅ Heal thresholds (auto-promote/rollback/hold) defined  
✅ Telemetry routing identified (collector, decision-maker, audit trail)  
✅ Phase gate dependencies linked to charter requirements  
✅ Phase D checklist status verified (all items checked before dispatch)  
✅ YAML block valid + parseable  

---

## Integration with Phase Charters

| Phase | Observability Requirement | Locked By |
|-------|---------------------------|-----------|
| Phase 4 (Governance) | Metrics definition + routing behavior | Phase D checklist before agent dispatch |
| Phase 5 (Multi-Canary) | Cohort progression + threshold evaluation | ijfw-plan Observability Contract section |
| Phase 6 (Rollback) | Real-time metric streaming (if applicable) | Phase 6 charter + observability spec |

---

## Retroactive Validation: Phase 27 Wave E

**Finding:** Phase 27 Wave E (Six Rules Framework) defines instinct enforcement + drift detection but assumes observability is already spec'd upfront.

**Verification:**
- ✅ CodeLevelDriftDetector requires metrics to evaluate (drift detection assumes observability contract exists)
- ✅ InstinctOps 30+ event types require telemetry routing (confirms observability routing must be defined)
- ✅ ExecutionPolicyAutoHealing requires heal thresholds (confirms Phase D observability spec is prerequisite)

**Conclusion:** Phase 27 Wave E design is sound — it assumes observability contract locked upfront (Phase D). This amendment formalizes that assumption in the charter.

