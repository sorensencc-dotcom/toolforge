# roadmapMigrationHelper

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

Copy a small set of **canonical** roadmap sources to project roots based on Task 1.2 consolidation decisions. Defaults to dry-run so you can verify before writing.

## Tags

roadmap, migration

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-DryRun` | `$true` | `$true` = print would-copy; `$false` = `Copy-Item -Force` |

Mappings are hardcoded in the script (not read from the audit JSON). Current mapping:

| Source | Dest | Root |
|--------|------|------|
| `C:\dev\rewrite-docs\castironforge\cic-ingestion\toolforge\ROADMAP.md` | `C:\dev\rewrite-docs\ROADMAP.md` | rewrite-docs |

Comments in-script note cic-ingestion / rewrite-mcp already at root, and docs/meta + kb-sync have no canonical copy step.

## Outputs

- Dry-run: planned source/dest lines
- Live: copies files; exits `1` if source missing or dest missing after copy
- Console completion line with `DryRun=` flag

## Behavior

For each mapping: require source exists -> copy or print -> verify dest when not dry-run.

## Dependencies

- PowerShell
- Source file present for each active mapping

## Entrypoint

- **File**: `C:\dev\utilities\roadmap-migration-helper.ps1`

## Examples

```powershell
& "C:\dev\utilities\roadmap-migration-helper.ps1" -DryRun $true
& "C:\dev\utilities\roadmap-migration-helper.ps1" -DryRun $false
```

## Notes

- Tiny helper (~1.7 KB) - extend `$migrations` in the script if Task 1.2 decisions grow.
- Prefer dry-run after reading the consolidation audit.
- Source path includes a nested `...\toolforge\ROADMAP.md` under rewrite-docs archive layout; that is the file being copied from, not the Toolforge workspace root.

## See Also

- [roadmapConsolidationScanner](roadmapConsolidationScanner.md)
- [roadmapOrphanCleanup](roadmapOrphanCleanup.md)
