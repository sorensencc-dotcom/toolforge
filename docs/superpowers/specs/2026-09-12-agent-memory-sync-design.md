# Multi-Agent Memory Synchronization to Obsidian Vault

**Status:** Ready for Review  
**Date:** 2026-09-12  
**Target:** Toolforge Multi-Agent Ecosystem (`sync-tools/agent-memory/`)  

---

## 1. Objective

Provide an automated, idempotent synchronization engine that connects all active and future coding agents (Claude Code, Antigravity, OpenAI Codex, Grok/Sigil Bridge, and Local Models) to the canonical Obsidian Vault.

The utility ensures prompt-zero alignment on architecture indexes, wiki conventions, and log audit trails without manual configuration, preventing agent memory amnesia and hallucinated structures across workspaces.

---

## 2. Path Resolution & Vault Configuration

Vault root resolution is platform-neutral, environment-aware, and fails closed against invalid paths:

### 2.1 Resolution Algorithm
1. If `process.env.OBSIDIAN_VAULT_ROOT` is set:
   - Expand leading `~` to `os.homedir()`.
   - Resolve to canonical absolute path (`path.resolve()`).
2. If not set, check standard platform default roots:
   - Windows: `C:/dev/kb-sync/obsidian/vault/wiki`
   - POSIX / macOS / Linux: `path.join(os.homedir(), 'dev', 'kb-sync', 'obsidian', 'vault', 'wiki')`
3. Append `/wiki` if the specified root points to the parent vault.

### 2.2 Validation & Fail-Closed Guardrails
- **Existence Check:** Verifies directory existence (`fs.existsSync(resolvedPath)`).
- **Containment Check:** Guarantees target is a directory and contains at least `Index.md` or `Log.md` to prevent pointing agents to empty or unvetted directories.
- **Fail-Closed Behavior:** If validation fails and `--force` is not set, sync halts with exit code 1 (or skips with warning in `--lenient` discovery mode).

---

## 3. Architecture & Directory Layout

The tool is implemented as a modular Node.js/CommonJS engine in Toolforge with an extensible adapter pattern:

```
sync-tools/
├── agent-memory-sync.cjs             # CLI orchestrator & workspace resolver
├── lib/
│   ├── managed-region.cjs            # Safe block parser, marker injector & CRLF handler
│   ├── json-region.cjs               # Format-safe JSON property/key injector (UTF-8, no BOM, CRLF-aware)
│   ├── vault-context.cjs             # Vault path resolver & validation guardrails
│   ├── workspace-discovery.cjs       # Hybrid scanner with deterministic ignore rules
│   └── base-adapter.cjs              # Abstract base class & multi-target lifecycle contract
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

### 4.1 Base Adapter Contract (`BaseAgentAdapter`)
All adapters subclass `BaseAgentAdapter` and implement standard lifecycle methods returning an array of per-target receipts:

```javascript
class BaseAgentAdapter {
  constructor(name) {
    this.name = name;
  }
  
  // Returns: Promise<Array<{ adapter: string, targetFile: string, status: 'CREATED'|'UPDATED'|'UNCHANGED'|'SKIPPED'|'ERROR', changesMade: boolean, error?: string }>>
  async sync(workspaceContext, vaultContext, options = {}) {
    throw new Error('Not implemented');
  }
}
```

### 4.2 Target Write Governance & Boundary Rules
To protect repository integrity, mutations are strictly classified into **Internal Agent State** vs **Governed Workspace Files**:

| Adapter | Target | Category | Write Rule |
|---|---|---|---|
| `ClaudeCodeAdapter` | `~/.claude/projects/<sanitized>/memory/MEMORY.md` | Internal State | Create/Update freely in user home directory. |
| `AntigravityAdapter` | `GEMINI.md`, `AGENTS.md` | Governed File | Update managed region ONLY if file already exists; never create unmanaged root files. |
| `CodexAdapter` | `codex/AGENTS.md`, `CODEX.md` | Governed File | Update managed region ONLY if file already exists. |
| `GrokAdapter` | `.sigil/grok-context.md` | Internal State | Create/Update only if `.sigil/` directory exists or `--create-stubs` is passed. |
| `LocalModelAdapter` | `opencode.json` | Governed Config | Update JSON property ONLY if `opencode.json` exists in workspace root. |
| `LocalModelAdapter` | `.local-agent-context.md` | Internal State | Create/Update pointer stub. |

### 4.3 Claude Code Path Sanitization Specification
- Path normalization: lowercases Windows drive letters, replaces all non-alphanumerics (`:`, `\`, `/`, `.`, ` `) with `-`.
- Example: `C:\dev\sigil-repo` -> `C--dev-sigil-repo` (or `c--dev` for dev root).
- UNC paths (`\\server\share\repo`) -> `UNC--server-share-repo`.

---

## 5. Mutation Strategies, Line Endings & Concurrency

### 5.1 Markdown Managed Regions (`managed-region.cjs`)
Used for all `.md` targets:

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

- **Line Ending & Encoding Preservation:** Detects CRLF vs LF on read and guarantees identical line endings on write. Strips UTF-8 BOM if present and writes standard UTF-8.
- **Duplicate/Malformed Marker Cleanup:** If duplicate markers exist, cleans up redundant blocks into a single canonical block.

### 5.2 JSON Mutation Strategy (`json-region.cjs`)
Used for `.json` targets (`opencode.json`):
- Reads JSON AST / Object, parses safely, merges `system_prompt_pointer` or `vault_context` under `toolforge_memory` namespace.
- Preserves original indentation (e.g. 2 spaces, tabs) and matches input line endings (CRLF vs LF).

### 5.3 Windows-Safe Atomic Replacement Algorithm
To prevent `EBUSY` / `EPERM` locks on Windows:
1. Write payload to temporary file `<target>.tmp.<pid>.<timestamp>` in same directory.
2. Attempt `fs.renameSync(tempFile, targetFile)`.
3. If `fs.renameSync` fails due to Windows file lock (`EPERM` / `EEXIST`), fallback to `fs.copyFileSync(tempFile, targetFile)` followed by `fs.unlinkSync(tempFile)`.
4. Guarantee cleanup of temporary files in `finally` block on error.

---

## 6. Deterministic Workspace Discovery & Ignore Rules

`workspace-discovery.cjs` resolves workspaces using strict precedence and exclusion filters:

1. **Precedence:**
   - Explicit CLI path argument (`node sync-tools/agent-memory-sync.cjs <path>`)
   - `sync-tools/repo-registry.json` registered workspaces
   - `--all` filesystem scan of base directory (default `C:\dev`)
2. **Deterministic Exclusion List:**
   - Version control: `.git/`, `.worktrees/`, `.hg/`, `.svn/`
   - Dependencies: `node_modules/`, `vendor/`, `.pnpm-store/`
   - Staging & artifacts: `_archive/`, `.cache/`, `dist/`, `build/`, `.tmp/`, `_kb-sync-staging/`, `sync-artifacts/`, `coverage/`, `target/`
3. **Deduplication:**
   - Canonicalizes absolute paths with `fs.realpathSync` to prevent duplicate operations across directory junctions or symlinks.

---

## 7. Agent Onboarding Process & Extensibility Runbook

To onboard any new agent harness (e.g., Cursor, Windsurf, Devin, or bespoke local orchestrators):

1. **Create Adapter Module (`sync-tools/adapters/<agent-name>.cjs`)**:
   - Subclass `BaseAgentAdapter` from `../lib/base-adapter.cjs`.
   - Implement `sync(workspaceContext, vaultContext, options)` returning `Promise<Array<Receipt>>`.
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
   - **Path Sanitization:** Windows drives (`C:\dev`), UNC paths, POSIX paths, spaces, and special characters.
   - **CRLF/LF & BOM Preservation:** Verifies line endings and UTF-8 encoding are unchanged across Markdown and JSON mutations.
   - **JSON Format Safety:** Confirms `opencode.json` remains strictly valid JSON without comment injection.
   - **Managed Marker Idempotency:** Repeated sync passes yield `changesMade: false` and identical byte hashes.
   - **Atomic Replacement & Error Recovery:** Verifies `.tmp` file cleanup during simulated write failures.
   - **Exclusion Safety:** Confirms scanner ignores `node_modules`, `_kb-sync-staging`, and nested `.worktrees`.
2. **Acceptance Smoke Test:**
   - Execute against `C:\dev` and `C:\dev\sigil-repo`.
   - Submit final code and test outputs to OpenAI Codex (`codex exec`) for automated second-opinion review prior to landing.
