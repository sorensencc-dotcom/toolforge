# Parallelism Matrix Template

**Purpose:** Declare wave execution order + dependencies. Copy into every phase charter.

**Location in charter:** Insert after Architecture + Prerequisites, before Wave Assignments section.

---

## Template for Charters

```markdown
## Execution Plan

### Parallelism Matrix

[Critical path description]
[Parallelizable groups description]
[Resource constraints if any]

| Wave | Spec | Category | Depends On | Tag | Duration | Notes |
|---|---|---|---|---|---|---|
| W.1 | `{spec_name}` | `{category}` | None | `{tag}` | X hours | {notes} |
| W.2 | `{spec_name}` | `{category}` | W.1 | `{tag}` | X hours | {notes} |

**Verification:**
- [x] No cycles detected
- [x] All dependencies declared
- [x] Width tags honest
- [x] Test wave blocks on all cores
- [x] Critical path <= deadline
```

---

## Column Definitions

| Column | Purpose | Example |
|---|---|---|
| **Wave** | Identifier | W.1, W.2, W.3 |
| **Spec** | Name from Execution Plan | ProposalValidator, CanaryEngine |
| **Category** | Type (infra/core/integration/test/governance) | core, integration |
| **Depends On** | Waves this waits for | None, W.1, W.1+W.2 |
| **Tag** | Parallelism + blocking | `no-block`, `blocks-on: W.1`, `4-wide` |
| **Duration** | Estimated time (hours/days) | 2–4h, 1 day |
| **Notes** | Context + constraints | "Entry point", "Shared database access" |

---

## Tag Reference

### Execution Width
- `4-wide` — Default parallelism (4 instances max)
- `2-wide` — Resource constraint (2 instances max)
- `sequential` — One-at-a-time (single-threaded)

### Blocking
- `no-block` — Independent; starts immediately
- `blocks-on: W.X` — Wait for W.X to complete
- `blocks-on: W.X, W.Y` — Wait for multiple waves
- `4-wide (blocked by W.1)` — Hybrid (4-wide after W.1 done)

### Categories
- `infra` — Setup, env vars, config, scaffolding
- `core` — Algorithms, engines, domain logic
- `integration` — Cross-boundary plumbing, adapters
- `test` — E2E, unit tests, validation, fixtures
- `governance` — Approval gates, audit trails, policy

---

## Example: Phase 4 Governance + Canary

```markdown
### Parallelism Matrix

**Critical path:** W.1 + W.2 → W.3 → W.4 → W.5  
**Duration:** ~5 days (2d + 2d parallel, then 1d serial for W.3→W.4→W.5)  
**Parallelizable:** W.1 + W.2 (no inter-dependencies)  
**Resource constraints:** Shared database; single approval authority

| Wave | Spec | Category | Depends On | Tag | Duration | Notes |
|---|---|---|---|---|---|---|
| W.1 | ProposalValidator | core | None | `no-block` | 2d | Validation rules, constraints |
| W.2 | GovernanceEngine | core | None | `no-block` | 2d | Approval logic, thresholds |
| W.3 | CanaryEngine | core | W.1, W.2 | `blocks-on: W.1, W.2` | 1d | Reads validator + approval output |
| W.4 | PromotionEngine | core | W.3 | `blocks-on: W.3` | 1d | Executes promotion decision |
| W.5 | E2E Harness | test | W.1–W.4 | `blocks-on: W.1, W.2, W.3, W.4` | 1d | Tests all specs end-to-end |

**Parallelization plan:**
- Week 1: W.1 + W.2 run 4-wide (independent)
- Week 2: W.3 waits for W.1+W.2, runs after complete
- Week 2–3: W.4 runs after W.3
- Week 3: W.5 runs final integration test

**Verification:**
- [x] No cycles (linear chain W.1→W.3→W.4→W.5)
- [x] All deps declared (W.3 mentions both W.1 + W.2)
- [x] Width honest (W.1+W.2 both tagged `no-block`, truly independent)
- [x] Test blocks all cores (W.5 depends on W.1–W.4)
- [x] Deadline feasible (5d < 7d available)
```

---

## Anti-Patterns (avoid)

❌ **Ghost dependency**
```markdown
| W.2 | Engine | core | None | `no-block` | ... | Uses output from W.1 |  ← WRONG
```
→ Should be: `Depends On: W.1` and `Tag: blocks-on: W.1`

❌ **Width mismatch**
```markdown
| W.1 | Spec1 | core | None | `4-wide` | ... |
| W.2 | Spec2 | core | W.1 | `4-wide` | ... |  ← WRONG
```
→ Should be: W.2 tagged `blocks-on: W.1, 4-wide` or `sequential`

❌ **Missing test**
```markdown
| W.1 | Core1 | core | None | ... |
| W.2 | Core2 | core | W.1 | ... |
| W.3 | Test  | test | None | ... |  ← WRONG (doesn't block on cores)
```
→ Should be: `Depends On: W.1, W.2` and `blocks-on: W.1, W.2`

---

## YAML Variant (for automation)

Optional alternate format for automated tools:

```yaml
parallelism_matrix:
  version: "1.0"
  phase: "4"
  
  waves:
    - id: W.1
      spec_name: ProposalValidator
      category: core
      depends_on: []
      tag: no-block
      width: 1
      duration_days: 2
      notes: "Validation rules entry point"
      
    - id: W.2
      spec_name: GovernanceEngine
      category: core
      depends_on: []
      tag: no-block
      width: 1
      duration_days: 2
      notes: "Approval logic independent setup"
      
    - id: W.3
      spec_name: CanaryEngine
      category: core
      depends_on: [W.1, W.2]
      tag: blocks-on
      width: 1
      duration_days: 1
      notes: "Needs validator + approval"
      
    - id: W.5
      spec_name: E2E Harness
      category: test
      depends_on: [W.1, W.2, W.3, W.4]
      tag: blocks-on
      width: 4
      duration_days: 1
      notes: "Tests all specs"
  
  parallelizable_groups:
    - id: A
      waves: [W.1, W.2]
      can_parallel: true
      
    - id: B
      waves: [W.3]
      depends_on_group: A
      
    - id: C
      waves: [W.4]
      depends_on_group: B
      
    - id: D
      waves: [W.5]
      depends_on_group: [A, B, C]
  
  verification:
    - check: no_cycles
      status: pass
    - check: all_deps_declared
      status: pass
    - check: width_honest
      status: pass
    - check: test_wave_final
      status: pass
    - check: deadline_feasible
      status: pass
```

---

## How to Fill In Your Charter

1. **List all waves** from your Execution Plan section
2. **For each wave, identify:**
   - Dependencies (which prior waves must complete first)
   - Parallelism (can run 4-wide, 2-wide, or sequential)
   - Duration estimate (days/hours)
3. **Create matrix table** with 7 columns
4. **Add verification checklist** (5 items)
5. **Run ijfw-verify** to validate:
   ```bash
   ijfw-verify [charter-file]
   ```
6. **If PASS:** Proceed to Tier 1  
   **If FLAG:** Address or escalate to Tier 1  
   **If ERROR:** Fix and re-verify

---

## Governance Checks (ijfw-verify will validate)

| Check | Rule |
|---|---|
| **No cycles** | Dependency graph is acyclic (DAG) |
| **All deps declared** | If spec mentions wave X, matrix shows blocks-on |
| **Width honest** | `4-wide` waves don't have active serial dependencies |
| **Test blocks cores** | Test wave depends on all core/integration waves |
| **Critical path <= deadline** | Sum of critical path duration <= remaining days |

See: [ijfw-verify Checks](ijfw-verify-parallelism-checks.md)

---

**Template version:** 1.0  
**Updated:** 2026-07-12  
**Questions?** See [Parallelism Matrix System(parallelism-matrix-system.md)

