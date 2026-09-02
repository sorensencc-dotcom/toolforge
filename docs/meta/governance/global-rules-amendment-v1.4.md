---
title: CIC + Rewrite Labs Global Rules — Amendment v1.3 → v1.4
description: Section 12 (Charter Lifecycle & Audit-First Scope Lock) addition
date: 2026-07-11
type: amendment
---

# Amendment: v1.3 → v1.4

**Document:** CIC + Rewrite Labs Global Rules  
**Effective:** 2026-07-11 (Phase 3 charters onward)  
**Change Type:** Addition (Section 12, new)

---

## New Section 12: Charter Lifecycle & Audit-First Scope Lock

### 12.1 Charter Lifecycle Phases

Charter transitions follow sequence:
```
DRAFT → DISCUSS → SCOPE LOCK DECISION → LOCKED → IMPLEMENTATION → SHIPPED
```

Each transition requires appropriate approval (Tier 1 for LOCKED).

### 12.2 Audit-First Scope Lock Gate

**Rule:** No charter may transition to LOCKED status without passing the Audit-First Scope Lock gate.

**Gate comprises three parallel audit streams (30-min SLA total):**

1. **Codebase Mapper Scan** (10 min)
   - Map proposed Phase to 8-dir structure
   - Document tech stack, dependencies, entry/exit points
   - Verify Phase N integration with Phase N-1 exit

2. **Plan Checker vs. Existing Infrastructure** (10 min)
   - Detect infrastructure re-specification
   - Identify duplicate components (libs, config, APIs, schemas)
   - Flag breaking changes (backward-incompatible migrations, orphaned APIs)

3. **Pattern Mapper Conformance** (10 min)
   - Map proposed patterns to existing analogs (PATTERNS.md reference)
   - Verify telemetry key naming consistency
   - Check documentation template compliance

**Conformance Threshold:** Infrastructure alignment >= 85%, 0 critical conflicts

### 12.3 Audit Execution & Reporting

**Trigger:** When ijfw-spec-phase reaches "Scope Freeze Decision" point

**Agents (run in parallel):** ijfw-codebase-mapper, ijfw-plan-checker, ijfw-pattern-mapper

**Output:** Merged report: `docs/meta/audit/{PHASE_ID}-audit-report.md`

**Archive:** Path and verdict stored in charter YAML frontmatter (fields: `audit_report_id`, `audit_verdict`)

### 12.4 Lock Decision Gate Logic

Charter scope lock proceeds only if ALL conditions met:

```
IF audit_verdict == PASS
  AND infrastructure_conflicts == 0
  AND pattern_conformance >= 85%
  AND Tier 1 approval received
THEN
  Charter transitions to LOCKED ✅
  Proceed to implementation wave
ELSE
  Charter remains in SCOPE LOCK DECISION state
  Escalate to ijfw-discuss-phase to resolve conflicts
  Re-audit required before lock retry
```

### 12.5 Exception Path (Rare — Requires Tier 1 Explicit Override)

**Condition:** Audit fails but timeline-critical (e.g., security incident response)

**Required process:**
1. Tier 1 explicitly documents `audit_waived_reason` in charter YAML
2. Phase proceeds with conditional flag: `audit_waived: true`
3. Conflict resolution scheduled for Phase N+1
4. Waiver logged to governance audit trail (docs/meta/governance-audit-log.md)
5. Post-mortem review required at next quarterly governance cycle

**Default stance:** Exceptions are disallowed. Audit must pass before lock.

### 12.6 Baseline Audit (Existing Charters)

**Phase 1–2 Charters:** Retroactive audit completed during Phase ABC, Section B  
**Phases 3–6 Charters:** All future charters subject to Audit-First gate before scope lock  
**Phase 7+:** Every charter lock requires passing audit gate as standard practice

---

## Integration Points

| System | Change |
|--------|--------|
| **ijfw-spec-phase** | Audit suite auto-invoked before "Scope Freeze Decision" (workflow integration) |
| **Phase ABC Model** | Audit Phases A.5–C added as permanent governance fixture |
| **Charter Template** | Add YAML fields: `audit_report_id`, `audit_verdict`, `audit_waived` |
| **PATTERNS.md** | New reference doc (created Phase A.5) |
| **INFRASTRUCTURE.md** | New reference doc (created Phase A.5) |
| **docs/meta/audit/** | New directory for audit reports |
| **CLAUDE.md** | Governance section updated with link to Section 12 |

---

## Rationale

**Problem:** Scope creep and infrastructure duplication occur post-lock audit; rework required.

**Solution:** Move audit pre-lock. Three parallel 10-min scans detect conflicts before charter freezes.

**Impact:**
- Estimated -40% scope rework rate
- Estimated -60% infrastructure duplication incidents
- Improved pattern consistency across phases
- Cost: +30 min per charter decision cycle
- ROI: Breaks even after 2 charters; positive on 3+

---

## References

- Pre-Charter Audit Checklist: docs/meta/governance/pre-charter-audit-checklist.md
- ijfw-spec-phase Integration: docs/meta/governance/ijfw-spec-phase-audit-gate-integration.md
- Phase ABC Audit Phases: docs/meta/phase-abc-audit-phases-fixture.md
