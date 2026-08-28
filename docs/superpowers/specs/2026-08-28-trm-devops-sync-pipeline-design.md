# TRM DevOps Sync & Triage Pipeline Design Specification (v1.1)

## Overview
This specification details the architecture, extraction contracts, data schemas, concurrency controls, and lifecycle reconciler for adapting the Topic Research Mining (TRM) pattern to development operations. The pipeline ingests unstructured diagnostic logs, failure threads, and CI/CD traces into a NotebookLM operational buffer (`[Open Dev Issues]`), executes deterministic extraction queries, and reconciles the results into local, actionable Markdown artifacts (`dev/triage/queue.md`, `dev/triage/archive/index.json`, and `dev/triage/archive/`).

---

## Architecture & System Topology

The pipeline uses a headless core engine with dual entrypoints (CLI and MCP Server) to support both automated terminal scripting and interactive AI agent workflows, backed by a local pending buffer and concurrency locking.

```
                      ┌─────────────────────────────────────────┐
                      │            NotebookLM Corpus            │
                      │       "Open Dev Issues" (Buffer)        │
                      └────────────────────┬────────────────────┘
                                           │ (API / Fallback Stream)
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │     Local Fallback / Pending Buffer     │
                      │    (dev/triage/.cache/pending-sync/)    │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │            Shared Core Engine           │
                      │       (modules/trm-devops/src/core)     │
                      │  • NotebookLM Client & Fallback Buffer  │
                      │  • Zero-Hallucination Extractor         │
                      │  • Guardrailed Normalizer (SHA-256)     │
                      │  • Concurrency Lock (queue.md.lock)     │
                      │  • Atomic Markdown Queue Reconciler     │
                      │  • Lineage Tracker & Archive Indexer    │
                      └────────────────────┬────────────────────┘
                                           │
                 ┌─────────────────────────┴─────────────────────────┐
                 ▼                                                   ▼
┌───────────────────────────────────┐               ┌───────────────────────────────────┐
│           CLI Entrypoint          │               │         MCP Server Adapter        │
│  (src/cli/index.ts - npm scripts) │               │   (src/mcp/server.ts - MCP tools) │
│  • dev:triage:sync                │               │   • sync_dev_triage               │
│  • dev:triage:prune               │               │   • prune_triage_source           │
│  • dev:triage:status              │               │   • query_dev_notebook            │
└─────────────────┬─────────────────┘               └─────────────────┬─────────────────┘
                  │                                                   │
                  └─────────────────────────┬─────────────────────────┘
                                            │
                                            ▼
                      ┌─────────────────────────────────────────┐
                      │          Local Execution Layer          │
                      │  • Active: dev/triage/queue.md          │
                      │  • Lock: dev/triage/queue.md.lock       │
                      │  • Index: dev/triage/archive/index.json │
                      │  • Archive: dev/triage/archive/YYYY-MM/ │
                      └─────────────────────────────────────────┘
```

---

## Directory Structure

```
modules/trm-devops/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                     # Core module export surface
│   ├── core/
│   │   ├── types.ts                 # Type definitions & schema interfaces
│   │   ├── normalizer.ts            # Error sanitization & signature hashing
│   │   ├── extractor.ts             # Schema validation & prompt injection
│   │   ├── lock.ts                  # Concurrency file lock & exponential backoff
│   │   ├── reconciler.ts            # Markdown state merge & atomic file writer
│   │   ├── pruning.ts               # Source deletion, archival & index.json updates
│   │   └── notebooklm-client.ts     # NotebookLM API bridge & offline fallback buffer
│   ├── cli/
│   │   └── index.ts                 # CLI command handler (sync, prune, status)
│   └── mcp/
│       └── server.ts                # MCP tool definitions and server listener
└── test/
    ├── normalizer.test.ts           # Hash stability, semantic preservation & sanitization tests
    ├── extractor.test.ts            # Chunk validation & dead-letter quarantine tests
    ├── lock.test.ts                 # Concurrency lock & backoff retry tests
    ├── reconciler.test.ts           # State preservation, merge & atomic write tests
    ├── pruning.test.ts              # Archival rollover, index.json & source deletion tests
    └── fallback.test.ts             # Offline pending-sync buffer recovery tests
```

---

## Data Models & Extraction Contract

### 1. TypeScript Interface (`src/core/types.ts`)

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
  id: string;                          // Stable identifier (e.g., "DEV-001")
  signatureHash: string;              // Deterministic SHA-256 of normalized error string
  parentHash?: string;                // Lineage / regression link to preceding defect
  sourceFingerprint: string;          // Hash of raw NotebookLM input source chunk
  status: DefectStatus;               // Lifecycle state
  title: string;                      // Verbatim concise defect summary
  targetRepo: string;                 // Exact repository name or "UNKNOWN"
  failingWorkflows: FailingWorkflow[];
  blastRadius: BlastRadiusRating;     // Impact classification (P0-P4)
  primarySuspects: string[];          // Root cause hypotheses grounded in traces
  actionSteps: string[];              // Verbatim reproduction and diagnostic commands
  sourceId: string;                   // NotebookLM source UUID
  firstSeen: string;                  // ISO-8601 creation timestamp
  lastObserved: string;               // ISO-8601 latest observation timestamp
  lastAction?: string;                // ISO-8601 timestamp of last operator mutation
  triageOwner?: string;               // Assigned engineer or agent identifier
  tags: string[];                     // Grouping tags (e.g., ["ci", "governance", "auth"])
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
  maxUnparsedQuarantine?: number;     // Default: 50 (dynamic expansion up to 200)
  queuePath?: string;                 // Default: "dev/triage/queue.md"
  archiveDir?: string;               // Default: "dev/triage/archive"
  offlineBufferDir?: string;         // Default: "dev/triage/.cache/pending-sync"
  lockTimeoutMs?: number;            // Default: 5000
}
```

### 2. Normalization Guardrails (`src/core/normalizer.ts`)
To prevent over-normalization and accidental hash collisions:
1. **Strip Execution Metadata Only**: Strips ephemeral log timestamps (line-leading `2026-08-28T11:34:25Z`), runner runtimes (`[145.2ms]`), process IDs (`PID: 1234`), and container UUIDs (`runner-.*`, `container_[a-zA-Z0-9_-]+`).
2. **Preserve Semantic Error Timestamps**: Preserves domain-level time strings inside error payloads (e.g., `"token expired at 2026-08-28"`, `"TTL reached: 3600s"`).
3. **Cross-Platform Path Normalization**: Standardizes file path separators (`\` normalized to `/`) and strips local user directory prefixes (`C:/Users/...` and `/home/runner/work/...`).
4. **Strip ANSI Escape Sequences**: Removes color and terminal styling codes (`\x1b[[0-9;]*m`).
5. **Compute Deterministic SHA-256**: Generates signature hash on the sanitized string.

---

## Concurrency Control & Local Storage

### 1. Concurrency Locking (`src/core/lock.ts`)
To protect against race conditions when CLI syncs and MCP agent tools write simultaneously:
* Creates `dev/triage/queue.md.lock` containing the current process PID and timestamp before reading or modifying `queue.md`.
* If a lock file exists, retries with exponential backoff (initial delay 50ms, jitter $\pm 20\%$, max backoff 2000ms) up to `lockTimeoutMs` (default 5000ms).
* Stale lock detection: If `queue.md.lock` is older than 30 seconds, breaks the lock, logs a warning, and reacquires.
* Releases `queue.md.lock` immediately after the atomic rename of `queue.md.tmp` to `queue.md`.

### 2. Local Fallback Buffer (`src/core/notebooklm-client.ts`)
If the NotebookLM API is offline or returns transient HTTP errors:
* Unprocessed or newly submitted failure logs are staged locally to `dev/triage/.cache/pending-sync/<timestamp>-<hash>.json`.
* On the next sync cycle, the engine drains both `pending-sync/` and remote NotebookLM chunks, merging them idempotently.

---

## Local Markdown Schema & Reconciler

### Target Schema: `dev/triage/queue.md`

```markdown
# Dev Triage Queue
*Last Synced: YYYY-MM-DD HH:mm:ss*

## Active Defects

### [DEV-001] CI/CD Failure across main and feat/openrouter-oxalpha-integration
- **Status:** OPEN
- **Owner:** @developer
- **Tags:** `ci`, `governance`, `release`
- **Target Repo:** `sorensencc-dotcom/toolforge`
- **Failing Workflows:**
  - `Governance` (SHA: `543b2e2`, Run ID: `12345678`, Step: `Pre-Commit Lint`)
  - `Toolforge Release` (SHA: `0825b92`, Attempt: `1`)
- **Blast Radius:** P0
- **NotebookLM Source ID:** `799f2eb8`
- **Source Fingerprint:** `8f4b23a1c9...`
- **Signature Hash:** `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- **Parent Hash:** `NONE`
- **First Seen:** 2026-08-28T11:30:00Z
- **Last Observed:** 2026-08-28T11:45:00Z
- **Last Action:** 2026-08-28T11:46:00Z
- **Primary Suspects:**
  - Strict branch lint or policy violation on `feat/`
  - Token scope starvation on release runner
- **Deterministic Action Steps:**
  1. `gh run view --repo sorensencc-dotcom/toolforge --log-failed`
  2. `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo`
<!-- operator-notes-start -->
[context]: Investigating token permission discrepancy on workflow runner.
[attempted-fixes]: Staged pre-commit policy exemption check.
[blocked-on]: Awaiting release secret propagation in GitHub repository settings.
<!-- operator-notes-end -->
```

### Reconciler Invariants (`src/core/reconciler.ts`)
1. **Atomic Writes**: Writes changes to `dev/triage/queue.md.tmp` and executes an atomic file rename under `queue.md.lock`.
2. **State Preservation**: Matches entries on `signatureHash`. Preserves structured operator notes (`[context]`, `[attempted-fixes]`, `[blocked-on]`), manual ownership, tags, and status transitions (`OPEN`, `IN_PROGRESS`, `MUTED`).
3. **Idempotency**: Running 10 successive sync passes against identical source inputs generates identical Markdown output byte-for-byte.

---

## Archival Engine & Global Indexing (`src/core/pruning.ts`)

When an operator marks an item `RESOLVED` in `dev/triage/queue.md` and invokes `prune`:
1. **Archival Target**: The entry is moved from `queue.md` into `dev/triage/archive/YYYY-MM/resolved-defects.md`.
2. **Global Index Update**: Appends or updates the entry in `dev/triage/archive/index.json`:
   ```json
   {
     "id": "DEV-001",
     "signatureHash": "e3b0c44298fc...",
     "parentHash": null,
     "targetRepo": "sorensencc-dotcom/toolforge",
     "blastRadius": "P0",
     "firstSeen": "2026-08-28T11:30:00Z",
     "resolvedAt": "2026-08-28T12:00:00Z",
     "durationMs": 1800000,
     "archiveFile": "dev/triage/archive/2026-08/resolved-defects.md",
     "triageOwner": "@developer",
     "tags": ["ci", "governance", "release"]
   }
   ```
3. **Remote Source Deletion**: The engine calls `notebooklmClient.deleteSource(sourceId)` to delete the raw source chunk from the NotebookLM buffer.
4. **Missing Source Tolerance**: If a source ID no longer exists on NotebookLM, the engine logs an informational notice and completes local archival without throwing an unhandled exception.

---

## Dead-Letter Quotas & Observability

1. **Quarantine Retention**: Malformed chunks are written to `dev/triage/.cache/unparsed-chunks-<timestamp>.json`.
2. **Dynamic Quota & Compression**: Retains 50 files by default (expanding to 200 if free disk space exceeds 1GB). Automatically compresses chunks older than 7 days into `.gz` archives.
3. **Dry-Run Invariant**: Executing `--dry-run` performs zero file writes and zero remote source deletions, outputting planned actions directly to stdout.

---

## Verification & Test Strategy

| Test Suite | File | Coverage Invariants |
|---|---|---|
| **Unit** | `normalizer.test.ts` | Path normalization (`\` vs `/`), semantic timestamp preservation vs metadata stripping, ANSI stripping, deterministic SHA-256 outputs. |
| **Unit** | `extractor.test.ts` | JSON schema parsing, missing field fallbacks, dead-letter quarantine routing, and source fingerprint generation. |
| **Unit** | `lock.test.ts` | Concurrency lock acquisition, exponential backoff on collision, and stale lock recovery. |
| **Unit** | `reconciler.test.ts` | Atomic writes, 10x idempotency, structured operator notes preservation, lineage links, and status transitions. |
| **Unit** | `pruning.test.ts` | Archive file creation, `index.json` schema updates, source deletion dispatch, and safe handling of missing remote IDs. |
| **Unit** | `fallback.test.ts` | Staging to `pending-sync/` on API outage and automated recovery during next sync cycle. |
| **Integration** | `cli.test.ts` | CLI command exit codes, stdout summaries, `--dry-run` guarantees, and quarantine cleanup limits. |
| **Contract** | `mcp.test.ts` | Verifies MCP tools (`sync_dev_triage`, `prune_triage_source`, `query_dev_notebook`) conform to MCP schemas. |
