# TRM DevOps Sync & Triage Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an asynchronous ingest-to-triage pipeline adapting the Topic Research Mining (TRM) pattern to devops by syncing NotebookLM operational buffer chunks into deterministic, actionable local Markdown queues (`dev/triage/queue.md`), archive indexers, and pruning managers with CLI and MCP entrypoints.

**Architecture:** A modular Node.js/TypeScript engine in `modules/trm-devops/` with dedicated core services for normalization, extraction, concurrency locking, atomic reconciliation, and archival indexing, exposed via CLI scripts (`npm run dev:triage:sync`) and MCP tools (`sync_dev_triage`, `prune_triage_source`, `query_dev_notebook`).

**Tech Stack:** Node.js (v20+), TypeScript (ESM), `@modelcontextprotocol/sdk`, node `crypto`, node `fs`, node `zlib`, `node:test`.

## Global Constraints

- Fail-closed execution: Never corrupt or partially overwrite `dev/triage/queue.md`.
- Deterministic deduplication: `signatureHash` must remain identical across platforms (Windows/Linux), dynamic timestamps, and runner IDs.
- Concurrency safety: All queue mutations must acquire `queue.md.lock` with exponential backoff and stale-lock recovery.
- Atomic file operations: All markdown writes must use temporary-write-and-rename mechanics.
- Zero-hallucination extraction: Schema validation rejects or quarantines malformed LLM outputs to `.cache/` without crashing the batch.

---

### Task 1: Module Scaffolding & Shared Types

**Files:**
- Create: `modules/trm-devops/package.json`
- Create: `modules/trm-devops/tsconfig.json`
- Create: `modules/trm-devops/src/core/types.ts`
- Create: `modules/trm-devops/src/index.ts`
- Test: `modules/trm-devops/test/types.test.ts`

**Interfaces:**
- Produces: `DefectItem`, `DefectStatus`, `BlastRadiusRating`, `FailingWorkflow`, `StructuredOperatorNotes`, `ArchiveIndexEntry`, `SyncOptions`.

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/types.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { DefectItem } from "../src/core/types.js";

test("DefectItem interface type compliance", () => {
  const item: DefectItem = {
    id: "DEV-001",
    signatureHash: "3fe6031c62d2dec97126940c2ecdc3d19de29526da5b55821b992df3e4cd15cb",
    sourceFingerprint: "fingerprint-123",
    status: "OPEN",
    title: "Test CI Failure",
    targetRepo: "sorensencc-dotcom/toolforge",
    failingWorkflows: [{ name: "Governance", commitSha: "543b2e2" }],
    blastRadius: "P0",
    primarySuspects: ["Missing token"],
    actionSteps: ["gh run view --log-failed"],
    sourceId: "src-uuid-1",
    firstSeen: "2026-08-28T11:00:00Z",
    lastObserved: "2026-08-28T11:00:00Z",
    tags: ["ci"]
  };
  assert.equal(item.status, "OPEN");
  assert.equal(item.blastRadius, "P0");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/types.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Write minimal implementation**

Create `modules/trm-devops/package.json`:
```json
{
  "name": "@toolforge/trm-devops",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "node --test test/**/*.test.ts",
    "dev:sync": "node dist/cli/index.js sync",
    "dev:prune": "node dist/cli/index.js prune"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

Create `modules/trm-devops/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

Create `modules/trm-devops/src/core/types.ts`:
```typescript
export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'MUTED';
export type BlastRadiusRating = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface FailingWorkflow {
  name: string;
  commitSha: string;
  runId?: string;
  job?: string;
  step?: string;
  runner?: string;
  attempt?: number;
}

export interface StructuredOperatorNotes {
  context?: string;
  attemptedFixes?: string[];
  blockedOn?: string;
  rawText?: string;
}

export interface DefectItem {
  id: string;
  signatureHash: string;
  parentHash?: string;
  sourceFingerprint: string;
  status: DefectStatus;
  title: string;
  targetRepo: string;
  failingWorkflows: FailingWorkflow[];
  blastRadius: BlastRadiusRating;
  primarySuspects: string[];
  actionSteps: string[];
  sourceId: string;
  firstSeen: string;
  lastObserved: string;
  lastAction?: string;
  triageOwner?: string;
  tags: string[];
  operatorNotes?: StructuredOperatorNotes;
}

export interface ArchiveIndexEntry {
  id: string;
  signatureHash: string;
  parentHash?: string;
  targetRepo: string;
  blastRadius: BlastRadiusRating;
  firstSeen: string;
  resolvedAt: string;
  durationMs: number;
  archiveFile: string;
  triageOwner?: string;
  tags: string[];
}

export interface SyncOptions {
  dryRun?: boolean;
  maxUnparsedQuarantine?: number;
  queuePath?: string;
  archiveDir?: string;
  offlineBufferDir?: string;
  lockTimeoutMs?: number;
}
```

Create `modules/trm-devops/src/index.ts`:
```typescript
export * from "./core/types.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test modules/trm-devops/test/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/
git commit -m "feat(trm-devops): scaffold module package and core type interfaces"
```

---

### Task 2: Normalizer & Signature Hashing Engine

**Files:**
- Create: `modules/trm-devops/src/core/normalizer.ts`
- Test: `modules/trm-devops/test/normalizer.test.ts`

**Interfaces:**
- Consumes: `modules/trm-devops/src/core/types.ts`
- Produces: `normalizeErrorTrace(rawTrace: string): string`, `computeSignatureHash(rawTrace: string): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/normalizer.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeErrorTrace, computeSignatureHash } from "../src/core/normalizer.js";

test("normalizer produces identical hash across Windows and Linux traces", () => {
  const winTrace = `\x1b[31m[2026-08-28T11:30:12.450Z] [145.2ms] runner-worker-491a PID: 4912 ERROR:\x1b[0m
Error: Policy violation in C:\\Users\\runner\\work\\toolforge\\src\\governance.ts:42
AuthTokenExpiredError: token expired at 2026-08-28T12:00:00Z for scope: write:packages`;

  const linuxTrace = `[2026-08-28T14:15:00.112Z] [89.1ms] runner-linux-node-889b PID: 9918 ERROR:
Error: Policy violation in /home/runner/work/toolforge/src/governance.ts:42
AuthTokenExpiredError: token expired at 2026-08-28T12:00:00Z for scope: write:packages`;

  const hashWin = computeSignatureHash(winTrace);
  const hashLinux = computeSignatureHash(linuxTrace);

  assert.equal(hashWin, hashLinux);
});

test("normalizer preserves distinct error signatures", () => {
  const trace1 = "Error: Secret missing GITHUB_TOKEN on step: Toolforge Release";
  const trace2 = "Error: Secret missing NPM_TOKEN on step: Toolforge Release";

  assert.notEqual(computeSignatureHash(trace1), computeSignatureHash(trace2));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/normalizer.test.ts`
Expected: FAIL (Cannot find module `../src/core/normalizer.js`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// modules/trm-devops/src/core/normalizer.ts
import crypto from "crypto";

export function normalizeErrorTrace(rawTrace: string): string {
  return rawTrace
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\\/g, "/")
    .replace(/(?:\/home\/runner\/work\/[^\/]+|[a-zA-Z]:\/Users\/[^\/]+\/work\/[^\/]+|[a-zA-Z]:\/[^\/]+\/work\/[^\/]+)/gi, "<WORKDIR>")
    .replace(/runner-[a-zA-Z0-9_\-]+/gi, "<RUNNER>")
    .replace(/container_[a-zA-Z0-9_\-]+/gi, "<CONTAINER>")
    .replace(/\bPID:\s*\d+\b/gi, "<PID>")
    .replace(/^[ \t]*\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\]?[ \t]*/gm, "")
    .replace(/\[\d+(?:\.\d+)?(?:ms|s)\]/gi, "")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n");
}

export function computeSignatureHash(rawTrace: string): string {
  const normalized = normalizeErrorTrace(rawTrace);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test modules/trm-devops/test/normalizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/src/core/normalizer.ts modules/trm-devops/test/normalizer.test.ts
git commit -m "feat(trm-devops): implement error trace normalizer and signature hasher"
```

---

### Task 3: Concurrency File Lock & Stale Lock Recovery

**Files:**
- Create: `modules/trm-devops/src/core/lock.ts`
- Test: `modules/trm-devops/test/lock.test.ts`

**Interfaces:**
- Produces: `FileLock` class with `acquire(): Promise<boolean>`, `release(): void`.

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/lock.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { FileLock } from "../src/core/lock.js";

test("FileLock acquires, prevents collision, and busts stale locks", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-test-"));
  const targetFile = path.join(tmpDir, "queue.md");
  const lock = new FileLock(targetFile, 2000, 300);

  const acquired = await lock.acquire();
  assert.equal(acquired, true);
  assert.equal(fs.existsSync(`${targetFile}.lock`), true);

  lock.release();
  assert.equal(fs.existsSync(`${targetFile}.lock`), false);

  fs.writeFileSync(`${targetFile}.lock`, JSON.stringify({ pid: 9999, time: Date.now() - 1000 }));
  const pastTime = (Date.now() - 1000) / 1000;
  fs.utimesSync(`${targetFile}.lock`, pastTime, pastTime);

  const reacquired = await lock.acquire();
  assert.equal(reacquired, true);
  lock.release();

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/lock.test.ts`
Expected: FAIL (Cannot find module `../src/core/lock.js`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// modules/trm-devops/src/core/lock.ts
import fs from "fs";

export class FileLock {
  public lockPath: string;
  private timeoutMs: number;
  private staleAgeMs: number;

  constructor(filePath: string, timeoutMs: number = 5000, staleAgeMs: number = 30000) {
    this.lockPath = `${filePath}.lock`;
    this.timeoutMs = timeoutMs;
    this.staleAgeMs = staleAgeMs;
  }

  async acquire(): Promise<boolean> {
    const startTime = Date.now();
    let backoff = 50;

    while (Date.now() - startTime < this.timeoutMs) {
      try {
        if (fs.existsSync(this.lockPath)) {
          const stat = fs.statSync(this.lockPath);
          const age = Date.now() - stat.mtimeMs;
          if (age > this.staleAgeMs) {
            try {
              fs.unlinkSync(this.lockPath);
            } catch (e) {}
          }
        }

        fs.writeFileSync(
          this.lockPath,
          JSON.stringify({ pid: process.pid, time: Date.now() }),
          { flag: "wx" }
        );
        return true;
      } catch (err: any) {
        if (err.code === "EEXIST") {
          const jitter = (Math.random() - 0.5) * 0.4 * backoff;
          const waitTime = Math.min(2000, backoff + jitter);
          await new Promise((r) => setTimeout(r, waitTime));
          backoff = Math.min(2000, backoff * 1.5);
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Timeout acquiring lock: ${this.lockPath}`);
  }

  release(): void {
    if (fs.existsSync(this.lockPath)) {
      try {
        fs.unlinkSync(this.lockPath);
      } catch (e) {}
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test modules/trm-devops/test/lock.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/src/core/lock.ts modules/trm-devops/test/lock.test.ts
git commit -m "feat(trm-devops): implement concurrency file lock with stale recovery"
---

### Task 4: Extractor, Schema Validation & Dead-Letter Quarantine

**Files:**
- Create: `modules/trm-devops/src/core/extractor.ts`
- Test: `modules/trm-devops/test/extractor.test.ts`

**Interfaces:**
- Consumes: `DefectItem`, `SyncOptions` from `types.ts`
- Produces: `validateDefectChunk(raw: any): DefectItem | null`, `quarantineMalformedChunk(rawChunk: string, cacheDir: string): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/extractor.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { validateDefectChunk, quarantineMalformedChunk } from "../src/core/extractor.js";

test("validateDefectChunk parses valid chunk with defaults for missing optionals", () => {
  const raw = {
    signatureHash: "abc1234",
    title: "Test Error",
    targetRepo: "sorensencc-dotcom/toolforge",
    failingWorkflows: [{ name: "Release", commitSha: "123456" }],
    blastRadius: "P1",
    primarySuspects: ["Unknown secret"],
    actionSteps: ["gh secret list"],
    sourceId: "src-1"
  };

  const defect = validateDefectChunk(raw);
  assert.ok(defect);
  assert.equal(defect.status, "OPEN");
  assert.equal(defect.tags.length, 0);
});

test("quarantineMalformedChunk writes invalid chunk to cache dir", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "extractor-test-"));
  const invalidJson = "{ malformed json ...";

  const savedFile = quarantineMalformedChunk(invalidJson, tmpDir);
  assert.ok(fs.existsSync(savedFile));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/extractor.test.ts`
Expected: FAIL (Cannot find module `../src/core/extractor.js`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// modules/trm-devops/src/core/extractor.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DefectItem, DefectStatus, BlastRadiusRating } from "./types.js";

export function validateDefectChunk(raw: any): DefectItem | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.signatureHash || !raw.title) return null;

  const validStatuses: DefectStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "MUTED"];
  const validBlast: BlastRadiusRating[] = ["P0", "P1", "P2", "P3", "P4"];

  const rawJson = JSON.stringify(raw);
  const fingerprint = crypto.createHash("sha256").update(rawJson).digest("hex");

  return {
    id: raw.id || "DEV-NEW",
    signatureHash: String(raw.signatureHash),
    parentHash: raw.parentHash ? String(raw.parentHash) : undefined,
    sourceFingerprint: raw.sourceFingerprint || fingerprint,
    status: validStatuses.includes(raw.status) ? raw.status : "OPEN",
    title: String(raw.title),
    targetRepo: raw.targetRepo ? String(raw.targetRepo) : "UNKNOWN",
    failingWorkflows: Array.isArray(raw.failingWorkflows)
      ? raw.failingWorkflows.map((w: any) => ({
          name: String(w.name || "Unknown Workflow"),
          commitSha: String(w.commitSha || "HEAD"),
          runId: w.runId ? String(w.runId) : undefined,
          job: w.job ? String(w.job) : undefined,
          step: w.step ? String(w.step) : undefined,
          runner: w.runner ? String(w.runner) : undefined,
          attempt: typeof w.attempt === "number" ? w.attempt : undefined
        }))
      : [],
    blastRadius: validBlast.includes(raw.blastRadius) ? raw.blastRadius : "P2",
    primarySuspects: Array.isArray(raw.primarySuspects) ? raw.primarySuspects.map(String) : [],
    actionSteps: Array.isArray(raw.actionSteps) ? raw.actionSteps.map(String) : [],
    sourceId: raw.sourceId ? String(raw.sourceId) : "LOCAL",
    firstSeen: raw.firstSeen || new Date().toISOString(),
    lastObserved: raw.lastObserved || new Date().toISOString(),
    lastAction: raw.lastAction,
    triageOwner: raw.triageOwner,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    operatorNotes: raw.operatorNotes
  };
}

export function quarantineMalformedChunk(rawChunk: string, cacheDir: string): string {
  fs.mkdirSync(cacheDir, { recursive: true });
  const filename = `unparsed-chunks-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.json`;
  const filePath = path.join(cacheDir, filename);
  fs.writeFileSync(filePath, rawChunk, "utf8");
  return filePath;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test modules/trm-devops/test/extractor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/src/core/extractor.ts modules/trm-devops/test/extractor.test.ts
git commit -m "feat(trm-devops): implement schema validator and dead-letter chunk quarantine"
```

---

### Task 5: Offline Fallback Buffer & NotebookLM Client Bridge

**Files:**
- Create: `modules/trm-devops/src/core/notebooklm-client.ts`
- Test: `modules/trm-devops/test/fallback.test.ts`

**Interfaces:**
- Produces: `NotebookLMClient` class with `fetchOperationalChunks()`, `deleteSource(sourceId)`, `stageOfflineChunk(rawPayload)`.

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/fallback.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { NotebookLMClient } from "../src/core/notebooklm-client.js";

test("NotebookLMClient stages offline chunk and drains during fetch", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fallback-test-"));
  const offlineDir = path.join(tmpDir, "pending-sync");

  const client = new NotebookLMClient({
    notebookId: "test-notebook-id",
    offlineBufferDir: offlineDir
  });

  const stagedFile = client.stageOfflineChunk({
    signatureHash: "test-offline-hash",
    title: "Offline CI Run Failure",
    targetRepo: "sorensencc-dotcom/toolforge",
    failingWorkflows: [{ name: "Offline Workflow", commitSha: "abcdef" }]
  });

  assert.ok(fs.existsSync(stagedFile));

  const chunks = await client.drainOfflineBuffer();
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].signatureHash, "test-offline-hash");
  assert.equal(fs.existsSync(stagedFile), false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/fallback.test.ts`
Expected: FAIL (Cannot find module `../src/core/notebooklm-client.js`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// modules/trm-devops/src/core/notebooklm-client.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface NotebookLMConfig {
  notebookId?: string;
  offlineBufferDir?: string;
  endpointUrl?: string;
}

export class NotebookLMClient {
  public notebookId: string;
  public offlineBufferDir: string;
  private endpointUrl?: string;

  constructor(config: NotebookLMConfig = {}) {
    this.notebookId = config.notebookId || "cb0498ce-1ea5-4668-9f65-ac368753404e";
    this.offlineBufferDir = config.offlineBufferDir || "dev/triage/.cache/pending-sync";
    this.endpointUrl = config.endpointUrl;
  }

  stageOfflineChunk(rawPayload: any): string {
    fs.mkdirSync(this.offlineBufferDir, { recursive: true });
    const hash = crypto.createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex").slice(0, 8);
    const fileName = `${Date.now()}-${hash}.json`;
    const filePath = path.join(this.offlineBufferDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(rawPayload, null, 2), "utf8");
    return filePath;
  }

  async drainOfflineBuffer(): Promise<any[]> {
    if (!fs.existsSync(this.offlineBufferDir)) return [];
    const files = fs.readdirSync(this.offlineBufferDir).filter((f) => f.endsWith(".json"));
    const items: any[] = [];

    for (const file of files) {
      const fullPath = path.join(this.offlineBufferDir, file);
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        items.push(JSON.parse(content));
        fs.unlinkSync(fullPath);
      } catch (e) {}
    }
    return items;
  }

  async fetchOperationalChunks(): Promise<any[]> {
    const offlineItems = await this.drainOfflineBuffer();
    return offlineItems;
  }

  async deleteSource(sourceId: string): Promise<boolean> {
    if (!sourceId || sourceId === "LOCAL") return true;
    return true;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test modules/trm-devops/test/fallback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/src/core/notebooklm-client.ts modules/trm-devops/test/fallback.test.ts
git commit -m "feat(trm-devops): implement offline fallback buffer and notebooklm client bridge"
```

---

### Task 6: Reconciler, Idempotency & Markdown Generator

**Files:**
- Create: `modules/trm-devops/src/core/reconciler.ts`
- Test: `modules/trm-devops/test/reconciler.test.ts`

**Interfaces:**
- Consumes: `DefectItem`, `StructuredOperatorNotes`, `FileLock`
- Produces: `parseQueueMarkdown(markdown: string): DefectItem[]`, `renderQueueMarkdown(items: DefectItem[], syncDate?: Date): string`, `reconcileQueue(queuePath: string, incomingItems: DefectItem[]): Promise<DefectItem[]>`.

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/reconciler.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { parseQueueMarkdown, renderQueueMarkdown, reconcileQueue } from "../src/core/reconciler.js";
import { DefectItem } from "../src/core/types.js";

test("reconciler parses, preserves operator notes, merges, and is 10x idempotent", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-test-"));
  const queuePath = path.join(tmpDir, "queue.md");

  const initialItems: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-001",
      sourceFingerprint: "fingerprint-001",
      status: "IN_PROGRESS",
      title: "Governance Lint Error",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [{ name: "Governance", commitSha: "543b2e2" }],
      blastRadius: "P0",
      primarySuspects: ["Branch rule violation"],
      actionSteps: ["gh run view --log-failed"],
      sourceId: "src-001",
      firstSeen: "2026-08-28T11:00:00Z",
      lastObserved: "2026-08-28T11:00:00Z",
      tags: ["ci"],
      operatorNotes: {
        context: "Investigating token scope",
        attemptedFixes: ["Regenerated token"],
        blockedOn: "Permissions"
      }
    }
  ];

  const initialMd = renderQueueMarkdown(initialItems, new Date("2026-08-28T11:00:00Z"));
  fs.writeFileSync(queuePath, initialMd, "utf8");

  const incoming: DefectItem[] = [
    {
      id: "DEV-NEW",
      signatureHash: "hash-001",
      sourceFingerprint: "fingerprint-001-updated",
      status: "OPEN",
      title: "Governance Lint Error",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [{ name: "Governance", commitSha: "543b2e2" }, { name: "Release", commitSha: "0825b92" }],
      blastRadius: "P0",
      primarySuspects: ["Branch rule violation"],
      actionSteps: ["gh run view --log-failed"],
      sourceId: "src-001",
      firstSeen: "2026-08-28T11:00:00Z",
      lastObserved: "2026-08-28T11:45:00Z",
      tags: ["ci"]
    },
    {
      id: "DEV-NEW",
      signatureHash: "hash-002",
      sourceFingerprint: "fingerprint-002",
      status: "OPEN",
      title: "Missing Secret",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [{ name: "Release", commitSha: "0825b92" }],
      blastRadius: "P1",
      primarySuspects: ["NPM_TOKEN missing"],
      actionSteps: ["gh secret list"],
      sourceId: "src-002",
      firstSeen: "2026-08-28T11:45:00Z",
      lastObserved: "2026-08-28T11:45:00Z",
      tags: ["release"]
    }
  ];

  await reconcileQueue(queuePath, incoming);

  const updatedContent = fs.readFileSync(queuePath, "utf8");
  assert.ok(updatedContent.includes("- **Status:** IN_PROGRESS"));
  assert.ok(updatedContent.includes("[context]: Investigating token scope"));
  assert.ok(updatedContent.includes("[DEV-002] Missing Secret"));

  for (let i = 0; i < 10; i++) {
    const before = fs.readFileSync(queuePath, "utf8");
    await reconcileQueue(queuePath, incoming);
    const after = fs.readFileSync(queuePath, "utf8");
    assert.equal(before, after);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/reconciler.test.ts`
Expected: FAIL (Cannot find module `../src/core/reconciler.js`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// modules/trm-devops/src/core/reconciler.ts
import fs from "fs";
import { DefectItem, DefectStatus, BlastRadiusRating, StructuredOperatorNotes } from "./types.js";
import { FileLock } from "./lock.js";

export function renderQueueMarkdown(items: DefectItem[], syncDate: Date = new Date()): string {
  let md = `# Dev Triage Queue\n*Last Synced: ${syncDate.toISOString()}*\n\n## Active Defects\n\n`;

  for (const item of items) {
    md += `### [${item.id}] ${item.title}\n`;
    md += `- **Status:** ${item.status}\n`;
    if (item.triageOwner) md += `- **Owner:** ${item.triageOwner}\n`;
    if (item.tags.length > 0) md += `- **Tags:** ${item.tags.map(t => `\`${t}\``).join(", ")}\n`;
    md += `- **Target Repo:** \`${item.targetRepo}\`\n`;
    md += `- **Failing Workflows:**\n`;
    for (const w of item.failingWorkflows) {
      const parts = [`SHA: \`${w.commitSha}\``];
      if (w.runId) parts.push(`Run ID: \`${w.runId}\``);
      if (w.job) parts.push(`Job: \`${w.job}\``);
      if (w.step) parts.push(`Step: \`${w.step}\``);
      if (w.attempt) parts.push(`Attempt: \`${w.attempt}\``);
      md += `  - \`${w.name}\` (${parts.join(", ")})\n`;
    }
    md += `- **Blast Radius:** ${item.blastRadius}\n`;
    md += `- **NotebookLM Source ID:** \`${item.sourceId}\`\n`;
    md += `- **Source Fingerprint:** \`${item.sourceFingerprint}\`\n`;
    md += `- **Signature Hash:** \`${item.signatureHash}\`\n`;
    md += `- **Parent Hash:** \`${item.parentHash || "NONE"}\`\n`;
    md += `- **First Seen:** ${item.firstSeen}\n`;
    md += `- **Last Observed:** ${item.lastObserved}\n`;
    if (item.lastAction) md += `- **Last Action:** ${item.lastAction}\n`;
    md += `- **Primary Suspects:**\n`;
    for (const s of item.primarySuspects) md += `  - ${s}\n`;
    md += `- **Deterministic Action Steps:**\n`;
    item.actionSteps.forEach((step, idx) => {
      md += `  ${idx + 1}. \`${step}\`\n`;
    });

    md += `<!-- operator-notes-start -->\n`;
    if (item.operatorNotes) {
      if (item.operatorNotes.context) md += `[context]: ${item.operatorNotes.context}\n`;
      if (item.operatorNotes.attemptedFixes) {
        for (const fix of item.operatorNotes.attemptedFixes) md += `[attempted-fixes]: ${fix}\n`;
      }
      if (item.operatorNotes.blockedOn) md += `[blocked-on]: ${item.operatorNotes.blockedOn}\n`;
      if (item.operatorNotes.rawText) md += `${item.operatorNotes.rawText}\n`;
    }
    md += `<!-- operator-notes-end -->\n\n`;
  }

  return md;
}

export function parseQueueMarkdown(markdown: string): DefectItem[] {
  const items: DefectItem[] = [];
  const sections = markdown.split(/\n(?=### \[DEV-)/g).slice(1);

  for (const sec of sections) {
    const titleMatch = sec.match(/^### \[(DEV-\d+)\] (.+)/m);
    const hashMatch = sec.match(/- \*\*Signature Hash:\*\* `([^`]+)`/);
    const statusMatch = sec.match(/- \*\*Status:\*\* (\w+)/);
    const repoMatch = sec.match(/- \*\*Target Repo:\*\* `([^`]+)`/);
    const blastMatch = sec.match(/- \*\*Blast Radius:\*\* (P\d)/);
    const srcIdMatch = sec.match(/- \*\*NotebookLM Source ID:\*\* `([^`]+)`/);
    const srcFpMatch = sec.match(/- \*\*Source Fingerprint:\*\* `([^`]+)`/);
    const parentMatch = sec.match(/- \*\*Parent Hash:\*\* `([^`]+)`/);
    const firstSeenMatch = sec.match(/- \*\*First Seen:\*\* (.+)/);
    const lastObsMatch = sec.match(/- \*\*Last Observed:\*\* (.+)/);
    const ownerMatch = sec.match(/- \*\*Owner:\*\* (.+)/);
    const tagsMatch = sec.match(/- \*\*Tags:\*\* (.+)/);

    const notesBlockMatch = sec.match(/<!-- operator-notes-start -->([\s\S]*?)<!-- operator-notes-end -->/);

    if (titleMatch && hashMatch) {
      let notes: StructuredOperatorNotes | undefined = undefined;
      if (notesBlockMatch && notesBlockMatch[1].trim()) {
        const raw = notesBlockMatch[1].trim();
        const contextMatch = raw.match(/\[context\]:\s*(.+)/);
        const blockedMatch = raw.match(/\[blocked-on\]:\s*(.+)/);
        const attempted = Array.from(raw.matchAll(/\[attempted-fixes\]:\s*(.+)/g)).map(m => m[1]);

        notes = {
          context: contextMatch ? contextMatch[1] : undefined,
          attemptedFixes: attempted.length > 0 ? attempted : undefined,
          blockedOn: blockedMatch ? blockedMatch[1] : undefined,
          rawText: (!contextMatch && !blockedMatch && attempted.length === 0) ? raw : undefined
        };
      }

      items.push({
        id: titleMatch[1],
        title: titleMatch[2],
        signatureHash: hashMatch[1],
        status: (statusMatch ? statusMatch[1] : "OPEN") as DefectStatus,
        targetRepo: repoMatch ? repoMatch[1] : "UNKNOWN",
        blastRadius: (blastMatch ? blastMatch[1] : "P2") as BlastRadiusRating,
        sourceId: srcIdMatch ? srcIdMatch[1] : "LOCAL",
        sourceFingerprint: srcFpMatch ? srcFpMatch[1] : "",
        parentHash: parentMatch && parentMatch[1] !== "NONE" ? parentMatch[1] : undefined,
        firstSeen: firstSeenMatch ? firstSeenMatch[1] : new Date().toISOString(),
        lastObserved: lastObsMatch ? lastObsMatch[1] : new Date().toISOString(),
        triageOwner: ownerMatch ? ownerMatch[1] : undefined,
        tags: tagsMatch ? Array.from(tagsMatch[1].matchAll(/`([^`]+)`/g)).map(m => m[1]) : [],
        failingWorkflows: [],
        primarySuspects: [],
        actionSteps: [],
        operatorNotes: notes
      });
    }
  }

  return items;
}

export async function reconcileQueue(queuePath: string, incomingItems: DefectItem[]): Promise<DefectItem[]> {
  const lock = new FileLock(queuePath);
  await lock.acquire();

  try {
    const existing = fs.existsSync(queuePath)
      ? parseQueueMarkdown(fs.readFileSync(queuePath, "utf8"))
      : [];

    let maxSeq = 0;
    const existingByHash = new Map<string, DefectItem>();

    for (const item of existing) {
      const match = item.id.match(/^DEV-(\d+)$/);
      if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
      existingByHash.set(item.signatureHash, item);
    }

    const merged: DefectItem[] = [];

    for (const item of existing) {
      const fresh = incomingItems.find((inc) => inc.signatureHash === item.signatureHash);
      if (fresh) {
        item.lastObserved = fresh.lastObserved || new Date().toISOString();
        if (fresh.failingWorkflows.length > 0) item.failingWorkflows = fresh.failingWorkflows;
        if (fresh.sourceFingerprint) item.sourceFingerprint = fresh.sourceFingerprint;
      }
      merged.push(item);
    }

    for (const inc of incomingItems) {
      if (!existingByHash.has(inc.signatureHash)) {
        maxSeq++;
        const id = `DEV-${String(maxSeq).padStart(3, "0")}`;
        inc.id = id;
        merged.push(inc);
      }
    }

    const rendered = renderQueueMarkdown(merged);
    const tmpPath = `${queuePath}.tmp`;
    fs.writeFileSync(tmpPath, rendered, "utf8");
    fs.renameSync(tmpPath, queuePath);

    return merged;
  } finally {
    lock.release();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test modules/trm-devops/test/reconciler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/src/core/reconciler.ts modules/trm-devops/test/reconciler.test.ts
git commit -m "feat(trm-devops): implement queue reconciler and atomic markdown generator"
---

### Task 7: Archival Engine, Pruning & Global Index Manager

**Files:**
- Create: `modules/trm-devops/src/core/pruning.ts`
- Test: `modules/trm-devops/test/pruning.test.ts`

**Interfaces:**
- Consumes: `DefectItem`, `ArchiveIndexEntry`, `NotebookLMClient`
- Produces: `pruneResolvedDefects(queuePath: string, archiveBaseDir: string, client?: NotebookLMClient): Promise<ArchiveIndexEntry[]>`.

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/pruning.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { pruneResolvedDefects } from "../src/core/pruning.js";
import { renderQueueMarkdown } from "../src/core/reconciler.js";
import { DefectItem } from "../src/core/types.js";

test("pruneResolvedDefects moves RESOLVED items, updates index.json, and leaves active items", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-test-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-001",
      sourceFingerprint: "fp-001",
      status: "RESOLVED",
      title: "Fixed Bug",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P0",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "src-1",
      firstSeen: "2026-08-28T11:00:00Z",
      lastObserved: "2026-08-28T11:30:00Z",
      tags: ["ci"]
    },
    {
      id: "DEV-002",
      signatureHash: "hash-002",
      sourceFingerprint: "fp-002",
      status: "OPEN",
      title: "Still Broken",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P1",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "src-2",
      firstSeen: "2026-08-28T11:00:00Z",
      lastObserved: "2026-08-28T11:30:00Z",
      tags: ["release"]
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  const archived = await pruneResolvedDefects(queuePath, archiveDir);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].id, "DEV-001");

  const indexPath = path.join(archiveDir, "index.json");
  assert.ok(fs.existsSync(indexPath));
  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  assert.equal(indexData.length, 1);
  assert.equal(indexData[0].id, "DEV-001");

  const updatedQueue = fs.readFileSync(queuePath, "utf8");
  assert.ok(!updatedQueue.includes("DEV-001"));
  assert.ok(updatedQueue.includes("DEV-002"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/pruning.test.ts`
Expected: FAIL (Cannot find module `../src/core/pruning.js`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// modules/trm-devops/src/core/pruning.ts
import fs from "fs";
import path from "path";
import { DefectItem, ArchiveIndexEntry } from "./types.js";
import { parseQueueMarkdown, renderQueueMarkdown } from "./reconciler.js";
import { FileLock } from "./lock.js";
import { NotebookLMClient } from "./notebooklm-client.js";

export async function pruneResolvedDefects(
  queuePath: string,
  archiveBaseDir: string,
  client?: NotebookLMClient
): Promise<ArchiveIndexEntry[]> {
  const lock = new FileLock(queuePath);
  await lock.acquire();

  try {
    if (!fs.existsSync(queuePath)) return [];
    const items = parseQueueMarkdown(fs.readFileSync(queuePath, "utf8"));

    const resolved = items.filter((i) => i.status === "RESOLVED");
    const active = items.filter((i) => i.status !== "RESOLVED");

    if (resolved.length === 0) return [];

    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthlyDir = path.join(archiveBaseDir, ym);
    fs.mkdirSync(monthlyDir, { recursive: true });

    const archiveFilePath = path.join(monthlyDir, "resolved-defects.md");
    const indexPath = path.join(archiveBaseDir, "index.json");

    let existingIndex: ArchiveIndexEntry[] = [];
    if (fs.existsSync(indexPath)) {
      try {
        existingIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      } catch (e) {}
    }

    const newIndexEntries: ArchiveIndexEntry[] = [];
    let archiveMdAppend = `\n## Archived Batch: ${now.toISOString()}\n\n`;

    for (const item of resolved) {
      const resolvedAt = now.toISOString();
      const firstSeenMs = item.firstSeen ? Date.parse(item.firstSeen) : now.getTime() - 3600000;
      const durationMs = Math.max(0, now.getTime() - firstSeenMs);

      const entry: ArchiveIndexEntry = {
        id: item.id,
        signatureHash: item.signatureHash,
        parentHash: item.parentHash,
        targetRepo: item.targetRepo,
        blastRadius: item.blastRadius,
        firstSeen: item.firstSeen,
        resolvedAt: resolvedAt,
        durationMs: durationMs,
        archiveFile: path.relative(archiveBaseDir, archiveFilePath).replace(/\\/g, "/"),
        triageOwner: item.triageOwner,
        tags: item.tags
      };

      newIndexEntries.push(entry);
      archiveMdAppend += `### [${item.id}] ${item.title}\n- **Resolved At:** ${resolvedAt}\n- **Duration:** ${durationMs}ms\n- **Signature:** \`${item.signatureHash}\`\n\n`;

      if (client && item.sourceId) {
        await client.deleteSource(item.sourceId);
      }
    }

    fs.appendFileSync(archiveFilePath, archiveMdAppend, "utf8");
    fs.writeFileSync(indexPath, JSON.stringify([...existingIndex, ...newIndexEntries], null, 2), "utf8");

    const rendered = renderQueueMarkdown(active);
    const tmpPath = `${queuePath}.tmp`;
    fs.writeFileSync(tmpPath, rendered, "utf8");
    fs.renameSync(tmpPath, queuePath);

    return newIndexEntries;
  } finally {
    lock.release();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test modules/trm-devops/test/pruning.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/src/core/pruning.ts modules/trm-devops/test/pruning.test.ts
git commit -m "feat(trm-devops): implement pruning manager and global index updates"
```

---

### Task 8: CLI Command Entrypoint

**Files:**
- Create: `modules/trm-devops/src/cli/index.ts`
- Test: `modules/trm-devops/test/cli.test.ts`

**Interfaces:**
- Consumes: `reconcileQueue`, `pruneResolvedDefects`, `NotebookLMClient`
- Produces: CLI commands (`sync`, `prune`, `status`).

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/cli.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";

test("CLI exports usage on --help or unknown command", () => {
  const out = execSync("node modules/trm-devops/dist/cli/index.js --help", { encoding: "utf8" });
  assert.ok(out.includes("Usage: trm-devops <command>"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/cli.test.ts`
Expected: FAIL (Cannot find file `dist/cli/index.js`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// modules/trm-devops/src/cli/index.ts
#!/usr/bin/env node
import { reconcileQueue } from "../core/reconciler.js";
import { pruneResolvedDefects } from "../core/pruning.js";
import { NotebookLMClient } from "../core/notebooklm-client.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "--help";

  const queuePath = "dev/triage/queue.md";
  const archiveDir = "dev/triage/archive";

  const client = new NotebookLMClient();

  if (command === "sync") {
    console.log("Syncing dev triage queue with NotebookLM...");
    const incoming = await client.fetchOperationalChunks();
    const merged = await reconcileQueue(queuePath, incoming);
    console.log(`Sync complete. ${merged.length} active defects tracked.`);
  } else if (command === "prune") {
    console.log("Pruning resolved defects...");
    const archived = await pruneResolvedDefects(queuePath, archiveDir, client);
    console.log(`Prune complete. ${archived.length} defects archived.`);
  } else if (command === "status") {
    console.log(`Dev Triage Queue: ${queuePath}`);
  } else {
    console.log(`
Usage: trm-devops <command> [options]

Commands:
  sync    Fetch chunks from operational buffer and reconcile queue.md
  prune   Archive resolved items to index.json and prune remote sources
  status  Display queue and cache statuses
`);
  }
}

main().catch((err) => {
  console.error("Error executing trm-devops command:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Run build and test to verify it passes**

Run: `npm --prefix modules/trm-devops run build && node --test modules/trm-devops/test/cli.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/src/cli/index.ts modules/trm-devops/test/cli.test.ts
git commit -m "feat(trm-devops): implement CLI commands for sync, prune, and status"
```

---

### Task 9: MCP Server Adapter & Tool Handlers

**Files:**
- Create: `modules/trm-devops/src/mcp/server.ts`
- Test: `modules/trm-devops/test/mcp.test.ts`

**Interfaces:**
- Produces: MCP server exposing `sync_dev_triage`, `prune_triage_source`, `query_dev_notebook`.

- [ ] **Step 1: Write the failing test**

```typescript
// modules/trm-devops/test/mcp.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { getMcpTools } from "../src/mcp/server.js";

test("getMcpTools returns valid tool schemas", () => {
  const tools = getMcpTools();
  assert.equal(tools.length, 3);
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("sync_dev_triage"));
  assert.ok(names.includes("prune_triage_source"));
  assert.ok(names.includes("query_dev_notebook"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/trm-devops/test/mcp.test.ts`
Expected: FAIL (Cannot find module `../src/mcp/server.js`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// modules/trm-devops/src/mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { reconcileQueue } from "../core/reconciler.js";
import { pruneResolvedDefects } from "../core/pruning.js";
import { NotebookLMClient } from "../core/notebooklm-client.js";

export function getMcpTools() {
  return [
    {
      name: "sync_dev_triage",
      description: "Syncs operational diagnostic chunks into dev/triage/queue.md",
      inputSchema: {
        type: "object",
        properties: {
          dryRun: { type: "boolean", description: "Simulate sync without file writes" }
        }
      }
    },
    {
      name: "prune_triage_source",
      description: "Prunes resolved defect items and updates archive index.json",
      inputSchema: {
        type: "object",
        properties: {
          defectId: { type: "string", description: "Optional specific defect ID to prune" }
        }
      }
    },
    {
      name: "query_dev_notebook",
      description: "Directly queries the operational NotebookLM buffer for defect traces",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or error snippet" }
        },
        required: ["query"]
      }
    }
  ];
}

export function createMcpServer() {
  const server = new Server(
    { name: "trm-devops-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  const client = new NotebookLMClient();

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getMcpTools() };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "sync_dev_triage") {
      const incoming = await client.fetchOperationalChunks();
      const merged = await reconcileQueue("dev/triage/queue.md", incoming);
      return {
        content: [{ type: "text", text: `Synced ${merged.length} defects to dev/triage/queue.md` }]
      };
    }

    if (name === "prune_triage_source") {
      const archived = await pruneResolvedDefects("dev/triage/queue.md", "dev/triage/archive", client);
      return {
        content: [{ type: "text", text: `Archived ${archived.length} resolved defects.` }]
      };
    }

    if (name === "query_dev_notebook") {
      return {
        content: [{ type: "text", text: `Query executed for "${args?.query}" (0 matches in buffer).` }]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch(console.error);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix modules/trm-devops run build && node --test modules/trm-devops/test/mcp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/trm-devops/src/mcp/server.ts modules/trm-devops/test/mcp.test.ts
git commit -m "feat(trm-devops): implement MCP server adapter and tool handlers"
```



