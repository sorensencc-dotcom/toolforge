# Governance Update: Data Contract Framework

**Date:** 2026-07-11  
**Status:** Tier 1 Approved  
**Scope:** CIC + Rewrite Labs global governance  
**Amendment to:** CIC Global Operating Rules v1.3  

---

## Executive Summary

Data Contracts formalize shared-state semantics for multi-agent flows. This governance amendment adds:

1. **Mandatory Data Contract** for specs touching >1 agent's state (effective 2026-07-11)
2. **CI Gating Rule** in ijfw-spec-phase (enforces before dispatch)
3. **Architecture Spec Checklist** (8 sections, all multi-agent specs)
4. **Example Validation** via Phase 27 Wave E (Six Rules Framework)

**Impact:** Eliminates ad-hoc coordination logic; formalizes state ownership, threading, invariants, failure recovery.

---

## Artifacts Delivered

### 1. DATA_CONTRACT_SPEC.md (Template)
**Location:** `/docs/meta/governance/data-contract-spec.md`

Reusable template for designing shared-state semantics:
- State schema (ownership, readers, writers, invariants, atomicity)
- Threading rules (execution model, locks, timeouts, retry logic)
- Failure modes & recovery strategies
- State diagram (ASCII or visual)
- Integration checklist (8-item validation)

### 2. PHASE27_WAVE_E_DATA_CONTRACT.md (Validated Example)
**Location:** `/docs/contracts/phase-27-wave-e-six-rules-framework.md`

Full data contract for Phase 27 Wave E:
- 5 shared states (CodePlan, DriftSignal, HealingPlan, Constraints, AcceptanceCriteria)
- Sequential threading (T0–T5)
- 4 failure modes + recovery (runaway repair, constraint violation, lock timeout, signal integrity)
- ASCII state diagram with decision branching
- Test matrix template

**Approval:** Tier 1 (Chris) — 2026-07-11

### 3. IJFW_SPEC_PHASE_DATA_CONTRACT_GATE.md (CI Gate)
**Location:** `.claude/settings.json` (implementation guide)

Hard-gating rule in ijfw-spec-phase:
- Blocks dispatch if multi-agent spec lacks data contract
- Bypass only via Tier 1 waiver (60-day expiration)
- Error output with remediation steps
- 4 application examples (blocked, proceed, waivered scenarios)

**Enforcement:** CI blocks merge/dispatch on violation

### 4. UI_SPEC_ARCHITECTURE_CHECKLIST.md (Integrated Checklist)
**Location:** `/docs/meta/UI_SPEC_ARCHITECTURE_CHECKLIST.md`

8-section checklist for all multi-agent architecture specs:
- Agents & state mapping
- State schema & ownership
- Threading & concurrency rules
- Failure modes & recovery
- Diagrams & visualization
- Testing & validation
- Governance & approvals
- Observability & monitoring

**Applied to:** Phase 27 Wave E as example (✓ passes all 8 sections)

---

## Integration into Governance

### CIC Global Operating Rules v1.3 → v1.4 (Amendment)

**New Section 11: Multi-Agent State Contracts**

```markdown
### 11. Multi-Agent State Contracts

11.1 **Requirement**
  When a spec involves >1 agent authoring/mutating shared state, 
  a formal Data Contract is mandatory before dispatch.

11.2 **Contract Components** (per DATA_CONTRACT_SPEC template)
  - State schema (ownership, readers, writers, invariants)
  - Threading rules (execution model, locks, timeouts)
  - Failure modes (detection, recovery, escalation)
  - State diagram (ASCII, swim lanes, branches)
  - Integration checklist (8-point validation)

11.3 **Approval Path**
  - Architecture (IJFW-architect agent) reviews draft
  - Tier 1 (Chris) approves contract
  - CI gate validates contract presence before dispatch
  - Contract archived in /docs/contracts/[name].md

11.4 **Gating Rule (ijfw-spec-phase)**
  IF (spec.agents.count > 1) AND (spec.touches[shared_state])
    THEN require(data_contract_present)
    ELSE skip()
  
  Bypass only: Tier 1 waiver (60-day expiration, renewable)

11.5 **Review Cadence**
  - Per-phase: new contracts reviewed at phase start
  - Quarterly: audit existing contracts for drift/obsolescence
  - On update: spec changes → contract update → Tier 1 re-approval

11.6 **Conflict Resolution**
  If contract conflicts with spec or code:
    1. Flag via ijfw-memory-audit
    2. Tier 1 decides: update contract or waive
    3. Document decision in CONTEXT.md
    4. If contract drifts 2+ phases → archive + replace
```

**Related Change:** Add dataContractVersion to spec frontmatter (required for multi-agent specs)

---

## Operational Procedures

### For Architects: Creating a Data Contract

1. **Draft** contract using DATA_CONTRACT_SPEC template
2. **Enumerate** all shared states (ownership, readers, writers)
3. **Define** threading rules (sequential/parallel, locks, timeouts)
4. **Enumerate** failure modes (detection, recovery)
5. **Draw** state diagram (ASCII or hand-drawn)
6. **Write** test matrix (happy path, each failure, edge cases)
7. **Submit** for Tier 1 review (Chris)
8. **Merge** to /docs/contracts/ after approval
9. **Reference** in spec: dataContractVersion: 'contract-name:X.Y'

**Time Estimate:** 2–3 hours per contract  
**Template:** `DATA_CONTRACT_SPEC.md`  
**Example:** `PHASE27_WAVE_E_DATA_CONTRACT.md`

### For CI/Pipeline: Validating Data Contracts

**Hook:** spec_phase_pre_dispatch

```yaml
check_data_contract:
  if spec.agents.length > 1:
    if spec.dataContractVersion == null:
      if no_tier1_waiver:
        exit 1  # BLOCKED
        log "DATA_CONTRACT_GATE_BLOCKED"
        output "remediation_steps.txt"
  exit 0  # PROCEED
```

**Config Location:** `.claude/settings.json` (pre-dispatch hook)  
**Bypass:** Tier 1 waiver in spec.yaml (temporary, expires 60d)

### For Reviewers: Auditing Data Contracts

**Checklist** (during ijfw-spec-phase or ijfw-review):
- [ ] All shared states identified (read by >1 agent)
- [ ] Ownership clear per state (one owner, multiple readers/writers documented)
- [ ] Threading rules unambiguous (execution order, locks, timeouts)
- [ ] Failure modes plausible (not theoretical; based on agent failure modes)
- [ ] Recovery strategies actionable (halt, rollback, compensate clearly defined)
- [ ] Diagram shows state transitions + lock lifecycle
- [ ] Test matrix covers happy + failure + edge cases
- [ ] Invariants formalized (pre/post conditions, severity)
- [ ] Atomicity boundaries explicit (what constitutes single-operation)

**Review Time:** 30–60 minutes per contract

---

## Example: Phase 27 Wave E Integration

**Spec:** phase-27-wave-e-six-rules-framework.md

**Before (ad-hoc coordination):**
```
# Unclear state ownership:
# - Who owns CodePlan? (repairAgent? detector?)
# - Can healer mutate Constraints? (implicit yes, no doc)
# - What if detector times out? (no spec)
# Implicit threading:
# - Assumed sequential, but not enforced
# - No timeouts documented
# - Failure recovery undefined
```

**After (formal data contract):**
```
Contract: six-rules-framework:1.0
States:
  CodePlan (owner: RepairOrch, readers: detector+instincts+healer) ✓
  DriftSignal (owner: detector, readers: healer) ✓
  HealingPlan (owner: healer, readers: resumeGate) ✓
  Constraints (owner: detector, mutators: healer) ✓ explicit
Threading:
  T0→T1→T2→T3→T4→T5 (sequential, locks, timeouts documented) ✓
Failure Modes:
  Runaway Repair (hard drift) → halt + restore checkpoint ✓
  Constraint Violation → rollback ✓
  Lock Timeout → escalate ✓
  Signal Integrity → halt + replay ✓
```

**Test Coverage:** 5 scenarios in test matrix (happy + 4 failures)  
**Approval:** Tier 1 (2026-07-11)  
**Status:** ✅ Validator for template

---

## Enforcement Timeline

| Date | Milestone | Status |
|------|-----------|--------|
| 2026-07-11 | Data Contract template approved | ✅ Complete |
| 2026-07-11 | Phase 27 Wave E contract example approved | ✅ Complete |
| 2026-07-11 | ijfw-spec-phase gate rule deployed | ⏳ Pending (CI integration) |
| 2026-07-15 | All Phase 27 Wave F+ specs validated | ⏳ Pending |
| 2026-08-11 | Post-Wave F contract audit | ⏳ Scheduled |
| 2026-09-11 | Global contract inventory (all phases) | ⏳ Scheduled |

---

## Risk Mitigation

### Risk 1: Specs Already in Flight Without Contracts
**Mitigation:** Tier 1 waiver (60-day grace period for existing specs)
- Existing multi-agent specs can proceed under waiver
- Waiver expires 60 days → must contract or re-waive
- Tracked in CONTEXT.md

### Risk 2: Contracts Drift from Code
**Mitigation:** ijfw-memory-audit (quarterly review)
- Auto-flag if code diverges from contract
- Tier 1 decides: update contract or waive
- Contracts 2+ phases obsolete → archive

### Risk 3: Overhead on Architecture Phase
**Mitigation:** Template + CI tooling
- DATA_CONTRACT_SPEC template reduces friction (copy-paste structure)
- ijfw-spec-phase auto-validates contract presence (fail-fast)
- Example (Phase 27 Wave E) shows time ~2–3 hours per contract

### Risk 4: False Positives (Specs Blocked Unnecessarily)
**Mitigation:** Bypass + escalation
- Tier 1 waiver for legitimate edge cases
- Escalation to tier1-architecture-review on dispute
- Clear remediation steps in gate error output

---

## Sustainability

### Contract Ownership
- **Creation:** Architect (IJFW-architect agent) + Tier 1 approval
- **Maintenance:** Phase lead (during phase) + Architecture team (post-phase)
- **Archival:** Automated (contracts 60+ days post-phase)

### Documentation
- **Primary Source:** /docs/contracts/ directory
- **Reference:** Spec frontmatter (dataContractVersion field)
- **History:** Git commit log (one commit per contract version)

### Review Cadence
- **Per Phase:** Contract created + approved at phase start
- **Quarterly (Jul, Oct, Jan, Apr):** Audit all active contracts
- **On Spec Change:** Contract updated + Tier 1 re-approval
- **Post-Phase:** Contracts archived or transitioned to next phase

---

## Approvals

**Proposed by:** Architecture (Chris)  
**Reviewed by:** IJFW-architect agent  
**Approved by:** Tier 1 Council (Chris) — 2026-07-11  
**Effective Date:** 2026-07-11  
**Amendment Scope:** CIC Global Operating Rules v1.3 → v1.4  

---

## Related Documents

- [Data Contract Specification Template](../meta/DATA_CONTRACT_SPEC.md)
- [Phase 27 Wave E Data Contract](../contracts/phase-27-wave-e-six-rules-framework.md)
- [ijfw-spec-phase Data Contract Gate](../meta/ijfw-spec-phase-data-contract-gate.md)
- [Architecture Spec Checklist](../meta/UI_SPEC_ARCHITECTURE_CHECKLIST.md)
- [CIC Global Operating Rules v1.3](../meta/global-operating-rules-cic-rewrite-labs.md)
- [Phase 27 Wave E Six Rules Framework](../memory/phase-27-wave-e-six-rules-framework.md)

---

## Q&A

**Q: Do single-agent specs need data contracts?**  
A: No. Gate rule: `IF agents.count > 1 AND touches[shared_state] THEN contract required`. Single-agent specs skip gate.

**Q: What if a spec touches shared state but only reads (no writes)?**  
A: No contract required. Gate rule checks for ownership conflicts (writer + reader). Read-only access doesn't conflict.

**Q: Can I waive the data contract requirement?**  
A: Yes, via Tier 1 waiver (60-day expiration). Provide justification (e.g., "hotfix, state read-only during window"). Waiver must be renewed post-phase.

**Q: Who creates the data contract?**  
A: Architect (IJFW-architect agent) drafts; Tier 1 (Chris) approves. Phase lead may contribute details.

**Q: What happens if my spec's contract drifts from the code?**  
A: ijfw-memory-audit flags it (quarterly). Tier 1 decides: update contract or waive. If contract 2+ phases obsolete, archive + replace.

**Q: Can I update a contract mid-phase?**  
A: Yes. Changes require Tier 1 re-approval + new version (increment minor). Update spec.dataContractVersion field.

**Q: How long does it take to create a data contract?**  
A: 2–3 hours typically. Use DATA_CONTRACT_SPEC template (copy-paste structure). Phase 27 Wave E example available.

---

## Document History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-07-11 | Chris (Architect) | Initial framework (template + gate + checklist + example) |

---

**Status:** ✅ Tier 1 Approved  
**Effective:** 2026-07-11 (Phase 27 Wave E onward)  
**Next Review:** 2026-08-11 (post-Wave F wrap)
