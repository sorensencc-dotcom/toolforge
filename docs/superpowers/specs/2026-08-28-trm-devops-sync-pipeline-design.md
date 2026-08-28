# TRM DevOps Sync & Triage Pipeline Design Specification

## Overview
This specification details the architecture, extraction contracts, data schemas, and lifecycle reconciler for adapting the Topic Research Mining (TRM) pattern to development operations. The pipeline ingests unstructured diagnostic logs, failure threads, and CI/CD traces into a NotebookLM operational buffer (`[Open Dev Issues]`), executes deterministic extraction queries, and reconciles the results into local, actionable Markdown artifacts (`dev/triage/queue.md` and `dev/triage/archive/`).

---

## Architecture & System Topology

The pipeline uses a headless core engine with dual entrypoints (CLI and MCP Server) to support both automated terminal scripting and interactive AI agent workflows.

```
                      ┌─────────────────────────────────────────┐
                      │            NotebookLM Corpus            │
                      │       "Open Dev Issues" (Buffer)        │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │            Shared Core Engine           │
                      │       (modules/trm-devops/src/core)     │
                      │  • NotebookLM API / Adapter Client      │
                      │  • Zero-Hallucination Extractor         │
                      │  • Cross-Platform Error Normalizer      │
                      │  • Atomic Markdown Queue Reconciler     │
                      │  • Source Lifecycle & Pruning Manager   │
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
                      │  • Dead-letter: dev/triage/.cache/      │
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
│   │   ├── reconciler.ts            # Markdown state merge & atomic file writer
│   │   ├── pruning.ts               # Source deletion & archival coordinator
│   │   └── notebooklm-client.ts     # NotebookLM API/automation bridge
│   ├── cli/
│   │   └── index.ts                 # CLI command handler (sync, prune, status)
│   └── mcp/
│       └── server.ts                # MCP tool definitions and server listener
└── test/
    ├── normalizer.test.ts           # Hash stability & cross-platform sanitization tests
    ├── extractor.test.ts            # Chunk validation & dead-letter quarantine tests
    ├── reconciler.test.ts           # State preservation, merge & atomic write tests
    └── pruning.test.ts              # Archival rollover & source deletion tests
```

---

## Data Models & Extraction Contract

### 1. TypeScript Interface (`src/core/types.ts`)

```typescript
export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'MUTED';
export type BlastRadiusRating = 'P0' | 'P1' | 'P2';

export interface FailingWorkflow {
  name: string;
  commitSha: string;
}

export interface DefectItem {
  id: string;                      // Stable identifier (e.g., "DEV-001")
  signatureHash: string;          // Deterministic SHA-256 of normalized error string
  status: DefectStatus;           // Lifecycle state
  title: string;                  // Verbatim concise defect summary
  targetRepo: string;             // Exact repository name or "UNKNOWN"
  failingWorkflows: FailingWorkflow[];
  blastRadius: BlastRadiusRating; // Impact classification
  primarySuspects: string[];      // Root cause hypotheses grounded in traces
  actionSteps: string[];          // Verbatim reproduction and diagnostic commands
  sourceId: string;               // NotebookLM source UUID
  firstSeen: string;              // ISO-8601 creation timestamp
  lastObserved: string;           // ISO-8601 latest observation timestamp
  operatorNotes?: string;         // Preserved human notes and annotations
}

export interface SyncOptions {
  dryRun?: boolean;
  maxUnparsedQuarantine?: number; // Default: 50
  queuePath?: string;             // Default: "dev/triage/queue.md"
  archiveDir?: string;           // Default: "dev/triage/archive"
}
```

### 2. Normalization & Signature Hashing (`src/core/normalizer.ts`)
To ensure idempotent deduplication across noisy CI runs:
1. Strip ISO-8601 timestamps, millisecond durations, and Unix epochs (`2026-08-28T11:34:25Z`, `145.2ms`, `1724844865`).
2. Strip ephemeral runner identifiers and container prefixes (`runner-.*`, `container_[a-zA-Z0-9_-]+`, PID tokens).
3. Standardize file path separators (`\` normalized to `/`) and strip local user directory prefixes (`C:/Users/...` and `/home/runner/work/...`).
4. Strip ANSI escape codes (`\x1b[[0-9;]*m`).
5. Compute SHA-256 over the sanitized string.

### 3. Extraction Prompt Contract
When querying the NotebookLM operational buffer, the extractor injects explicit prompt constraints:
* Extract exact commit SHAs, file paths, and error messages without paraphrasing.
* Omit missing fields or populate `"UNKNOWN"` rather than inferring repository names.
* Format output strictly as a JSON array of `DefectItem` objects.

---

## Local Markdown Schema & Reconciler

### Target Schema: `dev/triage/queue.md`

```markdown
# Dev Triage Queue
*Last Synced: YYYY-MM-DD HH:mm:ss*

## Active Defects

### [DEV-001] CI/CD Failure across main and feat/openrouter-oxalpha-integration
- **Status:** OPEN
- **Target Repo:** `sorensencc-dotcom/toolforge`
- **Failing Workflows:** Governance (`543b2e2`), Toolforge Release (`0825b92`), Wave D Gate (`0825b92`)
- **Blast Radius:** P0
- **NotebookLM Source ID:** `799f2eb8`
- **Signature Hash:** `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- **First Seen:** 2026-08-28T11:30:00Z
- **Last Observed:** 2026-08-28T11:45:00Z
- **Primary Suspects:**
  - Strict branch lint or policy violation on `feat/`
  - Token scope starvation on release runner
- **Deterministic Action Steps:**
  1. `gh run view --repo sorensencc-dotcom/toolforge --log-failed`
  2. `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\sigil-repo`
<!-- operator-notes-start -->
- Manual Note: Investigating token permission discrepancy on workflow runner.
<!-- operator-notes-end -->
```

### Reconciler Invariants (`src/core/reconciler.ts`)
1. **Atomic Writes**: Writes changes to `dev/triage/queue.md.tmp` and executes an atomic file rename to prevent file corruption during sudden terminations.
2. **State Preservation**: Matches entries on `signatureHash`. Preserves user edits in `Status` (`OPEN`, `IN_PROGRESS`, `MUTED`), manual comments, and content enclosed in `<!-- operator-notes-start -->...<!-- operator-notes-end -->`.
3. **Novel Entry Identification**: Assigns monotonic IDs (`DEV-001`, `DEV-002`) to novel hashes, setting `status: OPEN`.
4. **Idempotency**: Running successive sync passes against identical source inputs generates identical Markdown output byte-for-byte.

---

## Lifecycle Pruning & Archival Loop

When an operator marks an item `RESOLVED` in `dev/triage/queue.md` and invokes `prune`:
1. **Archival Target**: The entry is moved from `queue.md` into `dev/triage/archive/YYYY-MM/resolved-defects.md` with resolution metadata (timestamp, final status, and duration). Parent directories are created dynamically if missing.
2. **Remote Deletion**: The engine calls `notebooklmClient.deleteSource(sourceId)` to delete the raw source chunk from the NotebookLM buffer.
3. **Missing Source Tolerance**: If a source ID no longer exists on NotebookLM, the engine logs an informational notice and completes local archival without throwing an unhandled exception.

---

## Error Handling & Dead-Letter Quotas

1. **Fail-Closed Network Handling**: If the NotebookLM API is unreachable or returns authentication errors, the sync operation aborts prior to modifying disk state, leaving `dev/triage/queue.md` intact.
2. **Dead-Letter Chunk Quarantine**: Unparseable or malformed chunk responses are written to `dev/triage/.cache/unparsed-chunks-<timestamp>.json`.
3. **Quarantine Retention Policy**: The cache directory retains up to 50 files or items younger than 7 days, purging older entries automatically during sync.
4. **Dry-Run Guarantee**: Executing `--dry-run` performs no file writes and zero remote source deletions, outputting planned operations directly to stdout.

---

## Verification & Test Strategy

| Test Suite | File | Coverage Invariants |
|---|---|---|
| **Unit** | `normalizer.test.ts` | Cross-platform path normalization (`\` vs `/`), dynamic timestamp sanitization, ANSI stripping, and deterministic SHA-256 outputs. |
| **Unit** | `extractor.test.ts` | Validates JSON schema parsing, handles missing fields with defaults, and routes malformed payloads to `.cache/`. |
| **Unit** | `reconciler.test.ts` | Verifies atomic write mechanics, 10x sync idempotency, preservation of operator notes and status transitions (`IN_PROGRESS`, `MUTED`). |
| **Unit** | `pruning.test.ts` | Verifies monthly archive directory creation, source deletion dispatch, and safe handling of missing remote source IDs. |
| **Integration** | `cli.test.ts` | Validates CLI exit codes, stdout summaries, `--dry-run` invariants, and quarantine limits. |
| **Contract** | `mcp.test.ts` | Asserts MCP tools (`sync_dev_triage`, `prune_triage_source`, `query_dev_notebook`) adhere to MCP specification schemas. |
