# Parallel Search

Fail-closed TypeScript wrappers for Parallel Search, Extract, and asynchronous Task Run creation.

## Purpose

Provide deterministic current-web operations without exposing provider credentials or raw provider failures.

## Usage

Set `PARALLEL_API_KEY`, then call exports from `src/index.ts`.

## Permissions

Requires outbound web access to Parallel and no filesystem write access.

See [docs/USAGE.md](docs/USAGE.md) for inputs, outputs, and error handling.

See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for Toolforge conventions.
