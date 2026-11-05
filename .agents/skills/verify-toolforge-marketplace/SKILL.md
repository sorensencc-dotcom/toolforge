---
name: verify-toolforge-marketplace
description: "Verify Toolforge Marketplace CLI, API, and UI behavior: launch isolated instances, run doctor checks, drive mapped features, and capture verifiable proof."
---

# Verify Toolforge Marketplace

Toolforge Marketplace provides the central registry, CLI, and Web UI for discovering, installing, executing, and publishing agent skills. This verification skill enables an autonomous agent to launch the marketplace services or isolated CLI sessions, execute doctor diagnostic checks, drive mapped user features, and capture deterministic evidence before claiming tasks are complete.

## Launch

For CLI and validator features, no persistent daemon server is required: launch builds dependencies and prepares an isolated sandbox directory (`evidence/verify-toolforge-marketplace/<run-id>/sandbox-home`) with `USERPROFILE` and `HOME` redirected so tests never touch host `~/.toolforge/plugins.json`.

For API or UI server verification:

```bash
# Start the Marketplace API server in background with ephemeral port or PORT=3000
node src/api/server.js
```

Readiness is signaled when the process logs:
`Marketplace API listening on port <PORT>`
and HTTP GET `/health` responds with HTTP 200 `{ "status": "ok" }` (or `{ "status": "unhealthy" }` if PostgreSQL is offline).

For the React Web UI:
```bash
# Build the production UI assets
npm run ui:build

# Preview the built UI on port 5173
npm run ui:preview
```

Ready when `Local: http://localhost:5173/` is printed to stdout.

Teardown: Kill the specific server process using its PID recorded at launch. Never kill processes by image name (`node.exe`).

## Doctor

Before driving any feature, run the diagnostic doctor check:

```bash
node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs doctor [--run-id <run-id>]
```

The doctor verifies:
1. Node.js runtime version is >= v18 (current host: v24.18.0).
2. CLI binary exists at `src/cli/index.js` and successfully responds to `--help` with command catalogue (`install`, `list`, `search`, `plugins`, `exec`).
3. Core API server module exists at `src/api/server.js`.
4. Canonical registry manifest `manifest.json` exists and parses valid JSON.
5. Manifest contains >= 60 registered skills with valid schema attributes.

If any check returns `[FAIL]`, halt and resolve the configuration issue before attempting to drive features. Doctor writes an audit trail to `evidence/verify-toolforge-marketplace/<run-id>/doctor-report.json`.

## Drive

Drive features using the provided control helper script or exact repo commands. Always pass `--run-id <run-id>` to keep evidence isolated:

### 1. Drive CLI Plugin Lifecycle
Register a plugin, list active registrations, execute a dynamic plugin command, and remove the plugin:

```bash
node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs drive plugin-lifecycle --run-id <run-id>
```

### 2. Drive CLI Commands in Isolated Sandbox
Run arbitrary marketplace CLI commands without polluting the user's host environment:

```bash
# List available skills
node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- list --api-url <url> --limit 10

# Search skills
node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- search auth --api-url <url>

# Manage plugins
node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- plugins list
```

### 3. Drive Manifest & SemVer Validators
Run the complete 60-test verification suite for manifest integrity and SemVer constraint resolution:

```bash
node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs drive manifest-validation --run-id <run-id>
```

### 4. Drive Feature Map Recipes
Consult `.agents/skills/verify-toolforge-marketplace/features/` for detailed step-by-step driving contracts:
- [Plugin lifecycle](file:///C:/dev/.agents/skills/verify-toolforge-marketplace/features/plugin-lifecycle.md)
- [Skill discovery](file:///C:/dev/.agents/skills/verify-toolforge-marketplace/features/skill-discovery.md)
- [Skill installation](file:///C:/dev/.agents/skills/verify-toolforge-marketplace/features/skill-installation.md)
- [Marketplace trending](file:///C:/dev/.agents/skills/verify-toolforge-marketplace/features/marketplace-trending.md)
- [Manifest validation](file:///C:/dev/.agents/skills/verify-toolforge-marketplace/features/manifest-validation.md)

## Evidence

Every verification run records proof artifacts in:
`evidence/verify-toolforge-marketplace/<run-id>/`

Proof standards enforced:
- **Real user paths**: Exercise actual CLI entrypoints and HTTP endpoints; do not rely on mock internal function setters.
- **Action and resulting state**: Capture both command invocation and side effects (e.g. entry added to `plugins.json`, receipt written to `.toolforge-install.json`, exit code `0`).
- **Surviving proof**: Evidence artifacts (`doctor-report.json`, `*-proof.json`, `cli-*.json`) MUST survive teardown and cleanup.
- **Deterministic verification**: When external dependencies (e.g. live PostgreSQL) are absent, capture the clean skip or fallback behavior rather than reporting false positive passes.

## Cleanup

Teardown cleans up ephemeral runtime state, killed child server PIDs, and scratch directories while keeping proof artifacts intact:

```bash
node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cleanup --run-id <run-id>
```

Cleanup actions:
1. Terminates running verification server PID if recorded in `run-state.json`.
2. Removes disposable `sandbox-home` (`~/.toolforge/`) scratch directory.
3. Removes temporary sample plugin source directories.
4. Preserves all `*-proof.json`, `doctor-report.json`, and CLI execution logs in `evidence/verify-toolforge-marketplace/<run-id>/`.

## Helpers

The verification skill provides an executable control script located at:
`.agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs`

Subcommands:
- `doctor [--run-id <id>]`: Runs diagnostic environment and syntax checks.
- `cli -- <args..> [--run-id <id>]`: Executes the Toolforge CLI inside an isolated sandbox environment.
- `drive <feature-name> [--run-id <id>]`: Executes mapped feature verification flows (`plugin-lifecycle`, `manifest-validation`).
- `cleanup [--run-id <id>]`: Tears down running processes and temporary sandbox files while preserving evidence.
