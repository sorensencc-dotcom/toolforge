# Pre-commit hook: roadmap location check

**Status:** Implemented in the generated pre-commit hook. Reviewed against code 2026-10-05.
**Source of truth:** `Test-RoadmapLocations` in `setup-git-hooks.ps1` (repo root). The installer writes it to `.git/hooks/pre-commit.ps1`, which `.git/hooks/pre-commit` invokes.

## Purpose

Block commits that add a `ROADMAP.md` outside the locations the governance policy allows.

## Behavior

`Test-RoadmapLocations` runs as Gate 2 on every commit, before the validator gate. It:

1. Lists staged paths with `git diff --cached --name-only`.
2. Matches paths ending in `roadmap.md`, case-insensitively.
3. Accepts a match only when the path starts with one of `docs/meta`, `cic-ingestion`, `rewrite-docs`, `rewrite-mcp`, or `kb-sync`.
4. On a violation, prints the allowed roots and the offending paths, then exits 1.

The check matches on a path prefix, so `docs/metadata/ROADMAP.md` also passes. Treat the allowed-roots list as the contract and tighten the prefix match if that becomes a problem.

## Installation

`.git/hooks/` is not tracked by Git. A fresh clone has no hook until you run `setup-git-hooks.ps1` from the repo root. Edit the check in that installer, never in the installed copy; the next install overwrites the installed copy.

The installer lived at `utilities/setup-git-hooks.ps1` when this check shipped (2026-07-21). It now lives at the repo root.

## Not covered

- The bash `check_roadmap_locations()` function described in earlier versions of this note does not exist. The check is PowerShell.
- No CI job enforces roadmap location on `main`. A `roadmap-location` job in `.github/workflows/governance.yml` exists only on the unmerged `parkd821-20260908` branch. Until it merges, a commit made with the hook missing or bypassed (`--no-verify`) reaches `main` unchecked.
- `docs/meta/roadmap-consolidation-design.md`, cited by earlier versions as the spec, does not exist in the repo.

## Governance

Policy: `docs/meta/governance/documentation-policy.md`.
