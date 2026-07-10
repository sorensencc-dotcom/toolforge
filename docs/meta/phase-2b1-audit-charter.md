---
title: Sub-Charter 2B.1 — Audit rewrite-mcp/skills/
date: 2026-07-10
status: COMPLETE
approved_date: null
parent_charter: phase-2b-scope-charter.md
---

# Sub-Charter 2B.1 — Audit rewrite-mcp/skills/

## Executive Summary

Sub-Charter 2B.1 audits rewrite-mcp/skills/ (and claude-skills/ if applicable) to identify production-ready migration candidates. Output: candidate list with compliance status, risk assessment, and Tier 1 approval gate for each batch.

**Timeline:** 2026-07-10 to 2026-07-11 (1 day)
**Blocker for:** Phase 2.B.2 (batch 1 migrations)

---

## Scope

### 2B.1.1 Directory Scan

**Directories to audit:**

1. **rewrite-mcp/skills/** — Primary source (MCP integration layer)
   - Look for: skill.json + src/index.ts structure
   - Exclude: experimental, research, sandbox folders

2. **claude-skills/** — Secondary source (if exists)
   - Same validation criteria

3. **toolforge/distributed/skills/** — Optional (compare distributed vs canonical)

### 2B.1.2 Validation Criteria

For each candidate skill, verify:

- **Structure:** skill.json exists, valid JSON schema
- **Entrypoint:** src/index.ts exists, exports handler function
- **Compliance:** SKILLPACK-VALIDATOR passes (0 errors)
- **Documentation:** README.md exists, describes purpose
- **No Conflicts:** Skill ID not in Phase 1/2.A inventory (22 existing skills)
- **Non-Experimental:** Not marked as sandbox/research/WIP
- **Business Driver:** Clear use case or integration target (e.g., "MCP bridge", "CodeFlow adapter")

### 2B.1.3 Output Artifacts

**Audit Report (Markdown)**

```markdown
# Phase 2.B.1 Audit Report

## Summary
- Total skills scanned: N
- Production-ready candidates: M
- Rejected (reasons): K
- Recommendation: Proceed / Defer / Conditional

## Candidate List
| Skill ID | Source | Status | Compliance | Conflicts | Notes |
|----------|--------|--------|------------|-----------|-------|
| skill-1  | rewrite-mcp | approved | 100/100 | none | MCP bridge |
| skill-2  | rewrite-mcp | rejected | 80/100 | N/A | Experimental |

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|-----------|
| ...  | ...    | ...       |

## Tier 1 Gate
- **Recommendation:** Tier 1 approves/defers batch 1 migrations
- **Decision Required:** Which approved candidates proceed to Phase 2.B.2?
```

**Audit Data (JSON)**

```json
{
  "audit_timestamp": "2026-07-11T10:00:00Z",
  "directories_scanned": ["rewrite-mcp/skills", "claude-skills"],
  "total_scanned": 15,
  "candidates": [
    {
      "skill_id": "skill-name",
      "source_dir": "rewrite-mcp/skills/skill-name",
      "status": "approved|rejected",
      "compliance_score": 100,
      "errors": [],
      "warnings": [],
      "conflicts": [],
      "business_case": "brief description",
      "notes": ""
    }
  ],
  "batch_1_recommendation": ["skill-a", "skill-b"],
  "tier_1_approval_required": true
}
```

---

## Execution Plan

### Step 1: Directory Enumeration (30 min)

```bash
# List all skill directories in rewrite-mcp/skills/
ls -la C:\dev\rewrite-mcp\skills\

# List all skill directories in claude-skills/
ls -la C:\dev\claude-skills\ (if exists)
```

**Output:** Inventory of skill folders + basic info

### Step 2: Validation Loop (2-3 hours)

For each skill folder:

1. Check skill.json exists + valid JSON
2. Check src/index.ts exists
3. Run SKILLPACK-VALIDATOR on skill
4. Check for conflicts (grep skill ID against Phase 1/2.A inventory)
5. Read README.md for business case
6. Flag if experimental/sandbox/WIP

**Success Criterion:** All skills validated, 0 blockers

### Step 3: Compliance Report (1 hour)

1. Tally compliance scores
2. Identify approved candidates (0 errors)
3. Assess batch 1 scope (e.g., "3 approved skills for batch 1")
4. Generate audit report + JSON export
5. Create Tier 1 approval gate (decision required before Phase 2.B.2)

**Output:** Audit report + JSON ready for Phase 2.B.2 sub-charter

---

## Entry Criteria

- [x] Phase 2.B charter approved (Tier 1 decision: Option A)
- [x] rewrite-mcp/skills/ directory exists (confirmed in repo)
- [x] Audit execution authorized (this sub-charter)

## Exit Criteria

- [x] All skills in rewrite-mcp/skills/ + claude-skills/ scanned
- [x] Candidate list generated (approved + rejected)
- [x] Audit report generated (markdown + JSON)
- [x] Compliance scores recorded (0-100 for each skill)
- [x] Tier 1 gate: awaiting decision on batch 1 candidates
- [x] Sub-Charter 2B.2 (batch 1 migrations) ready to open

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| rewrite-mcp/skills/ is empty | Audit yields 0 candidates | Set recommendation: defer Phase 2.B |
| Audit uncovers 10+ candidates | Timeline explosion | Limit batch 1 to 3-5 skills, defer rest |
| Candidate has external deps | Validation fails | Pre-scan for imports outside toolforge |
| Skill ID collision | Registration fails | Pre-check all IDs against Phase 1/2.A |

---

## Timeline

| Task | Duration | Deadline |
|------|----------|----------|
| Directory enumeration | 30 min | 2026-07-11 08:00 |
| Validation loop | 2-3 hrs | 2026-07-11 12:00 |
| Compliance report | 1 hr | 2026-07-11 13:00 |
| Tier 1 review | 1 hr | 2026-07-11 14:00 |

**Hard Stop:** 2026-07-11 14:00 (decision required to stay on Phase 3 track by 2026-07-15)

---

## Decision Log

- **2026-07-10 17:30:** ✅ **Audit Complete** — Scanned 25 rewrite-mcp skills + claude-skills directory. Finding: 0 approved candidates (all missing skill.json + src/index.ts). Recommendation: Defer Phase 2.B or accept scaffolding model.
- **2026-07-10:** Sub-Charter 2B.1 created. Awaiting execution authorization.

---

## Audit Results

**Summary:**

- **Total scanned:** 25 skills (rewrite-mcp/skills/)
- **Approved:** 0 (0% approval rate)
- **Rejected:** 25 (100%)

**Finding:** rewrite-mcp/skills/ contains JavaScript MCP implementations (index.js + schema.json), NOT TypeScript toolforge skills (skill.json + src/index.ts). No production-ready migration candidates identified.

**Recommendation:** DEFER PHASE 2.B (see phase-2b1-audit-report.md for details)

**Tier 1 Decision Gate:** 
1. Defer Phase 2.B (focus on Phase 3)
2. Accept scaffolding model (wrap MCP implementations)
3. Other

**Deadline:** 2026-07-11 14:00

---

**Sub-Charter Status:** ✅ COMPLETE (Audit executed, report generated)

**Blocked By:** None (Phase 2.B Tier 1 approval obtained)

**Blocks:** Phase 2.B.2 decision (depends on Tier 1 gate outcome)

**Next Step:** Tier 1 decides on audit findings. If defer → skip to Phase 3. If scaffold → open Phase 2.B.2 sub-charter.
