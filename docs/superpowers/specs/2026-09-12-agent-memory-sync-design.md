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

## 5. Agent Onboarding Process & Extensibility Runbook

To add any new agent harness (e.g., Cursor, Windsurf, Devin, or bespoke local orchestrators):

1. **Create Adapter Module (`sync-tools/adapters/<agent-name>.cjs`)**:
   - Subclass `BaseAgentAdapter` from `../lib/base-adapter.cjs`.
   - Define `name` and target path resolution logic.
   - Implement `sync(workspaceContext, vaultContext, options)`.
2. **Register in Adapter Index (`sync-tools/adapters/index.cjs`)**:
   - Add the adapter to the auto-discovery export list.
3. **Add Unit Tests (`tests/adapters/<agent-name>.test.mjs`)**:
   - Validate target path generation and content formatting.
4. **Run Sync & Verification**:
   - Execute `node sync-tools/agent-memory-sync.cjs --agent <agent-name>`.

---

## 6. Architecture & Flow Visualizations (Cathryn Lavery Standard)

All visual specifications are authored as standalone HTML+SVG assets rendered with the canonical warm palette:
- **Topology Diagram:** `docs/superpowers/specs/assets/agent-memory-sync-topology.html` -> `.png`
- **Onboarding Flow Diagram:** `docs/superpowers/specs/assets/agent-onboarding-flow.html` -> `.png`

---

## 7. Multi-Agent Codex Review Step

Upon implementation completion, the full deliverable and test suite will be submitted to OpenAI Codex for independent peer code review:
- Via Sigil protocol bridge (`sigil-reviewer` / grok-codex channel) or direct Codex review invocation.
- Review findings must be addressed prior to landing.
