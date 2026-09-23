# Multi-Agent Memory Synchronization to Obsidian Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular, idempotent multi-agent memory sync utility connecting Claude Code, Antigravity, OpenAI Codex, Grok/Sigil Bridge, and Local Models to the canonical Obsidian Vault.

**Architecture:** Node.js/CommonJS modular engine in `sync-tools/` with extensible adapters subclassing `BaseAgentAdapter`, safe atomic writes with `.tmp` and `.bak` retry loops, format-aware Markdown managed regions and JSON mutators, and PowerShell integration.

**Tech Stack:** Node.js, CommonJS, Vitest/Node Test Runner, PowerShell 7, `diagram-tools.mjs` (Cathryn Lavery standard), OpenAI Codex CLI.

## Global Constraints
- Target directory: `sync-tools/` with `sync-tools/lib/` and `sync-tools/adapters/`.
- Fail-closed vault resolution: Halt with exit code 1 and `ERR_VAULT_NOT_FOUND` if vault is missing or invalid.
- File encodings: Pure UTF-8 without BOM on output; CRLF/LF line-ending preservation.
- Atomic replacement: `.tmp.<pid>.<time>.<rand>` + `fsync` + retry on Windows `EPERM`/`EBUSY` + `.bak` rollback.
- Receipt contract: Array returned on all paths, 1 receipt per target, sorted by `targetFile`, `changesMade === true` iff `status === "CREATED" || "UPDATED"`.

---

### Task 1: Vault Context & Root Path Resolver
- **Files:** Create `sync-tools/lib/vault-context.cjs`, Test `tests/sync-tools/vault-context.test.mjs`
- **Deliverable:** Fail-closed path resolver, tilde expansion, repository traversal, and sentinel validation (`Index.md` / `Log.md`).

### Task 2: Windows-Safe Atomic Replacement (`safe-write.cjs`)
- **Files:** Create `sync-tools/lib/safe-write.cjs`, Test `tests/sync-tools/safe-write.test.mjs`
- **Deliverable:** Atomic temp file write, `fsync`, Windows lock exponential backoff retry, collision-safe `.bak` rollback.

### Task 3: Format-Safe Mutators (Markdown Managed Region & JSON Mutator)
- **Files:** Create `sync-tools/lib/managed-region.cjs`, `sync-tools/lib/json-region.cjs`, Test `tests/sync-tools/mutators.test.mjs`
- **Deliverable:** CRLF/LF preservation, BOM stripping, HTML comment marker injection, and indentation-aware JSON mutation.

### Task 4: Base Agent Adapter Contract
- **Files:** Create `sync-tools/lib/base-adapter.cjs`
- **Deliverable:** Abstract base class enforcing deterministic array receipts and `status` vs `changesMade` invariants.

### Task 5: Agent Adapters Implementation
- **Files:** Create `sync-tools/adapters/claude-code.cjs`, `antigravity.cjs`, `codex.cjs`, `grok.cjs`, `local-models.cjs`, `index.cjs`, Test `tests/sync-tools/adapters.test.mjs`
- **Deliverable:** Adapter roster with exact sanitization, target write governance rules, and auto-discovery index loader.

### Task 6: Workspace Discovery with Ignore Rules
- **Files:** Create `sync-tools/lib/workspace-discovery.cjs`, Test `tests/sync-tools/discovery.test.mjs`
- **Deliverable:** Discovery precedence, normalized case-insensitive ignore set (`node_modules`, `.worktrees`, `_kb-sync-staging`), and symlink cycle prevention.

### Task 7: CLI Orchestrator & PowerShell Integration
- **Files:** Create `sync-tools/agent-memory-sync.cjs`, Modify `toolforge.ps1`, `package.json`
- **Deliverable:** Unified CLI with `--dry-run`, `--agent`, `--all`, deterministic summary report, and exit code handling.

### Task 8: Cathryn Lavery Architecture Diagrams
- **Files:** Create `docs/superpowers/specs/assets/agent-memory-sync-topology.html` & `.png`, `agent-onboarding-flow.html` & `.png`
- **Deliverable:** Standalone HTML+SVG and rendered PNG visual specifications using the warm palette.

### Task 9: Full Acceptance Test Suite & OpenAI Codex Second-Opinion Review
- **Files:** Create `tests/sync-tools/acceptance.test.mjs`
- **Deliverable:** Comprehensive test matrix execution, live smoke run on `C:/dev/sigil-repo`, and Codex verification pass.
