# Parallelism Matrix System

**Version:** 1.0  
**Effective:** 2026-07-12  
**Authority:** Tier 1  
**Status:** ACTIVE  

---

## Overview

The Parallelism Matrix System makes wave/spec execution order explicit, detects bottlenecks early, and optimizes subagent distribution. 

**Problem it solves:**
- ❌ Hidden dependencies → bottleneck surprise during execution
- ❌ Unclear parallelism → subagent under-utilization
- ❌ Missing critical path → deadline miss cascades
- ❌ Implicit dependencies → late conflict discovery

**Solution:**
- ✅ Explicit matrix (all dependencies declared)
- ✅ Automated validation (5 checks via ijfw-verify)
- ✅ Deadline risk assessment (critical path vs. deadline)
- ✅ Required governance gate (all charters must include before Tier 1 dispatch)

---

## Quick Start (5 minutes)

### For Charter Authors

1. Create section in Execution Plan:
   ```markdown
   ## Execution Plan
   
   ### Parallelism Matrix
   
   | Wave | Spec | Depends On | Tag | Notes |
   |---|---|---|---|---|
   | W.1 | {spec} | None | `no-block` | Entry point |
   | W.2 | {spec} | W.1 | `blocks-on: W.1` | After W.1 done |
   ```

2. Fill in each row with:
   - Wave identifier (W.1, W.2, etc.)
   - Spec name from Execution Plan
   - Waves it depends on (if any)
   - Parallelism tag (see Tag Reference below)
   - Notes

3. Run verification:
   ```bash
   ijfw-verify [charter-file]
   ```

4. Commit with updated Decision Log

### For Tier 1

1. Review matrix along with charter
2. Confirm:
   - [ ] All waves listed + tagged
   - [ ] Dependencies match wave descriptions
   - [ ] Critical path ≤ deadline buffer
   - [ ] ijfw-verify PASS or FLAGs acceptable
3. Approve and record in Decision Log

---

## Tag Reference

### Execution Width
- **`4-wide`**: Up to 4 specs in parallel (subagent budget default)
- **`2-wide`**: Up to 2 specs in parallel (resource constraint)
- **`sequential`**: One-at-a-time execution

### Dependencies
- **`no-block`**: Independent; starts immediately
- **`blocks-on: W.X`**: Wait for W.X completion
- **`blocks-on: W.X, W.Y`**: Wait for multiple waves
- **`4-wide (blocked by W.1)`**: Hybrid (4-wide after W.1 done)

### Categories (optional)
- `infra` — Setup, env, config
- `core` — Algorithms, engines, logic
- `integration` — Cross-boundary plumbing
- `test` — E2E, unit, validation
- `governance` — Approval gates, audit

---

## The 5 Checks (ijfw-verify)

**Check 1: No cycles**
- Rule: Dependency graph must be acyclic (DAG)
- Failure: "Cycle detected: W.1 → W.2 → W.3 → W.1"

**Check 2: All dependencies declared**
- Rule: If wave mentions W.X in spec, matrix must show `blocks-on: W.X`
- Failure: "Ghost dependency: W.2 mentions W.1 but shows no blocks-on"

**Check 3: Width honesty**
- Rule: `4-wide` waves cannot have active serial dependencies
- Failure: "W.2 tagged 4-wide but depends on W.1 (also 4-wide)"

**Check 4: Test blocks all cores**
- Rule: Test wave must `blocks-on` all core/integration waves
- Failure: "E2E Harness blocks on W.1, W.3 but not W.2, W.4"

**Check 5: Deadline feasibility**
- Rule: Critical path duration ≤ remaining days to deadline
- Failure: "Critical path 7d > deadline buffer 4d"

---

## Governance Rule

**Requirement:** All phase scope charters must include Parallelism Matrix before Tier 1 dispatch.

**Compliance checklist:**
- [ ] Matrix section present (after Architecture, before Wave Assignments)
- [ ] Every wave listed + parallelism tagged
- [ ] All dependencies documented
- [ ] No cycles (DAG)
- [ ] ijfw-verify PASS or FLAGs accepted

**Retrofit requirement:** Phases 2–6 by 2026-07-12 (documentation retrofit only, no re-approval)

---

## Example: Phase 4 Governance

```markdown
| Wave | Spec | Depends On | Tag | Notes |
|---|---|---|---|---|
| W.1 | ProposalValidator | None | `no-block` | Entry point |
| W.2 | GovernanceEngine | None | `no-block` | Independent setup |
| W.3 | CanaryEngine | W.1, W.2 | `blocks-on: W.1, W.2` | Needs both |
| W.4 | PromotionEngine | W.3 | `blocks-on: W.3` | After canary |
| W.5 | E2E Harness | W.1–W.4 | `blocks-on: W.1, W.2, W.3, W.4` | Final test |

**Critical path:** W.1 + W.2 → W.3 → W.4 → W.5 (5 days serial)  
**Parallelizable:** W.1 + W.2 (independent, 4-wide)

**Verification:** PASS (no cycles, all deps, deadline feasible)
```

---

## Integration Points

### ijfw-plan Agent Changes
- Auto-generate matrix section (after Architecture + Prerequisites)
- Compute critical path + parallelizable groups
- Include YAML block for ijfw-verify parsing
- Flag anti-patterns during planning

### ijfw-verify Agent Changes
- Parse matrix from charter/plan
- Run 5 automated checks
- Output verification table
- Return PASS/FLAG/ERROR verdict

### Charter Dispatch Workflow
```
Charter drafted
  ↓
[Charter author includes matrix per template]
  ↓
[ijfw-verify runs checks]
  ↓
[Author addresses FLAGs or accepts risk]
  ↓
[Tier 1 reviews + approves]
  ↓
[Charter LOCKED]
```

---

## Implementation Checklist

**By 2026-07-12:**
- [ ] This document placed in `/docs/meta/`
- [ ] Template file (link below)
- [ ] ijfw-verify checks file (link below)
- [ ] Governance rule file (link below)
- [ ] Retrofit Phases 2–6 (auto-generate matrices)

**Phase 7 onward:**
- [ ] ijfw-plan generates matrix automatically
- [ ] ijfw-verify runs 5 checks on all charters
- [ ] Tier 1 checklist includes matrix review
- [ ] Optional: git hook warns on charter edits without matrix update

---

## Anti-Patterns (what to avoid)

❌ **Ghost dependency:** Spec mentions W.X but matrix shows no `blocks-on`  
❌ **Width mismatch:** `4-wide` tag on wave with sequential dependency  
❌ **Hidden coupling:** Two `no-block` specs share same input file  
❌ **Missing test wave:** No test wave blocking on core specs  
❌ **Unrealistic schedule:** Critical path exceeds deadline buffer  

ijfw-verify automatically flags these.

---

## Files Included

| File | Purpose |
|---|---|
| [Parallelism Matrix Template](parallelism-matrix-template.md) | Copy-paste template for charters |
| [ijfw-plan Integration](ijfw-plan-integration-spec.md) | How agent generates matrix |
| [ijfw-verify Checks](ijfw-verify-parallelism-checks.md) | 5 automated validation rules |
| [Governance Rule](parallelism-matrix-governance-rule.md) | Policy + requirements |
| [Retrofit Example](parallelism-matrix-retrofit-example-phase3.md) | Walkthrough for existing charters |

---

## FAQ

**Q: What if dependencies change after approval?**  
A: Charter must be updated → re-verified → Tier 1 re-approves.

**Q: Can a single-wave phase skip the matrix?**  
A: Optional but recommended for consistency.

**Q: What if critical path exceeds deadline?**  
A: ijfw-verify FLAGs it. Tier 1 can: extend deadline, reduce scope, or accept risk.

**Q: Does ijfw-verify auto-fix issues?**  
A: No. It reports; author/Tier 1 decides on fix.

---

**Status:** ACTIVE  
**Next review:** After Phase 7 charter (evaluate agent integration)  
**Owner:** Rewrite Labs / Tier 1  

See: [CIC + Rewrite Labs Global Rules](../governance/global-operating-rules-cic-rewrite-labs.md)

