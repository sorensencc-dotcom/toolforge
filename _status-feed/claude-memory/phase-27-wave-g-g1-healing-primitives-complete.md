---
name: phase-27-wave-g-g1-healing-primitives-complete
description: Phase 27 Wave G — G.1 Healing Primitives implementation complete — 7 primitives, 20 tests PASS
metadata:
  type: project
  originSessionId: bd3a8b0d-47f8-4f0f-a511-393c978880be
---

# Phase 27 Wave G — G.1 Healing Primitives ✅ COMPLETE

**Date:** 2026-07-08  
**Duration:** Wave G.1 implementation  
**Status:** Ready for integration with Wave G.3 Resume Gate  
**Commit:** 2441e01 (cic-ingestion submodule)

## What Was Built

Seven deterministic, stateless, reversible healing primitives for autonomous drift recovery.

### Primitive Set

1. **heal.shrink_scope** — Reduce plan to single file/module
   - Triggers: KITCHEN_SINK, RUNAWAY_REFACTOR
   - Effect: Extract module from code changes, apply to all plan nodes
   - Example: [src/core/main.ts, src/utils/helper.ts] → expectedScope=[src/core]

2. **heal.tighten_criteria** — Rewrite acceptance criteria with module boundaries
   - Triggers: KITCHEN_SINK (HIGH/CRITICAL) with unrelated files
   - Effect: Reduce maxCorruptionPercent by 20%, increase minSurvivalPercent by 20%, add moduleBoundaries
   - Example: maxCorruptionPercent=50 → 40, minSurvivalPercent=50 → 60

3. **heal.inject_negative_tests** — Auto-add error/edge case tests
   - Triggers: OPTIMISTIC_PATH (HIGH/CRITICAL) with zero negative tests
   - Effect: Generate 5 test stubs (invalid, malformed, timeout, null, boundary)
   - Example: tests.failing=[] → [5 generated], coverage += 20%

4. **heal.enforce_surgical_diff** — Cap file modifications to ≤1
   - Triggers: RUNAWAY_REFACTOR (CRITICAL) with filesModified > 1
   - Effect: Keep primary change, discard rest, lock scope to single file
   - Example: [a.ts, b.ts, c.ts] → keep a.ts only

5. **heal.freeze_architecture** — Block refactors, renames, moves
   - Triggers: RUNAWAY_REFACTOR (CRITICAL) with refactor logs
   - Effect: Set _architectureFrozen=true, block 4 structural change types
   - Rules: no module renames, no directory moves, no interface changes, no dependency reordering

6. **heal.require_abstraction_step** — Force extraction of shared logic
   - Triggers: WRONG_ABSTRACTION (HIGH/CRITICAL) with duplicate blocks
   - Effect: Insert abstraction step at plan[0], set estimatedEffort=4h
   - Example: Duplicated validate() → inject extraction step

7. **heal.require_dependency_justification** — Audit new dependencies
   - Triggers: New imports in code changes
   - Effect: Extract dependency names, add to _dependencyJustification with status=PENDING
   - Example: import lodash, import moment → {lodash: PENDING, moment: PENDING}

## Composition Strategy

Primitives compose sequentially using `HealingPrimitives.compose()`:

```typescript
const results = HealingPrimitives.compose(ctx, [
  'heal.shrink_scope',
  'heal.tighten_criteria',
  'heal.inject_negative_tests',
]);
```

Each primitive receives modified context from previous:
- Shrink scope narrows expectedScope
- Tighten criteria hardened maxCorruption%
- Inject tests add negative test coverage

All primitives are:
- **Deterministic** — no randomness, same input → same output
- **Stateless** — no side effects on external state
- **Reversible** — can be undone by re-running with original inputs
- **Composable** — can chain multiple primitives
- **Aligned with Six Rules** — Verification First, Surgical Change, Drift Halt Reflex

## Instinct Alignment

All 7 primitives enforce Six Rules:
- **Verification First** (heal.inject_negative_tests) — adds failing test stubs upfront
- **Define Done** (heal.tighten_criteria) — locks acceptance criteria
- **Surgical Change** (heal.enforce_surgical_diff) — caps to single file
- **Drift Halt Reflex** (heal.freeze_architecture) — stops cascading changes
- **Dependency Skepticism** (heal.require_dependency_justification) — audits imports

## Deliverables

✅ **HealingPrimitives.ts** (470 lines)
- Static class with 7 methods
- Compose() for sequential application
- Helpers for scope/module/dependency extraction

✅ **HealingPrimitives.test.ts** (370 lines)
- 20 unit test cases
- Categories: individual primitives, composition, instinct alignment, reversibility
- All 20 PASS

✅ **g.healing.primitives.yaml** (200 lines)
- Specification of all 7 primitives
- Trigger conditions + effects
- Composition strategy
- Telemetry fields
- Integration points

✅ **.gitignore** updated
- Track all three Wave G.1 files

## Test Results

```
PASS  src/autonomy/HealingPrimitives.test.ts
  HealingPrimitives
    heal.shrink_scope
      ✓ reduces scope to primary module
      ✓ fails gracefully on empty code changes
    heal.tighten_criteria
      ✓ tightens thresholds for scope creep
      ✓ skips when no unrelated files
    heal.inject_negative_tests
      ✓ injects negative tests when missing
      ✓ skips when negative tests present
    heal.enforce_surgical_diff
      ✓ reduces multiple files to single primary
      ✓ skips when already surgical
    heal.freeze_architecture
      ✓ freezes architecture on runaway refactor
      ✓ skips when no refactor detected
    heal.require_abstraction_step
      ✓ adds abstraction step on duplication
      ✓ skips when no duplication
    heal.require_dependency_justification
      ✓ flags new dependencies for justification
      ✓ skips when no new dependencies
    Composition
      ✓ composes multiple primitives sequentially
      ✓ stops on unsupported primitive
      ✓ all primitives are reversible
    Instinct Alignment
      ✓ all primitives respect Verification First
      ✓ all primitives respect Surgical Change
      ✓ all primitives respect Drift Halt Reflex

Tests:       20 passed, 20 total
```

## Integration Points

Wave G.1 is called from Wave G.3 (Resume Gate):

1. Drift signal detected → type + severity known
2. Select primitives for drift type (KS → shrink, OP → inject, etc.)
3. Call `HealingPrimitives.compose(ctx, primitiveList)`
4. Receive modified plan + criteria
5. Pass to Wave G.3 Resume Gate for approval decision

## Wave G.1 → G.3 Contract

**Input:** HealingContext
- plan: PlanNode[] (original)
- criteria: AcceptanceCriteria (original)
- codeChanges: CodeChange[]
- tests: TestBundle
- driftSignal: DriftSignal

**Output:** HealingPrimitiveResult[]
- primitiveId: string
- applied: boolean
- modifiedPlan?: PlanNode[]
- modifiedCriteria?: AcceptanceCriteria
- modifiedTests?: TestBundle
- reason: string
- reversible: boolean (always true)

**Flow:**
- G.1 produces revised plan/criteria
- G.3 validates against resume conditions
- If approved: agent resumes with revised context
- If denied: Phase 27 halts for human review

## Metrics

- **Primitives:** 7/7 implemented
- **Test Cases:** 20/20 PASS
- **Code Quality:** 0 TS errors
- **Reversibility:** 100% (all 7)
- **Determinism:** 100% (no randomness)
- **Statefulness:** 0 (fully stateless)

## What's Next

**Wave G.2:** Cross-Wave Drift Correlation Graph
- Map drift signals across Waves B–F
- Identify patterns (planning → refactor, dependency → healing)
- Generate correlated drift vector

**Wave G.3:** Resume-Gate Logic
- Validate revised acceptance criteria
- Check for cross-wave contradictions
- Decide resume approval

**Wave G.4:** Multi-Wave Telemetry Stitching
- Collect telemetry from Waves B–F
- Create unified drift + healing dashboard
- Phase 28 entry point

## Related

- [[phase-27-wave-f-verification-complete]] — Wave F complete (predecessor)
- [[phase-27-wave-e-six-rules-framework]] — Six Rules Framework (used by G.1)
- [[phase-27-ingestion-autonomy-locked]] — 6-wave plan (Phase 27 A–F), now G.1–G.4 planned
