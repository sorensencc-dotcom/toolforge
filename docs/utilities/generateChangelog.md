# generateChangelog

**Category**: utilities  
**Version**: Phase 2b  
**Status**: active  
**Owner**: soren  

## Purpose

Generate / prepend a `CHANGELOG.md` section from git history since the last tag (Phase 2b Step 3.2). Reads the current version from `VERSION.md`, collects commits, and keeps a single `# Changelog` H1 with newest entries on top.

## Tags

changelog, release, git

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-OutputFile` | `C:\dev\CHANGELOG.md` | Changelog path |
| `-VersionFile` | `C:\dev\VERSION.md` | Source of current `version: X.Y.Z` |
| `-RepoRoot` | `C:\dev` | Git repo root for `git log` / `git describe` |

## Outputs

- Updated changelog markdown at `-OutputFile`
- Console summary: version, commit count, and "since last tag / start"

## Behavior

1. Require version file + `.git` under `RepoRoot`.
2. Parse current version from `VERSION.md`.
3. `git describe --tags --abbrev=0` for last tag (explicit `$LASTEXITCODE` check; no bash `||` fallback). If no tag, range is full `HEAD`.
4. `git log <range> --pretty=format:"%h - %s (%an)"`.
5. Build `## Version X.Y.Z` / `Date:` / `### Changes` block (or a "No changes recorded..." bullet).
6. Strip any leading `# Changelog` from the old body, then rewrite as `# Changelog` + new entry + previous body (prevents H1 duplication on re-runs).

## Dependencies

- PowerShell
- `git` on PATH
- Valid `VERSION.md` and git repo at `RepoRoot`

## Entrypoint

- **File**: `C:\dev\utilities\generate-changelog.ps1`

## Examples

```powershell
& "C:\dev\utilities\generate-changelog.ps1"
& "C:\dev\utilities\generate-changelog.ps1" -OutputFile "C:\dev\CHANGELOG.md"
```

## Notes

- Deterministic on Windows PowerShell 5.1 and pwsh 7+ (no bash-isms).
- Typically run after `bump-version.ps1` so the section heading matches the new version.

## See Also

- [bumpVersion](bumpVersion.md)
- `C:\dev\CHANGELOG.md`
