# Retrofit Example: Phase 3 Cowork Gateway

**Objective:** Step-by-step walkthrough of adding Parallelism Matrix to existing Phase 3.C charter.

**Source:** `docs/gateway/phase-3c-kickoff-charter.md`

---

## Step 1: Extract Waves from Charter

From Phase 3.C Execution Plan, identify all phases/waves:

```
Phase 3.C.1: Update CoworkClient (2–4 hours)
Phase 3.C.2: Update gateway.json (30 minutes)
Phase 3.C.3: Test Against Cowork Staging (4–8 hours)
Phase 3.C.4: Promote to Production (1 hour execution + approval)
```

Map to wave format:
- W.1 = 3.C.1
- W.2 = 3.C.2
- W.3 = 3.C.3
- W.4 = 3.C.4

---

## Step 2: Analyze Dependencies

Read each phase description in charter to find blocking relationships:

**W.1 (Update CoworkClient):**
- "Read Cowork API spec"
- "Update CoworkClient.ts endpoint paths"
- No dependencies mentioned
- **Dependency: None (entry point)**

**W.2 (Update gateway.json):**
- "Update endpoint paths to match spec"
- "Validate against gateway.json schema"
- No explicit mention, but logically: needs CoworkClient endpoint changes first
- **Dependency: W.1 (implicit in workflow)**

**W.3 (Test Against Cowork Staging):**
- "Obtain staging credentials"
- "Start gateway pointing at staging"
- "Run full integration test suite"
- Implicitly needs W.1 (endpoints) + W.2 (gateway config) to be complete
- **Dependency: W.1, W.2**

**W.4 (Promote to Production):**
- "Run smoke test... Monitor"
- "If clean: Phase 3 COMPLETE"
- Clearly depends on W.3 passing staging
- **Dependency: W.3 (explicit: "must pass staging first")**

**Summary:**
```
W.1 (no deps)
  ↓
W.2 (blocks on W.1)
  ↓
W.3 (blocks on W.1 + W.2)
  ↓
W.4 (blocks on W.3)

Critical path: Serial (W.1 → W.2 → W.3 → W.4)
No parallelization possible (each depends on all prior)
```

---

## Step 3: Assign Categories + Parallelism Tags

| Wave | Spec | Category | Duration | Parallelism | Reasoning |
|---|---|---|---|---|---|
| W.1 | CoworkClient Update | core | 2–4h | `no-block` | Entry point; starts immediately |
| W.2 | gateway.json Update | core | 30m | `sequential` | Needs CoworkClient context; single-threaded task |
| W.3 | Staging Integration Test | integration | 4–8h | `blocks-on: W.1, W.2` | Depends on both; orchestration-heavy |
| W.4 | Production Promotion | integration | 1h | `blocks-on: W.3` | Gate: staging must PASS |

**Parallelism analysis:**
- All waves are serial (no parallelism opportunity)
- Each feeds into the next
- Tags accurately reflect dependencies
- W.1 and W.2 could theoretically be `2-wide` or `4-wide`, but they're small/sequential in practice → keep `no-block` and `sequential` for clarity

---

## Step 4: Insert Into Charter

**Location:** After section "5. Execution Plan" header, before "Phase 3.C.1" subsection.

**Before:**
```markdown
## 5. Execution Plan

Once all prerequisites are met, execute in order:

### Phase 3.C.1: Update CoworkClient
```

**After (insert matrix):**
```markdown
## 5. Execution Plan

### Parallelism Matrix

**Critical path:** W.1 → W.2 → W.3 → W.4 (fully serial)  
**Total duration:** ~11 hours (2–4h + 0.5h + 4–8h + 1h)  
**Deadline:** 2026-07-12 (Phase 3 entry) — ample buffer  
**Parallelizable:** None (fully serial chain)

| Wave | Spec | Category | Depends On | Tag | Duration | Notes |
|---|---|---|---|---|---|---|
| W.1 | CoworkClient Update | core | None | `no-block` | 2–4h | Endpoint binding + auth |
| W.2 | gateway.json Update | core | W.1 | `sequential` | 30m | Path + URL updates |
| W.3 | Staging Test | integration | W.1, W.2 | `blocks-on: W.1, W.2` | 4–8h | E2E: all 6 workflows |
| W.4 | Production Promotion | integration | W.3 | `blocks-on: W.3` | 1h | Smoke test + 24h gate |

**Verification:**
- [x] No cycles (W.1 → W.2 → W.3 → W.4; linear chain)
- [x] All dependencies declared (W.2, W.3, W.4 all have explicit blocks-on)
- [x] Width honest (no false parallelism)
- [x] Integration test (W.3 tests all cores)
- [x] Deadline feasible (11h << 2026-07-12 + buffer)

### Phase 3.C.1: Update CoworkClient
[existing content continues...]
```

---

## Step 5: Run ijfw-verify

```bash
ijfw-verify docs/gateway/phase-3c-kickoff-charter.md
```

**Expected output:**
```
ijfw-verify: Parallelism Matrix Validation Report

Phase: 3.C
Charter: phase-3c-kickoff-charter.md
Matrix version: 1.0

Checks:
  1. No cycles (DAG)            │ PASS   │ Linear chain
  2. All deps declared          │ PASS   │ 0 ghost dependencies
  3. Width honesty              │ PASS   │ All serial (realistic)
  4. Test blocks all cores      │ PASS   │ W.3 tests W.1–W.2
  5. Critical path vs deadline  │ PASS   │ 11h << deadline

Overall verdict: PASS
  Status: Ready for Tier 1 dispatch
  No FLAGs or ERRORs
```

---

## Step 6: Update Decision Log & Commit

**Add to charter's Decision Log section:**

```markdown
### Decision Log

**2026-07-11 — Parallelism Matrix Retrofit**
- Action: Added Parallelism Matrix section per governance rule
- Waves: W.1 (CoworkClient), W.2 (gateway.json), W.3 (Staging), W.4 (Production)
- Dependencies: Fully serial chain (no parallelization possible)
- ijfw-verify: PASS (all 5 checks)
- Critical path: 11h < 2026-07-12 deadline + buffer
- Changes: Documentation only; no functional edits
- No re-approval needed (retrofit of existing charter)
- Committed by: Chris Sorensen | 2026-07-11
```

**Git commit:**
```bash
git add docs/gateway/phase-3c-kickoff-charter.md
git commit -m "docs: retrofit parallelism matrix for Phase 3.C

- Added Parallelism Matrix section after Architecture
- All 4 waves (W.1–W.4) tagged with dependencies
- Critical path: serial chain (11h) << deadline 2026-07-12
- ijfw-verify: PASS (no cycles, all deps declared, deadline feasible)
- Documentation retrofit only; no functional changes"
```

---

## Result: Before vs. After

### BEFORE
```markdown
## 5. Execution Plan

Once all prerequisites are met, execute in order:

### Phase 3.C.1: Update CoworkClient
...

### Phase 3.C.2: Update gateway.json
...

### Phase 3.C.3: Test Against Cowork Staging
...

### Phase 3.C.4: Promote to Production
...
```

### AFTER
```markdown
## 5. Execution Plan

### Parallelism Matrix

[table + verification]

### Phase 3.C.1: Update CoworkClient
...

### Phase 3.C.2: Update gateway.json
...

### Phase 3.C.3: Test Against Cowork Staging
...

### Phase 3.C.4: Promote to Production
...
```

**Changes:**
- +20 lines (matrix table + verification)
- +0 functional lines (pure documentation)
- Deadline risk: explicit + automated-checkable
- Dependency clarity: now visible at a glance

---

## Retrofit Checklist (for all Phases 2–6)

Copy this for each phase:

- [ ] Phase 2
  - [ ] Extract waves from Execution Plan
  - [ ] Analyze dependencies (read charter)
  - [ ] Assign categories + parallelism tags
  - [ ] Insert matrix into charter (after Architecture)
  - [ ] Run ijfw-verify → confirm PASS
  - [ ] Update Decision Log + commit

- [ ] Phase 3
  - [ ] Extract waves
  - [ ] Analyze dependencies
  - [ ] Assign tags
  - [ ] Insert matrix
  - [ ] ijfw-verify PASS
  - [ ] Commit

- [ ] Phase 4, 5, 6
  - [ ] (same steps)

**Estimated time:** 15–30 min per phase; ~2 hours total

---

## Common Anti-Patterns (avoided in this retrofit)

❌ **Ghost dependency not caught:**
```markdown
W.2 Spec: "Validate against gateway.json schema"
W.2 Depends_on: []  ← WRONG (should be W.1)
```
→ Fixed: W.2 now shows `blocks-on: W.1`

❌ **Width mismatch:**
```markdown
W.3 tag: "4-wide"
W.3 depends_on: [W.1, W.2]  ← WRONG (can't be parallel if waiting)
```
→ Fixed: W.3 shows `blocks-on: W.1, W.2` (not 4-wide)

❌ **Missed deadline:**
```markdown
Duration: 11h
Deadline: 2026-07-12 (today is 2026-07-11, so only 1h buffer)  ← WRONG
```
→ Not a problem here (11h << 24h available); if it were, ijfw-verify would FLAG it

---

## Summary

✅ Existing Phase 3.C charter retrofitted  
✅ Parallelism Matrix added (documentation)  
✅ All 4 waves listed + dependencies explicit  
✅ ijfw-verify validates: PASS  
✅ No functional changes; governance compliance  
✅ Ready for Tier 1 (no re-approval needed)  

Repeat for Phases 2, 4, 5, 6 by 2026-07-12.

---

**Reference:** [Parallelism Matrix System(parallelism-matrix-system.md)

