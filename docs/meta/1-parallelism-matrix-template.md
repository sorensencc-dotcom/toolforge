# Parallelism Matrix Template

**Purpose:** Declare which specs (wave items) can execute in parallel vs. which are sequential/blocking. Prevents bottleneck surprise + enables subagent distribution.

**Usage:** Copy this section into every phase charter under "Execution Plan" → "Parallelism Matrix" (after architecture/prerequisites, before wave assignments).

---

## Parallelism Matrix Template

| Wave | Spec | Category | Depends On | Parallelism Tag | Notes |
|---|---|---|---|---|---|
| W.1 | `{spec_name}` | `{category}` | None | `4-wide` / `2-wide` / `sequential` | Describe scope; note if input data comes from external source |
| W.2 | `{spec_name}` | `{category}` | `W.1` | `blocks-on: W.1` | Must wait for W.1 output before starting |
| W.3 | `{spec_name}` | `{category}` | `W.1` | `4-wide (blocked by W.1)` | Can start after W.1; runs 4-wide with W.2 pending W.1 completion |

---

## Tag Reference

### Execution Width
- **`4-wide`**: Up to 4 specs can run in parallel (subagent-distrib budget)
- **`2-wide`**: Up to 2 specs can run in parallel (resource constraint)
- **`sequential`**: Must run one-at-a-time; output feeds into next

### Dependency Modifiers
- **`blocks-on: W.X`**: Cannot start until wave W.X completes + delivers output
- **`blocks-on: W.X, W.Y`**: Depends on multiple waves
- **`no-block`**: Independent; can start immediately (useful for setup/infra tasks)
- **`4-wide (blocked by W.1)`**: Hybrid—runs 4-wide internally but waits for W.1 first

### Categories (optional, for clarity)
- `infra` — Infrastructure/setup (env, config, scaffolding)
- `core` — Core logic (algorithms, engines, domain models)
- `integration` — Cross-boundary plumbing (adapters, converters, glue)
- `test` — Test harness + validation (E2E, unit, fixtures)
- `governance` — Approval gates, audit trails

---

## Reading the Matrix

**Row W.1:** Can execute 4-wide, depends on nothing → starts immediately.

**Row W.2:** Can execute 4-wide internally; depends on W.1 → waits for W.1, then starts.

**Row W.3:** Must be sequential; depends on W.2 → waits for W.2 (which itself waits for W.1).

**Row W.4:** 2-wide but blocks on W.1 + W.3 → waits for both, then 2 instances in parallel.

---

## Example: Phase 4 (Governance + Canary)

| Wave | Spec | Category | Depends On | Parallelism Tag | Notes |
|---|---|---|---|---|---|
| W.1 | ProposalValidator | core | None | `no-block` | Can start immediately; sets validation rules |
| W.2 | GovernanceEngine | core | None | `no-block` | Independent; defines approval logic |
| W.3 | CanaryEngine | core | W.1, W.2 | `blocks-on: W.1, W.2` | Needs validator rules + approval output |
| W.4 | PromotionEngine | core | W.3 | `blocks-on: W.3` | Depends on canary decision |
| W.5 | E2E Test Harness | test | W.1–W.4 | `blocks-on: W.1, W.2, W.3, W.4` | Tests all specs after all are complete |

**Parallelization plan:**
- **Phase 1 (Week 1):** W.1 + W.2 run 4-wide (independent prep)
- **Phase 2 (Week 2):** W.3 waits for W.1+W.2, then runs while W.4 queues
- **Phase 3 (Week 3):** W.4 runs after W.3; W.5 runs last (integration)
- **Critical path:** W.1 + W.2 → W.3 → W.4 → W.5 (sequential for critical items)

---

## Governance Checks (ijfw-verify enforces these)

1. ✅ **No cycles:** Dependency graph must be a DAG (no circular blocks-on)
2. ✅ **Parallelism honest:** A spec tagged `4-wide` cannot depend on other active specs in same iteration
3. ✅ **Coverage:** Every wave must have an explicit parallelism tag
4. ✅ **Testability:** Test wave (if present) must block-on all core/integration waves

---

## Anti-Patterns (ijfw-verify flags these)

- ❌ **Ghost dependency:** Spec A blocks-on B, but B not listed in matrix → ERROR
- ❌ **Width mismatch:** Spec tagged `4-wide` but has sequential dependency → FLAG (may indicate underutilized resource)
- ❌ **Hidden coupling:** Two specs both tagged `no-block` but share config file → WARNING (consider explicit dependency)
- ❌ **Missing test:** No test wave blocking on core waves → WARNING

---

## Example YAML Encoding (optional, for automation)

```yaml
parallelism_matrix:
  version: "1.0"
  waves:
    - id: W.1
      spec: ProposalValidator
      depends_on: []
      tag: no-block
      width: 1
      category: core
      
    - id: W.2
      spec: GovernanceEngine
      depends_on: []
      tag: no-block
      width: 1
      category: core
      
    - id: W.3
      spec: CanaryEngine
      depends_on: [W.1, W.2]
      tag: blocks-on
      width: 1
      category: core
      
    - id: W.4
      spec: E2E Harness
      depends_on: [W.1, W.2, W.3]
      tag: blocks-on
      width: 4
      category: test

  rules:
    - no_cycles: true
    - all_deps_declared: true
    - test_wave_final: true
```

