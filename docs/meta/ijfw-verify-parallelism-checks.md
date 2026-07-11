# ijfw-verify: Parallelism Matrix Checks

**Scope:** 5 automated checks on Parallelism Matrix in phase charters + ijfw-plan output.

**Trigger:** `/ijfw-verify [charter-or-plan-file]`

**Verdict:** PASS, FLAG, or ERROR

---

## Check 1: No Cycles (DAG)

**Rule:** Dependency graph must be acyclic.

**Pseudocode:**
```
topo_sort(dependency_graph)
  if fails → ERROR "Cycle detected"
```

**Failure example:**
```
W.1 blocks-on W.2
W.2 blocks-on W.3
W.3 blocks-on W.1  ← CYCLE
```

**Output:**
```
ijfw-verify: ERROR
  Cycle detected: W.1 → W.2 → W.3 → W.1
  Fix: Break dependency; verify charter execution order
```

**Severity:** ERROR (blocking)

---

## Check 2: All Dependencies Declared

**Rule:** If wave description mentions "requires W.X", matrix must show `blocks-on: W.X`.

**Scanner:** Parse wave specs for keywords:
- "requires output from"
- "waits for"
- "depends on"
- "input from W.X"
- "after [wave] completes"

**Pseudocode:**
```
for each wave w in matrix:
  for each keyword k in [w.spec, w.notes]:
    if k mentions wave X:
      if X not in w.depends_on:
        WARN "Ghost dependency: " + w.id + " mentions " + X
```

**Failure example:**
```
W.2 spec: "CanaryEngine reads validator output from W.1"
Matrix: W.2 depends_on = []  ← MISSING
```

**Output:**
```
ijfw-verify: WARN (auto-fixable)
  Ghost dependency found: W.2 mentions W.1 but shows no blocks-on
  Suggestion: Add `blocks-on: W.1` to W.2 entry
  Action: Fix charter or acknowledge
```

**Severity:** WARN (fixable, may require review)

---

## Check 3: Width Honesty

**Rule:** Wave tagged `4-wide` cannot have unresolved serial dependencies during same execution phase.

**Definition:**
- `4-wide` = can run 4 instances in parallel
- `blocks-on: W.X` = must wait, but CAN run 4-wide internally
- `4-wide (blocked by W.1)` = hybrid (4-wide after W.1)

**Pseudocode:**
```
for each wave w tagged "4-wide":
  if w.depends_on.size() > 0:
    for each dep d in w.depends_on:
      if d also tagged "4-wide":
        FLAG "Width mismatch: " + w.id + " vs " + d.id
```

**Failure example:**
```
W.1 tag: "4-wide"
W.2 tag: "4-wide"
W.2 depends_on: [W.1]  ← MISMATCH
```

**Diagnosis:** W.2 cannot run 4-wide in parallel if it waits for W.1.

**Output:**
```
ijfw-verify: FLAG
  Width mismatch: W.2 tagged "4-wide" but depends on W.1
  Options:
    1. Change W.2 to "blocks-on: W.1, 4-wide" (parallel after W.1)
    2. Change W.2 to "sequential" (single-threaded)
    3. Re-examine if W.2 actually needs W.1 output
  Action: Review + fix tag
```

**Severity:** FLAG (indicates resource underutilization; review needed)

---

## Check 4: Test Wave Blocks All Cores

**Rule:** If test wave exists, it must `blocks-on` all core/integration waves.

**Test wave detection:**
- `category == "test"` OR
- Spec name matches: test, harness, validation, e2e, integration

**Pseudocode:**
```
test_waves = [w for w in matrix if w.category == "test"]
core_waves = [w for w in matrix if w.category in [core, integration]]

for each test_wave t in test_waves:
  for each core_wave c in core_waves:
    if c.id not in t.depends_on:
      WARN "Test wave doesn't block on " + c.id
```

**Failure example:**
```
W.5: E2E Harness (test)
  depends_on: [W.1, W.3]
  
Missing: W.2, W.4  ← INCOMPLETE
```

**Output:**
```
ijfw-verify: WARN
  Test wave incomplete: E2E Harness blocks W.1, W.3 but not W.2, W.4
  Risk: Untested specs (W.2, W.4) may ship with bugs
  Fix: Add missing core waves to test's `depends_on`
```

**Severity:** WARN (quality risk; often auto-fixable)

---

## Check 5: Deadline Feasibility

**Rule:** Critical path duration must not exceed remaining days to deadline.

**Formula:**
```
critical_path_days = sum(wave.duration for wave in topo_sort(dependencies))
days_remaining = (deadline - today).days

if critical_path_days > days_remaining:
  FLAG "Critical path exceeds deadline"
```

**Failure example:**
```
Phase deadline: 2026-07-15
Today: 2026-07-11
Days remaining: 4

Critical path:
  W.1 (ProposalValidator): 2d
  W.3 (CanaryEngine): 3d  ← Depends on W.1+W.2
  W.4 (PromotionEngine): 2d  ← Depends on W.3
  Total: 7 days (EXCEEDS 4 available)
```

**Output:**
```
ijfw-verify: FLAG (high risk)
  Critical path exceeds deadline
  Path: W.1 (2d) → W.3 (3d) → W.4 (2d) = 7 days
  Available: 4 days (deadline 2026-07-15)
  Shortfall: 3 days
  
  Options:
    1. Extend deadline to 2026-07-14
    2. Parallelize: Move W.2 to run with W.1 (save 1–2d)
    3. Reduce scope: Drop W.4 from this phase
    4. Accept risk: Tier 1 signs off on schedule miss
```

**Severity:** FLAG (schedule risk; requires Tier 1 escalation)

---

## Verification Report Output

`ijfw-verify` outputs a summary table:

```
ijfw-verify: Parallelism Matrix Validation Report

Phase: 4
Charter: phase-4-governance-charter.md
Matrix version: 1.0

Checks:
┌─────────────────────────────────────┬────────┬─────────────────┐
│ Check                               │ Result │ Notes           │
├─────────────────────────────────────┼────────┼─────────────────┤
│ 1. No cycles (DAG)                  │ PASS   │ 5 waves, linear │
│ 2. All dependencies declared        │ PASS   │ 0 ghost deps    │
│ 3. Width honesty (4-wide)           │ FLAG   │ W.2 tag review  │
│ 4. Test blocks all cores            │ PASS   │ E2E→W.1–W.4     │
│ 5. Critical path vs deadline        │ FLAG   │ 7d vs 4d avail  │
└─────────────────────────────────────┴────────┴─────────────────┘

Overall verdict: CONDITIONAL
  2 PASSes, 2 FLAGs, 0 ERRORs
  
Actions:
  - Review Check 3 (width tag) → confirm or fix W.2
  - Review Check 5 (deadline) → escalate to Tier 1
  
Dispatch status: Ready for Tier 1 with FLAGs noted
```

---

## Exit Codes

| Code | Condition | Action |
|---|---|---|
| 0 | PASS (all checks OK) | Proceed to dispatch |
| 1 | ERROR (cycle detected) | Fix + re-verify (blocks dispatch) |
| 2 | FLAG + WARN (review needed) | Escalate to Tier 1; document risk |

---

## Configuration: Strictness Levels

Optional `.claude/settings.json`:

```json
{
  "ijfw_verify": {
    "parallelism_checks": {
      "no_cycles": "ERROR",
      "all_deps_declared": "WARN",
      "width_honesty": "FLAG",
      "test_wave_blocks": "WARN",
      "critical_path": "FLAG"
    },
    "auto_fix": {
      "implicit_deps": false,
      "remove_cycles": false
    },
    "output": {
      "format": "table",
      "verbose": false
    }
  }
}
```

- Change severity level (ERROR → WARN, FLAG → PASS, etc.)
- Enable auto-fix if desired (requires review before commit)
- Control output verbosity

---

## Integration: When ijfw-verify Runs

1. **Manually:** `ijfw-verify [charter-file]` (on demand)
2. **After ijfw-plan:** Runs checks on matrix section (before output)
3. **Before dispatch:** Gating check (Tier 1 sees verdict)
4. **On commit (optional):** Git hook warns if charter matrix broken

---

**Reference:** [Parallelism Matrix System](PARALLELISM_MATRIX_SYSTEM.md)

