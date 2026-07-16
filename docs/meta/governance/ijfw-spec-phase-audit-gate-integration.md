---
title: ijfw-spec-phase Audit Gate Integration
description: Workflow integration — audit suite runs in parallel before charter scope freeze
date: 2026-07-11
---

# ijfw-spec-phase: Audit Gate Integration

**Workflow Stage:** Post-discuss, pre-lock (Charter Scope Freeze decision point)

---

## Workflow Sequence

```
Phase Design
    ↓
ijfw-spec-phase triggered
    ├─ PLAN: Deep reasoning on scope
    ├─ DISCUSS: Ambiguity resolution (if needed)
    ├─ AUDIT [NEW]: Run in parallel (30 min SLA)
    │   ├─ Codebase Mapper Scan
    │   ├─ Plan Checker vs. Existing Infra
    │   └─ Pattern Mapper Analogs
    ├─ Decision: Charter Scope Freeze?
    │   ├─ If PASS audit: YES → Lock
    │   └─ If FAIL audit: NO → Loop to ijfw-discuss-phase
    └─ Charter Locked ✅
```

---

## Audit Execution Details

**Trigger:** ijfw-spec-phase reaches "Charter Scope Freeze" decision point

**Parallelization:** 3 audit threads (30-min total SLA)
- Codebase Mapper: 10 min
- Plan Checker: 10 min
- Pattern Mapper: 10 min

**Agents Involved:**
- `ijfw:ijfw-codebase-mapper` — analyze directory structure, tech stack, entry/exit points
- `ijfw:ijfw-plan-checker` — detect infrastructure re-spec, duplication
- `ijfw:ijfw-pattern-mapper` — map Phase patterns to existing analogs

**Output Aggregation:**
- Collect all 3 reports
- Merge findings into single `{PHASE_ID}-audit-report.md`
- Calculate conformance score (infrastructure alignment, pattern compliance)
- Surface any conflicts requiring escalation

---

## Gate Logic

**Before Lock Decision:**

```
IF audit_pass == TRUE
  AND infrastructure_conflicts == 0
  AND pattern_conformance >= 85%
THEN
  Charter scope frozen ✅
  Proceed to Phase implementation
ELSE
  Charter scope HELD ⏸
  Escalate to ijfw-discuss-phase
  Re-audit before lock retry
```

---

## Governance Rule Addition

**New Rule (Section 12: Charter Lifecycle):**

> **12.2 Audit-First Scope Lock:** No charter may transition to LOCKED status without passing Audit-First Scope Lock gate. The gate comprises three parallel scans (codebase mapping, infrastructure alignment, pattern conformance) and must complete with passing verdict on all three before Tier 1 scope freeze approval. Audit reports are archived in docs/meta/audit/ and referenced in charter YAML frontmatter (field: `audit_report_id`).

---

## Phase ABC Integration (Audit Phases)

**New fixture in Phase ABC model:**

- **Phase A.5 (NEW):** Audit Tooling Setup — Establish PATTERNS.md, INFRASTRUCTURE.md reference docs; wire audit agents into ijfw-spec-phase
- **Phase B:** Baseline Audit Scans — Run audit suite against all existing phases (1–6); document baseline conformance
- **Phase C:** Audit Enforcement — Lock charter decisions to audit sign-off; reject scope changes without re-audit
- **Ongoing:** Every charter lock requires passing Audit-First gate ✅

---

## Rollback / Exception Path

**If audit fails but timeline-critical:**

1. Tier 1 explicitly documents conflict
2. Phase proceeds with conditional flag: `audit_waived_reason: "..."`
3. Conflict resolved post-ship (Phase N+1 scope includes fix)
4. Incident logged to governance audit trail
5. Audit waiver triggers post-mortem review (next quarterly cycle)

**Default:** No exceptions. Audit must pass before lock.
