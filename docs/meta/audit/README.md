---
title: Audit Reports Directory
description: Archive of pre-charter audit reports (Audit-First Scope Lock gate)
date: 2026-07-11
---

# Audit Reports

**Purpose:** Archive for pre-charter audit reports generated during Audit-First Scope Lock gate (before charter scope freeze).

**Naming Convention:** `{PHASE_ID}-audit-report.md` (e.g., `phase-3-audit-report.md`, `phase-7-audit-report.md`)

---

## Audit Report Structure

Each report contains findings from three parallel audit streams:

1. **Codebase Mapper Scan**
   - Directory structure conformance
   - Tech stack inventory
   - Entry/exit point integration

2. **Plan Checker vs. Existing Infrastructure**
   - Re-specification detection
   - Duplicate component identification
   - Breaking change flags

3. **Pattern Mapper Conformance**
   - Pattern analog mapping (PATTERNS.md)
   - Telemetry key consistency
   - Documentation template compliance

---

## Audit Verdict

Each report includes:
- `audit_verdict` — PASS | FAIL
- `infrastructure_alignment_score` — % (target >= 85%)
- `critical_conflicts` — Count (target: 0)
- `pattern_conformance` — % (target >= 85%)
- Timestamp, audit_report_id, phase_id

---

## Charter Integration

Audit report path referenced in charter YAML:
```yaml
audit_report_id: "docs/meta/audit/phase-N-audit-report.md"
audit_verdict: PASS
```

---

## Phase ABC Audit Phases

**Phase B: Baseline Audit Scans**
- Runs audit suite against all existing charters (Phases 1–6)
- Generates baseline conformance report

**Phase 7+: Ongoing**
- Every charter lock requires audit gate
- Reports archived here

---

## References

- **Audit Checklist:** docs/meta/governance/pre-charter-audit-checklist.md
- **ijfw-spec-phase Integration:** docs/meta/governance/ijfw-spec-phase-audit-gate-integration.md
- **Governance Rule:** docs/meta/governance/global-operating-rules-cic-rewrite-labs.md (Section 14)
- **Phase ABC Phases:** docs/meta/phase-abc-audit-phases-addition.md
