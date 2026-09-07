# toolforgeSkillInstaller

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

Promotes skills from the pending-install inbox through the full lifecycle: canonical install → distributed sync → `manifest.json` registration → Cowork registration helper → cleanup / report.

## Tags

installer, skills, lifecycle

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-PendingDir` | `C:\dev\audit\new-skills-pending-install` | Inbox of skills waiting install |
| `-Verbose` | off | Detailed logs |

Pending items can be skill directories or `.SKILL.md` / paired `.SKILL.json` files. Metadata prefers `SKILL.json` when present.

## Outputs

- Installed skill trees under `C:\dev\skills\`
- Sync into `C:\dev\rewrite-mcp\toolforge\skills` when that tree exists
- Updated `manifest.json`
- Calls `Invoke-CoworkSkillInstall.ps1` for Cowork registration
- Report: `C:\dev\audit\SKILL-INSTALL-REPORT.md`
- Moves processed items under `audit\installed-skills`
- Exit `0` if all succeed; exit `1` if any skill failed

## Behavior

For each pending skill: read metadata → copy into canonical → sync distributed → upsert manifest → invoke Cowork wrapper → record success/failure → write report.

## Dependencies

- PowerShell
- `C:\dev\utilities\Invoke-CoworkSkillInstall.ps1`
- Writable `skills\`, `manifest.json`, `audit\`

## Entrypoint

- **File**: `C:\dev\utilities\toolforgeSkillInstaller.ps1`

## Schedule

On-demand (no dedicated scheduled task found in Sep 2026 pass).

## Error Handling

`$ErrorActionPreference = Stop` inside the installer; failures are caught per skill into the `failed` list so one bad package does not necessarily hide others (aggregate exit code reflects failures).

## Examples

```powershell
& "C:\dev\utilities\toolforgeSkillInstaller.ps1"
& "C:\dev\utilities\toolforgeSkillInstaller.ps1" -Verbose
Get-Content C:\dev\audit\SKILL-INSTALL-REPORT.md
```

## Notes

- Drop new skills in the pending directory first; do not hand-edit production trees as the primary install path.
- Cowork registration quality depends on the wrapper + cowork-plugin-customizer availability.

## See Also

- [toolforgeSkillValidator](toolforgeSkillValidator.md)
- [coworkAutoSync](../daemons/coworkAutoSync.md)
