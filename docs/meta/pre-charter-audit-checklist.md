---
title: Pre-Charter Audit Checklist
description: Mandatory pre-lock validation suite — codebase mapping, infrastructure alignment, pattern conformance
date: 2026-07-11
---

# Pre-Charter Audit Checklist

**Mandatory Gate:** All items must PASS before charter scope freeze. Audit must complete in parallel (30 min SLA).

---

## 1. Codebase Mapper Scan

**Purpose:** Map proposed Phase scope against existing architecture (tech stack, entry points, directory structure).

**Checklist:**
- [ ] **Tech Stack Inventory:** List languages, frameworks, dependencies for Phase scope
- [ ] **Directory Map:** Proposed files fit 8-dir standard structure (docs/, scripts/, tests/, config/, agents/, etc.)
- [ ] **Naming Convention:** All proposed file/dir names lowercase-hyphen compliant
- [ ] **Entry Point Audit:** Proposed Phase entry points integrate with Phase N-1 exit points
- [ ] **Dependency Scan:** No new undeclared dependencies; version locks documented
- [ ] **Parallel Execution Check:** No conflicting write-paths with concurrent phases

**Output:** `CODEBASE_MAPPING.json` (file paths, tech stack, entry/exit points)

---

## 2. Plan Checker vs. Existing Infrastructure

**Purpose:** Detect re-specification of infrastructure already implemented; prevent duplication.

**Checklist:**
- [ ] **Pattern Reuse:** All proposed components checked against existing patterns (PATTERNS.md)
- [ ] **Existing Libs:** Verify new utilities don't duplicate existing lib functions
- [ ] **Config Overlap:** No conflicting config keys or override attempts
- [ ] **API Endpoints:** New endpoints don't shadow existing routes
- [ ] **Data Models:** Schema changes backward-compatible; no orphaned migrations
- [ ] **Test Fixtures:** Reuse existing test data; no redundant factories

**Output:** `INFRASTRUCTURE_ALIGNMENT.json` (reused patterns, libs, configs; conflicts flagged)

---

## 3. Pattern Mapper Analogs

**Purpose:** Map proposed Phase patterns to closest existing analogs; ensure consistency.

**Checklist:**
- [ ] **Handler Patterns:** Proposed handlers use existing error handling, logging, telemetry patterns
- [ ] **Validator Patterns:** Validation logic consistent with Phase N-1 validators
- [ ] **Engine Patterns:** Processing engines follow established orchestration patterns
- [ ] **Metrics Collection:** Telemetry keys consistent with existing nomenclature
- [ ] **CLI/Config Interface:** CLI flags, env vars, config schema follow conventions
- [ ] **Documentation:** README/docs follow template structure (Summary, Scope, Components, Exit Criteria)

**Output:** `PATTERN_CONFORMANCE.json` (pattern matches, deviations noted with justification)

---

## Gate Decision

**PASS Criteria:**
- All 3 scans complete
- 0 critical conflicts detected
- Infrastructure alignment score >= 85%
- Charter locked by Tier 1

**FAIL Criteria:**
- Unresolved conflicts in plan vs. existing infra
- Duplicate infrastructure not consolidated
- Pattern deviations without documented justification

**Escalation:** Failures → Discuss Phase (ijfw-discuss-phase) to resolve before re-audit

---

## Integration Point

**Triggered by:** ijfw-spec-phase (before "Charter Scope Freeze" decision)  
**Runs in parallel:** ✅ 30-min SLA  
**Output destination:** docs/meta/audit/{PHASE_ID}-audit-report.md  
**Governance rule:** Charter cannot transition to LOCKED status without audit sign-off
