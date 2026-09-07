# toolforgeSkillHealthCheck

**Category**: utilities  
**Version**: Phase 1.6  
**Status**: active  
**Owner**: soren  

## Purpose

Checks whether skills look runnable: entrypoint present, runtime bits available, optional dry-run, dependency presence, and manifest ↔ runtime consistency. Writes a runtime health report and can append new warnings into `TODOS.md`.

## Tags

health, skills, monitoring

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-OutputPath` | `C:\dev\skills\SKILLPACK-RUNTIME-HEALTH.md` | Health report |
| `-TodosPath` | `C:\dev\TODOS.md` | Backlog file for new warnings |
| `-DryRun` | `$true` | Whether dry-run execution checks run |
| `-Verbose` | off | Detailed logs |

## Outputs

- Markdown health report at `-OutputPath`
- Possible updates to `TODOS.md` when new skill/manifest warnings appear
- Console pass/warn/fail tallies

## Behavior

1. Env guard `$env:TOOLFORGE_HEALTHCHECK_RUNNING` → exit 0 if already running.
2. Walk canonical skills (skips internal helpers like `_cic-shared` where configured).
3. Record per-skill checks (pass / warn / fail) with timestamps.
4. `Write-IfChanged` the report so empty churn does not rewrite the file.
5. Sync newly observed warnings into the todos file when that path exists.

## Dependencies

- PowerShell
- `C:\dev\skills`, `manifest.json`
- Optional: `audit\SKILL-RUN-LOG.md`

## Entrypoint

- **File**: `C:\dev\utilities\toolforgeSkillHealthCheck.ps1`

## Schedule

On-demand; also triggered from `cowork-auto-sync.ps1`.

## Error Handling

`$ErrorActionPreference = Continue` so one bad skill does not abort the pack. Loop guard exits 0.

## Examples

```powershell
& "C:\dev\utilities\toolforgeSkillHealthCheck.ps1"
& "C:\dev\utilities\toolforgeSkillHealthCheck.ps1" -DryRun:$false -Verbose
```

## Notes

- Default dry-run is on — safer for scheduled chains.
- Report path lives under `skills\`, not `docs\`.

## See Also

- [toolforgeSkillValidator](toolforgeSkillValidator.md)
- [coworkAutoSync](../daemons/coworkAutoSync.md)
