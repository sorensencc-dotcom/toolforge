---
title: Governance Rule Addition — Audit-First Scope Lock
description: New Section 12 (Charter Lifecycle) for CIC + Rewrite Labs Global Rules v1.4
date: 2026-07-11
---

# Governance Rule: Audit-First Scope Lock

**Document:** CIC + Rewrite Labs Global Rules  
**Amendment:** v1.3 → v1.4  
**Section:** 12 (Charter Lifecycle) — NEW  
**Effective:** Immediately (Phase 3 charters onward)

---

## Section 12: Charter Lifecycle & Audit-First Scope Lock

### 12.1 Charter Phases (Existing)

Charter lifecycle: DRAFT → DISCUSS → SCOPE LOCK DECISION → LOCKED → IMPLEMENTATION → SHIPPED

### 12.2 Audit-First Scope Lock Gate (NEW)

**Rule:** No charter may transition to LOCKED status without passing Audit-First Scope Lock gate.

**Gate Components (all must PASS):**

1. **Codebase Mapper Scan**
   - Proposed Phase maps to 8-dir structure
   - Tech stack and dependencies documented
   - Entry/exit points integrate with Phase N-1

2. **Plan Checker vs. Existing Infrastructure**
   - No infrastructure re-specification detected
   - New components use existing libs/patterns
   - Config and API changes backward-compatible

3. **Pattern Mapper Conformance**
   - Proposed patterns align with existing analogs (PATTERNS.md)
   - Telemetry keys consistent with nomenclature
   - Documentation follows template structure

**Conformance Threshold:** Infrastructure alignment >= 85%, 0 critical conflicts

**SLA:** 30 minutes (3 parallel audit streams × 10 min each)

### 12.3 Audit Execution & Reporting

**Trigger:** Charter reaches "Scope Freeze Decision" in ijfw-spec-phase workflow

**Agents:** ijfw-codebase-mapper, ijfw-plan-checker, ijfw-pattern-mapper (run in parallel)

**Output:** Single merged audit report: `docs/meta/audit/{PHASE_ID}-audit-report.md`

**Archive:** Report path and verdict recorded in charter YAML frontmatter (field: `audit_report_id`)

### 12.4 Lock Decision Logic

```
IF audit_verdict == PASS
  AND infrastructure_conflicts == 0
  AND pattern_conformance >= 85%
  AND Tier 1 approves
THEN
  Charter transitions to LOCKED ✅
ELSE
  Charter held in SCOPE LOCK DECISION state
  → Escalate to ijfw-discuss-phase
  → Resolve conflicts
  → Re-audit before retry
```

### 12.5 Exception Path (Rare)

**Condition:** Audit fails but timeline-critical (e.g., security incident fix)

**Process:**
1. Tier 1 explicitly documents `audit_waived_reason` in charter
2. Phase proceeds with conditional flag: `audit_waived: true`
3. Conflict resolution scheduled for Phase N+1
4. Audit waiver logged to governance audit trail
5. Post-mortem review required at next quarterly governance cycle

**Default:** Exceptions disallowed. Audit must pass before lock.

### 12.6 Retroactive Audit (Existing Charters)

**Phases 1–2 Baseline:** Run full audit suite against Phase 1–2 charters (completed Phase ABC, Section B)

**Phases 3–6:** All future charters require passing Audit-First gate before scope lock

---

## Integration Points

- **ijfw-spec-phase:** Audit suite invoked before "Charter Scope Freeze" decision (workflow integration)
- **Phase ABC Model:** Audit Phases A.5–C added as permanent fixtures
- **Charter Template:** Add fields: `audit_report_id`, `audit_verdict`, `audit_waived` (optional)
- **Governance Dashboard:** Track audit pass/fail/waived rate per phase

---

## Amendment Rationale

**Why?** Current scope-lock sometimes audited post-lock, causing rework. Moving audit pre-lock reduces scope creep, infrastructure duplication, and pattern drift. Automated 30-min SLA enables frictionless integration into ijfw-spec-phase workflow.

**Cost:** +30 min per charter decision cycle  
**Benefit:** -40% scope rework rate, -60% infrastructure duplication, improved pattern consistency
