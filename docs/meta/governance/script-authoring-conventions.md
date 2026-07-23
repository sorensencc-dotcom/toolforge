# Script Authoring Conventions

Status: proposed
Owner: Chris Sorensen
Effective date: pending Tier 1 review

## Hook path resolution

Any new git hook installer must resolve paths dynamically, never hardcode
a repo-relative path assuming standalone-clone context:

- Bash: `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`, or
  `git rev-parse --show-toplevel` for the repo root.
- Node: walk up from `import.meta.url` to find `.git` — see
  `CIC-GOVERNANCE/scripts/setup-git-hook.mjs::findGitRoot`.

Reference implementations already following this pattern:
`CIC-GOVERNANCE/scripts/setup-git-hook.mjs`,
`CIC-GOVERNANCE/scripts/governance-validate-precommit.sh`.

## One hook installer per repo

Exactly one mechanism may write `.git/hooks/pre-commit` (or equivalent) in
a given repo. Before adding a second installer, check what's already
there (`git config core.hooksPath`, `.husky/`, existing npm `*setup-hook*`
scripts) and extend it instead.

This rule exists because it was violated silently at `C:\dev` root: two
installers (`setup-git-hooks.ps1`, `CIC-GOVERNANCE/scripts/setup-git-hook.mjs`)
both wrote `.git/hooks/pre-commit`, and whichever ran last silently dropped
the other's checks — including retro-schema and roadmap-location
enforcement that this repo's own governance docs document as active.
Fixed 2026-07-22 by merging into one chained shim.

## Migration dry-run

Any new backfill/migration script must accept a dry-run flag before it
can write. See `utilities/roadmap-migration-helper.ps1` (`-DryRun`) as
the reference pattern.
