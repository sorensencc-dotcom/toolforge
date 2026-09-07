# toolforgeSkillValidator

**Category**: utilities  
**Version**: Phase 1.x refinement  
**Status**: active  
**Owner**: soren  

## Purpose

Multi-system consistency check for the skill lifecycle. Validates canonical skills, distributed copies, manifest entries, Cowork registry alignment, runtime/audit hints, and dependencies. Writes a markdown validation pack.

## Tags

validation, skills, governance

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-OutputPath` | `C:\dev\skills\SKILLPACK-VALIDATION.md` | Report path |
| `-Verbose` | off | Detailed logs |
| `-SkipGenerators` | off | Skip post-validation Phase 1.4–1.7 generators |

## Outputs

- Validation report markdown at `-OutputPath`
- Console summary of pass/warn/error counts per domain
- May chain other generators unless `-SkipGenerators`

## Behavior

Domains covered (from script design):

- Canonical skill integrity (schema / structure)
- Distributed sync under `C:\dev\rewrite-mcp\toolforge\skills`
- Manifest consistency
- Cowork registration (`audit\COWORK-REGISTERED-SKILLS.md`)
- Runtime / audit log checks (`audit\SKILL-RUN-LOG.md`)
- Dependencies

Uses `Write-IfChanged` with CRLF preservation so timestamp-only churn does not rewrite the report. Env guard `$env:TOOLFORGE_VALIDATOR_RUNNING` prevents nested re-entry (exits 0).

## Dependencies

- PowerShell
- `C:\dev\skills`, `manifest.json`, optional distributed tree and audit files

## Entrypoint

- **File**: `C:\dev\utilities\toolforgeSkillValidator.ps1`

## Schedule

On-demand; also invoked by `cowork-auto-sync.ps1` Phase 5.

## Error Handling

`$ErrorActionPreference = Stop` for hard failures. Per-skill findings accumulate as pass/warn/error. Loop guard exits 0.

## Examples

```powershell
& "C:\dev\utilities\toolforgeSkillValidator.ps1"
& "C:\dev\utilities\toolforgeSkillValidator.ps1" -Verbose -SkipGenerators
```

## Notes

- Large script (~43 KB) — prefer reading the report over grepping the source for day-to-day ops.
- Distributed path is hardcoded to `C:\dev\rewrite-mcp\toolforge`.

## See Also

- [coworkAutoSync](../daemons/coworkAutoSync.md)
- [toolforgeSkillHealthCheck](toolforgeSkillHealthCheck.md)
- [toolforgeDependencyGraph](toolforgeDependencyGraph.md)
