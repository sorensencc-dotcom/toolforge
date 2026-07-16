# Governance Rule: Parallelism Matrix Requirement

**Effective date:** 2026-07-12  
**Authority:** Tier 1  
**Applies to:** All phase scope charters (Phases 1–N)  
**Status:** ACTIVE  

---

## Rule Statement

**All phase scope charters must include a Parallelism Matrix before dispatch to Tier 1 for approval.**

---

## Rationale

Parallelism matrices prevent:
- Hidden dependencies (bottleneck surprise)
- Over-serialization (resource under-utilization)
- Missed deadlines (critical path invisible)
- Subagent coordination failure (unclear parallelism)

---

## Charter Compliance Checklist

Before dispatch to Tier 1:

### ✅ Matrix Presence
- [ ] Charter includes "Parallelism Matrix" section
- [ ] Located after Architecture/Prerequisites, before Wave Assignments

### ✅ Content Completeness
- [ ] Every wave from Execution Plan listed in matrix
- [ ] Every wave has explicit parallelism tag: `no-block`, `blocks-on: X`, `4-wide`, `sequential`, or hybrid
- [ ] All dependencies documented in `Depends On` column
- [ ] Categories assigned (optional: `infra`, `core`, `integration`, `test`)

### ✅ Structural Integrity
- [ ] No cycles in dependency graph (DAG)
- [ ] All declared dependencies exist as matrix rows
- [ ] Implicit dependencies (mentioned in spec text) are explicit in matrix
- [ ] Test wave (if present) blocks on all core/integration waves

### ✅ Realism
- [ ] Critical path duration ≤ remaining days until deadline
- [ ] Width tags (`4-wide`) are honest (no false parallelism)
- [ ] Resource constraints documented (if applicable)

### ✅ Validation
- [ ] ijfw-verify PASS or FLAGs acceptable + documented
- [ ] Charter author signed (declaration of accuracy)

---

## Dispatch Workflow

```
Charter drafted → Author adds matrix per template
  ↓
ijfw-verify runs checks
  ↓
If ERROR: Author fixes → re-verify
If FLAG: Author documents risk or fixes → escalates
If PASS: Proceed
  ↓
Tier 1 reviews charter + matrix
  ↓
Tier 1 approves or requests edits
  ↓
Charter LOCKED + Decision Log updated
```

---

## Tier 1 Review Criteria

When approving charter, Tier 1 verifies:

1. **Matrix completeness:** All waves listed + tagged ✓
2. **Dependencies match:** Wave descriptions align with matrix ✓
3. **Timeline feasibility:** Critical path ≤ deadline buffer ✓
4. **Parallelism honesty:** 4-wide tags don't hide serial work ✓
5. **Risk acceptance:** Acceptable mitigations for any FLAGs ✓

---

## Retrofit Requirement (Existing Charters)

Phases 2–6 must be retrofitted with Parallelism Matrix by **2026-07-12**:

| Phase | Charter File | Status | Retrofit Date |
|---|---|---|---|
| 2 | phase-2-... | EXISTING | 2026-07-12 |
| 3 | phase-3-cowork-gateway-charter.md | EXISTING | 2026-07-12 |
| 4 | phase-4-governance-charter.md | EXISTING | 2026-07-12 |
| 5 | phase-5-multicanary-charter.md | EXISTING | 2026-07-12 |
| 6 | phase-6-rollback-charter.md | EXISTING | 2026-07-12 |

**Retrofit process:**
1. Extract wave descriptions from Execution Plan
2. Run ijfw-plan to auto-generate matrix
3. Insert matrix into charter (after Architecture, before Wave Assignments)
4. Run ijfw-verify; fix any ERRORs (FLAGs OK for existing work)
5. Update charter's updated date
6. Commit as "docs: retrofit parallelism matrix"
7. **No re-approval needed** (charter already approved; matrix is documentation)

**Effort:** ~15 min per charter; ~2 hours total

---

## Exemptions

- **Single-wave phases:** Matrix optional (but recommended)
- **Blocked phases:** May show "WAITING" status until unblocked; matrix completed once unblocked

---

## Enforcement

### Checklist (Charter Author)
- Before submitting to Tier 1, run:
  ```bash
  ijfw-verify [charter-file]
  ```
- Verify: All waves listed + tagged; ijfw-verify PASS or FLAGs documented

### Checklist (Tier 1)
- Review matrix along with rest of charter
- Confirm: Dependencies realistic, deadline feasible, FLAGs acceptable
- Approve and record decision in charter Decision Log

### Optional: Git Hook
Add `.git/hooks/pre-commit` to warn if charter edited without matrix:

```bash
if git diff --cached | grep -q "## Execution Plan" && \
   ! git diff --cached | grep -q "## Parallelism Matrix"; then
  echo "WARNING: Charter modified without Parallelism Matrix"
  echo "  Run: ijfw-verify [charter] to validate"
  exit 1
fi
```

---

## Decision Log Template

Add to every charter after approval:

```markdown
### Decision Log

**2026-07-12 — Tier 1 Parallelism Matrix Review**
- Matrix status: PASS (or PASS with FLAGs noted)
- FLAGs reviewed: [if any]
- Critical path: [X days] vs. Deadline: [date] = [buffer]
- Decision: APPROVED as submitted
- Signature: [Tier 1 name] | [timestamp]
```

---

## Related Documents

- [Parallelism Matrix System](parallelism-matrix-system.md) — Master reference
- [Parallelism Matrix Template](parallelism-matrix-template.md) — Copy-paste template
- [ijfw-verify Checks](ijfw-verify-parallelism-checks.md) — 5 automated rules
- [CIC + Rewrite Labs Global Rules](../governance/global-operating-rules-cic-rewrite-labs.md) — Parent governance

---

## FAQ

**Q: What if a charter is already locked without a matrix?**  
A: Retrofit (no re-approval needed). See Retrofit Requirement section.

**Q: Can a matrix change after Tier 1 approval?**  
A: No. If wave order changes, update charter → re-verify → Tier 1 re-approves.

**Q: What if critical path exceeds deadline?**  
A: ijfw-verify flags it. Tier 1 can: (1) extend deadline, (2) reduce scope, (3) increase parallelism, or (4) accept risk + document.

**Q: Who checks if dependencies are honest?**  
A: ijfw-verify (check 2) finds ghost dependencies; charter author + Tier 1 review realism.

**Q: Does every wave need a row?**  
A: Yes. Full visibility + audit trail.

---

**Status:** ACTIVE  
**Approved by:** Tier 1  
**Last updated:** 2026-07-12  
**Next review:** After Phase 7 charter (evaluate effectiveness)

See: [Parallelism Matrix System](parallelism-matrix-system.md)

