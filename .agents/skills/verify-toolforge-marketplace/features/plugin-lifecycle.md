# Plugin lifecycle

Plugin lifecycle lets a developer register a local plugin directory containing a valid manifest, list all active plugins, execute dynamic plugin namespace commands, and cleanly unregister plugins from the system.

## Sub-features

- `plugin-register` registers a directory with a valid manifest and entrypoint into the local plugin registry.
- `plugin-list` lists registered plugin IDs, versions, and physical source paths.
- `plugin-exec` routes dynamic namespace commands and passes validated arguments to the plugin entrypoint.
- `plugin-remove` deregisters a plugin ID from the registry and restores the clean baseline.

## How to get to it (user POV)

- Run `toolforge plugins add <path>` in the terminal.
- Run `toolforge plugins list` in the terminal.
- Run `toolforge exec <plugin-id> <command-name> [args..]` or dynamic namespace invocation `toolforge <namespace> <command> [args..]`.
- Run `toolforge plugins remove <plugin-id>` in the terminal.

## Driving it with control-marketplace

Preconditions:

- `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs doctor` reports PASS.
- A disposable `sandbox-home` directory is isolated under `evidence/verify-toolforge-marketplace/<run-id>/`.
- A valid sample plugin directory exists with `manifest.json` and `index.js`.

- **Drive complete lifecycle.** Execute the automated end-to-end driver:
  Run `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs drive plugin-lifecycle --run-id <run-id>`.
  Exit code `0` and console output shows:
  - Registration confirmation: `✓ Successfully registered plugin Verify Echo (verify-echo) v1.0.0`.
  - Registry inspection: `Registered Plugins: - Verify Echo (verify-echo) v1.0.0 at <path>`.
  - Command execution: `{ "reply": "verification-token-42", ... }`.
  - Removal confirmation: `✓ Successfully removed plugin verify-echo`.

- **Confirm evidence artifact.** Inspect `evidence/verify-toolforge-marketplace/<run-id>/plugin-lifecycle-proof.json`.
  Contains `verdict: "PASS"`, the exact steps executed, and output objects from each lifecycle phase.

- **Confirm registry isolation.** Inspect `evidence/verify-toolforge-marketplace/<run-id>/sandbox-home/.toolforge/plugins.json` after removal.
  The array is empty (`[]`) or unmapped, confirming no dangling plugin registrations remain in the sandbox.

## Gotchas

- Omitting `USERPROFILE` or `HOME` environment redirection during ad-hoc CLI testing writes to host `~/.toolforge/plugins.json` and mutates local user setup.
- Manifest files require `id`, `name`, `version`, and `entrypoint` (or `main`); omitting any of these causes `plugins add` to reject registration with exit code 1.
- Plugin command arguments defined under `argsSchema: 'v1'` require all positional arguments marked `required: true`; passing fewer parameters causes an instant schema rejection.
