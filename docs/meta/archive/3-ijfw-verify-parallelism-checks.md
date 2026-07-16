# ijfw-verify: Parallelism Matrix Automated Checks

**Scope:** Add 5 automated checks to `ijfw-verify` that flag mismatches between declared parallelism + actual dependencies.

**Trigger:** Runs after phase charter + ijfw-plan output are locked, before Tier 1 dispatch.

---

## Check 1: No Cycles (DAG Validation)

**Rule:** Parallelism matrix dependency graph must be acyclic.

**Pseudocode:**
```
for each wave w in matrix:
  if topological_sort(dependencies) fails:
    ERROR "Cycle detected: " + cycle_path
```

**Failure example:**
```
W.1 blocks-on W.2
W.2 blocks-on W.3
W.3 blocks-on W.1  ← CYCLE
```

**Output:**
```
ijfw-verify: FAIL
  Error: Parallelism matrix has cycle
  Path: W.1 → W.2 → W.3 → W.1
  Fix: Break dependency; check charter for logical vs. implementation order
```

---

## Check 2: All Dependencies Declared

**Rule:** If wave A's spec mentions dependency on wave B output, wave A must declare `blocks-on: B` in matrix.

**Scanner:** Parse wave descriptions for keywords:
- "requires output from"
- "waits for"
- "depends on"
- "after [wave] completes"
- "input from W.X"

**Pseudocode:**
```
for each wave w in matrix:
  for each keyword in [w.spec, w.notes]:
    if keyword mentions wave X:
      if X not in w.depends_on:
        WARN "Implicit dependency: " + w.id + " → " + X
```

**Failure example:**
```
Wave W.2 spec: "CanaryEngine reads validator output from W.1"
Matrix shows: W.2 depends_on = []  ← MISSING
```

**Output:**
```
ijfw-verify: WARN (auto-fixable)
  Ghost dependency: W.2 mentions W.1 but matrix shows no blocks-on
  Suggestion: Add `blocks-on: W.1` to W.2 entry
  Action: Auto-add or require charter revision?
```

---

## Check 3: Width Honesty (4-wide Constraint)

**Rule:** Wave tagged `4-wide` cannot have unresolved serial dependencies during same execution phase.

**Interpretation:**
- `4-wide` = can run 4 instances in parallel with other `4-wide` specs (no inter-dependencies)
- `blocks-on: W.X` = cannot run until W.X completes, but can still run 4-wide internally
- `4-wide (blocked by W.1)` = hybrid (runs 4-wide after W.1)

**Pseudocode:**
```
parallelizable_set = {w | w.tag == "4-wide" and w.depends_on.size() == 0}
for each wave w in parallelizable_set:
  for each other wave x in parallelizable_set:
    if w.depends_on.contains(x) or x.depends_on.contains(w):
      FLAG "Width mismatch: " + w.id + " tagged 4-wide but depends on " + x.id
```

**Failure example:**
```
W.2 tag: "4-wide"
W.2 depends_on: W.1
W.1 is also tagged "4-wide"
```

**Diagnosis:** W.2 is probably mis-tagged; should be `blocks-on: W.1, 4-wide` or `sequential`.

**Output:**
```
ijfw-verify: FLAG
  Width mismatch: W.2 tagged "4-wide" but depends on W.1 (also 4-wide)
  Diagnosis: W.2 cannot execute in parallel if it waits for W.1
  Options:
    1. Change W.2 tag to "blocks-on: W.1, 4-wide" (can parallelize after W.1 done)
    2. Change W.2 tag to "sequential" (runs one at a time)
    3. Re-examine if W.2 actually needs W.1 output
```

---

## Check 4: Test Wave Blocks on All Core/Integration

**Rule:** If test wave exists, it must `blocks-on` all non-test waves (prevents premature testing).

**Test wave identification:**
- Category == "test" OR
- Spec name contains "test", "harness", "validation", "e2e", "integration"

**Pseudocode:**
```
test_waves = [w for w in matrix if w.category == "test"]
non_test_waves = [w for w in matrix if w.category != "test"]

for each test_wave t in test_waves:
  for each non_test n in non_test_waves:
    if n.id not in t.depends_on:
      WARN "Test wave " + t.id + " does not block on " + n.id
```

**Failure example:**
```
W.5: E2E Harness
  category: test
  depends_on: [W.1, W.3]  ← Missing W.2, W.4
  
Non-test waves: W.1, W.2, W.3, W.4
```

**Output:**
```
ijfw-verify: WARN
  Test wave incomplete: E2E Harness blocks on W.1, W.3 but not W.2, W.4
  Suggestion: Add missing waves to `depends_on` so all core logic is tested
  Risk: Untested specs (W.2, W.4) may ship with bugs
```

---

## Check 5: Realistic Critical Path

**Rule:** Estimated critical path duration must be consistent with phase deadline.

**Formula:**
```
critical_path_waves = topological_sort(matrix)
critical_path_duration = sum(wave.estimated_days for wave in critical_path_waves)

if critical_path_duration > (phase_deadline - today):
  FLAG "Critical path exceeds deadline"
```

**Pseudocode:**
```
phase_deadline = charter.deadline  # e.g., 2026-07-15
days_remaining = (phase_deadline - today).days
critical_path_days = sum(w.estimated_days for w in critical_path_waves)

if critical_path_days > days_remaining:
  FLAG "Critical path (" + critical_path_days + " days) exceeds remaining time (" + days_remaining + " days)"
```

**Failure example:**
```
Phase deadline: 2026-07-15
Today: 2026-07-11
Days remaining: 4

Critical path:
  W.1 (ProposalValidator): 2 days
  W.3 (CanaryEngine): 3 days  ← Depends on W.1, W.2
  W.4 (PromotionEngine): 2 days  ← Depends on W.3
  Total: 7 days (exceeds 4 remaining)
```

**Output:**
```
ijfw-verify: FLAG (high risk)
  Critical path exceeds deadline
  Path: W.1 (2d) → W.3 (3d) → W.4 (2d) = 7 days
  Deadline: 2026-07-15 (4 days from 2026-07-11)
  Shortfall: 3 days
  
  Recommendations:
    1. Extend deadline to 2026-07-14 (not recommended)
    2. Parallelize: Move W.2 to run with W.1 (save 1–2 days)
    3. Scope reduction: Drop W.4 from this phase (move to Phase 5)
    4. Accept risk: Proceed if Tier 1 signs off on schedule miss
```

---

## Verification Checklist (Output by ijfw-verify)

ijfw-verify produces a summary table:

```
ijfw-verify: Parallelism Matrix Validation Report

Phase: 4 (Governance + Canary)
Charter version: 1.0
Matrix version: 1.0

Checks:
┌─────────────────────────────────────┬────────┬──────────────────┐
│ Check                               │ Result │ Notes            │
├─────────────────────────────────────┼────────┼──────────────────┤
│ 1. No cycles (DAG validation)       │ PASS   │ 5 waves, no loops│
│ 2. All deps declared                │ PASS   │ 0 ghost deps     │
│ 3. Width honesty (4-wide)           │ FLAG   │ W.2: see details │
│ 4. Test wave blocks all cores       │ PASS   │ E2E → W.1–W.4    │
│ 5. Critical path vs deadline        │ FLAG   │ 7d vs 4d avail   │
└─────────────────────────────────────┴────────┴──────────────────┘

Overall verdict: CONDITIONAL
  2 PASSes, 2 FLAGs, 0 ERRORs
  
  Recommended actions:
    - Review Check 3 (W.2 width tag) and confirm or fix
    - Review Check 5 (deadline risk) and escalate to Tier 1 if proceeding
    
  Dispatch status: Ready for Tier 1 review (with noted FLAGs)
```

---

## Integration: Where ijfw-verify Runs

1. **After ijfw-plan output** → checks matrix structure
2. **Before charter dispatch to Tier 1** → confirms no blockers
3. **During phase review** → catches last-minute edits that break matrix
4. **On commit (optional, via git hook)** → warns on charter merge if matrix broken

---

## Configuration: Strictness Levels

Users can configure ijfw-verify strictness:

```
# .claude/settings.json
{
  "ijfw_verify": {
    "parallelism_checks": {
      "no_cycles": "ERROR",           // Fail on cycles
      "all_deps_declared": "WARN",    // Warn on implicit deps (auto-fixable)
      "width_honesty": "FLAG",        // Flag width mismatches
      "test_wave_blocks": "WARN",     // Warn if test incomplete
      "critical_path": "FLAG"         // Flag if exceeds deadline
    },
    "auto_fix": {
      "implicit_deps": false,         // Auto-add missing blocks-on?
      "remove_cycles": false          // Auto-break cycles?
    }
  }
}
```

