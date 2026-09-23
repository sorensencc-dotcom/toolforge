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

### 2.1 Dynamic Root Resolution & Discovery Algorithm
1. **Environment Override:** If `process.env.OBSIDIAN_VAULT_ROOT` is defined:
   - Handle tilde expansion: bare `~`, `~/...`, or `~\...` expand to `os.homedir()`. Reject unsupported POSIX `~username` syntax.
   - Resolve to canonical absolute path (`path.resolve()`).
2. **Dynamic Repository Traversal:**
   - Locate the nearest repository root by starting at `process.cwd()` and walking upward (`dir = path.dirname(dir)`) until encountering `.git` directory or `package.json`, halting at filesystem root.
   - Check `<repoRoot>/kb-sync/obsidian/vault/wiki` and `<repoRoot>/../kb-sync/obsidian/vault/wiki`.
3. **Platform Default Fallbacks:**
   - Windows: `path.join(process.env.SystemDrive || 'C:', 'dev', 'kb-sync', 'obsidian', 'vault', 'wiki')`
   - POSIX / macOS / Linux: `path.join(os.homedir(), 'dev', 'kb-sync', 'obsidian', 'vault', 'wiki')`
4. **Canonical Subtree Guard:**
   - If the resolved path basename is not `wiki`, append `wiki` only if `path.join(resolvedPath, 'wiki')` exists. Prevents duplicate `/wiki/wiki` appending.

### 2.2 Strict Fail-Closed Validation
- **Existence & Type:** Target must exist and be a directory (`fs.statSync(resolvedPath).isDirectory()`).
- **Sentinel Verification:** Target directory must contain canonical entrypoints (`Index.md` or `Log.md`).
- **Fail-Closed Guarantee:** If validation fails, abort immediately with exit code 1 and error code `ERR_VAULT_NOT_FOUND`.

---

## 3. Architecture & Directory Layout

The tool is implemented as a modular Node.js/CommonJS engine in Toolforge with an extensible adapter pattern:

```
sync-tools/
├── agent-memory-sync.cjs             # CLI orchestrator & workspace resolver
├── lib/
│   ├── managed-region.cjs            # Safe block parser, marker injector & CRLF handler
│   ├── json-region.cjs               # Indentation-aware, BOM-free, UTF-8 JSON mutator
│   ├── vault-context.cjs             # Vault path resolver, discovery & sentinel validator
│   ├── workspace-discovery.cjs       # Recursive scanner with normalized ignore matching
│   ├── safe-write.cjs                # Windows-safe atomic write with retry & rollback
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

### 4.1 Base Adapter Contract (`BaseAgentAdapter`) & Receipt Invariants
All adapters subclass `BaseAgentAdapter`. The `sync()` method returns an array of deterministic receipts:

```javascript
/**
 * @typedef {Object} SyncReceipt
 * @property {string} adapter - Identifier of the executing adapter
 * @property {string} targetFile - Absolute, canonical path to the target file
 * @property {'CREATED'|'UPDATED'|'UNCHANGED'|'SKIPPED'|'ERROR'} status
 * @property {boolean} changesMade - Semantic invariant: true if CREATED/UPDATED, false otherwise
 * @property {string} [errorCode] - e.g. 'ERR_FILE_LOCKED', 'ERR_PARSE_JSON', 'ERR_BOUNDARY_VIOLATION'
 * @property {string} [error] - Descriptive error message
 */
```

- **Receipt Invariants:**
  1. Exactly one receipt per declared target file (no duplicate target entries).
  2. Returns an Array on all execution paths (including no-op and caught error paths).
  3. Strict semantic consistency: `changesMade === true` $\iff$ `status === 'CREATED' || status === 'UPDATED'`.
  4. Receipts are deterministically sorted by `targetFile` path ascending.
- **Exit Code Policy:** If any receipt in the aggregate execution run has status `ERROR`, the CLI terminates with exit code 1.

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
  - Strips UTF-8 BOM on input; outputs pure UTF-8 without BOM.
  - Detects CRLF (`\r\n`) vs LF (`\n`) from existing file; defaults to platform newline for new files.
  - Guarantees exactly one trailing newline at EOF.
  - Collapses duplicate or broken marker tags into a single canonical block.

### 5.2 JSON Mutation Strategy (`json-region.cjs`)
- **Indentation & Formatting Contract:**
  - Strips UTF-8 BOM on input; outputs pure UTF-8 without BOM.
  - Detects indentation style (spaces vs tabs, default 2 spaces).
  - Preserves top-level and nested key ordering.
  - Injects vault context under namespace `toolforge_memory`.
  - Matches detected CRLF/LF line endings and guarantees single trailing newline at EOF.

### 5.3 Windows-Safe Atomic Replacement (`safe-write.cjs`)
1. Create unique temporary file `<target>.tmp.<pid>.<timestamp>.<rand>` in target's parent directory.
2. Write content to temp file and flush via `fs.fsyncSync(fd)`.
3. If destination exists, create unique backup `<target>.bak.<pid>.<timestamp>.<rand>` and flush via `fs.fsyncSync(backupFd)`.
4. Execute `fs.renameSync(tempFile, targetFile)`.
5. On Windows retryable lock errors (`EPERM`, `EBUSY`, `EEXIST`):
   - Retry with exponential backoff (5 attempts: 25ms, 50ms, 100ms, 200ms, 400ms).
6. Verify destination file exists and byte length matches source buffer.
7. Unlink backup and temporary files in `finally` block. On unrecoverable error during replacement, restore target from backup and fail closed.

---

## 6. Deterministic Workspace Discovery & Exclusion Rules

### 6.1 Discovery Precedence
1. **Explicit Target:** Single CLI argument `node sync-tools/agent-memory-sync.cjs <path>`.
2. **Registry Targets:** Repositories listed in `sync-tools/repo-registry.json`.
3. **Filesystem Walk (`--all`):** Scans directories under base root (default `C:\dev` or detected root).

### 6.2 Normalized Exclusion Matching
During traversal, directory names are normalized (lowercased, forward slashes) and matched against the deterministic ignore set:
- **VCS & Repos:** `.git`, `.worktrees`, `.hg`, `.svn`
- **Dependencies:** `node_modules`, `vendor`, `.pnpm-store`
- **Staging & Build:** `_archive`, `.cache`, `dist`, `build`, `.tmp`, `_kb-sync-staging`, `sync-artifacts`, `coverage`, `target`

- **Symlink / Junction Cycle Prevention:** Resolves realpaths via `fs.realpathSync` and maintains a `Set<string>` of normalized canonical paths.

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
   - **JSON Format Matrix:** Validates `opencode.json` indentation preservation, key order preservation, BOM-free UTF-8, and syntax validity.
   - **Receipt Invariant Matrix:** Verifies single receipt per target, array return on all paths, and status $\iff$ `changesMade` invariant.
   - **Atomic Replacement & Rollback:** Simulates write failures and verifies rollback recovery from `.bak`.
   - **Exclusion Matrix:** Verifies recursive walk skips `node_modules`, `_kb-sync-staging`, and `.worktrees`.
2. **Acceptance Smoke Test:**
   - Execute against `C:\dev` and `C:\dev\sigil-repo`.
   - Submit final code and test outputs to OpenAI Codex (`codex exec`) for automated second-opinion review prior to landing.
