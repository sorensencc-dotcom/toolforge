# coworkAutoSync

**Category**: daemons  
**Version**: Phase 1.7  
**Status**: active  
**Owner**: soren  

## Purpose

Keeps the Cowork registry lined up with canonical Toolforge skills. Scans `C:\dev\skills`, compares versions to `audit\COWORK-REGISTERED-SKILLS.md`, rewrites that registry when skill metadata changes, then kicks the validator / dep-graph / metadata / health-check utilities.

Built to run as a scheduled or on-demand PowerShell job.

## Tags

daemon, cowork, skills, sync

## Inputs

- Canonical skill folders under `C:\dev\skills\` (skips `_TEMPLATE`; needs `SKILL.json`)
- Existing Cowork registry markdown (optional on first run)
- Switch: `-Verbose` for detailed console logs

## Outputs

- `C:\dev\audit\COWORK-REGISTERED-SKILLS.md` — registry table (only rewritten when skill-relevant content changes)
- `C:\dev\audit\COWORK-AUTO-SYNC-REPORT.md` — run summary + action log
- Console progress per phase
- Side effect: runs `toolforgeSkillValidator`, `toolforgeDependencyGraph`, `toolforgeMetadataGenerator`, `toolforgeSkillHealthCheck` when those scripts exist

## Behavior

1. **Guard**: if `$env:TOOLFORGE_SYNC_RUNNING` is set, exits 0 to avoid re-entry loops.
2. **Phase 1**: load every skill dir with `SKILL.json` into an in-memory canonical map.
3. **Phase 2**: parse the Cowork registry markdown table (warns and continues if missing).
4. **Phase 3**: compare — count new registrations and version updates (logging only at this stage).
5. **Phase 4**: regenerate the Cowork registry markdown from canonical state via `Write-IfChanged` (skips disk write when normalized content matches).
6. **Phase 5**: invoke the four utilities above.
7. Always write/check the sync report, then clear the env guard.

## Dependencies

- PowerShell 7+
- Companion utilities under `C:\dev\utilities\` (validator, dep graph, metadata gen, health check)

## Entrypoint

- **File**: `C:\dev\daemons\cowork-auto-sync.ps1`
- **Runtime**: PowerShell

## Configuration

Paths are derived from `$PSScriptRoot\..` (repo root = `C:\dev`):

| Role | Path |
|------|------|
| Canonical skills | `skills\` |
| Cowork registry | `audit\COWORK-REGISTERED-SKILLS.md` |
| Sync report | `audit\COWORK-AUTO-SYNC-REPORT.md` |
| Validator | `utilities\toolforgeSkillValidator.ps1` |
| Dep graph | `utilities\toolforgeDependencyGraph.ps1` |
| Metadata | `utilities\toolforgeMetadataGenerator.ps1` |
| Health check | `utilities\toolforgeSkillHealthCheck.ps1` |

## Schedule

No dedicated Task Scheduler entry found on this machine as of the Sep 2026 docs pass. Run manually or wire a task yourself. Comment in script: designed for Task Scheduler.

## Error Handling

- Exit `0` when already running (loop guard) or on success
- Exit `1` if canonical load, skill sync, or registry update fails
- Validator phase failures are warnings; report still generates
- `$ErrorActionPreference = Continue` so one bad skill JSON does not abort the whole scan

## Examples

```powershell
& "C:\dev\daemons\cowork-auto-sync.ps1"
& "C:\dev\daemons\cowork-auto-sync.ps1" -Verbose
Get-Content C:\dev\audit\COWORK-AUTO-SYNC-REPORT.md
```

## Notes

- Registry writes strip timestamps before comparing, so pure clock churn does not dirty the file.
- Phase 3 logs "registered/updated" counts; the real registry rewrite is Phase 4 from full canonical state.
- Does **not** call Cowork APIs directly — it maintains local audit markdown and downstream generators.

## See Also

- [toolforgeManifestSync](toolforgeManifestSync.md)
- [toolforgeDocsSync](toolforgeDocsSync.md)
- Utilities: `toolforgeSkillValidator`, `toolforgeMetadataGenerator`, `toolforgeSkillHealthCheck`, `toolforgeDependencyGraph`
