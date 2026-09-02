---
name: phase-27-m1-aperture-tests-phase-b
description: Phase B debugging; 12/18 orchestrator tests passing; policy engine + adapter registration fixes
metadata: 
  node_type: memory
  type: project
  originSessionId: 61ad00e7-7b1e-41fb-9370-faa203531ee2
---

## Phase B: Orchestrator Integration Debug — In Progress

**Current Status:** 12/18 tests passing (67%) in tool-execution-docker.test.ts

### Fixed This Session

1. **PolicyEngine not loaded** (Bug #1)
   - Root cause: Tests created SandboxSpec with policy but never called `policyEngine.load(policy)`
   - ExecutionOrchestrator.authorize() calls `getPolicyForAgent()` which returned null
   - Fix: Added `policyEngine.load(testPolicy)` in beforeEach
   - Status: FIXED ✅

2. **Adapters not registered** (Bug #2)
   - Root cause: ExecutionOrchestrator retrieves adapters from internal map with `this.adapters.get(adapterId)`
   - Tests never called `orchestrator.registerAdapter()` for any adapters
   - Fix: Registered all 5 adapters in beforeEach:
     - FileReadAdapter, FileWriteAdapter, HttpGetAdapter, HttpPostAdapter, ShellExecAdapter
   - Status: FIXED ✅

3. **AdapterRegistry schema mismatch** (Bug #3)
   - Root cause: Registry defined `data` field but FileWriteAdapter expects `content`
   - Validation failed with "Missing required field: data"
   - Fix: Changed registry inputSchema properties to match adapter expectations
     - `data` → `content`
     - Added `encoding` and `mode` fields to registry schema
   - File: cic-ingestion/src/aperture/registry/AdapterRegistry.ts line 259
   - Status: FIXED ✅

4. **Test status type mismatch** (Bug #4)
   - Root cause: Tests expected `error` status but ExecutionOrchestrator returns `failed` for validation errors
   - ExecutionReceipt.status: 'success' | 'failed' | 'denied' | 'timeout' (no 'error')
   - Fix: Changed all `expect(...).toBe('error')` → `expect(...).toBe('failed')`
   - Status: FIXED ✅

5. **Jest root directory** (Infrastructure)
   - Root jest.config.js missing cic-ingestion root
   - Fix: Added `"<rootDir>/cic-ingestion"` to roots array
   - Status: FIXED ✅

### Test Results Summary

**Passing (12/18):**
- Receipt generation (3/3) ✅
  - Generate receipt with proper structure
  - Track latency (numeric milliseconds)
  - Preserve trace ID through execution

- Tool execution tracking (3/3) ✅
  - Shell exec works correctly
  - Error handling for missing files
  - Invalid tool ID returns proper error

- Error handling (2/3)
  - Nonexistent file handling
  - Invalid tool ID (returns 'failed')
  - ✓ Captures error details in receipt

- Docker constraints (1/2)
  - Invalid tool ID handling
  - ✗ Sandbox isolation from each other (file write failed)

- Concurrent operations (2/2)
  - Multiple tools concurrent execution
  - Concurrent operations on same sandbox

- Other (1/1)
  - Tool execution failure handling

**Failing (6/18):**

1. **Single tool execution — file.write (expected "success", got "failed")**
   - Line 75-98
   - Inputs: path='output.txt', content='written data'
   - Receipt shows status='failed' but no error code visible in test output

2. **Chained execution — write then read (write expected "success", got "failed")**
   - Line 118-144
   - First operation (file.write) fails before read can proceed

3. **Chained execution — shell then write (write expected "success", got "failed")**
   - Line 146-180
   - Shell exec works (verified earlier), but file.write fails

4. **File persistence (ENOENT: no such file or directory)**
   - Line 419-445
   - Test writes file via orchestrator.execute(file.write), then tries to read directly from fs
   - Error: `C:\Users\soren\AppData\Local\Temp\aperture-...\persist.txt` not found
   - Write receipt status likely 'success' but file not on disk

5. **Large file handling (1MB, expected "success", got "failed")**
   - Line 449-479
   - 1MB string write returning failed status
   - Likely: policy byte limit enforcement (policy max_bytes = 100MB, should pass)

6. **Sandbox isolation — read from sandbox2 where file wrote to sandbox1 (expected "failed", got ???)**
   - Line 312-363
   - Write to sandbox1 first, but previous fix may have made this succeed
   - Need to re-run to see actual status

### Blocker Analysis

**Primary blocker:** FileWriteAdapter.execute() not returning success

Hypotheses:
1. Adapter execution context issue
   - File written to different tmpdir than test expects
   - Line 69: `const safePath = path.join(sandbox.tmpdir, filePath);`
   - sandbox.tmpdir should be SandboxHandle.tmpdir from SandboxRuntime.create()
   - Verify: adapter receives correct SandboxHandle and tmpdir

2. Adapter execution error not surfacing
   - Error happens silently in try/catch
   - orchestrator.execute() line 218 catches and returns 'failed' status
   - Need to add error logging to see what's thrown

3. File system permissions
   - tmpdir created in C:\Users\soren\AppData\Local\Temp
   - Write permission should exist but verify with test logging

### Next Steps (Phase B Continuation)

1. **Add debug logging to FileWriteAdapter.execute()**
   - Log safePath being written to
   - Log exception before throwing
   - Verify content is non-empty

2. **Add debug logging to test**
   - Console.log sandbox.tmpdir after creation
   - Console.log result.receipt.error.message for failed writes

3. **Verify adapter receives correct SandboxHandle**
   - Confirm sandbox.tmpdir is valid directory
   - Confirm file actually gets written to that path

4. **Check if execution context differs from expected**
   - File operations may need to run inside sandbox context (SandboxRuntime.execute())
   - Currently adapters run in test process context

5. **Consider simpler test first**
   - Create minimal test: SandboxRuntime.create() → write file directly (no orchestrator)
   - Verify file persistence without orchestrator layer
   - Isolate whether problem is orchestrator or adapter

### Architecture Notes

**ExecutionOrchestrator flow:**
1. Registry lookup (✅ working)
2. Policy authorization (✅ working after load fix)
3. Execution limits check (✅ working)
4. Input validation (✅ working after schema fix)
5. Sandbox creation (✅ creating valid SandboxHandle)
6. **Adapter execution (❌ failing for file.write)** ← HERE
7. Output validation
8. Limit increment
9. Sandbox cleanup
10. Receipt generation (✅ working)

**File write flow:**
- Test provides: {path: 'output.txt', content: 'written data'}
- Adapter validates and joins with sandbox.tmpdir
- Adapter writes file with fs.writeFile()
- Adapter returns {success: true, path, size, created}
- Receipt generated with status='success'

Current issue: Step 6 (adapter.execute) returns error, caught at line 218, wrapped in failed receipt.

### Files Modified
- jest.config.js: Added cic-ingestion to roots
- tool-execution-docker.test.ts: Added policy load, adapter registration, debug logging
- AdapterRegistry.ts: Fixed file.write schema (data→content)
- FileReadAdapter.ts: Already had _ prefix on unused options param

### Commit
e5ba5a4 "Phase 27 Phase A: 12/18 orchestrator integration tests passing"
