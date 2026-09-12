# Multi-Agent Memory Synchronization to Obsidian Vault

**Status:** Draft (Addressing Review Findings)  
**Date:** 2026-09-12  
**Target:** Toolforge Multi-Agent Ecosystem (`sync-tools/agent-memory/`)  

---

## 1. Objective

Provide an automated, idempotent synchronization engine that connects all active and future coding agents (Claude Code, Antigravity, OpenAI Codex, Grok/Sigil Bridge, and Local Models) to the canonical Obsidian Vault.

The utility ensures prompt-zero alignment on architecture indexes, wiki conventions, and log audit trails without manual configuration, preventing agent memory amnesia and hallucinated structures across workspaces.

---

## 2. Path Resolution & Vault Configuration

The vault location is dynamically resolved with cross-platform and environment variable support:

```javascript
const VAULT_WIKI_PATH = process.env.OBSIDIAN_VAULT_ROOT 
  ? path.resolve(process.env.OBSIDIAN_VAULT_ROOT, 'wiki')
  : path.resolve('C:/dev/kb-sync/obsidian/vault/wiki');
```

- **Path Containment & Validation:** Prior to synchronization, the engine verifies that `VAULT_WIKI_PATH` exists and is accessible. If absent, logs a non-fatal warning and enters graceful degradation mode.
- **Cross-Platform Normalization:** All internal path comparisons use normalized forward slashes or `path.resolve()` to maintain consistency across Windows, WSL, and POSIX runtimes.

---

## 3. Architecture & Directory Layout

The tool is implemented as a modular Node.js/CommonJS engine in Toolforge with an extensible adapter pattern:

```
sync-tools/
├── agent-memory-sync.cjs             # CLI orchestrator & workspace resolver
├── lib/
│   ├── managed-region.cjs            # Safe block parser, marker injector & CRLF handler
│   ├── json-region.cjs               # Format-safe JSON property/key injector
│   ├── vault-context.cjs             # Obsidian vault path & schema resolver
│   ├── workspace-discovery.cjs       # Hybrid scanner with ignore rules
│   └── base-adapter.cjs              # Abstract base class & lifecycle contract
└── adapters/
    ├── claude-code.cjs               # ~/.claude/projects/<sanitized>/memory/MEMORY.md
    ├── antigravity.cjs               # GEMINI.md / AGENTS.md managed pointer block
    ├── codex.cjs                     # codex/AGENTS.md / CODEX.md managed pointer block
    ├── grok.cjs                      # .sigil/grok-context.md context stub
    ├── local-models.cjs              # opencode.json & .local-agent-context.md
    └── index.cjs                     # Adapter registry loader
```

---

## 4. Agent Adapters & Target Contracts

### 4.1 Base Adapter Contract (`BaseAgentAdapter`)
All adapters subclass `BaseAgentAdapter` and implement standard lifecycle methods returning a structured result:

```javascript
class BaseAgentAdapter {
  constructor(name) {
    this.name = name;
  }
  
  // Returns: Promise<{ adapter: string, targetFile: string, status: 'CREATED'|'UPDATED'|'UNCHANGED'|'SKIPPED'|'ERROR', changesMade: boolean, error?: string }>
  async sync(workspaceContext, vaultContext, options = {}) {
    throw new Error('Not implemented');
  }
}
```

### 4.2 Claude Code Adapter (`ClaudeCodeAdapter`)
- **Target Path:** `~/.claude/projects/<sanitized-workspace-path>/memory/MEMORY.md`
- **Sanitization Specification:**
  - Converts drive letters and directory separators to dashes matching Claude Code's native Windows format: `C:\dev\sigil-repo` $\rightarrow$ `C--dev-sigil-repo` (or `c--dev` for root).
  - Handles UNC paths (`\\\\server\\share` $\rightarrow$ `UNC--server-share`), whitespace, and non-alphanumerics deterministically.
- **Scope:** Updates internal agent memory without polluting workspace files unless explicitly configured.

### 4.3 Antigravity & Codex Adapters
- **Target Files:** `GEMINI.md` / `AGENTS.md` (Antigravity) and `codex/AGENTS.md` (Codex).
- **Write Governance:** Scoped strictly to demarcated managed regions (`<!-- TOOLFORGE-VAULT-POINTER-START -->`). If the governed file exists without markers, updates are non-destructive and preserve 100% of existing directives. Does not create unmanaged repository-level governed files without explicit opt-in.

### 4.4 Grok / Sigil Bridge Adapter (`GrokAdapter`)
- **Target Files:** `.sigil/grok-context.md`
- **Content:** Dense, token-efficient markdown status summary for Sigil MCP task ingestion.

### 4.5 Local Models & OpenCode Adapter (`LocalModelAdapter`)
- **Target Files:** `opencode.json` (JSON format) and `.local-agent-context.md` (Markdown format).
- **Format-Aware Mutation:** Uses `json-region.cjs` to safely parse and merge `instructions` or `vault_context` properties into `opencode.json` without inserting invalid HTML comments into JSON files.

---

## 5. Mutation Strategies & Idempotency Rules

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

- **Line Ending & Encoding Preservation:** Detects CRLF vs LF on read and guarantees identical line endings on write.
- **Duplicate/Malformed Marker Cleanup:** If corrupted or duplicate markers exist, collapses them into a single clean canonical block.

### 5.2 JSON Mutation Strategy (`json-region.cjs`)
Used for `.json` targets (`opencode.json`):
- Reads JSON AST / Object, parses safely, merges `system_prompt_pointer` or `vault_context` under `toolforge_memory` namespace.
- Formats output preserving original indentation (e.g. 2 spaces) and valid JSON syntax.

### 5.3 Concurrency & Atomic Writes
- Writes output to a temporary sibling file (`<target>.tmp.<pid>.<timestamp>`) and performs an atomic rename (`fs.renameSync`) to eliminate corruption during concurrent agent reads.

---

## 6. Workspace Discovery & Exclusion Rules

`workspace-discovery.cjs` scans repositories with strict boundary rules:
- **Registry Lookup:** Reads explicit repositories defined in `sync-tools/repo-registry.json`.
- **Exclusion Filters:** Hardcoded ignores for `node_modules/`, `.git/`, `.worktrees/`, `_archive/`, `.cache/`, `dist/`, and build artifacts.
- **Deduplication:** Canonicalizes absolute workspace roots using `fs.realpathSync` to avoid duplicate processing of junctions or symlinks.

---

## 7. Agent Onboarding Process & Extensibility Runbook

To onboard any new agent harness (e.g., Cursor, Windsurf, Devin, or bespoke local orchestrators):

1. **Create Adapter Module (`sync-tools/adapters/<agent-name>.cjs`)**:
   - Subclass `BaseAgentAdapter` from `../lib/base-adapter.cjs`.
   - Implement `sync(workspaceContext, vaultContext, options)` returning the standard `{ adapter, targetFile, status, changesMade, error }` result schema.
2. **Register in Adapter Registry (`sync-tools/adapters/index.cjs`)**:
   - Add adapter instance to registry export.
3. **Add Verification Suite (`tests/adapters/<agent-name>.test.mjs`)**:
   - Test path resolution, target mutation, and idempotency.
4. **Execute Verification**:
   - Run `node sync-tools/agent-memory-sync.cjs --agent <agent-name> --dry-run`.

---

## 8. Visual Specifications (Cathryn Lavery Standard)

Visual specifications are generated using the canonical warm palette (`#f2ece2` paper, `#2c2420` ink, `#c4501a` terracotta accent, Barlow Condensed / Playfair Display typography) via `diagram-tools.mjs`:
- **Architecture Topology:** `docs/superpowers/specs/assets/agent-memory-sync-topology.html` $\rightarrow$ `.png`
- **Onboarding Flowchart:** `docs/superpowers/specs/assets/agent-onboarding-flow.html` $\rightarrow$ `.png`

---

## 9. Comprehensive Test & Acceptance Matrix

1. **Unit Tests (`tests/agent-memory-sync.test.mjs`):**
   - **Path Sanitization:** Windows drives (`C:\dev`), UNC paths, POSIX paths, spaces, and special characters.
   - **CRLF/LF Preservation:** Verifies line endings are unchanged across mutations.
   - **JSON Format Safety:** Confirms `opencode.json` remains strictly valid JSON without comment injection.
   - **Managed Marker Idempotency:** Repeated sync passes yield `changesMade: false` and identical byte hashes.
   - **Exclusion Safety:** Confirms scanner ignores `node_modules` and nested `.worktrees`.
2. **Acceptance Smoke Test:**
   - Execute against `C:\dev` and `C:\dev\sigil-repo`.
   - Submit final code and test outputs to OpenAI Codex (`codex exec`) for automated second-opinion review prior to landing.
