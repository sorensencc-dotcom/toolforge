---
name: phase-1-pr-template
description: Phase 1 PR validation template enforcing file contract zero-drift
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7868a049-3774-41db-ade2-dd9374785bc7
---

# **PHASE 1 PR TEMPLATE (STRICT VALIDATION)**

Use this template for every Phase 1 PR. Non-negotiable.

---

## **PR Title Format**

```
Phase 1: [Component] – [Implementation Step]
```

Examples:
- `Phase 1: Ledger Substrate – EventStream + BackgroundWriter`
- `Phase 1: MAAL Core – TaskFingerprinting`
- `Phase 1: BridgeOrchestrator – MAAL Integration`

---

## **PR Description Template**

```markdown
## Phase 1 Implementation: [Component Name]

### Step Number
Step [N] of 9

### Files Modified
- [ ] List exact file paths here

### Files Created
- [ ] `cic-os/src/core/maal/TaskFingerprinting.ts`
- [ ] (etc — only if in this PR)

### No Extra Files?
- [ ] Zero helper classes
- [ ] Zero utils directories
- [ ] Zero factories
- [ ] Zero new directories beyond contract
- [ ] Zero SPL code
- [ ] Zero training code

### Ledger Schemas (if Step 1)
- [ ] `postgres/ledgers/routing_history.sql` created
- [ ] `postgres/ledgers/drift_ledger.sql` created
- [ ] `postgres/ledgers/model_performance_ledger.sql` created
- [ ] `postgres/ledgers/cost_ledger.sql` created

### Acceptance Criteria
- [ ] All files match Phase 1 File Contract exactly
- [ ] No additional files exist beyond contract
- [ ] Interfaces match contract signatures exactly
- [ ] No implementation logic (STEP 0) OR full implementation (STEP 1–9)
- [ ] EventStream + BackgroundWriter contain ledger logic only (no state)
- [ ] BridgeOrchestrator integration only calls MAALRouter (no new logic)
- [ ] All exports match contract exports exactly
- [ ] No drift from v0.1.0-maal-foundation baseline

### Integration Points
- [ ] If modifying BridgeOrchestrator: MAALRouter call chain visible
- [ ] If implementing ledger: EventStream drains to Postgres
- [ ] If implementing MAAL: fingerprint → regime → constraints → ledger
- [ ] Fallback graph validation does not introduce new branching

### Testing
- [ ] Unit tests for this step pass
- [ ] Smoke test suite (Step 8) runs clean
- [ ] No regressions in existing tests

### Code Review Gate
- [ ] Diff reviewed against Phase 1 File Contract
- [ ] No undeclared files
- [ ] No scope creep beyond Step [N]
```

---

## **Code Review Checklist for Reviewers**

### **File Contract Validation (HARD GATE)**

Before approving, verify:

```
File Contract Check
- [ ] All new files declared in PR match Phase 1 File Contract?
- [ ] Any extra files present in diff? (VETO if yes)
- [ ] Any new directories created beyond contract? (VETO if yes)
- [ ] All exported interfaces match contract signatures exactly?
- [ ] All type names match contract exactly (case-sensitive)?
```

### **Implementation Logic Gate (STEP-DEPENDENT)**

If STEP 0 (scaffolding only):
```
- [ ] No logic in interfaces
- [ ] No imports except type imports
- [ ] No function bodies
- [ ] No state initialization
```

If STEP 1–9 (implementation):
```
- [ ] Logic is scoped to this step only
- [ ] No SPL code appears
- [ ] No training code appears
- [ ] Ledger writes are async only
- [ ] BridgeOrchestrator calls MAALRouter (no new MAAL logic)
```

### **Ledger Substrate Validation (Steps 1–3)**

```
EventStream Ring Buffer
- [ ] Fixed size (parameterized)
- [ ] Non-blocking push
- [ ] drain(batchSize) returns array
- [ ] size() returns count

BackgroundWriter
- [ ] Timer-based flush
- [ ] Writes to Postgres
- [ ] Handles backpressure (high-water mark)
- [ ] Logs flush events

SQL Schemas
- [ ] routing_history table created
- [ ] drift_ledger table created
- [ ] model_performance_ledger table created
- [ ] cost_ledger table created
- [ ] All columns match contract exactly
```

### **MAAL Core Validation (Steps 2–6)**

```
TaskFingerprinting
- [ ] compute(input) returns TaskFingerprint
- [ ] taskClass is enum-like (string)
- [ ] complexityBucket is 0–5
- [ ] modality is "text" | "code" | "image+code"
- [ ] schemaSignature is deterministic hash
- [ ] tokenBucket is 0–6

RoutingRegimeSelector
- [ ] select(input) returns "local_only" | "hybrid" | "remote_allowed"
- [ ] Logic is deterministic (same input → same regime)
- [ ] No randomness

ConstraintEngine
- [ ] derive(input) returns RoutingConstraints
- [ ] maxCost is set per regime
- [ ] maxLatencyMs is set per regime
- [ ] allowedModels list is populated
- [ ] disallowedModels list is populated (locality enforcement)

FallbackGraphValidator
- [ ] validate(edges) returns boolean
- [ ] Detects cycles
- [ ] Enforces max depth
- [ ] Allows only known failure codes
```

### **BridgeOrchestrator Integration (Step 7)**

```
- [ ] MAALRouter is injected as dependency
- [ ] route() called before ModelRouter
- [ ] Constraints passed to ModelRouter
- [ ] Ledger events emitted via EventStream
- [ ] No new routing logic added to BridgeOrchestrator
- [ ] No side effects beyond ledger emission
```

### **Smoke Test Coverage (Step 8)**

```
- [ ] Fingerprinting determinism test
- [ ] Regime selection test (all buckets)
- [ ] Constraint derivation test (all regimes)
- [ ] Ledger emission test
- [ ] BackgroundWriter flush test
- [ ] BridgeOrchestrator integration test
- [ ] No SPL-specific tests (Phase 2)
```

### **Freeze Readiness (Step 9)**

```
Before tagging v0.1.0-maal-foundation:
- [ ] All 8 steps implemented
- [ ] All tests pass
- [ ] Zero known drift
- [ ] Zero extra files
- [ ] Zero undeclared changes
```

---

## **VETO Conditions (Auto-Reject)**

PR is automatically rejected if:

1. **Extra files present** not in Phase 1 File Contract
2. **Extra directories** created beyond `cic-os/src/core/` or `cic-ingestion/src/orchestrator/`
3. **SPL code** appears (even comments referencing SPL)
4. **Training code** appears (even stubs)
5. **Helper classes** added (factories, utils, mappers)
6. **Signature mismatch** in exported interfaces
7. **BridgeOrchestrator** modified beyond MAAL router call
8. **New branching logic** in MAAL (beyond regime/constraint/fallback)
9. **Undeclared imports** from external packages
10. **Circular dependencies** within MAAL

---

## **Approval Gate**

PR may merge only if:

```
✓ File Contract validation: PASS
✓ Implementation logic validation: PASS (step-dependent)
✓ Ledger/MAAL/Integration validation: PASS
✓ Test coverage: ≥90%
✓ Zero veto conditions triggered
✓ At least 1 architecture reviewer approval
```

---

## **Post-Merge Verification**

After merge:

```
1. Verify file count matches contract
2. Run full Phase 1 smoke test
3. Verify ledger writes to Postgres
4. Verify BridgeOrchestrator + MAALRouter integration
5. Log merge event to Phase 1 completion board
```

---

## **Example PR (Step 1: Ledger Substrate)**

Title:
```
Phase 1: Ledger Substrate – EventStream + BackgroundWriter + SQL Schemas
```

Files created:
```
cic-os/src/core/ledger/EventStream.ts
cic-os/src/core/ledger/BackgroundWriter.ts
postgres/ledgers/routing_history.sql
postgres/ledgers/drift_ledger.sql
postgres/ledgers/model_performance_ledger.sql
postgres/ledgers/cost_ledger.sql
```

Files modified:
```
cic-os/src/core/ledger/index.ts (exports)
```

Files NOT created:
```
(none — strict)
```

Acceptance criteria checklist: All items checked.

---

End Phase 1 PR Template.
