# Multi-Agent Memory Synchronization to Obsidian Vault

**Status:** Ready for Implementation  
**Date:** 2026-09-12  
**Target:** Toolforge Multi-Agent Ecosystem (`sync-tools/agent-memory/`)  

---

## 1. Objective

Provide an automated, idempotent synchronization engine that connects all active and future coding agents (Claude Code, Antigravity, OpenAI Codex, Grok/Sigil Bridge, and Local Models) to the canonical Obsidian Vault.

The utility ensures prompt-zero alignment on architecture indexes, wiki conventions, and log audit trails without manual configuration, preventing agent memory amnesia and hallucinated structures across workspaces.

---

## 2. Path Resolution & Vault Configuration

### 2.1 Dynamic Root Resolution Algorithm
1. **Environment Override:** If `process.env.OBSIDIAN_VAULT_ROOT` is defined:
   - Handle tilde expansion: bare `~`, `~/...`, or `~\...` expand to `os.homedir()`. Reject unsupported POSIX `~username` syntax.
   - Resolve to absolute path (`path.resolve()`).
2. **Dynamic Fallback Discovery:**
   - Resolve relative to `process.env.TOOLFORGE_ROOT` or the nearest repository root enclosing `process.cwd()`:
   - Search `<repoRoot>/kb-sync/obsidian/vault/wiki` -> `<repoRoot>/../kb-sync/obsidian/vault/wiki`.
   - If not found, check platform default paths:
     - Windows: `path.join(process.env.SystemDrive || 'C:', 'dev', 'kb-sync', 'obsidian', 'vault', 'wiki')`
     - POSIX: `path.join(os.homedir(), 'dev', 'kb-sync', 'obsidian', 'vault', 'wiki')`
3. **Canonical Subtree Guard:**
   - If resolved directory basename is not `wiki`, append `wiki` only if `path.join(resolvedPath, 'wiki')` exists. Prevents duplicate `/wiki/wiki` appending.

### 2.2 Strict Fail-Closed Validation
- **Existence & Type:** Target must exist and be a directory (`fs.statSync().isDirectory()`).
- **Sentinel Verification:** Target directory must contain canonical entrypoints (`Index.md` or `Log.md`).
- **Fail-Closed Guarantee:** If validation fails, abort immediately with exit code 1 and error code `ERR_VAULT_NOT_FOUND`. No force bypass is permitted to target non-existent or invalid vault paths.

---

## 3. Architecture & Directory Layout

The tool is implemented as a modular Node.js/CommonJS engine in Toolforge with an extensible adapter pattern:

```
sync-tools/
├── agent-memory-sync.cjs             # CLI orchestrator & workspace resolver
├── lib/
│   ├── managed-region.cjs            # Safe block parser, marker injector & CRLF handler
│   ├── json-region.cjs               # Indentation-aware, BOM-free JSON mutator
│   ├── vault-context.cjs             # Vault path resolver & sentinel validator
│   ├── workspace-discovery.cjs       # Recursive scanner with deterministic ignore sets
│   ├── safe-write.cjs                # Windows-safe atomic write with rollback & fsync
│   └── base-adapter.cjs              # Abstract base class & receipt contract
└── adapters/
    ├── claude-code.cjs               # ~/.claude/projects/<sanitized>/memory/MEMORY.md
    ├── antigravity.cjs               # GEMINI.md / AGENTS.md managed pointer block
    ├── codex.cjs                     # codex/AGENTS.md / CODEX.md managed pointer block
    ├── grok.cjs                      # .sigil/grok-context.md context stub
    ├── local-models.cjs              # opencode.json & .local-agent-context.md
    └── index.cjs                     # Adapter registry loader
```

---

## 4. Agent Adapters & Target Governance Contracts

### 4.1 Base Adapter Contract (`BaseAgentAdapter`) & Receipt Schema
All adapters subclass `BaseAgentAdapter`. The `sync()` method returns an array of deterministic receipts:

```javascript
/**
 * @typedef {Object} SyncReceipt
 * @property {string} adapter - Identifier of the executing adapter
 * @property {string} targetFile - Absolute, canonical path to the mutated file
 * @property {'CREATED'|'UPDATED'|'UNCHANGED'|'SKIPPED'|'ERROR'} status
 * @property {boolean} changesMade - True if file content was modified
 * @property {string} [errorCode] - e.g. 'ERR_FILE_LOCKED', 'ERR_PARSE_JSON', 'ERR_BOUNDARY_VIOLATION'
 * @property {string} [error] - Descriptive error message
 */
```

- **Ordering Invariant:** Receipts are deterministically sorted by `targetFile` path.
- **Exit Code Policy:** If any receipt has status `ERROR`, the CLI terminates with exit code 1.

### 4.2 Target Write Governance & Boundary Rules

| Adapter | Target Path | Boundary Category | Governance Rule |
|---|---|---|---|
| `ClaudeCodeAdapter` | `~/.claude/projects/<sanitized>/memory/MEMORY.md` | Internal State | Create/Update freely in user home directory. |
| `AntigravityAdapter` | `GEMINI.md`, `AGENTS.md` | Governed File | Update managed region ONLY if file already exists; never create unmanaged root files. |
| `CodexAdapter` | `codex/AGENTS.md`, `CODEX.md` | Governed File | Update managed region ONLY if file already exists. |
| `GrokAdapter` | `.sigil/grok-context.md` | Internal State | Create/Update only if `.sigil/` directory exists. |
| `LocalModelAdapter` | `opencode.json` | Governed Config | Update JSON property ONLY if `opencode.json` exists in workspace root. |
| `LocalModelAdapter` | `.local-agent-context.md` | Internal State | Create/Update pointer stub. |

### 4.3 Claude Code Path Sanitization Specification
Deterministic encoding algorithm:
```javascript
function encodeWorkspaceKey(targetPath) {
  const resolved = path.resolve(targetPath);
  return resolved
    .replace(/^([a-zA-Z]):/, (_, drive) => `${drive.toUpperCase()}-`)
    .replace(/^\\\\/, 'UNC--')
    .replace(/[^a-zA-Z0-9]/g, '-');
}
```
- Example Windows drive: `C:\dev\sigil-repo` -> `C--dev-sigil-repo`
- Example UNC path: `\\server\share\repo` -> `UNC--server-share-repo`
- Example POSIX path: `/home/user/dev/repo` -> `-home-user-dev-repo`

---

## 5. Mutation Strategies, File Encodings & Atomic Write Safety

### 5.1 Markdown Managed Regions (`managed-region.cjs`)
- **Marker Standard:**
```markdown
<!-- TOOLFORGE-VAULT-POINTER-START -->
# Persistent System Memory Pointer
> Managed by Toolforge sync-tools. Auto-generated on sync. DO NOT manually edit this block.
- Canonical Knowledge Base Root: <VaultRoot>
- Ingest Guidelines: docs/targets/obsidian.md
- Primary Architecture Graph: [[Index]]
- Active Conventions: [[wiki-schema]]
- Log Audit Trail: [[Log]]
- Repository Target: <WorkspaceName>
<!-- TOOLFORGE-VAULT-POINTER-END -->
```
- **Line Ending & UTF-8 Policy:**
  - Detects CRLF (`\r\n`) vs LF (`\n`) from existing file; defaults to platform newline for new files.
  - Strips UTF-8 BOM on input; outputs UTF-8 without BOM.
  - Guarantees exactly one trailing newline at EOF.
  - Collapses duplicate or broken marker tags into a single canonical block.

### 5.2 JSON Mutation Strategy (`json-region.cjs`)
- **Indentation & Formatting Contract:**
  - Detects indentation style (spaces vs tabs, default 2 spaces).
  - Preserves key ordering and valid JSON syntax.
  - Injects vault context under namespace `toolforge_memory`.
  - Preserves detected CRLF/LF line endings and trailing newline.

### 5.3 Windows-Safe Atomic Replacement (`safe-write.cjs`)
1. Write payload to temporary file `<target>.tmp.<pid>.<timestamp>` in target's parent directory.
2. Flush to disk via `fs.fsyncSync(fd)` to guarantee persistence.
3. If destination exists, create backup `<target>.bak.<pid>`.
4. Attempt `fs.renameSync(tempFile, targetFile)`.
5. On Windows retryable lock errors (`EPERM`, `EBUSY`, `EEXIST`):
   - Retry with exponential backoff (3 attempts: 50ms, 100ms, 200ms).
   - If rename still fails, fallback to `fs.copyFileSync(tempFile, targetFile)`.
6. Verify written file byte length matches source buffer.
7. Unlink backup and temporary files in `finally` block; on unrecoverable failure, restore from `.bak`.

---

## 6. Deterministic Workspace Discovery & Ignore Rules

### 6.1 Discovery Precedence
1. **Explicit Target:** Single CLI argument `node sync-tools/agent-memory-sync.cjs <path>`.
2. **Registry Targets:** Repositories listed in `sync-tools/repo-registry.json`.
3. **Filesystem Walk (`--all`):** Scans directories under base root (default `C:\dev` or detected root).

### 6.2 Deterministic Exclusion Set
During recursive directory traversal, ignore any directory whose normalized basename matches:
- **VCS & Repos:** `.git`, `.worktrees`, `.hg`, `.svn`
- **Dependencies:** `node_modules`, `vendor`, `.pnpm-store`
- **Staging & Build:** `_archive`, `.cache`, `dist`, `build`, `.tmp`, `_kb-sync-staging`, `sync-artifacts`, `coverage`, `target`

- **Symlink / Junction Cycle Prevention:** Resolves realpaths via `fs.realpathSync` and maintains a `Set<string>` of visited inode/path keys.

---

## 7. Agent Onboarding Process & Extensibility Runbook

To onboard any new agent harness (e.g., Cursor, Windsurf, Devin, or bespoke local orchestrators):

1. **Create Adapter Module (`sync-tools/adapters/<agent-name>.cjs`)**:
   - Subclass `BaseAgentAdapter` from `../lib/base-adapter.cjs`.
   - Implement `sync(workspaceContext, vaultContext, options)` returning `Promise<Array<SyncReceipt>>`.
2. **Register in Adapter Registry (`sync-tools/adapters/index.cjs`)**:
   - Add adapter instance to registry export.
3. **Add Verification Suite (`tests/adapters/<agent-name>.test.mjs`)**:
   - Test path resolution, target mutation, and idempotency.
4. **Execute Verification**:
   - Run `node sync-tools/agent-memory-sync.cjs --agent <agent-name> --dry-run`.

---

## 8. Visual Specifications (Cathryn Lavery Standard)

Visual specifications are generated using the canonical warm palette (`#f2ece2` paper, `#2c2420` ink, `#c4501a` terracotta accent, Barlow Condensed / Playfair Display typography) via `diagram-tools.mjs`:
- **Architecture Topology:** `docs/superpowers/specs/assets/agent-memory-sync-topology.html` -> `.png`
- **Onboarding Flowchart:** `docs/superpowers/specs/assets/agent-onboarding-flow.html` -> `.png`

---

## 9. Comprehensive Test & Acceptance Matrix

1. **Unit Tests (`tests/agent-memory-sync.test.mjs`):**
   - **Path Sanitization Matrix:** Table tests covering Windows drive paths, UNC shares, POSIX paths, spaces, dots, and hyphens.
   - **Vault Path & Sentinel Matrix:** Missing vault, empty vault, non-wiki root, tilde expansion (`~`, `~/path`, `~\path`), and `~user` rejection.
   - **CRLF/LF & BOM Matrix:** Preserves CRLF on Windows files, preserves LF on POSIX files, strips input BOM, verifies zero output BOM.
   - **JSON Format Matrix:** Validates `opencode.json` indentation preservation, key order preservation, and syntax validity.
   - **Atomic Replacement & Rollback:** Simulates write failures and verifies rollback recovery from `.bak`.
   - **Exclusion Matrix:** Verifies recursive walk skips `node_modules`, `_kb-sync-staging`, and `.worktrees`.
2. **Acceptance Smoke Test:**
   - Execute against `C:\dev` and `C:\dev\sigil-repo`.
   - Submit final code and test outputs to OpenAI Codex (`codex exec`) for automated second-opinion review prior to landing.
