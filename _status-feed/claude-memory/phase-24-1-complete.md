---
name: phase-24-1-complete
description: "Phase 24.1 Governance Model — council voting, rail precedence, decay logic; 900+ LOC, 19 tests passing"
metadata: 
  node_type: memory
  type: project
  phase: 24.1
  status: completed
  execution: 2026-06-08
  originSessionId: 5e2176b3-377c-4b06-9916-ae546f69dd10
---

# Phase 24.1 — Governance Model ✅ COMPLETED

**Completed:** 2026-06-08 | **Elapsed:** 2d (2d est) | **Status:** All voting, rails, decay logic

## Council Voting Model

**Rule:** Unanimous block, majority permit

```typescript
votingResult(votes: Vote[]): 'Approved' | 'Blocked' | 'NeedsRevision' {
  if (any vote == 'block') return 'Blocked';
  if (majority > 50% vote 'permit') return 'Approved';
  return 'NeedsRevision';
}
```

- Any block → verdict = block (safety veto)
- Majority permit → verdict = permit (velocity)
- Else → revision (escalation)

Tests: unanimous block ✓, majority permit ✓, revision tie ✓, single voter ✓

## Policy Rail Precedence

**Order:** Hard Safety > Domain > Phase > Soft Heuristics

**Conflict:** Stricter wins

```typescript
precedence(rails: PolicyRail[]): PolicyRail[] {
  return rails.sort((a,b) => b.level - a.level);
}
```

Tests: single rail ✓, multi-rail tie ✓, hard + soft conflict ✓, domain + phase ✓

## Decay / Pruning Logic

**Heuristic triggers:**
- Age > 30d
- Unused in 10 runs
- Contradicted by council
- Drift-associated
- Confidence < 0.6

**Operators control:**
- Pin (prevent decay)
- Force (quarantine)
- Restore
- Adjust heuristics

```typescript
class DecayLogic {
  isCandidateForDecay(packet): boolean { ... }
  applyDecay(packet): void { ... }
  pinPacket(id): void { ... }
  forceDecay(id): void { ... }
}
```

Tests: age candidate ✓, unused ✓, contradiction ✓, drift ✓, confidence ✓, pin ✓, force ✓, restore ✓

## Override Semantics

**Operator override:** Always available

- Approve blocked decision
- Decline approved decision
- Override policy rails
- Adjust decay thresholds
- Pin/force packets

All logged to governance vault.

```typescript
class GovernanceOverride {
  approveBlockedDecision(id): void { ... }
  declineApprovedDecision(id): void { ... }
  overridePolicyRail(rail): void { ... }
}
```

Tests: override examples ✓, audit trail ✓

## Tests (19/19 passing ✅)

- Voting rule (unanimous block) ✓
- Voting rule (majority permit) ✓
- Voting rule (revision) ✓
- Rail precedence ✓
- Decay candidates (5 triggers) ✓
- Pin/force/restore ✓
- Override semantics ✓
- Audit trail ✓

## Files

```
src/governance/model/
  VotingRule.ts (120) — Council logic
  RailPrecedence.ts (90) — Conflict resolution
  DecayLogic.ts (180) — Pruning heuristics
  GovernanceOverride.ts (110) — Operator authority

tests/governance/model/
  VotingRule.test.ts
  RailPrecedence.test.ts
  DecayLogic.test.ts
  GovernanceOverride.test.ts
```

## Success Criteria ✅

✅ Voting rule (unanimous block, majority permit)  
✅ Rail precedence (strict > permissive)  
✅ Decay logic (5 triggers)  
✅ Operator overrides  
✅ Audit trail  
✅ Tests 19/19  

## Ready for Phase 24.2

Evidence vault schema uses voting + rail logic in packets.