---
name: drift-detector-fix-2026-07-02
description: Fixed variable shadowing and dedup performance in work-summarizer-v2 drift-detector
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b9e4418-e9b7-4f47-8b0a-fa70e19169d1
---

## Drift-Detector Fix — Complete

**Repo:** c:\Users\soren\.claude\skills\work-summarizer-v2  
**File:** src/drift-detector.ts  
**Commit:** 6239320  
**Date:** 2026-07-02

---

## Bugs Fixed

### 1. Variable Shadowing (L84)
**Issue:** `filePath` redefined in tool_use block, overwriting outer scope.
```typescript
// BEFORE: L83-86
const filePath = block.input.file_path.toLowerCase();  // shadows L48 filePath
if (filePath.includes("drift")) {
  signal.files.push(filePath);  // records tool path, not source file
}

// AFTER
const toolFilePath = block.input.file_path.toLowerCase();
if (toolFilePath.includes("drift")) {
  filesSet.add(filePath);  // correct: source file from L48
}
```
**Impact:** Recorded tool operation paths instead of source .jsonl files in signal.files

### 2. Dedup Performance (L64, L67, L87, L90)
**Issue:** Used `array.includes()` in loop (O(n) × keyword count).
```typescript
// BEFORE
if (!signal.files.includes(filePath)) signal.files.push(filePath);  // O(n) per iteration
if (!signal.keywords.includes(keyword)) signal.keywords.push(keyword);

// AFTER
filesSet.add(filePath);  // O(1) per iteration
keywordsSet.add(keyword);
```
**Impact:** Reduced from O(n²) to O(n) for dedup in large scans

---

## Improvements

- Replaced arrays with Sets for deduplication
- Added type hints to lambda parameters
- Marked unused `_daysBack` parameter
- Fixed linter errors (implicit any, unused vars)

---

## Status

✅ All fixes verified  
✅ Committed with tests passing  
✅ Ready for production
