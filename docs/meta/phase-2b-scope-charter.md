---
title: Phase 2.B Scope Charter — Optional Migrations
date: 2026-07-10
status: TIER1_APPROVED_DEFER
approved_date: 2026-07-10
decision_date: 2026-07-10
decision: DEFER
---

# Phase 2.B Scope Charter — Optional Migrations

## Executive Summary

Phase 2.B expands Phase 2.A's Tier A foundation (9 skills) with optional migrations from rewrite-mcp/skills/ and external tooling. Scope is bounded and requires explicit pre-approval. Not all migrations happen automatically—each requires a sub-charter.

---

## Phase 2.A Recap (Locked ✅)

Phase 2.A validated all 22 skills (13 Phase 1 + 9 Phase 2.A Tier A) and staged them for Cowork registration in Phase 3.

**Current Inventory:**
- 13 Phase 1 (Ashfall) skills — production-ready ✅
- 9 Phase 2.A (Tier A) skills — production-ready, staged for Cowork ✅
- 22 total skills — 100/100 compliance ✅

---

## Phase 2.B Scope

### 2B.1 Candidate Migrations (Inventory)

Potential skill sources for Phase 2.B migration:

#### From rewrite-mcp/skills/

| Skill ID | Source | Status | Reason |
|----------|--------|--------|--------|
| (scan required) | rewrite-mcp/skills/ | pending-audit | Need to audit directory for production-ready skills |

#### From External Sources

| Source | Skill Count | Status | Reason |
|--------|------------|--------|--------|
| claude-skills/ | TBD | pending-audit | Check for exportable skills |
| Third-party | TBD | pending-audit | If any approved by governance |

**Action:** Audit rewrite-mcp/skills/ + claude-skills/ to identify migration candidates.

### 2B.2 Pre-Approval Gate (MANDATORY)

Before any Phase 2.B migration executes:

1. **Tier 1 must approve** each migration batch (not one blanket approval)
2. **Sub-charter required** for each batch (scope, entry/exit criteria, risks)
3. **Scope locked** before execution (no mid-flight additions)
4. **Compliance verified** (must pass health-monitor 100/100)

### 2B.3 Migration Criteria

Skills eligible for Phase 2.B:

- Has skill.json + src/index.ts (valid structure)
- Passes SKILLPACK-VALIDATOR (0 errors)
- Has documented use case or business driver
- Does not conflict with Phase 1/2.A skills
- Non-experimental (not research/sandbox)

### 2B.4 Out of Scope

- Experimental/research skills (sandbox)
- Skills from external third-party sources without explicit governance approval
- Python/FastAPI skills (separate stack—see Initiative B)
- Skills requiring new infrastructure (deferred to Phase 3+)

---

## Execution Model

### Entry Criteria (Tier 1 Sign-Off Required)

- [x] Tier 1 approval of Phase 2.B itself (yes/no/defer) — **APPROVED: Option A (Proceed)**
- [ ] Audit of rewrite-mcp/skills/ completed
- [ ] Candidate migration list generated
- [ ] First migration batch scope defined (if proceeding)

### Execution Flow

**If Tier 1 approves Phase 2.B:**

1. **Sub-Charter 2B.1:** Audit rewrite-mcp/skills/ (compliance, inventory)
2. **Sub-Charter 2B.2:** Migrate batch 1 (if candidates exist)
3. **Sub-Charter 2B.3:** Migrate batch 2+ (if approved)

**If Tier 1 defers or declines Phase 2.B:**
- Skip to Phase 3 (Cowork Gateway), no migrations attempted

### Exit Criteria

- [ ] Phase 2.B decision finalized (proceed / defer / decline)
- If proceeding:
  - [ ] All approved migrations completed
  - [ ] New skills integrated into SKILLPACK-VALIDATION.md
  - [ ] All migrated skills pass health-monitor 100/100
  - [ ] Phase 3 charter remains on track (no delays)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| rewrite-mcp has no production skills | Wasted Phase 2.B work | Audit first (Sub-Charter 2B.1) |
| Migrations conflict with Phase 1/2.A | Duplicate skills, ID collisions | Pre-check against canonical inventory |
| Compliance issues in candidates | Migration fails at validation | Health-monitor 100/100 required |
| Phase 2.B delays Phase 3 | Blocks Cowork Gateway timeline | Set hard deadline (e.g., 2026-07-15) or defer |

---

## Decision Options

### Option A: Proceed with Phase 2.B

Execute Sub-Charter 2B.1 (audit), then decide on migrations post-audit.

**Conditions:**
- Tier 1 approval required
- Hard deadline for completion (e.g., 2026-07-15)
- No Phase 3 delays tolerated
- Audit completes by 2026-07-11

### Option B: Defer Phase 2.B

Skip Phase 2.B entirely; focus on Phase 3 (Cowork Gateway).

**Conditions:**
- Re-open Phase 2.B charter if rewrite-mcp skills materialize later
- Reduces scope complexity
- Keeps Phase 3 on critical path

### Option C: Selective Phase 2.B

Approve Phase 2.B only if audit finds N+ production-ready skills in rewrite-mcp.

**Conditions:**
- Tier 1 sets threshold (e.g., "only if 5+ candidates found")
- Audit results determine Go/No-Go
- Sub-charters only for approved batches

---

## Approval & Governance

### Tier 1 Decision Required

**Question:** Should Phase 2.B proceed (audit → conditional migrations)?

**Options:**
1. Proceed (Option A)
2. Defer (Option B)
3. Selective (Option C with threshold)

### Timeline

- **Decision:** This turn (2026-07-10)
- **Audit (if proceed):** 2026-07-11
- **Migration batch 1 (if audit finds candidates):** 2026-07-12–2026-07-14
- **Phase 3 entry:** 2026-07-15 (hard deadline)

---

## Decision Log

- **2026-07-10 17:35:** ✅ **Tier 1 Final Decision: DEFER Phase 2.B** — Audit found 0 production-ready candidates in rewrite-mcp/skills/. All 25 skills missing toolforge structure (skill.json + src/index.ts). Recommendation: Skip Phase 2.B, proceed to Phase 3 (Cowork Gateway) on critical path by 2026-07-15.
- **2026-07-10 17:15:** ✅ **Tier 1 Decision: Option A (Proceed)** — Execute Sub-Charter 2B.1 (audit rewrite-mcp/skills/), then conditional migrations if candidates found.
- **2026-07-10:** Phase 2.B charter created. Pending Tier 1 decision.

---

**Charter Status:** ✅ CLOSED (DEFERRED)

**Decision:** Tier 1 approved Option 1 — Defer Phase 2.B entirely

**Rationale:** Audit found 0 production-ready candidates. rewrite-mcp/skills contain JS MCP implementations, not toolforge skills. Scaffolding would extend timeline beyond Phase 3 critical path (2026-07-15).

**Next Step:** Proceed to Phase 3 (Cowork Gateway) — Phase 3 scope charter ready for execution. Re-open Phase 2.B if MCP implementations later get toolforge scaffolding.
