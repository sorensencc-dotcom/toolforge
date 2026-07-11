---
title: ijfw-spec-phase Integration — Phase 0 Gate
date: 2026-07-11
status: ACTIVE
owner: Tier2 (Operators)
---

# ijfw-spec-phase Workflow: Phase 0 Gate Integration

**Purpose:** Integrate Phase 0 Pattern Research Gate into ijfw-spec-phase process. Phase 0 decision gate inserted before Phase 1 charter lock.

**Workflow Stage:** Pre-charter discovery checkpoint

---

## Workflow: ijfw-spec-phase + Phase 0

### Entry Point: Phase Planning (Tier 2)

**Trigger:** User invokes `/ijfw-plan [brief component description]`

**Inputs:**
- Component brief (1–2 sentences)
- Phase roadmap context (where in phases 1–N?)
- Integration surface (upstream/downstream components)

**Initial Classification (Tier 2, 2min):**

```
Is this a MAJOR COMPONENT?

IF: New capability + crosses subsystem boundary
    OR: Shared service (2+ features)
    OR: Performance-sensitive path
    → YES → Insert Phase 0 gate (continue below)

IF: Applying existing pattern + single-feature scope
    → NO → Skip Phase 0, proceed to Phase 1 charter
```

### Phase 0 Checkpoint (Tier 2, 30min time-boxed)

**Step 1: Research Execution** (Use Phase 0 template)

1. **Q1: Novel Component?** (10min)
   - Execute codebase search (Grep + artifact scan)
   - Consult prior phase docs
   - **Output:** "Novel" | "Existing pattern" | "Duplicate"

2. **Q2: External Lookup Required?** (10min, if Q1=Novel)
   - GitHub/NPM search for industry patterns
   - Internal precedent (prior phase implementations)
   - Failure mode analysis
   - **Output:** "Pattern found: [name]" | "Green field" | "Defer to Phase 1"

3. **Q3: Reuse Assessment** (5min, if Q1=Existing/Duplicate)
   - Cite baseline + scope delta
   - Risk surface evaluation
   - Consolidation candidate assessment
   - **Output:** "Safe reuse" | "Risky reuse" | "Consolidate"

**Step 2: Decision Log** (5min)

Record Phase 0 decision in template (Section 5):
- Classification (Novel/Existing/Duplicate)
- External pattern status (Found/Green field/Deferred)
- Risk surface (Low/Medium/High)
- Mock readiness (Ready/Partial/Not ready)
- **Recommendation:** APPROVE_TO_PHASE_1 | REVISE | CONSOLIDATE | DEFER

**Step 3: Tier 1 Gate**

Submit Phase 0 research doc to Tier 1 for approval:
- Link: `docs/meta/phase-0-[component-name].md` (or memory reference)
- Request: Tier 1 decision + approval signature
- **Approval Window:** 24 hours (or accept risk of blocking Phase 1)

### Approval Decision (Tier 1, 1–2min)

**Tier 1 Options:**

1. **APPROVE_TO_PHASE_1** → Phase 1 charter proceeds (cite Phase 0 findings)
2. **REVISE** → Phase 0 needs clarification (Tier 2 rework, re-submit)
3. **CONSOLIDATE** → Component duplicates existing → Recommend merging
4. **DEFER** → Component research incomplete → Defer external lookup to Phase 1

**Approval Logging:**
- Phase 0 doc marked TIER1_APPROVED (date + signature)
- Phase 1 charter template includes Phase 0 reference section (pre-filled)
- Git commit: `docs: Phase 0 gate approved — [component-name]`

### Phase 1 Charter Lock (Tier 2 → Tier 1)

**Charter Template Update (Phase 0 Integration):**

```markdown
## Phase 0 Research Summary

**Research Gate Date:** [date]

**Phase 0 Decision:** [APPROVED / REVISED / CONSOLIDATED]

**Classification:** 
- Component Type: [Novel / Existing Pattern / Duplicate]
- External Pattern: [Found: X / Green field / N/A]
- Risk Surface: [Low / Medium / High]

**Key Findings from Phase 0:**
- Codebase pattern status: [citation or "not found"]
- External precedent: [URL/reference or "no external match"]
- Mitigation strategy: [mock plan, risk acceptance, consolidation path]

**Assumption Validation Plan:**
- Assumption 1: [How do we validate?]
- Assumption 2: [How do we validate?]

**Link to Full Phase 0 Doc:** [docs/meta/phase-0-[component-name].md]
```

**Approval Gate (Tier 1):**
- Phase 0 findings must be cited in Phase 1 charter
- Charter cannot lock without Phase 0 decision log attached
- **Conflict:** Phase 0 → DEFER, Phase 1 → APPROVE_TO_MOCK → Phase 2 resolves

---

## Decision Tree: When to Insert Phase 0

```
START: New component planned

Q: Is this MAJOR?
├─ YES (novel OR shared OR perf-sensitive) → Phase 0 REQUIRED
├─ NO (existing pattern + single-feature) → Skip Phase 0
└─ UNCERTAIN → Tier 2 consults Tier 1 (2min) → classify

IF Phase 0 Required:
├─ Execute Phase 0 (30min time-box)
├─ Tier 1 approval gate (24h window)
├─ IF APPROVED_TO_PHASE_1 → Phase 1 charter + Phase 0 reference
├─ IF REVISE → Rework Phase 0 (return to step 1)
├─ IF CONSOLIDATE → Merge with existing → no Phase 1
└─ IF DEFER → Phase 0 decision = "DEFER to Phase 1" (risk logged)

IF Phase 0 Skipped:
└─ Phase 1 charter proceeds (note: "Phase 0 not triggered")
```

---

## Risk Handling: Phase 0 Escalations

### Scenario 1: Phase 0 Research Incomplete (Time-Box Exceeded)

**Situation:** 30min time-box elapsed, external lookup unfinished.

**Decision Options:**
1. **DEFER** — Phase 0 decision = "DEFER to Phase 1" (risk acceptance logged in charter)
2. **EXTEND** — Request Tier 1 exception for additional research (max +30min)
3. **PIVOT** — Scope down component (move complex features to Phase 2+)

**Log:** Phase 0 doc Section 5 notes time pressure + decision rationale.

### Scenario 2: External Pattern Exists, But Delta Unclear

**Situation:** Phase 0 finds industry pattern (e.g., "API gateway"), but our delta vs. standard pattern is ambiguous.

**Decision Options:**
1. **APPROVE_TO_PHASE_1 + MOCK** — Proceed with mock implementation, Phase 1 charter clarifies delta vs. pattern
2. **REVISE** — Tier 2 deepens Phase 0 research (re-read docs, contact maintainers)
3. **CONSOLIDATE** — Use existing pattern as-is, no delta (reduce scope)

### Scenario 3: Codebase Search Reveals Duplicate

**Situation:** Phase 0 Q1 finds "existing pattern" at 80%+ match.

**Decision:** **CONSOLIDATE** (mandatory)
- Phase 0 doc explains duplication discovery
- Tier 1 approves consolidation path (merge vs. refactor)
- Component does NOT proceed to Phase 1 as separate charter
- Phase 1 charter instead: "Consolidate [dup] with [baseline]" (separate scope)

---

## Phase 0 Deliverable Formats

### Option 1: Standalone Doc (Recommended for Novel Components)

**Location:** `docs/meta/phase-0-[component-name].md`

**Usage:** Major components, integration boundaries, complexity warrants artifact

**Approval Path:** Commit to git, Tier 1 signs off, Phase 1 charter references

### Option 2: Memory Reference (Fast-Track)

**Location:** `MEMORY.md` (current session section)

**Usage:** Lightweight research, low-risk reuse, time-box pressed

**Format:**
```markdown
- [Phase 0 — Component Name (Fast-Track)] — Brief research findings (Q1/Q2 decision, pattern status). Tier 1 approved [date].
```

**Approval:** Tier 1 confirms in MEMORY.md note (inline comment or follow-up message)

### Option 3: Phase 1 Inline (Deferred Research)

**Location:** Phase 1 charter (Section 3, "Phase 0 Research Summary")

**Usage:** Phase 0 DEFER decision — external lookup moved to Phase 1 with risk acceptance

**Format:** See Phase 1 Charter Lock section above (Phase 0 Reference template)

**Risk Logging:** Phase 0 doc notes "DEFER" reason + Phase 1 charter includes risk mitigation plan

---

## Checklist: Phase 0 → Phase 1 Handoff

- [ ] Phase 0 completed (30min time-box, or DEFER logged)
- [ ] Component classified (Novel / Existing / Duplicate)
- [ ] Q2 research executed if Q1=Novel (or DEFER noted)
- [ ] Phase 0 decision logged (APPROVE_TO_PHASE_1 / REVISE / CONSOLIDATE / DEFER)
- [ ] Tier 1 approval obtained (date + signature in doc)
- [ ] Phase 1 charter includes Phase 0 reference section (pre-filled)
- [ ] Phase 0 assumptions → Phase 1 validation plan
- [ ] Git commit: `docs: Phase 0 gate [component-name]` or MEMORY.md update
- [ ] Link from MEMORY.md index (Phase 0 section)

---

## Troubleshooting

### Q: Can Phase 0 be skipped?

**A:** Only if component does NOT meet "major" criteria (new capability OR shared service OR perf-sensitive). If uncertain, ask Tier 1 (2min consultation). Skipping Phase 0 for major components → drift incident.

### Q: What if Phase 0 research finds no pattern? Is that "green field"?

**A:** Yes. "Green field" means no internal precedent (codebase search empty) AND no external pattern (GitHub/NPM search). Proceed with novel component assumption. Risks documented in Phase 0 doc, validated in Phase 1 execution.

### Q: Who executes Phase 0?

**A:** Tier 2 researcher (agent) following Phase 0 template. Tier 1 approves decision gate. If Tier 2 is blocked (missing context), escalate to Tier 1 for guidance (not decision).

### Q: What if Phase 0 reveals the component should be split into multiple sub-components?

**A:** Phase 0 doc recommends scope split. Tier 1 approves revised component boundary. Each sub-component may need own Phase 0 (if major). Proceed with Phase 1 for approved scope.

---

## Integration with ijfw Workflow

**ijfw Skill Checklist:**

- [ ] ijfw-plan triggers Phase 0 classification (major component? yes/no)
- [ ] If Phase 0 required, ijfw-plan workflow pauses → link to Phase 0 template
- [ ] Tier 2 completes Phase 0 (30min)
- [ ] ijfw-plan resumes with Tier 1 approval of Phase 0 decision
- [ ] Phase 1 charter generated with Phase 0 reference pre-filled

---

**Document Status:** ACTIVE (2026-07-11)

**Related:** ijfw-spec-phase | phase-0-pattern-research-gate-template.md | global-operating-rules-cic-rewrite-labs.md
