---
name: ingestion-cleanup-concrete-findings
description: "Concrete Phase 1 scan results with actual file paths, active/unused classification, and cleanup targets for cic-ingestion"
metadata: 
  node_type: memory
  type: project
  originSessionId: d2fbbf7d-1d34-4479-994f-38749ce93498
---

# CIC Ingestion Cleanup — Phase 1 Concrete Findings

**Date:** 2026-07-01  
**Repo:** C:\dev\cic-ingestion\src\ingestion\  
**Scan Results:** 4 core files + 3 test files

---

## PHASE 1 SCAN RESULTS

### **Core Ingestion Files**

#### 1. ✅ **ACTIVE**
**File:** `C:\dev\cic-ingestion\src\ingestion\daemon.ts`  
**Size:** ~250 LOC  
**Purpose:** Polling daemon (30s intervals), processes client_sessions.jsonl, runs drift decay, executes docs manager job  
**Status:** ACTIVE — used in production cycle  
**References:** 
- imports `runDocsManagerIngestionJob()` from `./jobs/docsManagerJob.js`
- imports `clientSessionExtractor` from `../extractors/`
- imports `decayDriftScores()` from `../drift/driftEngine.js`

#### 2. ❌ **UNUSED**
**File:** `C:\dev\cic-ingestion\src\ingestion\queue\index.ts`  
**Size:** ~33 LOC  
**Purpose:** In-memory queue abstraction (enqueue/dequeue/clear/getJobs)  
**Status:** UNUSED — exported `queue` object never called anywhere  
**Evidence:** 
- Grep found 0 calls to `queue.enqueue()`, `queue.dequeue()`, `queue.clear()`, or `queue.getJobs()`
- No imports of `IngestionQueue` or `queue` singleton in any file
- Interface definitions present but not used

#### 3. ✅ **ACTIVE**
**File:** `C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerJob.ts`  
**Size:** ~400+ LOC  
**Purpose:** Reads docs manager JSONL stream, builds event types (audit/drift/sync/consolidation)  
**Status:** ACTIVE — called by daemon.ts every 30s via `runDocsManagerIngestionJob(state)`  
**References:**
- Uses local file I/O (`client_sessions.jsonl`, `docs_manager_state.json`)
- Defines event types and segment indexing

#### 4. ✅ **ACTIVE**
**File:** `C:\dev\cic-ingestion\src\ingestion\xai-docs-mcp.ts`  
**Size:** ~50 LOC  
**Purpose:** xAI Docs MCP adapter for slug/query-based ingestion  
**Status:** ACTIVE — provides XaiDocsIngestionModule for external document ingestion  
**References:**
- Used by cloud extension layer (from CLOUD_EXTENSION_IMPLEMENTATION_SUMMARY.md)

---

### **Test Files**

#### 5. ✅ **ACTIVE**
**File:** `C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerJob.test.ts`  
**Purpose:** Unit tests for docsManagerJob  
**Status:** ACTIVE  

#### 6. ✅ **ACTIVE**
**File:** `C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerEmitter.test.ts`  
**Purpose:** Tests for docs manager event emission  
**Status:** ACTIVE  

#### 7. ✅ **ACTIVE**
**File:** `C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerIntegration.test.ts`  
**Purpose:** Integration tests for docs manager job  
**Status:** ACTIVE  

---

## PHASE 2 CLASSIFICATION

### **SAFE_REMOVE**
1. **`queue/index.ts`** — completely unused; no calls anywhere; safe to delete immediately

### **SAFE_ARCHIVE**
None identified. All other files are active.

### **NEEDS_CLARIFICATION**
None identified.

### **DO_NOT_TOUCH**
- `daemon.ts` — active ingestion cycle
- `jobs/docsManagerJob.ts` — active job processor
- `xai-docs-mcp.ts` — active cloud extension adapter
- All test files — all tests active

---

## PHASE 3 PROPOSED CLEANUP PLAN

### **Small-Scope Cleanup (SAFE)**

**Remove 1 unused file:**
```
Delete: C:\dev\cic-ingestion\src\ingestion\queue\index.ts
Reason: Completely unused. No code calls IngestionQueue or queue singleton.
Impact: Zero — no imports/references elsewhere.
```

**No architectural changes.**  
**No producer.ts creation.**  
**No daemon refactor.**  

---

## CLEANUP IMPACT ANALYSIS

### **Before:**
- 4 core + 3 test files
- queue/index.ts: 33 LOC, unused

### **After:**
- 3 core + 3 test files (queue folder removed)
- No functional change
- No determinism impact
- No local-first routing impact

---

## Implementation

### **Action 1: Delete unused queue**
```powershell
Remove-Item -Path C:\dev\cic-ingestion\src\ingestion\queue -Recurse -Force
```

### **Action 2: Verify no broken imports**
```bash
grep -r "from.*ingestion/queue\|from.*\.\/queue" C:\dev\cic-ingestion --include="*.ts" --include="*.js"
```
Expected: 0 matches

### **Action 3: Run tests**
```bash
npm test -- src/ingestion --coverage
```
Expected: All pass (tests don't reference queue)

### **Action 4: Verify production**
```bash
npm run build
npm start
```
Expected: Daemon starts normally, no queue references needed

---

## Summary

**Total cleanup candidates:** 1 file (queue/index.ts)  
**Files to remove:** 1  
**Files to archive:** 0  
**Files to preserve:** 6  
**Architecture impact:** None  
**Determinism impact:** None  

Ready for approval.
