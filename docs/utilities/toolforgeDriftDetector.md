# toolforgeDriftDetector

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

Compares the canonical Toolforge tree (`C:\dev`) to the distributed copy (`C:\dev\rewrite-mcp\toolforge`). Surfaces missing/extra directories, tool/skill/doc drift, and `manifest.json` divergence. Can optionally copy missing pieces with `-AutoFix`.

## Tags

drift, sync, monitoring

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-OutputPath` | `C:\dev\drift\DRIFT-REPORT.md` | Report path |
| `-Verbose` | off | Detailed logs |
| `-AutoFix` | off | Attempt to sync missing skills/tools/docs/manifest into distributed |

## Outputs

- `C:\dev\drift\DRIFT-REPORT.md` (via `Write-IfChanged`)
- Console drift counts
- Exit `0` when clean / after successful run path; exit `1` when drifts remain (per script end)

## Behavior

1. Compare top-level directory sets (large exclude list: `node_modules`, archives, agent caches, etc.).
2. Diff tools, skills, docs, and manifest versions.
3. If `-AutoFix` and `totalDrifts -gt 0`, copy missing skills/tools/docs and sync `manifest.json` into the distributed tree.
4. Write the markdown report.

## Dependencies

- PowerShell
- Canonical root `C:\dev`
- Distributed root `C:\dev\rewrite-mcp\toolforge` (warns/drifts if absent)

## Entrypoint

- **File**: `C:\dev\utilities\toolforgeDriftDetector.ps1`

## Schedule

**Windows Task Scheduler**: `Toolforge Drift Detector`  
- Daily ~09:00 local (trigger `2026-08-30T09:00:00-04:00`)  
- Action: `powershell.exe … & 'C:\dev\utilities\toolforgeDriftDetector.ps1' -AutoFix; exit 0`  
Note: the scheduled command forces `exit 0`, so Task Scheduler will not fail the task on script exit 1.

## Error Handling

`$ErrorActionPreference = Stop` for unexpected failures. Drift findings are collected into the report rather than throwing per item.

## Examples

```powershell
& "C:\dev\utilities\toolforgeDriftDetector.ps1" -Verbose
& "C:\dev\utilities\toolforgeDriftDetector.ps1" -AutoFix
Get-Content C:\dev\drift\DRIFT-REPORT.md
```

## Notes

- AutoFix copies toward **distributed**, not the other way around.
- Review the exclude list before trusting "missing" findings for exotic folders.

## See Also

- [toolforgeManifestSync](../daemons/toolforgeManifestSync.md)
- Manifest skill `toolforge-drift-monitor` (TypeScript skill — separate from this utility)
