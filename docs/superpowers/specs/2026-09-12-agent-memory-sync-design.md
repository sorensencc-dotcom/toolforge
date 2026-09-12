# Multi-Agent Memory Synchronization to Obsidian Vault

**Status:** Approved  
**Date:** 2026-09-12  
**Target:** Toolforge Multi-Agent Ecosystem (`sync-tools/agent-memory/`)  

---

## 1. Objective

Provide an automated, idempotent synchronization engine that connects all active and future coding agents (Claude Code, Antigravity, OpenAI Codex, Grok/Sigil Bridge, and Local Models) to the canonical Obsidian Vault (`C:/dev/kb-sync/obsidian/vault/wiki/`).

The utility ensures prompt-zero alignment on architecture indexes, wiki conventions, and log audit trails without manual configuration, preventing agent memory amnesia and hallucinated structures across workspaces.

---

## 2. Architecture & Directory Layout

The tool is implemented as a modular Node.js/CommonJS engine in Toolforge with an extensible adapter pattern:

```
sync-tools/
├── agent-memory-sync.cjs             # CLI orchestrator & workspace resolver
├── lib/
│   ├── managed-region.cjs            # Safe block parser & marker injector
│   ├── vault-context.cjs             # Obsidian vault path & schema resolver
│   ├── workspace-discovery.cjs       # Hybrid scanner (repo-registry + CLI paths + scan)
│   └── base-adapter.cjs              # Base class for agent adapters
└── adapters/
    ├── claude-code.cjs               # ~/.claude/projects/.../memory/MEMORY.md + CLAUDE.md
    ├── antigravity.cjs               # GEMINI.md + AGENTS.md + .ijfw/
    ├── codex.cjs                     # codex/AGENTS.md + CODEX.md
    ├── grok.cjs                      # .sigil/grok-context.md + Sigil bridge context
    ├── local-models.cjs              # opencode.json + system prompt templates
    └── index.cjs                     # Adapter registry loader
```

---

## 3. Agent Adapters & Target Mappings

### 3.1 Claude Code Adapter (`ClaudeCodeAdapter`)
- **Internal Memory Path:** `~/.claude/projects/<sanitized-workspace-path>/memory/MEMORY.md`
- **Sanitization Rule:** Encodes Windows drive letters and separators (e.g. `C:\dev\sigil-repo` -> `C--dev-sigil-repo`).
- **Workspace Surface:** Also updates workspace `CLAUDE.md` adapter marker.

### 3.2 Antigravity Adapter (`AntigravityAdapter`)
- **Target Files:** `GEMINI.md`, `AGENTS.md`, and `.ijfw/memory/` references in workspace root.
- **Content:** Injects Obsidian graph nodes, IJFW prelude directives, and writing discipline rules.

### 3.3 OpenAI Codex Adapter (`CodexAdapter`)
- **Target Files:** `codex/AGENTS.md` and workspace `CODEX.md`.
- **Content:** Pins vault architecture indexes and prevents out-of-bounds file creation.

### 3.4 Grok / Sigil Bridge Adapter (`GrokAdapter`)
- **Target Files:** `.sigil/grok-context.md` and Sigil relay context stubs.
- **Content:** Standardizes dense markdown summaries of vault status for Sigil MCP task ingestion.

### 3.5 Local Models / OpenCode Adapter (`LocalModelAdapter`)
- **Target Files:** `opencode.json` and `.local-agent-context.md`.
- **Content:** Supplies token-efficient system context for Ollama, vLLM, and OpenRouter runtimes.

### 3.6 Extensibility Contract
New agent harnesses extend `BaseAgentAdapter` and implement:
```javascript
class CustomAgentAdapter extends BaseAgentAdapter {
  constructor() {
    super('custom-agent');
  }
  async sync(workspaceContext, vaultContext, options) {
    // Adapter implementation
  }
}
```

---

## 4. Managed Region Markers & Idempotency

All updates use non-destructive HTML comment markers:

```markdown
<!-- TOOLFORGE-VAULT-POINTER-START -->
# Persistent System Memory Pointer
> Managed by Toolforge sync-tools. Auto-generated on sync. DO NOT manually edit this block.
- Canonical Knowledge Base Root: C:/dev/kb-sync/obsidian/vault/wiki/
- Ingest Guidelines: docs/targets/obsidian.md
- Primary Architecture Graph: [[Index]]
- Active Conventions: [[wiki-schema]]
- Log Audit Trail: [[Log]]
- Repository Target: <WorkspaceName>
<!-- TOOLFORGE-VAULT-POINTER-END -->
```

### Injection Algorithm
1. If file does not exist, write the marker block.
2. If file exists and contains `<!-- TOOLFORGE-VAULT-POINTER-START -->` ... `<!-- TOOLFORGE-VAULT-POINTER-END -->`, replace only the enclosed block.
3. If file exists without markers, prepend the marker block and retain 100% of existing content below.

---

## 5. CLI & Toolforge PowerShell Integration

- **Node CLI:**
  - `node sync-tools/agent-memory-sync.cjs`
  - `node sync-tools/agent-memory-sync.cjs <path>`
  - `node sync-tools/agent-memory-sync.cjs --all`
  - `node sync-tools/agent-memory-sync.cjs --agent <agent-name>`
  - `node sync-tools/agent-memory-sync.cjs --dry-run`
- **PowerShell (`toolforge.ps1`):**
  - `.\toolforge.ps1 -SyncAgentMemory`
  - `.\toolforge.ps1 -SyncAgentMemory -Path <path>`
  - `.\toolforge.ps1 -SyncAgentMemory -All`
  - `.\toolforge.ps1 -SyncAgentMemory -DryRun`
- **npm Scripts:**
  - `"sync:agent-memory": "node sync-tools/agent-memory-sync.cjs"`

---

## 6. Verification & Test Plan

1. **Unit Tests (`tests/agent-memory-sync.test.mjs`):**
   - Path sanitization logic across OS paths.
   - Idempotent managed-region replacement (ensuring repeated runs produce identical bytes).
   - Non-destructive preservation of pre-existing session wraps and notes.
   - Dry-run mode verification.
2. **Integration & Smoke Verification:**
   - Execute sync against `C:\dev` and `C:\dev\sigil-repo`.
   - Inspect generated `MEMORY.md`, `GEMINI.md`, and agent configs.
