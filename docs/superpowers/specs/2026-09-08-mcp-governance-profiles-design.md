# Unified Multi-Client MCP Governance & Profile-Based Context Optimization

**Date:** 2026-09-08  
**Status:** Validated Design Spec  
**Target Clients:** Claude Code CLI, Codex CLI, Grok Bot, Claude Desktop, Antigravity IDE, Ollama / Local Models  

---

## 1. Executive Summary & Problem Statement

Modern AI developer environments run multiple heterogeneous coding agents and CLIs concurrently. By default, agents connect to Model Context Protocol (MCP) servers via `stdio` subprocesses, causing two critical failure modes:
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
          - Virtual Meta-Tool     - Domain knowledge base    Notion, GitHub, Media)
```

### Core Architecture Components

1. **Canonical Registry (`.sigil/mcp-registry.toml`)**: Single version-controlled catalog declaring all available MCP servers, endpoints, estimated schema token weights (`schema_weight`), transports (`stdio` vs `sse`/`http`), and profile tags.
2. **Config Compiler (`sigil mcp sync`)**: Deterministic generator that parses the registry and updates native configuration files across all clients (`.codex/config.toml`, `.claude.json`, `claude_desktop_config.json`, `mcp_config.json`).
3. **Shared HTTP/SSE Singleton Gateway**: Persistent background daemon for high-weight stateless API integrations (`github-mcp`, `notion-mcp`, `ijfw-memory`), allowing all client sessions to share a single process.
4. **Virtualized Meta-Tool Gateway**: On-demand tool search/proxy (`mcp.tools.search`, `mcp.tools.execute`) for small-context local models, reducing tool schema footprints by >90%.

---

## 3. Registry Schema & Profile Token Budgets

### 3.1 Profile Definitions

```toml
[profiles.minimal]
description = "For Ollama and small-context local models (8k-32k window)"
max_tools = 4
max_schema_tokens = 2500
fallback_to_meta_tool = true

[profiles.dev]
description = "For Codex CLI, Claude Code, and daily CLI workflows"
max_tools = 12
max_schema_tokens = 12000
fallback_to_meta_tool = false

[profiles.full]
description = "For Antigravity IDE and Claude Desktop (large context windows)"
max_tools = 50
max_schema_tokens = 45000
fallback_to_meta_tool = false
```

### 3.2 Server Definitions & Schema Weighting

```toml
# --- Tier 1: Core Knowledge & Context ---
[servers.kb-context-cache]
transport = "stdio"
command = "node"
args = ["C:/dev/kb-sync/scripts/mcp-context-server.mjs"]
schema_weight = 600
profiles = ["minimal", "dev", "full"]
tags = ["knowledge", "memory", "core"]

[servers.ijfw-memory]
transport = "stdio"
command = "node"
args = ["C:/Users/soren/.ijfw/mcp-server/src/server.js"]
schema_weight = 1200
profiles = ["dev", "full"]
tags = ["memory", "governance"]

# --- Tier 2: Shared Remote APIs (Shared HTTP/SSE) ---
[servers.github]
transport = "sse"
url = "http://127.0.0.1:4411/mcp/github"
schema_weight = 7500
profiles = ["full"]
tags = ["git", "api", "heavy"]

[servers.notion]
transport = "sse"
url = "http://127.0.0.1:4411/mcp/notion"
schema_weight = 4000
profiles = ["full"]
tags = ["docs", "api", "heavy"]

# --- Tier 3: Browser & UI Automation ---
[servers.chrome-devtools]
transport = "stdio"
command = "npx"
args = ["-y", "chrome-devtools-mcp"]
schema_weight = 4500
profiles = ["full"]
tags = ["browser", "qa"]

# --- Tier 4: On-Demand Virtualized Meta-Tool ---
[servers.sigil-virtual-tools]
transport = "stdio"
command = "node"
args = ["C:/dev/sigil-repo/sigil/connectors/v1/mcp-virtual-gateway.mjs"]
schema_weight = 350
profiles = ["minimal"]
tags = ["gateway", "virtual"]
```

### 3.3 Budget Validation Constraint

Compilation strictly enforces:
$$\sum_{s \in \text{servers}(P)} s.\text{schema\_weight} \le P.\text{max\_schema\_tokens}$$
If a profile exceeds its configured budget, compilation halts with a diagnostic report identifying offending servers.

---

## 4. Client Bindings & Compilation Targets

| Client | Configuration Path | Default Profile | Transport Support |
| :--- | :--- | :--- | :--- |
| **Codex CLI** | `~/.codex/config.toml` | `dev` | `stdio`, `sse`, `http` |
| **Claude Code** | `~/.claude.json` / `settings.json` | `dev` | `stdio`, `sse`, `http` |
| **Claude Desktop** | `~/AppData/Roaming/Claude/claude_desktop_config.json` | `full` | `stdio`, `sse` |
| **Antigravity IDE** | `~/.gemini/antigravity/mcp_config.json` | `full` | `stdio`, `sse` (native lazy loading) |
| **Ollama / Local Models** | Generated Modelfile / LiteLLM Proxy config | `minimal` | `stdio` / Virtual Meta-Tool |

### Non-Destructive Update Policy
`sigil mcp sync` parses existing client configuration files and only modifies the MCP server table/object. Non-MCP settings (UI preferences, model flags, trusted paths) are preserved byte-for-byte.

---

## 5. Operational Commands & CLI Interface

```powershell
# 1. Validate registry budgets and schemas
sigil mcp validate

# 2. Sync all client configuration files to designated profiles
sigil mcp sync

# 3. Inspect active client profiles and token footprints
sigil mcp status

# 4. Switch profile for a specific client
sigil mcp profile set codex dev-minimal
sigil mcp sync --client codex

# 5. One-off ephemeral activation
sigil mcp use research --client claude-code
```

---

## 6. Process Janitor & Daemon Lifecycle Integration

1. **Singleton Reaping**: [`node-process-janitor.ps1`](file:///C:/dev/utilities/node-process-janitor.ps1) verifies running MCP instances against active registry singletons and terminates duplicate/orphaned daemons.
2. **Health Check Endpoints**: Shared SSE gateways expose `/health` and `/ready` endpoints to ensure smooth reconnects without dangling socket handles.
3. **Graceful Degradation**: If the shared SSE gateway is stopped, client sessions fallback to direct `stdio` mode or alert the user with restart commands.
