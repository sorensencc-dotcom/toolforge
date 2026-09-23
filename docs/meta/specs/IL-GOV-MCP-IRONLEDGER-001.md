# IL-GOV-MCP-IRONLEDGER-001: IronLedger Read-Only MCP Governance Integration

**Record ID:** `IL-GOV-MCP-IRONLEDGER-001`  
**Classification:** Operational / Governance (Tier 2 Execution under Tier 1 Charter)  
**Date:** 2026-09-09  
**Status:** ACTIVE  
**Canonical Registry Target:** `.sigil/mcp-registry.toml`  

---

## 1. Executive Summary

This governance document records the registration, contract specifications, profile token budget allocations, and rollback safety procedures for folding the Phase 5 IronLedger read-only Model Context Protocol (MCP) server into the multi-client governance layer.

---

## 2. Server Specification & Contract

- **Server Identifier:** `ironledger`
- **Transport:** Standard Input/Output (`stdio`) via Python runtime
- **Command:** `python`
- **Arguments:** `["-m", "ironledger.cli", "mcp", "--db", "C:/dev/IronLedger/ironledger.db", "--ledger-dir", "C:/dev/IronLedger/ledger"]`
- **Assigned Schema Weight:** 600 tokens (actual measured schema: ~140 tokens)
- **Tags:** `["finance", "ledger", "read-only"]`

### Exposed Tool Capabilities

| Tool | Purpose | Schema Details |
|---|---|---|
| `search` | Full-text search across ledger entries and postings | Required `query: string`, optional `limit: integer` (1..500, default 50), `offset: integer` (default 0). |
| `balances` | Projection account balances by currency | No parameters required; returns list of `(account, minor_units, currency, minor_unit_scale)` records. |
| `projection_status` | Disposable projection health & freshness check | No parameters required; returns projection state, hash match status, and compile run reference. |

### Core Architectural Invariants

1. **Read-Only / Zero Mutation**: No compile, import, review, rule, or project mutation endpoints are exposed over MCP.
2. **Zero Third-Party MCP Package Imports**: Standard library JSON-RPC 2.0 implementation (`json`, `http.server`, `socket`, `hashlib`, `secrets`).
3. **Audit Immutability**: All tool invocations append hash-chained `audit_events` to the operational SQLite database (`--db`) with `actor="operator"`, without leaking query strings or secrets.

---

## 3. Profile Allocations & Budget Conformance

IronLedger is assigned to the `dev` (developer CLI) and `full` (IDE / desktop) profiles:

| Client Runtime | Configuration Target | Profile | Active Servers | Tools | Schema Tokens | Ceiling Budget | Headroom |
|---|---|---|---|---|---|---|---|
| **Codex CLI** | `~/.codex/config.toml` | `dev` | 4 | 4 | 3,900 | 12,000 / 12 | +8,100 |
| **Claude CLI** | `~/.claude.json` | `dev` | 4 | 4 | 3,900 | 12,000 / 12 | +8,100 |
| **Claude Desktop** | `%APPDATA%/Claude/claude_desktop_config.json` | `full` | 7 | 7 | 19,900 | 45,000 / 50 | +25,100 |
| **Antigravity IDE** | `~/.gemini/antigravity/mcp_config.json` | `full` | 7 | 7 | 19,900 | 45,000 / 50 | +25,100 |
| **Grok Bridge** | `C:/dev/sigil-repo/modules/grok-bridge/config.json` | `dev-minimal` | 2 | 2 | 1,800 | 5,000 / 6 | +3,200 |

---

## 4. Operational Safety & Rollback Pipeline

1. **Automated Atomic Writes**: All client mutations execute via temporary staging files with immediate `.bak` fallback.
2. **Pre-Sync Snapshot Archive**: Timestamped backups stored at `C:/dev/.sigil/backups/mcp-configs-<timestamp>/`.
3. **Rollback Procedure**: To remove or revert IronLedger MCP from all clients, remove `"ironledger"` from `.sigil/mcp-registry.toml` and execute `node scripts/mcp-governance/cli.mjs sync`.
