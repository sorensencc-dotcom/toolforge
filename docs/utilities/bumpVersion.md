# bumpVersion

**Category**: utilities  
**Version**: Phase 2b  
**Status**: active  
**Owner**: soren  

## Purpose

Semver bump for Toolforge `VERSION.md` (Phase 2b Step 3.1). Reads the `version: X.Y.Z` line, bumps it by patch/minor/major, rewrites the version and date lines in place, and returns the new version for callers (and GitHub Actions when `GITHUB_OUTPUT` is set).

## Tags

versioning, release, semver

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-BumpType` | `patch` | `patch` \| `minor` \| `major` |
| `-VersionFile` | `C:\dev\VERSION.md` | Path to VERSION.md |

## Outputs

- Rewrites `version:` and `date: yyyy-MM-dd` lines in the version file
- Console: `Version bumped: X.Y.Z -> A.B.C (bumpType)`
- Pipeline: the new semver string (e.g. `1.2.0`) so callers can capture it
- If `$env:GITHUB_OUTPUT` is set: appends `version=` and `previous_version=` lines (modern Actions output file)

## Behavior

1. Fail fast if the version file is missing or has no line matching `^version: X.Y.Z$`.
2. Parse major/minor/patch; apply bump (`major` resets minor+patch; `minor` resets patch).
3. Line-anchored regex replace for `version:` and `date:` only (does not touch incidental "version:" text elsewhere).
4. Write with UTF-8 and `-NoNewline`.
5. Always produces a strictly greater version for the same bump type (never silently no-ops).

## Dependencies

- PowerShell (`$ErrorActionPreference = Stop`)
- A well-formed `VERSION.md` with `version:` / `date:` lines

## Entrypoint

- **File**: `C:\dev\utilities\bump-version.ps1`

## Examples

```powershell
& "C:\dev\utilities\bump-version.ps1" -BumpType patch
$new = & "C:\dev\utilities\bump-version.ps1" -BumpType minor
& "C:\dev\utilities\bump-version.ps1" -BumpType major -VersionFile "C:\dev\VERSION.md"
```

## Notes

- Uses `GITHUB_OUTPUT` (not the deprecated `::set-output` workflow command).
- Pair with `generate-changelog.ps1` when cutting a release entry.

## See Also

- [generateChangelog](generateChangelog.md)
- `C:\dev\VERSION.md`
