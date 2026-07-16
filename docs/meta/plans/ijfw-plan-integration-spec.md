# ijfw-plan Integration: Parallelism Matrix Output Section

**Scope:** Add "Parallelism Matrix" section to ijfw-plan output format, inserted after Architecture + Prerequisites, before Wave Assignments.

---

## New Output Section: Parallelism Matrix

**Triggered by:** `/ijfw-plan [phase description]`

**Format:** Markdown table (for readability) + optional YAML block (for verification tools).

### Location in ijfw-plan Output

```
# [Phase X] Implementation Plan

## 1. Overview
...

## 2. Architecture
...

## 3. Prerequisites
...

## 4. PARALLELISM MATRIX  ← NEW SECTION
   [table + dependency analysis]

## 5. Wave Assignments
...

## 6. Success Criteria
...
```

---

## Section Content Template

```markdown
## 4. Parallelism Matrix

**Critical path (longest dependency chain):**
- [Wave names in serial order]
- Estimated duration: X days

**Parallelizable groups (can execute in parallel):**
- Group A: [Wave names] (no inter-dependencies)
- Group B: [Wave names] (all depend on Group A output)

**Resource constraints:**
- Subagents available: 4-wide (one per subagent type × max 4 simultaneous)
- Shared resources: [list any bottlenecks, e.g., database access, credentials]

### Matrix

| Wave | Spec | Depends On | Tag | Width | Note |
|---|---|---|---|---|---|
| W.1 | {name} | None | `no-block` | 4-wide | Entry point |
| W.2 | {name} | W.1 | `blocks-on: W.1` | 4-wide | After W.1 complete |
| W.3 | {name} | W.2 | `blocks-on: W.2` | sequential | Single-threaded |
| W.4 | {name} | W.1, W.2 | `blocks-on: W.1, W.2` | 4-wide | Parallel merge point |

**Verification:**
- [x] No cycles detected
- [x] All dependencies declared
- [x] Width tags honest (no over-parallelism)
- [x] Test wave (if present) blocks on all core waves
```

---

## ijfw-plan Agent Changes

The `ijfw-plan` agent will:

1. **After drafting wave assignments**, derive the Parallelism Matrix automatically:
   - Scan each wave spec for explicit dependencies (e.g., "blocks-on: W.X")
   - Compute critical path (longest chain of sequential deps)
   - Group waves by depth in dependency DAG
   - Auto-detect width constraints (subagent budget: 4-wide default)

2. **Inject matrix into output** after Architecture section

3. **Generate verification YAML** (passed to ijfw-verify on handoff)

4. **Flag anti-patterns** during planning:
   - If wave declared `4-wide` but has serial dependencies → FLAG
   - If two waves share input but no explicit dependency → WARN
   - If critical path > 21 days (assuming 5-day default phase duration) → FLAG

---

## YAML Output Format (for ijfw-verify)

After the markdown matrix, include a YAML block for programmatic verification:

```yaml
---
metadata:
  phase: 4
  version: "1.0"
  
parallelism_matrix:
  critical_path_waves: [W.1, W.2, W.3, W.4]
  critical_path_days: 15
  
  waves:
    - id: W.1
      spec_name: ProposalValidator
      depends_on: []
      tag: no-block
      width: 1
      category: core
      
    - id: W.2
      spec_name: GovernanceEngine
      depends_on: []
      tag: no-block
      width: 1
      category: core
      
    - id: W.3
      spec_name: CanaryEngine
      depends_on: [W.1, W.2]
      tag: blocks-on
      width: 1
      category: core
      
    - id: W.4
      spec_name: PromotionEngine
      depends_on: [W.3]
      tag: blocks-on
      width: 1
      category: core
      
    - id: W.5
      spec_name: E2E Harness
      depends_on: [W.1, W.2, W.3, W.4]
      tag: blocks-on
      width: 4
      category: test
      
  parallelizable_groups:
    - group_id: A
      waves: [W.1, W.2]
      waves_can_run_parallel: true
      
    - group_id: B
      waves: [W.3]
      depends_on_group: A
      
    - group_id: C
      waves: [W.4]
      depends_on_group: B
      
    - group_id: D
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

---
```

---

## Acceptance Criteria for ijfw-plan Output

✅ Parallelism Matrix section present  
✅ All waves have explicit parallelism tag (`no-block`, `blocks-on:`, `sequential`, or `4-wide`)  
✅ Dependencies accurately reflect wave specs  
✅ Critical path identified + duration estimated  
✅ No cycles detected (verified by ijfw-verify)  
✅ YAML block valid + parseable  

