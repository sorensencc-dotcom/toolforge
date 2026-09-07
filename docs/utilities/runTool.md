# runTool

**Category**: utilities  
**Version**: 1.0 (utilities launcher)  
**Status**: active (execution stubs)  
**Owner**: soren  

## Purpose

Discover and pick Toolforge skills from `manifest.json`. Lists active skills, shows metadata, and can target one skill by ID. Interactive menu when you do not pass `-SkillId` or `-ListOnly`.

## Tags

launcher, skills, manifest

## Inputs

| Param | Meaning |
|-------|---------|
| `-ListOnly` | Print active skills and exit |
| `-SkillId <id>` | Run that skill (skip menu) |
| `-Verbose` | Extra log lines + skill detail dump |

Reads `C:\dev\manifest.json` and expects skill folders under `C:\dev\skills\<id>\`.

## Outputs

- Console skill list / detail / selection UI
- Exit `0` on list or purported success; exit `1` on missing manifest, bad parse, unknown skill, bad choice, or missing entrypoint

## Behavior

1. Load skills where `status -eq "active"`.
2. `-ListOnly` → print name, category, description, tags → exit.
3. `-SkillId` → resolve skill, optional detail, call `Invoke-Skill`.
4. Otherwise interactive numbered menu (last option = Exit).
5. `Invoke-Skill` resolves `skills\<id>\<entrypoint>` and switches on `runtime` (`typescript`, `javascript`, `powershell`).

**Honest caveat:** the runtime branches currently print a "Running…" / success message. They do **not** actually call `npx ts-node`, `node`, or `& $entrypointPath` yet (those lines are commented). Treat this as a discovery/selection helper until execution is wired.

## Dependencies

- PowerShell
- Valid `C:\dev\manifest.json`
- Skill directories under `C:\dev\skills`

## Entrypoint

- **File**: `C:\dev\utilities\run-tool.ps1`
- Note: repo root also has `C:\dev\run-tool.ps1` (classic launcher referenced by older docs). This page documents the **utilities** copy.

## Configuration

Hardcoded paths: `C:\dev\manifest.json`, `C:\dev\skills`.

## Schedule

N/A — interactive / on-demand.

## Error Handling

`$ErrorActionPreference = Stop`. Missing manifest or entrypoint → red message + exit 1.

## Examples

```powershell
& "C:\dev\utilities\run-tool.ps1" -ListOnly
& "C:\dev\utilities\run-tool.ps1" -SkillId "roadmap-validator" -Verbose
& "C:\dev\utilities\run-tool.ps1"   # interactive
```

## Notes

- Only skills marked `active` in the manifest show up.
- Until real executors land, `-SkillId` is useful for validating that the entrypoint path exists.

## See Also

- `C:\dev\manifest.json`
- [setupTaskScheduler](setupTaskScheduler.md)
- Skill Operator Guide under `docs/meta/`
