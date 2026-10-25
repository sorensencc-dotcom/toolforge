# Toolforge Marketplace verification map

This directory is the maintained source for verifying the user-facing behavior of Toolforge Marketplace. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Node.js runtime >= v18 installed on the host system.
- Ensure CLI entrypoint `src/cli/index.js` and canonical registry `manifest.json` are present.
- Set `USERPROFILE` (and `HOME`) to a disposable scratch directory (e.g. `evidence/verify-toolforge-marketplace/$RUN_ID/sandbox-home`) so verification runs never read or write user-level `~/.toolforge/plugins.json` or pollute host config.
- Run `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs doctor` and require all 5 environment and syntax checks to PASS before driving any feature.
- Never drive a shared or unisolated global instance: always pass isolated working directories or run-id scoping.

## Driving conventions

- Start every recipe from the baseline doctor-verified state.
- Run CLI commands through the isolated wrapper: `node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs cli -- <command>` or via the direct CLI binary `node src/cli/index.js <command>` with `USERPROFILE` scoped.
- Treat every command and option as literal.
- Never delete proof artifacts during cleanup; cleanup removes only temporary sandbox homes and scratch mock files.
- Capture stdout, stderr, exit codes, and filesystem artifacts for all verification claims.

## Proof and skip reporting

- Capture the user action and the resulting system state, not only the final CLI exit status.
- CLI proof includes command executed, exit code, stdout transcript, and generated JSON records.
- Mutation proof includes verifying the filesystem artifact (e.g. `.toolforge-install.json`, registered plugin entry in `plugins.json`, or validator test summaries).
- Record the feature ID and entry point used with every artifact in `evidence/verify-toolforge-marketplace/<run-id>/`.
- If an external dependency (like a remote PostgreSQL instance) is absent, report the skip cleanly and verify local deterministic capabilities rather than asserting false passes.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order:

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-marketplace` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Plugin lifecycle](./plugin-lifecycle.md) covers registering plugins, listing plugins, executing dynamic plugin commands, and removing plugins via the CLI.
- [Skill discovery](./skill-discovery.md) covers browsing catalog skills, filtering by category, and searching queries via CLI and API routes.
- [Skill installation](./skill-installation.md) covers installing skills by name or version, destination directory placement, and installation metadata receipts.
- [Marketplace trending](./marketplace-trending.md) covers calculating and viewing 7-day and 30-day trending skills, growth percentages, and rankings.
- [Manifest validation](./manifest-validation.md) covers validating skill manifests and resolving SemVer version constraints.
