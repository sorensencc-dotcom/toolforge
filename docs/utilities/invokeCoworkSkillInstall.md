# invokeCoworkSkillInstall

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

Register a canonical Toolforge skill into Cowork. Thin wrapper around `cowork-plugin-customizer` (`create-skill`) with consistent validation, audit logging, and exit codes.

## Tags

cowork, skills, install, registration

## Inputs

| Param | Required | Meaning |
|-------|----------|---------|
| `-SkillId` | yes | Skill id (e.g. `roadmap-validator`) |
| `-SourcePath` | yes | Path to skill source (`.SKILL.md` or skill directory) |
| `-Verbose` | no | Extra `[INFO]` / `[ERROR]` console logs |

## Outputs

- Console success/failure for the registration attempt
- Appends a row to `C:\dev\audit\COWORK-REGISTERED-SKILLS.md` (`SUCCESS` or `FAILED`)
- On failure, also appends to `C:\dev\audit\COWORK-REGISTRATION-ERRORS.md`
- Creates the audit dir / markdown tables if missing
- Exit `0` on success; `1` on validation or registration failure

## Behavior

1. Validate non-empty `SkillId` and that `SourcePath` exists.
2. Ensure `C:\dev\audit` and the two markdown logs (with table headers).
3. Call `Invoke-CliScript -Skill cowork-plugin-customizer -Action create-skill -SkillName $SkillId -SourcePath $SourcePath`.
4. Log success, or on exception write the error log + a failed registration row.

## Dependencies

- PowerShell (`$ErrorActionPreference = Stop`)
- `Invoke-CliScript` available in the session
- Cowork plugin customizer skill (`cowork-plugin-customizer`)

## Entrypoint

- **File**: `C:\dev\utilities\Invoke-CoworkSkillInstall.ps1`

## Examples

```powershell
& "C:\dev\utilities\Invoke-CoworkSkillInstall.ps1" `
  -SkillId "roadmap-validator" `
  -SourcePath "C:\dev\skills\roadmap-validator"

& "C:\dev\utilities\Invoke-CoworkSkillInstall.ps1" `
  -SkillId "toolforge-drift-monitor" `
  -SourcePath "C:\dev\skills\toolforge-drift-monitor" `
  -Verbose
```

## Notes

- Audit logs are append-only markdown tables - good for ops forensics, not a full registry API.
- Related lifecycle checks live in `toolforgeSkillValidator` / installer docs.

## See Also

- [toolforgeSkillInstaller](toolforgeSkillInstaller.md)
- [toolforgeSkillValidator](toolforgeSkillValidator.md)
- `C:\dev\audit\COWORK-REGISTERED-SKILLS.md`
