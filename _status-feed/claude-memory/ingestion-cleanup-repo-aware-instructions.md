---
name: ingestion-cleanup-repo-aware-instructions
description: "Concrete, repo-specific instruction block with actual file paths, Phase 1 findings, and cleanup targets"
metadata: 
  node_type: memory
  type: reference
  originSessionId: d2fbbf7d-1d34-4479-994f-38749ce93498
---

# CIC Ingestion Cleanup — Repo-Aware Instruction Block

**Status:** Ready for review and approval  
**Repo:** C:\dev\cic-ingestion\src\ingestion\  
**Scope:** Remove 1 unused file (queue/index.ts); preserve daemon + jobs + MCP adapter  
**Phase 1 findings:** See [[ingestion-cleanup-concrete-findings]]

---

## PHASE 1 — CONCRETE FINDINGS (ALREADY SCANNED)

### **File Inventory**

| File | LOC | Status | Action |
|------|-----|--------|--------|
| daemon.ts | ~250 | ✅ ACTIVE | DO_NOT_TOUCH |
| queue/index.ts | ~33 | ❌ UNUSED | SAFE_REMOVE |
| jobs/docsManagerJob.ts | ~400 | ✅ ACTIVE | DO_NOT_TOUCH |
| xai-docs-mcp.ts | ~50 | ✅ ACTIVE | DO_NOT_TOUCH |
| jobs/*.test.ts | various | ✅ ACTIVE | DO_NOT_TOUCH |

### **Why queue/index.ts Is Unused**

1. **No imports anywhere** — grep found 0 references to `from './queue'` or `import { queue }` in entire codebase
2. **No method calls** — grep found 0 calls to `queue.enqueue()`, `queue.dequeue()`, `queue.clear()`, `queue.getJobs()`
3. **Export not consumed** — `export const queue = new IngestionQueue()` at end of file is never referenced
4. **Tests don't use it** — docsManagerJob.test.ts, docsManagerIntegration.test.ts, docsManagerEmitter.test.ts all skip queue
5. **Daemon doesn't use it** — daemon.ts processes client_sessions.jsonl directly, never calls queue methods
6. **Jobs don't use it** — docsManagerJob.ts reads from file system, never uses queue

### **Conclusion**
queue/index.ts is a **dead artifact** from an earlier design phase. Safe to delete with zero impact.

---

## PHASE 2 — CLASSIFICATION (CONCRETE)

### **SAFE_REMOVE (1 file)**
```
C:\dev\cic-ingestion\src\ingestion\queue\index.ts
```
- Completely unused
- No imports
- No method calls
- No side effects
- Safe deletion

### **SAFE_ARCHIVE (0 files)**
All remaining files are active.

### **NEEDS_CLARIFICATION (0 files)**
None.

### **DO_NOT_TOUCH (6 files)**
```
C:\dev\cic-ingestion\src\ingestion\daemon.ts                          ← active
C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerJob.ts            ← active
C:\dev\cic-ingestion\src\ingestion\xai-docs-mcp.ts                   ← active
C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerJob.test.ts       ← active
C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerEmitter.test.ts   ← active
C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerIntegration.test.ts ← active
```

---

## PHASE 3 — CLEANUP PLAN (CONCRETE & MINIMAL)

### **Single Action: Delete Unused Queue**

**Target:** `C:\dev\cic-ingestion\src\ingestion\queue\`  
**Action:** Delete directory  
**Reason:** No code uses it; completely safe  
**Verification:**
```bash
# Verify no imports remain
grep -r "from.*ingestion/queue\|from.*\.\/queue\|import.*queue" \
  C:\dev\cic-ingestion\src \
  --include="*.ts" --include="*.js"

# Expected: 0 matches
```

### **No Other Changes Required**
- Daemon continues polling client_sessions.jsonl
- Jobs continue processing docs manager events
- Tests continue passing
- Determinism guarantees remain intact
- Local-first routing unaffected

---

## PHASE 4 — APPROVAL GATES

**Questions before deletion:**

1. **Delete queue/index.ts immediately?** (YES/NO)
2. **Generate git patch after deletion?** (YES/NO)
3. **Run test suite post-cleanup?** (YES/NO)
4. **Commit with message "cleanup: remove unused ingestion queue"?** (YES/NO)

**Wait for explicit approval.**

---

## PHASE 5 — EXECUTION (AFTER APPROVAL)

If approved:

```powershell
# 1. Delete unused queue
Remove-Item -Path C:\dev\cic-ingestion\src\ingestion\queue -Recurse -Force

# 2. Verify no broken imports
cd C:\dev
grep -r "queue/index\|\.\/queue" src/cic-ingestion --include="*.ts"
# Expected: 0 results

# 3. Run ingestion tests
npm test -- src/ingestion

# 4. Build
npm run build

# 5. Generate patch
git diff C:\dev\cic-ingestion\src\ingestion > cleanup-queue.patch

# 6. Show summary
echo "Cleanup complete. Files removed: 1 (queue/index.ts). Impact: 0. Tests: PASS."
```

---

## Summary for Review

**Cleanup scope:** Minimal, targeted, safe  
**Files to remove:** 1 (queue/index.ts)  
**Files preserved:** 6  
**Breaking changes:** 0  
**Determinism impact:** 0  
**Test impact:** 0  
**Architecture impact:** 0  

**Status:** Ready for approval.
