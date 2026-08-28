# Project status

## Current goal
Maintain the cross-repository governance CI matrix and onboard repositories in waves.

## Completed work
- Added the CI governance matrix for the initial repositories.
- Added Wave 2 entries for `toolforge` and `sigil-repo`.
- Added Wave 3 entries for `cic-vision-governance`, `charlie-deep-research`, `financeos`, and `TheFoundry`.
- Pushed commits `09657c0d` and `ae0ddc1` to `feat/openrouter-oxalpha-integration`.

## Decisions
- `AGENTS.md` is the canonical shared instruction surface.
- `CLAUDE.md` imports `AGENTS.md` instead of duplicating project rules.
- Wave 3 repositories use the standard `gov:validate` and `gov:smoke` contract until their manifests expose verified commands.

## Tests
- Initial governance matrix commands passed for the four established repositories.
- Matrix structure verified with 10 repository entries, 10 validation commands, and 10 smoke commands.
- Wave 3 commands were not executable locally because several checkouts lack package manifests or governance scripts.

## Blockers
- Wave 3 repository command entry points remain unverified in local checkouts.

## Next action
Confirm Wave 3 repository manifests and replace placeholder governance commands with executable adapters.