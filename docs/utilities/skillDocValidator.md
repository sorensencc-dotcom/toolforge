# skillDocValidator

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

Validate skill documentation against Skill Operator Guide conventions: line limits, no duplicate standard sections across README/SKILL, Operator Guide link, and types-only Input Schema (no narrative prose). Report-only - it lists issues; it does not rewrite files.

## Tags

validation, skills, documentation

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-Path` | `skills` | Skill directory, or parent when `-Recursive` |
| `-Recursive` | off | Scan child skill dirs under `-Path` (skips `_TEMPLATE`; requires `README.md`) |
| `-Verbose` | off | Surface warnings (`WarningPreference`) |

Relative `-Path` is resolved from the current working directory (typically run from `C:\dev`).

## Outputs

- Console: pass message, or per-skill issue list
- Exit `0` if all checked skills pass; `1` if any issues

Skills missing either `README.md` or `SKILL.md` are skipped (no finding).

## Behavior

For each skill with both docs present:

1. **Line limits** - README at most 100 lines; SKILL.md at most 150 lines (`-gt` thresholds in script).
2. **Duplicate sections** - flags if both files have the same `##` among: Setup, Installation, Requirements, Configuration, Error Handling, Troubleshooting, Testing.
3. **Operator Guide link** - at least one of the files must match `skill-operator-guide`.
4. **Input Schema prose** - heuristic: Input Schema fenced block plus narrative like "This input/parameter ... allows/enables/provides".

## Dependencies

- PowerShell
- Skill folders with `README.md` + `SKILL.md`

## Entrypoint

- **File**: `C:\dev\utilities\skill-doc-validator.ps1`

## Examples

```powershell
cd C:\dev
& "C:\dev\utilities\skill-doc-validator.ps1" -Path "skills\kb-sync-artifact-generator"
& "C:\dev\utilities\skill-doc-validator.ps1" -Path "skills" -Recursive
```

## Notes

- Report-only on purpose: there is no auto-fix switch. Fix the flagged docs by hand (or via your usual editor workflow).
- Pairs with the Skill Operator Guide under `docs/meta/`.

## See Also

- [`meta/skill-operator-guide.md`](../meta/skill-operator-guide.md)
- [toolforgeSkillValidator](toolforgeSkillValidator.md)
