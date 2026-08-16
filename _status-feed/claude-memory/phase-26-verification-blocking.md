---
name: phase-26-verification-blocking
description: "CRITICAL blocker checklist for PHASE-26 deployment — Docker image, E2E tests, git state verification required before prod"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6e5614b6-8cbc-45a7-bc36-e7370292bfa7
---

# PHASE-26 Verification — BLOCKING Items

**Status:** Pre-deployment (MUST COMPLETE NEXT SESSION)
**Commit:** 4275a68 (checklist added)
**Blocker:** DO NOT DEPLOY until all items pass

## Why This Matters

TS compilation passed (0 errors), wave executor passed health checks.
But Docker build output never confirmed success, E2E tests never ran post-build.

Three major risk zones:
1. **Docker image doesn't exist** (polling said 0 but log showed only context transfer)
2. **Tests fail at runtime** (ProposalForDecision fields incomplete, null checks fragile)
3. **Git state unknown** (commits may have been lost in rebase or cherry-pick)

## Immediate Actions (Next Session Start)

Run in order, ~30 min:

```bash
# 1. Verify Docker image exists and runs
docker inspect cic-phase-26:0.26.0
docker run --rm cic-phase-26:0.26.0 node --version

# 2. Run E2E test suite
npm test -- src/autonomy/__tests__/e2e-test-harness.ts 2>&1 | tail -50

# 3. Verify git commits
git log --oneline | head -10
git log --grep="PHASE-26" --oneline
```

## If Docker Build Failed

Execute debugging sequence (30-60 min):

```bash
# Check subdir node_modules for npm temp files
ls -la rewrite-mcp/projects/cic/ingestion/node_modules/.bin/ | grep "^\."

# If found, clean and rebuild:
cd rewrite-mcp/projects/cic/ingestion && npm ci --omit=dev && cd -
docker build --no-cache -t cic-phase-26:0.26.0 .

# Check .dockerignore format (must be LF not CRLF)
file .dockerignore
sed -i 's/\r$//' .dockerignore

# Full rebuild with progress visibility
docker build --progress=plain -t cic-phase-26:0.26.0 . 2>&1 | tee docker-build.log
```

## If E2E Tests Failed

Execute debugging sequence (30-60 min):

```bash
# Check ProposalForDecision interface completeness
grep -r "ProposalForDecision" src --include="*.ts" | grep -E "interface|type"

# Audit all submitProposal call sites
grep -r "submitProposal(" src --include="*.ts" -A 2

# Check MemoryService/GovernanceService exports
ls -la src/autonomy/services/*.ts
grep "export.*MemoryService\|export.*GovernanceService" src/autonomy/services/*.ts

# Run tests with detailed output
npm test -- --verbose --no-coverage 2>&1 | tail -100
```

## Sign-Off Criteria

✅ TS compilation: 0 errors (DONE — ad4bb24)
✅ Wave executor: health checks (DONE — a988e92)
⏳ **Docker image: exists + runs (NEXT SESSION)**
⏳ **E2E tests: all 8 PASS or failures documented (NEXT SESSION)**
⏳ **Git commits: all 5 present (NEXT SESSION)**

## Critical Fields to Verify

**ProposalForDecision required fields:**
- action_type ✅
- target_resource ✅
- requested_by ✅
- voting_threshold ✅
- estimated_cost_usd ✅
- risk_level ✅
- **decision_deadline** ✅ (added in ad4bb24)
- ❓ Any others? (NOT VERIFIED)

**MemoryService methods:**
- writePacket() ❓
- getPacket() ❓
- queryPackets() ❓
- extendTTL() ❓

**GovernanceService methods:**
- submitProposal() ❓
- castVote() ❓
- getProposal() ❓

## Success Threshold

- Docker: image runs + node/npm versions correct
- Tests: ≥5/8 pass (or 0 hard crashes with documented failures)
- Git: all 5 commits in log

**Anything less = debug further before deployment**

## Reference

Full checklist: `PHASE-26-VERIFICATION-CHECKLIST.md`

---

**DO NOT SKIP THIS.**
TS passed. But integration untested. Verify before prod.
