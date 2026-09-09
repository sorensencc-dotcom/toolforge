# Unified Multi-Client MCP Governance & Profile-Based Context Optimization

**Date:** 2026-09-08  
**Status:** Approved Engineering Spec  
**Target Clients:** Claude Code CLI, Codex CLI, Grok Bot, Claude Desktop, Antigravity IDE, Ollama / Local Models  

---

## 1. Executive Summary & Problem Statement

Modern AI developer environments run multiple heterogeneous coding agents and CLIs concurrently. By default, agents connect to Model Context Protocol (MCP) servers via unmanaged `stdio` subprocesses, causing two critical failure modes:
1. **Context & Token Bloat**: Loading 8–10 full MCP server definitions injects 20,000–35,000+ tokens of raw JSON tool schemas into every prompt. For local models (Ollama) with 8k–32k context windows, this exhausts the budget before prompt processing begins.
2. **Process Explosion & Memory Waste**: Multiple concurrent CLI sessions fork independent `node.exe` instances for identical servers (e.g., 5 sessions × 8 MCPs = 40+ processes), consuming 4–8 GB of RAM and leaving orphaned processes on Windows.

This specification introduces a **Centralized Registry with Profile-Based Context Compilation** and **Shared Daemon Gateways** to enforce deterministic token budgets, eliminate duplicate processes, and provide seamless multi-client management.

---

## 2. Architecture & System Topology

```
                          ┌────────────────────────────┐
                          │   .sigil/mcp-registry.toml  │
                          │   (Canonical Single Source) │
                          └──────────────┬─────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │                       │                       │
           Profile: minimal         Profile: dev           Profile: full
           (Budget: ≤ 2,500 tokens)(Budget: ≤ 12,000 tokens)(Budget: ≤ 45,000 tokens)
                 │                       │                       │
                 ▼                       ▼                       ▼
          [Ollama / Local]        [Codex / Claude Code]    [Antigravity / Desktop]
          - Core fs / context     - Dev tools + Git        - Full suites (DevTools,
          - Curated static tools  - Domain knowledge base    Notion, GitHub, Media)
```

### Core Architecture Components

1. **Canonical Registry (`.sigil/mcp-registry.toml`)**: Single version-controlled catalog declaring all available MCP servers, endpoints, estimated schema token weights (`schema_weight`), transports (`stdio` vs `sse`/`http`), and profile tags.
2. **Config Compiler (`sigil mcp sync`)**: Deterministic generator that parses the registry and updates native configuration files across all clients (`.codex/config.toml`, `.claude.json`, `claude_desktop_config.json`, `mcp_config.json`, `sigil-grok-bridge`).
3. **Shared HTTP/SSE Singleton Gateway**: Persistent background daemon for high-weight stateless API integrations (`github-mcp`, `notion-mcp`, `ijfw-memory`), allowing all client sessions to share a single process.
4. **Curated Static Minimal Profile**: Direct, concise native tool definitions for small local models, avoiding multi-step meta-tool indirection failures on 7B/8B models.

---

## 3. Registry Schema & Profile Token Budgets

### 3.1 Registry Header & Profile Definitions

```toml
# Canonical Multi-Client MCP Registry
registry_version = "2026-09-08"
schema_version = 1

[profiles.minimal]
description = "For Ollama and small-context local models (8k-32k window)"
max_tools = 4
max_schema_tokens = 2500
servers = ["kb-context-cache"]

[profiles.dev-minimal]
description = "Lightweight CLI profile with memory and core context only"
max_tools = 6
max_schema_tokens = 5000
servers = ["kb-context-cache", "ijfw-memory"]

[profiles.dev]
description = "Standard developer profile for Codex CLI and Claude Code"
max_tools = 12
max_schema_tokens = 12000
servers = ["kb-context-cache", "ijfw-memory", "sigil"]

[profiles.research]
description = "Research and documentation focus with search and knowledge tools"
max_tools = 15
max_schema_tokens = 20000
servers = ["kb-context-cache", "ijfw-memory", "notion", "parallel-search"]

[profiles.full]
description = "Unconstrained profile for Antigravity IDE and Claude Desktop"
max_tools = 50
max_schema_tokens = 45000
servers = ["kb-context-cache", "ijfw-memory", "github", "notion", "chrome-devtools", "sigil"]
```

### 3.2 Server Definitions & Schema Weighting

```toml
# --- Tier 1: Core Knowledge & Context (stdio, isolated state) ---
[servers.kb-context-cache]
transport = "stdio"
command = "node"
args = ["C:/dev/kb-sync/scripts/mcp-context-server.mjs"]
schema_weight = 600
tags = ["knowledge", "memory", "core"]

[servers.ijfw-memory]
transport = "stdio"
command = "node"
args = ["C:/Users/soren/.ijfw/mcp-server/src/server.js"]
schema_weight = 1200
tags = ["memory", "governance"]

[servers.sigil]
transport = "stdio"
command = "node"
args = ["C:/dev/sigil-repo/sigil/connectors/v1/mcp-stdio-server.mjs"]
schema_weight = 1500
tags = ["sigil", "relay"]

# --- Tier 2: Shared Remote APIs (Shared HTTP/SSE Singleton) ---
[servers.github]
transport = "sse"
url = "http://127.0.0.1:4411/mcp/github"
schema_weight = 7500
tags = ["git", "api", "heavy"]

[servers.notion]
transport = "sse"
url = "http://127.0.0.1:4411/mcp/notion"
schema_weight = 4000
tags = ["docs", "api", "heavy"]

[servers.parallel-search]
transport = "sse"
url = "https://search.parallel.ai/mcp"
schema_weight = 3500
tags = ["search", "web"]

# --- Tier 3: Browser & UI Automation (Local pinned path) ---
[servers.chrome-devtools]
transport = "stdio"
command = "node"
args = ["C:/Users/soren/AppData/Local/npm-cache/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp/dist/index.js"]
schema_weight = 4500
tags = ["browser", "qa"]
```

### 3.3 Exact Budget Validation Rules

The compiler executes exact schema token validation:
1. **Tool Count Invariant**:
   $$\text{count}(\text{profile}.\text{servers}) \le \text{profile}.\text{max\_tools}$$
2. **Exact Serialized Tokenizer Invariant**:
   For each server, the compiler extracts the live JSON tool schema definitions, serializes them, and counts exact tokens via `js-tiktoken` (cl100k_base / o200k_base):
   $$\sum_{s \in \text{profile}.\text{servers}} \text{tiktoken}(\text{schema}(s)) \le \text{profile}.\text{max\_schema\_tokens}$$
If any profile exceeds either invariant, `sigil mcp validate` halts execution with exit code `10` and outputs the itemized tool weight breakdown.

---

## 4. Client Bindings & AST-Safe Mutation Policy

| Client | Configuration File | Default Profile | Supported Transports |
| :--- | :--- | :--- | :--- |
| **Codex CLI** | `~/.codex/config.toml` | `dev` | `stdio`, `sse`, `http` |
| **Claude Code** | `~/.claude.json` / `settings.json` | `dev` | `stdio`, `sse`, `http` |
| **Grok Bot** | `C:\dev\skills\sigil-grok-bridge\config.json` | `dev-minimal` | `stdio`, `http` |
| **Claude Desktop** | `~/AppData/Roaming/Claude/claude_desktop_config.json` | `full` | `stdio`, `sse` |
| **Antigravity IDE** | `~/.gemini/antigravity/mcp_config.json` | `full` | `stdio`, `sse` (native lazy-loading) |
| **Ollama / Local Models** | Generated Modelfile / LiteLLM Proxy config | `minimal` | `stdio` |

### Non-Destructive AST/CST Surgical Update Algorithm
To prevent mangling comments, key ordering, or non-MCP settings:
1. Create a timestamped backup copy: `<target-file>.bak`.
2. Parse target file into a Concrete Syntax Tree (CST) or perform bounded section replacement targeting only `[mcp_servers]` (TOML) or `"mcpServers"` (JSON).
3. Validate modified content syntax before writing.
4. Write changes to `<target-file>.tmp` and execute an atomic rename (`fs.renameSync`).
5. On any write or syntax failure, automatically restore from `.bak` and report the error.

---

## 5. Operational Commands & CLI Interface

```powershell
# 1. Validate registry budgets and schemas against js-tiktoken
sigil mcp validate

# 2. Sync all client configuration files to designated profiles (atomic)
sigil mcp sync

# 3. Dry-run sync previewing file diffs without writing to disk
sigil mcp sync --dry-run

# 4. Inspect active client profiles, tool counts, and token footprints
sigil mcp status

# 5. Set default profile mapping for a specific client
sigil mcp profile set codex dev-minimal
sigil mcp profile set grok dev-minimal
sigil mcp sync --client codex

# 6. One-off ephemeral activation
sigil mcp use research --client claude-code
```

### 5.1 Profile Manifest Output (`sigil mcp status`)

The `status` command renders a unified governance dashboard table across all connected clients:

```
=== MCP Governance Profile Manifest (Registry: 2026-09-08) ===

Client          Active Profile  Tools  Schema Weight  Max Budget  Headroom / Status
--------------  --------------  -----  -------------  ----------  -----------------
Codex CLI       dev             3      3,300 tokens   12,000      +8,700 [OK]
Claude Code     dev             3      3,300 tokens   12,000      +8,700 [OK]
Grok Bot        dev-minimal     2      1,800 tokens    5,000      +3,200 [OK]
Claude Desktop  full            6     22,300 tokens   45,000     +22,700 [OK]
Antigravity     full            6     22,300 tokens   45,000     +22,700 [OK]
Ollama          minimal         1        600 tokens    2,500      +1,900 [OK]

Total Running Process Overhead: 4 singletons (saved 36 duplicate processes)
```

### 5.2 Deterministic Error & Exit Codes

All CLI commands return deterministic exit codes for programmatic automation:

| Exit Code | Identifier | Description |
| :--- | :--- | :--- |
| `0` | `SUCCESS` | Operation completed cleanly with zero violations. |
| `10` | `ERR_BUDGET_VIOLATION` | Profile exceeds `max_tools` count or `max_schema_tokens` budget. |
| `20` | `ERR_AST_PARSE_FAILURE` | Syntax or parser error reading/writing TOML or JSON structure. |
| `30` | `ERR_ATOMIC_WRITE_FAILURE` | Failed to write `.tmp` or perform atomic rename; rolled back from `.bak`. |
| `40` | `ERR_CLIENT_CONFIG_INVALID` | Client config target path not found, inaccessible, or corrupted. |
| `50` | `ERR_REGISTRY_SCHEMA_INVALID` | Missing required fields, version mismatch, or undefined server references. |

---

## 6. Process Janitor & Daemon Lifecycle Integration

1. **Singleton Reaping**: [`node-process-janitor.ps1`](file:///C:/dev/utilities/node-process-janitor.ps1) verifies running MCP instances against active registry singletons and terminates duplicate/orphaned daemons.
2. **Race-Condition & Grace Period Guard**:
   - The janitor enforces a **60-second creation grace period** before considering any process for termination.
   - Any process with an **alive parent PID** is strictly protected from termination.
3. **Health Check Endpoints**: Shared SSE gateways expose `/health` and `/ready` endpoints to ensure smooth reconnects without dangling socket handles.
