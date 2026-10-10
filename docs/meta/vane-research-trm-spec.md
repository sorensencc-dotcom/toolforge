# Specification: Toolforge Vane Research Skill & TRM Stage 3 Fallback Integration

- **Status**: Revised & Governed (Post-Codex Review)
- **Author**: Antigravity Pair
- **Target Systems**: `Toolforge Skillpack`, `TRM Stage 3 (run-closed-loop-research-v2.mjs)`, `kb-sync`, `Vane (ItzCrazyKns/Vane)`
- **Date**: 2026-10-08
- **Revision**: 2.0.0

---

## 1. Executive Summary & Objective

Integrate [Vane](https://github.com/ItzCrazyKns/Vane) — an open source AI search engine combining SearXNG and local LLM/embedding backends (e.g. Ollama) — into the Toolforge skill ecosystem and the Topic Research Mining (TRM) closed-loop pipeline.

### Core Goals & Boundary Definitions
1. **Loopback-Constrained Local Service**:
   - Vane runs locally under Docker, bound strictly to `127.0.0.1:3000` via Compose override.
   - Loopback verification accepts strictly `127.0.0.1`, `localhost`, and `::1`. Remote interfaces and wildcards are rejected.
2. **Toolforge Skill Registration (`vane-research`)**:
   - Provide capability `research.web/read` (`READ_ONLY`).
   - Dynamic provider resolution via Vane `/api/providers` (querying active local models before `/api/search`).
   - Full compliance with Vane's live `/api/search` schema (`chatModel`, `embeddingModel`, `optimizationMode`, `sources: ["web"]`, `query`, `history`).
   - **Cross-Process GPU Concurrency Lock**: File-based lock (`.vane-gpu.lock`) with PID and timeout to protect host GPU VRAM across multiple node runners or agent processes.
3. **TRM Stage 3 Pipeline Adapter (`VaneTRMFallbackAdapter`)**:
   - Integrated cleanly at TRM Stage 3 seam (gap query expansion fallback).
   - **Finite State Machine Circuit Breaker**: Formal `CLOSED` -> `OPEN` -> `HALF_OPEN` state machine with error-type isolation (transport failures trip the breaker; contract/resolver failures do not).
   - **Provenance & Trust Boundaries**:
     - Respects explicit caller approval contract (`{ approved: true | false }`).
     - Distinguishes snippet-level citations from full-text observations.
     - Persists valid batch bundles into `_kb-sync-staging/trm/<batchId>/` via `TRMSourceResolver`.
     - Validates 100% against `validateTrmPayloadSemantics`.

---

## 2. Architecture & Service Topology

```
+---------------------------------------------------------------------------------------+
|                                  HOST WORKSTATION                                     |
|                                                                                       |
|   +------------------------------------+      +-----------------------------------+   |
|   | TRM Closed-Loop Orchestrator       |      | Toolforge Agent / Runner          |   |
|   | (run-closed-loop-research-v2.mjs)  |      | (vane-research-skill.ts)          |   |
|   +-----------------+------------------+      +-----------------+-----------------+   |
|                     |                                           |                     |
|                     | invokes                                   | executes            |
|                     v                                           v                     |
|   +------------------------------------+      +-----------------------------------+   |
|   | VaneTRMFallbackAdapter             |      | Process-Wide File Lock            |   |
|   | - Breaker: CLOSED/OPEN/HALF-OPEN   |      | (.vane-gpu.lock, 1-worker limit)  |   |
|   +-----------------+------------------+      +-----------------+-----------------+   |
|                     |                                           |                     |
|                     +---------------------+---------------------+                     |
|                                           |                                           |
|                                           | HTTP Loopback Only                        |
|                                           | (127.0.0.1:3000, localhost:3000)          |
|                                           v                                           |
|                     +-------------------------------------------+                     |
|                     | Docker: vane-service (docker-compose)     |                     |
|                     | Port bind: 127.0.0.1:3000:3000            |                     |
|                     | - GET  /api/providers                     |                     |
|                     | - POST /api/search                        |                     |
|                     | Internal upstreams:                       |                     |
|                     | - SearXNG metasearch                      |                     |
|                     | - Local Ollama (127.0.0.1:11434)          |                     |
|                     +---------------------+---------------------+                     |
|                                           |                                           |
|                                           | Writes verified bundles                   |
|                                           v                                           |
|                     +-------------------------------------------+                     |
|                     | kb-sync Pipeline & Staging Root           |                     |
|                     | - TRMSourceResolver                       |                     |
|                     | - Governed approval gate (caller-supplied)|                     |
|                     | - sources/src-*.md                        |                     |
|                     | - sources.manifest.json & payload.json    |                     |
|                     | - validateTrmPayloadSemantics() PASS      |                     |
|                     +-------------------------------------------+                     |
+---------------------------------------------------------------------------------------+
```

---

## 3. Strict Interface & Protocol Contracts

### 3.1. Local Service Compose Deployment (`C:\dev\Vane`)
Default `docker-compose.yaml` binds to `0.0.0.0:3000`. To prevent external host access:
- Use `docker-compose.override.yaml` (or edit `docker-compose.yaml`):
  ```yaml
  services:
    vane:
      ports:
        - "127.0.0.1:3000:3000"
  ```

### 3.2. Endpoint Validation & Loopback Gate
The loopback validator must strictly evaluate:
```javascript
export function validateLoopbackUrl(urlString) {
  const parsed = new URL(urlString);
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(`SECURITY_BOUNDARY_VIOLATION: Endpoint must resolve to local loopback (127.0.0.1, localhost, or ::1). Got: ${parsed.hostname}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid protocol: ${parsed.protocol}`);
  }
  return true;
}
```

### 3.3. Vane API Request/Response Protocol
1. **Provider Discovery**:
   - `GET http://127.0.0.1:3000/api/providers`
   - Returns `{ providers: [ { id, name, chatModels: [{ key, name }], embeddingModels: [{ key, name }] } ] }`
   - Selects default local Ollama provider or first active provider if not explicitly configured.
2. **Search Invocation**:
   - `POST http://127.0.0.1:3000/api/search`
   ```json
   {
     "chatModel": { "providerId": "<uuid>", "key": "<model-key>" },
     "embeddingModel": { "providerId": "<uuid>", "key": "<model-key>" },
     "optimizationMode": "balanced",
     "sources": ["web"],
     "query": "What is TRM architecture?",
     "history": [],
     "stream": false
   }
   ```
3. **Response Schema**:
   ```json
   {
     "message": "Synthesized answer text...",
     "sources": [
       {
         "content": "Raw document snippet or text content...",
         "metadata": {
           "title": "Document Title",
           "url": "https://example.org/doc"
         }
       }
     ]
   }
   ```

### 3.4. Process-Wide GPU Concurrency Semaphore
Because Node instances run in separate processes:
- Implement a lockfile semaphore at `os.tmpdir() + '/.vane-gpu-worker.lock'`.
- Acquire using atomic `fs.openSync(path, 'wx')`.
- Store payload: `{ pid: process.pid, acquiredAt: Date.now() }`.
- Automatically evicts stale locks older than 65 seconds (exceeding maximum 60s quality timeout).

### 3.5. Circuit Breaker State Machine
- **States**:
  - `CLOSED`: Normal operation. Failures increment counter.
  - `OPEN`: Failures exceeded threshold (3 consecutive transport failures). Fast-fails for 60 seconds cooldown.
  - `HALF_OPEN`: Cooldown expired. Allows exactly 1 canary trial. Success resets to `CLOSED`; failure resets to `OPEN`.
- **Fault Isolation**:
  - Transport errors (`ECONNREFUSED`, `ETIMEDOUT`, HTTP 502/503/504) trigger breaker failure tracking.
  - Contract errors (schema mismatch, bad query, resolver rejection) throw immediately and do **not** trip the breaker.

### 3.6. TRMSourceResolver Integration & Approval Contract
- The caller must supply explicit approval `{ approved: boolean }`.
- If `approved: false` (or omitted by untrusted callers), materialization is rejected with standard provenance error.
- Citations are typed with `rationale: "Retrieved via Vane search snippet"` and character spans computed accurately over the actual snippet content.

---

## 4. Conformance Test Matrix

1. **Loopback Gate**:
   - Accept: `http://localhost:3000`, `http://127.0.0.1:3000`, `http://[::1]:3000`.
   - Reject: `http://0.0.0.0:3000`, `http://example.com:3000`, `http://192.168.1.10:3000`.
2. **Cross-Process GPU Lock**:
   - Parallel execution across 2 independent Node worker processes: worker 1 succeeds, worker 2 receives `VRAM_CONCURRENCY_SATURATED`.
   - Stale lock (>65s) is automatically reclaimed.
3. **Vane Request/Response Conformance**:
   - Validates mock `/api/providers` and `/api/search` matching `docs/API/SEARCH.md`.
4. **Circuit Breaker**:
   - 3 consecutive network failures transition state from `CLOSED` to `OPEN`.
   - Subsequent calls immediately fail with `CIRCUIT_BREAKER_OPEN`.
   - Cooldown elapses -> canary probe in `HALF_OPEN` -> success transitions to `CLOSED`.
5. **TRMSourceResolver Approval Boundary**:
   - `approved: false` rejects file materialization and writes 0 files.
   - `approved: true` materializes `payload.json`, `sources.manifest.json`, `FILES.manifest.txt`, and `src-*.md`.
   - Passes `validateTrmPayloadSemantics(batchDir, payload, manifest)` with `valid: true`.

---

## 5. Implementation Roadmap

- [x] **Phase 1: Proof of Concept Verification**: Initial mock and semantic validation.
- [x] **Phase 2: Upstream Acquisition**: Cloned [ItzCrazyKns/Vane](https://github.com/ItzCrazyKns/Vane) into `C:\dev\Vane`.
- [x] **Phase 3: Formal Codex Review & Spec Overhaul**: Incorporated all P0/P1 findings into Spec v2.0.0.
- [ ] **Phase 4: Component Hardening & Comprehensive Unit Test Suite**: Implement lockfile, state machine breaker, and providers discovery in `temp-vane-test`.
- [ ] **Phase 5: Canonical Placement**: Package skill into `C:\dev\skills\vane-research\` and adapter into `C:\dev\modules\wiki\vane-trm-fallback-adapter.mjs`.
- [ ] **Phase 6: Stage 3 Seam Integration**: Hook adapter into `run-closed-loop-research-v2.mjs`.
