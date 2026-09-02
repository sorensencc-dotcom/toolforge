---
title: "Phase 0: Pattern Research Gate [COMPONENT_NAME]"
date: "2026-07-11"
status: TEMPLATE
decision: RESEARCH_REQUIRED
approval_required: TIER1_BEFORE_PHASE_1
time_boxed: 30min
---

# Phase 0: Pattern Research Gate — [COMPONENT_NAME]

**Purpose:** Pre-charter discovery checkpoint. Validates whether proposed component is (a) novel, (b) applies existing patterns, or (c) duplicates. Informs charter scope + risk surface.

**Ownership:** Tier 2 researcher + Tier 1 approval gate

**Output:** Research decision doc (commit to docs/meta or defer)

---

## Research Checkpoint (30min time-box)

### Q1: Is This Component Novel?

**Decision Tree:**

```
┌─ "Is this a wholly new capability or architecture?"
│  ├─ YES → Continue Q2
│  └─ NO → Go to Q3
```

**Evidence Required:**
- Existing codebase search (10min): Grep for similar names, keywords, patterns
- Artifact inventory scan (5min): Check MEMORY.md + docs/meta/artifact-versions-manifest.md
- Team knowledge check (5min): Consult prior phase docs (phases 1–current)

**Decision:**
- **Novel (YES):** Proceed to Q2 (external lookup required)
- **Existing Pattern (NO):** Proceed to Q3 (reuse pathway)

---

### Q2: External Lookup Required? (Novel Components Only)

**Trigger:** Component is novel AND spans one or more of:
- Network/infrastructure boundary (API, gateway, router)
- Data schema or storage format (DB, cache, config)
- Authentication/authorization mechanism
- Performance-sensitive path (latency <100ms or throughput >1K/sec)
- Cross-team integration point

**Research Tasks (10min):**

| Question | Lookup Source | Output |
|----------|---|---|
| Does industry have standard pattern? | GitHub, NPM docs, AWS docs, architecture blogs | "Pattern exists: [name]" or "No standard found" |
| Do we have internal precedent? | Phase 1–current charters, deployed services | Link to prior implementation or "Green field" |
| What are failure modes? | Related phase risk logs, incident reports | "Failure mode: [X], cost: [Y]" |
| Can we mock/defer integration? | Phase charter scope boundaries | "Mock ready: yes/no/partial" |

**Record Output in Section 4 (Pattern Research Log)**

**Decision:**
- **External Pattern Found:** Cite source + rationale for delta (Section 4.2)
- **No External Match:** Proceed to detail design assumptions (Section 3)
- **Defer to Implementation:** Note in Phase 0 decision log (Section 5)

---

### Q3: Reuse Existing Pattern (Non-Novel Components)

**Claim:** Component applies existing codebase patterns or prior-phase implementation.

**Evidence Required (5min):**
- Existing implementation path (file:line reference)
- Scope delta vs. baseline (what's different?)
- Risk surface (is this delta safe?)

**Output:** Document reuse claim + delta in Section 4 (Pattern Research Log)

**Decision:**
- **Safe Reuse:** Cite baseline + delta → Phase 1 charter can reference
- **Risky Reuse:** Flag assumption + risk mitigation in charter
- **Actual Duplicate:** Recommend consolidation in Phase 0 decision (do not proceed to Phase 1)

---

## Phase 0 Deliverable Outline

### 1. Component Summary

**Name:** [Component name / identifier]

**Classification:** 
- [ ] Novel
- [ ] Existing pattern + delta
- [ ] Duplicate (consolidate, do not proceed)

**Time Budget:** 30min research ✅ / Phase 1 implementation [TBD]

**Tier 1 Gate:** Phase 0 decision required before Phase 1 charter lock

---

### 2. Discovery Questions (Pre-Research)

Answer these before opening Section 3:

1. **What problem does this component solve?** (1 sentence)
   - _Answer: [TBD]_

2. **Where does it integrate?** (upstream → this component → downstream)
   - _Answer: [TBD]_

3. **What is its data model?** (inputs → processing → outputs)
   - _Answer: [TBD]_

4. **Is integration mocked in Phase 1?** (yes/no/partial)
   - _Answer: [TBD]_

---

### 3. Design Assumptions (Novel Components)

> Only complete this section if Q1 = "Novel"

| Assumption | Rationale | Risk | Mitigation |
|-----------|-----------|------|-----------|
| [Assumption 1] | [Why we believe this] | [What breaks if wrong?] | [How do we validate?] |
| [Assumption 2] | | | |

---

### 4. Pattern Research Log

**4.1 Codebase Search Results**

```
Pattern searches executed:
- grep: "[query]" → [files found]
- grep: "[query]" → [files found]

Conclusion: [Pattern exists / No pattern found / Partial match]
```

**4.2 External Lookup Results**

> Only complete if Q2 triggered (novel + integration boundary)

| Source | Query | Result | Citation |
|--------|-------|--------|----------|
| GitHub | [search] | [found pattern / not found] | [URL] |
| NPM / Docs | [search] | [result] | [URL] |
| Internal (Phase X) | [search] | [result] | [file:line] |

**Summary:** [Industry pattern / Internal precedent / Green field]

**Applicability:** How does external pattern apply to our delta?
- _Answer: [TBD]_

---

### 5. Phase 0 Decision

**Recommendation:** [APPROVE_TO_PHASE_1 / REVISE / CONSOLIDATE / DEFER]

**Rationale:**
- Component classification: [Novel / Existing pattern / Duplicate]
- External pattern fit: [High / Medium / Low / N/A]
- Risk surface: [Low / Medium / High]
- Mock readiness: [Ready / Partial / Not ready]

**Conditions for Phase 1 Entry:**
- [ ] Phase 0 decision logged + approved by Tier 1
- [ ] Risk mitigations identified (if High risk)
- [ ] Phase 1 charter references Phase 0 findings
- [ ] Mock implementation plan defined (if applicable)

**Next Steps:**
1. [Action 1 for Tier 2]
2. [Action 2 for Tier 2]
3. Tier 1 approval gate → Phase 1 charter lock

---

## Approval & Governance

**Phase 0 Status:** [RESEARCH_IN_PROGRESS / PENDING_APPROVAL / APPROVED]

**Tier 1 Approval Required:** Yes (before Phase 1 charter lock)

**Approved By:** [Name + date, or "Pending"]

**Approval Evidence:** [Link to commit / memory reference]

---

## Notes

- **Time-box:** Strict 30min limit. If research incomplete, phase 0 decision is "DEFER to Phase 1" with explicit risk acceptance clause.
- **Artifact Rules:** Phase 0 decisions that materialize into public components require design doc (DESIGN.md) before Phase 1 execution.
- **External Lookup Threshold:** Trigger only when novel component crosses team/subsystem boundary or affects data schema / security model.
- **Reuse vs. Duplication:** If codebase already implements 80%+ of component, flag as duplicate for consolidation (do not proceed).

---

**Template Version:** 1.0 (2026-07-11)

**Related:** See also Phase 1 charter template, ijfw-spec-phase workflow, global operating rules (Section 12)
