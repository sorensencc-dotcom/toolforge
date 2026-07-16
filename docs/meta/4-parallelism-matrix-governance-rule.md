# Governance Rule: Parallelism Matrix in Phase Charters

**Effective date:** 2026-07-12  
**Authority:** Tier 1  
**Applies to:** All phase scope charters (Phases 1–N)  

---

## Rule Statement

**All phase scope charters must include a Parallelism Matrix before dispatch to Tier 1 for approval.**

---

## Rationale

Parallelism matrices prevent:
- ❌ Bottleneck surprise (dependencies hidden until execution)
- ❌ Resource under-utilization (overly sequential plans)
- ❌ Deadline miss cascades (critical path not visible)
- ❌ Subagent coordination failure (unclear which waves can run in parallel)

Explicit matrices enable:
- ✅ Optimal subagent distribution (4-wide parallelism)
- ✅ Accurate deadline risk assessment
- ✅ Early dependency conflict detection
- ✅ Cross-phase handoff clarity

---

## Charter Compliance Checklist

Before a phase charter can be dispatched to Tier 1:

### ✅ Matrix Presence
- [ ] Charter includes "Parallelism Matrix" section (or titled equivalent)
- [ ] Matrix appears after Architecture/Prerequisites, before Wave Assignments
- [ ] Matrix is in table format (markdown or YAML-compatible)

### ✅ Content Completeness
- [ ] Every wave/spec listed in matrix
- [ ] Every wave has explicit parallelism tag: `no-block`, `blocks-on: X`, `4-wide`, `sequential`, or hybrid
- [ ] All dependencies documented in `depends_on` column
- [ ] Categories assigned (optional but recommended: `infra`, `core`, `integration`, `test`)

### ✅ Structural Integrity
- [ ] Dependency graph is acyclic (no cycles)
- [ ] All declared dependencies exist as rows in matrix
- [ ] Implicit dependencies (mentioned in spec text) are explicit in matrix
- [ ] Test wave (if present) blocks on all core/integration waves

### ✅ Realism
- [ ] Critical path duration is ≤ remaining days until phase deadline
- [ ] Width tags (`4-wide`) are honest (specs don't have serial blocking dependencies)
- [ ] Resource constraints documented (if applicable)

### ✅ Sign-Off
- [ ] Charter author confirms matrix is accurate per current plan
- [ ] ijfw-verify passes (no ERRORs; FLAGs allowed with Tier 1 escalation)
- [ ] Tier 1 approves matrix along with rest of charter scope

---

## Dispatch Workflow

```
Charter drafted
    ↓
[Charter author reviews Parallelism Matrix]
    ↓
[ijfw-plan output auto-generates matrix section]
    ↓
Charter author edits matrix if needed
    ↓
[ijfw-verify runs automated checks]
    ↓
  [Matrix checks: PASS or FLAG/ERROR]
    ↓
If ERROR: Fix + re-verify
If FLAG: Add note to charter; escalate to Tier 1
If PASS: Proceed to Tier 1 dispatch
    ↓
[Tier 1 reviews charter + matrix]
    ↓
[Tier 1 approves or requests edits]
    ↓
Charter LOCKED
```

---

## Tier 1 Approval Criteria for Matrix

When reviewing phase charter, Tier 1 must verify:

1. **Matrix completeness:** All waves listed and tagged
2. **Dependency sanity:** Dependencies match wave descriptions
3. **Timeline feasibility:** Critical path ≤ deadline buffer
4. **Parallelism honesty:** 4-wide tags don't hide serial work
5. **Risk acceptance:** FLAGs in ijfw-verify output are acceptable or mitigated

---

## Exemptions & Overrides

### Exemptions
- **Single-wave phases:** If a phase has only one wave, matrix is optional (but recommended for consistency)
- **External-dependency phases:** If phase is blocked on external input, matrix may show "WAITING" status with dependencies once unblocked

### Overrides
- **Tier 1 can accept a FAILING matrix** if:
  - Risk is documented + acknowledged in charter decision log
  - Mitigation plan is written (e.g., "aggressive parallelism to offset late start")
  - Override is time-stamped + signed by Tier 1

---

## Template for Phase Charters

New phase charters must include this section:

```markdown
## Execution Plan

### Parallelism Matrix

[Copy from template; fill in phase-specific details]

### Wave Assignments

[Each wave assigned to subagent; references matrix for dependency order]
```

---

## Retrofit Requirement: Existing Charters

Existing charters (Phases 2–6, already drafted) must be retrofitted with Parallelism Matrix:

| Phase | Charter File | Status | Retrofit Date |
|---|---|---|---|
| 2 | phase-2-... | Existing | 2026-07-12 |
| 3 | phase-3-cowork-gateway-charter.md | Existing | 2026-07-12 |
| 4 | phase-4-governance-charter.md | Existing | 2026-07-12 |
| 5 | phase-5-multicanary-charter.md | Existing | 2026-07-12 |
| 6 | phase-6-rollback-charter.md | Existing | 2026-07-12 |

Retrofit process:
1. Extract wave descriptions from each charter's Execution Plan
2. Auto-generate matrix using ijfw-plan
3. Insert matrix into charter (after Architecture, before Wave Assignments)
4. Run ijfw-verify; fix any FLAGs
5. Update charter's updated date; commit as "docs: retrofit parallelism matrix"
6. No re-approval required (only for newly drafted charters)

---

## Enforcement: Git Hook Integration

Optional: Add git pre-commit hook that warns if a charter file is modified without an updated Parallelism Matrix:

```bash
#!/bin/bash
# .git/hooks/pre-commit

if git diff --cached | grep -q "## Execution Plan" && ! git diff --cached | grep -q "## Parallelism Matrix"; then
  echo "WARNING: Charter modified but Parallelism Matrix not updated"
  echo "  Run: ijfw-plan [phase] to regenerate matrix"
  echo "  Then: git add [charter-file]"
  echo ""
  echo "Proceed with commit? (y/n)"
  read -r response
  [ "$response" = "y" ] || exit 1
fi
```

---

## Audit Trail

Every matrix approval is recorded in charter's Decision Log:

```markdown
### Decision Log

**2026-07-12 — Tier 1 Parallelism Review**
- Matrix status: PASS (0 errors, 2 flags)
- Flags reviewed: [list any FLAGs]
- Decision: APPROVED as submitted
- Signature: [Tier 1 name] | [timestamp]
```

---

## Related Documents

- [Parallelism Matrix Template](parallelism-matrix-template.md)
- [ijfw-plan Integration Spec](ijfw-plan-integration-spec.md)
- [ijfw-verify Parallelism Checks](ijfw-verify-parallelism-checks.md)
- [CIC + Rewrite Labs Global Rules](cic-rewrite-labs-global-rules.md)

---

## FAQ

**Q: What if a phase charter is already locked without a matrix?**  
A: Retrofit (see §6). No re-approval needed unless chart changes.

**Q: Can a matrix change after Tier 1 approval?**  
A: No. If wave order must change, update charter, re-run ijfw-verify, request Tier 1 re-approval.

**Q: What if critical path exceeds deadline?**  
A: ijfw-verify FLAGs it. Tier 1 must sign off on risk or phase must revise scope/deadline.

**Q: Does every single-spec wave need a row?**  
A: Yes. Visibility + audit trail.

---

**Status:** ACTIVE  
**Approved by:** Tier 1  
**Last updated:** 2026-07-12  
