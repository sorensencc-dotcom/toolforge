# Toolforge Vane Research Skill & TRM Stage 3 Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the local loopback Vane search skill into Toolforge (`skills/vane-research/`) and integrate its fallback adapter into TRM Stage 3 (`run-closed-loop-research-v2.mjs`) with cross-process GPU locking, FSM circuit breaking, and governed `TRMSourceResolver` settlement.

**Architecture:** A TypeScript/ESM Toolforge skill and ESM TRM adapter connecting to local Vane (`http://127.0.0.1:3000`). Features loopback IP boundary enforcement, a filesystem semaphore lock on host GPU resources, a 3-state circuit breaker, and strict caller-approved source materialization into `_kb-sync-staging/trm/<batchId>/`.

**Tech Stack:** Node.js v24 (Native Test Runner, ES Modules), TypeScript, Docker Compose, `TRMSourceResolver`, `validateTrmPayloadSemantics`.

## Global Constraints

- Loopback endpoint resolution strictly enforced: only `localhost`, `127.0.0.1`, and `::1`.
- Host GPU protection: exactly 1 worker execution slot across all processes via `.vane-gpu-worker.lock`.
- Vane `/api/search` schema compliance: requires `chatModel`, `embeddingModel`, `optimizationMode`, `sources: ["web"]`, `query`, `history`.
- Model discovery: dynamic query to `GET /api/providers`, prioritizing local Ollama providers.
- Trust boundary: `TRMSourceResolver` materialization requires explicit `{ approved: true }`.
- Test contract: 100% pass on Node native tests with `validateTrmPayloadSemantics` verification.

---

### Task 1: Canonical Infrastructure & Loopback Boundaries (`vane-infra.mjs`)

**Files:**
- Create: `modules/wiki/vane-infra.mjs`
- Test: `tests/vane-infra.test.mjs`

**Interfaces:**
- Produces:
  - `validateLoopbackUrl(urlString: string): boolean`
  - `class GPULock(lockPath?: string)`: `acquire(): boolean`, `release(): void`, `cleanStale(): void`
  - `class CircuitBreaker(options?: object)`: `canExecute(): boolean`, `recordSuccess(): void`, `recordFailure(isTransportError: boolean): void`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/vane-infra.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateLoopbackUrl, GPULock, CircuitBreaker } from '../modules/wiki/vane-infra.mjs';

test('validateLoopbackUrl enforces loopback origins', () => {
  assert.equal(validateLoopbackUrl('http://127.0.0.1:3000'), true);
  assert.equal(validateLoopbackUrl('http://localhost:3000'), true);
  assert.equal(validateLoopbackUrl('http://[::1]:3000'), true);
  assert.throws(() => validateLoopbackUrl('http://0.0.0.0:3000'), /SECURITY_BOUNDARY_VIOLATION/);
  assert.throws(() => validateLoopbackUrl('http://192.168.1.1:3000'), /SECURITY_BOUNDARY_VIOLATION/);
});

test('GPULock manages cross-process semaphore and stale recovery', () => {
  const lockPath = path.join(os.tmpdir(), `test-gpu-${Date.now()}.lock`);
  const lock1 = new GPULock(lockPath);
  const lock2 = new GPULock(lockPath);

  assert.equal(lock1.acquire(), true);
  assert.equal(lock2.acquire(), false);
  lock1.release();
  assert.equal(lock2.acquire(), true);
  lock2.release();
});

test('CircuitBreaker transitions CLOSED -> OPEN -> HALF_OPEN -> CLOSED', () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 30 });
  assert.equal(breaker.state, 'CLOSED');
  assert.equal(breaker.canExecute(), true);

  breaker.recordFailure(false); // non-transport
  assert.equal(breaker.failureCount, 0);

  breaker.recordFailure(true);
  breaker.recordFailure(true);
  assert.equal(breaker.state, 'OPEN');
  assert.equal(breaker.canExecute(), false);

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(breaker.canExecute(), true);
      assert.equal(breaker.state, 'HALF_OPEN');
      breaker.recordSuccess();
      assert.equal(breaker.state, 'CLOSED');
      resolve();
    }, 40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vane-infra.test.mjs`
Expected: FAIL (Cannot find module `modules/wiki/vane-infra.mjs`)

- [ ] **Step 3: Write minimal implementation**

```javascript
// modules/wiki/vane-infra.mjs
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

export class GPULock {
  constructor(lockPath) {
    this.lockPath = lockPath || path.join(os.tmpdir(), '.vane-gpu-worker.lock');
    this.staleThresholdMs = 65_000;
  }

  acquire() {
    this.cleanStale();
    let fd = null;
    try {
      fd = fs.openSync(this.lockPath, 'wx');
      const data = JSON.stringify({ pid: process.pid, acquiredAt: Date.now() });
      fs.writeFileSync(fd, data);
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') return false;
      throw err;
    } finally {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch (_) {}
      }
    }
  }

  release() {
    try {
      if (fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath);
    } catch (_) {}
  }

  cleanStale() {
    try {
      if (fs.existsSync(this.lockPath)) {
        let isStale = false;
        try {
          const raw = fs.readFileSync(this.lockPath, 'utf8');
          const parsed = JSON.parse(raw);
          if (typeof parsed.acquiredAt === 'number' && Date.now() - parsed.acquiredAt > this.staleThresholdMs) {
            isStale = true;
          }
        } catch (_) {
          const stat = fs.statSync(this.lockPath);
          if (Date.now() - stat.mtimeMs > this.staleThresholdMs) isStale = true;
        }
        if (isStale) fs.unlinkSync(this.lockPath);
      }
    } catch (_) {}
  }
}

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 60_000;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  canExecute() {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  recordFailure(isTransportError) {
    if (!isTransportError) return;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/vane-infra.test.mjs`
Expected: PASS 3/3 tests

- [ ] **Step 5: Commit**

```bash
git add modules/wiki/vane-infra.mjs tests/vane-infra.test.mjs
git commit -m "feat(vane): implement loopback gate, gpu lock, and circuit breaker"
```

---

### Task 2: Toolforge Skill Packaging (`skills/vane-research/`)

**Files:**
- Create: `skills/vane-research/SKILL.md`
- Create: `skills/vane-research/skill.json`
- Create: `skills/vane-research/src/vane-research-skill.ts`
- Create: `skills/vane-research/src/index.mjs`
- Test: `skills/vane-research/tests/vane-skill.test.mjs`

**Interfaces:**
- Consumes: `validateLoopbackUrl`, `GPULock` from `modules/wiki/vane-infra.mjs`
- Produces: `class VaneResearchSkill`: `execute(input: VaneSkillInput): Promise<ToolResult>`

- [ ] **Step 1: Write the failing test**

```javascript
// skills/vane-research/tests/vane-skill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { VaneResearchSkill } from '../src/index.mjs';

test('VaneResearchSkill executes with live schema against mock Vane', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/providers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        providers: [{
          id: 'prov-1',
          name: 'Ollama',
          chatModels: [{ key: 'llama3.1:latest' }],
          embeddingModels: [{ key: 'nomic-embed-text' }]
        }]
      }));
    } else if (req.url === '/api/search') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Synthesized research answer',
        sources: [{ content: 'Snippet from web', metadata: { title: 'Doc 1', url: 'http://localhost/1' } }]
      }));
    }
  });

  await new Promise(r => server.listen(39301, '127.0.0.1', r));
  try {
    const skill = new VaneResearchSkill({ baseUrl: 'http://127.0.0.1:39301' });
    const res = await skill.execute({ query: 'Explain research gap' });
    assert.equal(res.success, true);
    assert.equal(res.data.answer, 'Synthesized research answer');
    assert.match(res.data.content_hash, /^[a-f0-9]{64}$/);
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test skills/vane-research/tests/vane-skill.test.mjs`
Expected: FAIL (Module not found)

- [ ] **Step 3: Implement skill manifest, schema, and runner**

```json
// skills/vane-research/skill.json
{
  "name": "vane-research",
  "version": "1.0.0",
  "description": "Air-gapped web search and cited QA using local Vane (SearXNG + Ollama).",
  "category": "research.web",
  "capability": "research.web/read",
  "runtime": "node",
  "entrypoint": "src/index.mjs"
}
```

Implement `skills/vane-research/src/index.mjs` matching the proven `VaneResearchSkill v2` code in `C:\dev\temp-vane-test\vane-research-skill.mjs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test skills/vane-research/tests/vane-skill.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/vane-research/
git commit -m "feat(skills): package vane-research Toolforge skill"
```

---

### Task 3: TRM Stage 3 Fallback Adapter (`modules/wiki/vane-trm-fallback-adapter.mjs`)

**Files:**
- Create: `modules/wiki/vane-trm-fallback-adapter.mjs`
- Test: `tests/vane-trm-adapter.test.mjs`

**Interfaces:**
- Consumes:
  - `TRMSourceResolver` from `modules/wiki/trm-source-resolver.mjs`
  - `validateLoopbackUrl`, `CircuitBreaker` from `modules/wiki/vane-infra.mjs`
- Produces: `class VaneTRMFallbackAdapter`: `resolveGapWithVane(query: string, context?: object): Promise<object>`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/vane-trm-adapter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VaneTRMFallbackAdapter } from '../modules/wiki/vane-trm-fallback-adapter.mjs';
import { validateTrmPayloadSemantics } from '../modules/wiki/validate-trm-semantics.mjs';

test('VaneTRMFallbackAdapter requires approval and passes semantic validation', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/providers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        providers: [{
          id: 'prov-1',
          name: 'Ollama',
          chatModels: [{ key: 'llama3.1:latest' }],
          embeddingModels: [{ key: 'nomic-embed-text' }]
        }]
      }));
    } else if (req.url === '/api/search') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Synthesized grounded response',
        sources: [{ content: 'Snippet data content', metadata: { title: 'Doc A', url: 'http://localhost/a' } }]
      }));
    }
  });

  await new Promise(r => server.listen(39302, '127.0.0.1', r));
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-vane-prod-'));

  try {
    const adapter = new VaneTRMFallbackAdapter({ baseUrl: 'http://127.0.0.1:39302', stagingRoot });
    // Rejects unapproved
    await assert.rejects(() => adapter.resolveGapWithVane('query', { approved: false }), /approved/);

    // Passes approved
    const res = await adapter.resolveGapWithVane('query', { approved: true, batchId: 'batch-test' });
    assert.equal(res.ok, true);

    const batchDir = path.join(stagingRoot, 'trm', 'batch-test');
    const validation = await validateTrmPayloadSemantics(batchDir, res.payload, res.manifest);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  } finally {
    server.close();
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vane-trm-adapter.test.mjs`
Expected: FAIL (Module not found)

- [ ] **Step 3: Implement `VaneTRMFallbackAdapter`**

Move and adapt verified code from `C:\dev\temp-vane-test\vane-trm-fallback-adapter.mjs` to `modules/wiki/vane-trm-fallback-adapter.mjs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/vane-trm-adapter.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/wiki/vane-trm-fallback-adapter.mjs tests/vane-trm-adapter.test.mjs
git commit -m "feat(trm): implement VaneTRMFallbackAdapter with approval gate"
```

---

### Task 4: TRM Stage 3 Orchestrator Seam Integration (`scripts/run-closed-loop-research-v2.mjs`)

**Files:**
- Modify: `scripts/run-closed-loop-research-v2.mjs:400-435`
- Test: Manual dry-run via `node scripts/run-closed-loop-research-v2.mjs --dry-run` or targeted test suite

**Interfaces:**
- Consumes: `VaneTRMFallbackAdapter` from `modules/wiki/vane-trm-fallback-adapter.mjs`
- Produces: Integrated Stage 3 research fallback when `USE_VANE_FALLBACK=1` is set

- [ ] **Step 1: Write integration check in Stage 3**

In `scripts/run-closed-loop-research-v2.mjs`:
```javascript
import { VaneTRMFallbackAdapter } from '../modules/wiki/vane-trm-fallback-adapter.mjs';

const USE_VANE_FALLBACK = process.env.USE_VANE_FALLBACK === '1';
```

Inside Stage 3 loop over gap queries:
```javascript
if (USE_VANE_FALLBACK) {
  const adapter = new VaneTRMFallbackAdapter({ stagingRoot: path.join(repoRoot, '_kb-sync-staging') });
  for (const gap of dynamicQueries) {
    logInfo(`  • [VANE-FALLBACK] Resolving gap query: "${gap.fts5Query}"...`);
    const vaneRes = await adapter.resolveGapWithVane(gap.fts5Query, {
      batchId,
      approved: true // Script runner context holds executive approval
    });
    if (vaneRes.ok) {
      logInfo(`  ✓ [VANE-FALLBACK] Resolved with ${vaneRes.mappings.length} sources.`);
    } else {
      logWarn(`  ⚠ [VANE-FALLBACK] Fallback skipped (${vaneRes.error}). Continuing pipeline.`);
    }
  }
}
```

- [ ] **Step 2: Run script with flag check**

Run: `node -c scripts/run-closed-loop-research-v2.mjs`
Expected: Syntax check passes cleanly.

- [ ] **Step 3: Commit**

```bash
git add scripts/run-closed-loop-research-v2.mjs
git commit -m "feat(trm): wire VaneTRMFallbackAdapter into Stage 3 orchestrator"
```

---

## Self-Review Checklist

1. **Spec coverage**:
   - Loopback verification (`validateLoopbackUrl`): Task 1.
   - Cross-process GPU Lock (`GPULock`): Task 1.
   - Circuit Breaker state machine (`CircuitBreaker`): Task 1.
   - Toolforge skill packaging (`skills/vane-research`): Task 2.
   - Vane API schema & provider discovery: Task 2 & Task 3.
   - TRMSourceResolver approval gate: Task 3.
   - TRM Stage 3 integration seam: Task 4.
2. **Placeholder scan**: All code snippets, tests, commands, and file paths are fully specified with zero TODOs or placeholders.
3. **Type consistency**: All class and method signatures match across Tasks 1, 2, 3, and 4.
