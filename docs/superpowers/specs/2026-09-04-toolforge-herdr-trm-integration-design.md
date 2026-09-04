# Toolforge, Herdr, and TRM Self-Healing Integration Design

## Overview

This specification establishes the end-to-end integration architecture binding **Toolforge** (distributed skill registry and MCP server), **Herdr** (PTY and workspace multiplexer), **TRM** (telemetry, diagnostics, and triage), and **Sigil** (cryptographic WebAuthn biometric gate).

The architecture formalizes:
1. Manifest schema definition using Draft-07 JSON Schema.
2. Skill registration for Tier-1 triage (`trm-tinyfish-triage`), Tier-2 research escalation (`trm-parallel-escalation`), and cryptographic guard verification (`trm-sigil-guard`).
3. An idempotent installer script (`scripts/install-plan.js`) that validates schemas, merges registries without data corruption, and verifies runtime paths.
4. Multiplexer configuration (`.herdr/config.toml`) and startup automation (`scripts/start-herd.ps1` / `scripts/start-herd.sh`) with semantic state hooks.

---

## Architecture & Components

### 1. File Structure

```
c:/dev/
├── schemas/
│   └── toolforge-manifest-schema.json    # Canonical Draft-07 JSON Schema definition
├── skills/
│   └── trm-self-healing/
│       ├── manifest.json                 # Package manifest declaring triage and guard skills
│       ├── package.json                  # Module dependencies and scripts
│       └── src/
│           ├── trm-tinyfish-triage.ts    # Tier-1 signature matching + TinyFish API search
│           ├── trm-parallel-escalation.ts# Tier-2 deep research + workaround synthesis
│           └── trm-sigil-guard.ts        # Sigil loopback gate + WebAuthn verification
├── scripts/
│   ├── install-plan.js                   # Node.js schema validator and idempotent registry merger
│   ├── start-herd.ps1                   # Windows PowerShell bootstrap and pre-flight launcher
│   └── start-herd.sh                    # POSIX shell bootstrap launcher
├── .herdr/
│   └── config.toml                       # Herdr multiplexer configuration and semantic hooks
└── manifest.json                         # Global Toolforge skill registry
```

---

## Component Specifications

### 2. JSON Schema Definition (`schemas/toolforge-manifest-schema.json`)

The schema enforces strict validation on registered skills:
- **Root Fields**: `name`, `version`, `description`, `skills`.
- **Skill Item Fields**: `id`, `name`, `description`, `entrypoint`, `runtime` (`node`, `python`, `bash`), `inputs`, `outputs`.
- **Execution Policy**: Optional `permissions` object defining `filesystem` access level (`deny`, `read-only`, `read-write`) and `network` host allowlists.
- **Environment Policy**: Optional `environment` map tracking required variables, default values, and secure masking flags.

### 3. Skill Manifest (`skills/trm-self-healing/manifest.json`)

Registers three core capabilities:
- **`trm-tinyfish-triage`**:
  - Runtime: `node`
  - Permissions: `filesystem: "read-only"`, `network: ["api.tinyfish.io"]`
  - Environment: `TINYFISH_API_KEY` (required, secure)
- **`trm-parallel-escalation`**:
  - Runtime: `node`
  - Permissions: `filesystem: "read-only"`, `network: ["api.parallel.ai"]`
  - Environment: `PARALLEL_API_KEY` (required, secure)
- **`trm-sigil-guard`**:
  - Runtime: `node`
  - Permissions: `filesystem: "read-write"`, `network: ["127.0.0.1:8787", "127.0.0.1:8795"]`
  - Environment: `SIGIL_CONNECTOR_URL`, `SIGIL_CONNECTOR_TOKEN` (required, secure)

### 4. Idempotent Merge & Installation Engine (`scripts/install-plan.js`)

The installer executes the following sequence:
1. **Validation**: Compiles and tests target manifest files against `schemas/toolforge-manifest-schema.json`.
2. **Registry Resolution**: Reads `C:\dev\manifest.json` and optional user profile registry `~/.toolforge/manifest.json`.
3. **Merge Algorithm**:
   - Matches skills by `id`.
   - Updates existing skill metadata if the incoming version is newer or modified.
   - Appends new skills without removing unreferenced active tools.
4. **Pre-flight Health Checks**: Verifies that entrypoint paths resolve to physical files on disk and validates runtime executable availability.
5. **Dry-Run Flag**: `--dry-run` emits unified JSON diffs without writing modifications to disk.

### 5. Herdr Multiplexer Configuration (`.herdr/config.toml`)

- **Server**: Daemon binds to `127.0.0.1:8792` with SQLite persistence at `~/.herdr/state.db`.
- **Workspaces**: Uses git worktrees located at `~/dev/dev-sandbox/trm-devops/workspaces`.
- **Profiles**: Preconfigures `claude-code`, `codex`, and `opencode` with Sigil connector environment variables and PTY settings.
- **MCP Server Staging**: Spawns Toolforge stdio MCP server (`sigil/connectors/v1/mcp-stdio-server.mjs`) on startup.
- **Semantic State Hooks**:
  - `on_working`: Pushes telemetry to TRM socket (`127.0.0.1:8795`).
  - `on_idle`: Updates monitoring buffers.
  - `on_blocked`: Flags session as `◉ Blocked` and sends notification when waiting on Sigil WebAuthn biometric verification.
  - `on_done`: Completes task logging and triggers NotebookLM operational sync.

### 6. Fleet Launcher Script (`scripts/start-herd.ps1`)

Automates operator startup:
1. Validates local loopback connectivity to `SIGIL_CONNECTOR_URL` (`http://127.0.0.1:8787`).
2. Confirms presence of `SIGIL_CONNECTOR_TOKEN`.
3. Checks if Herdr daemon is running; if not, spawns the server process.
4. Initializes agent panes with the selected profile.

---

## Security & Isolation Guardrails

1. **Zero-Trust Network Access**: All inter-process communication remains bound to `127.0.0.1`.
2. **Secret Masking**: All keys (`TINYFISH_API_KEY`, `PARALLEL_API_KEY`, `SIGIL_CONNECTOR_TOKEN`) are marked `secure: true` in manifests and stripped from debug traces and logs.
3. **Biometric Gate**: Modifying file operations require physical Touch ID / Windows Hello WebAuthn signing via Sigil connector before release from `blocked` state.

---

## Verification Plan

### Automated Verification
1. Validate JSON schema syntax:
   ```powershell
   node -e "const Ajv = require('ajv'); const ajv = new Ajv(); const schema = require('./schemas/toolforge-manifest-schema.json'); ajv.compile(schema); console.log('Schema valid');"
   ```
2. Run installer dry run:
   ```powershell
   node scripts/install-plan.js --dry-run
   ```
3. Run full installation and verify `manifest.json` integrity:
   ```powershell
   node scripts/install-plan.js
   ```
4. Verify entrypoint resolution and syntax across registered TypeScript/JavaScript files.

### Manual Verification
1. Start Herdr daemon and test hook execution against mock state transitions (`working` -> `blocked` -> `done`).
2. Verify visual indicator and direct pane attach during simulated Sigil approval prompt.
