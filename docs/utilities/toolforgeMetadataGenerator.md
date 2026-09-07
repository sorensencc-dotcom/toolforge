# toolforgeMetadataGenerator

**Category**: utilities  
**Version**: Phase 1.5 / metadata schema 1.0.0  
**Status**: active  
**Owner**: soren  

## Purpose

Generate the canonical skillpack metadata registry: unified per-skill schema (identity, deps, health, timestamps) plus summary counts. Also refreshes an embedded `#manifest-data` JSON block in `dashboard.html` when that file exists, and writes a sibling markdown summary.

## Tags

skills, metadata, registry, dashboard

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-OutputPath` | `C:\dev\skills\SKILLPACK-METADATA.json` | Primary JSON output |
| `-Verbose` | off | Detailed logs |

Hardcoded companions:

- Canonical skills: `<repoRoot>\skills` (`C:\dev\skills`)
- Distributed check: `C:\dev\rewrite-mcp\toolforge\skills`
- Runtime log: `<repoRoot>\audit\SKILL-RUN-LOG.md`
- Validation log path constant: `<repoRoot>\skills\SKILLPACK-VALIDATION.md` (referenced; lastValidation currently seeded from `SKILL.json` mtime / prior metadata)

## Outputs

- `SKILLPACK-METADATA.json` (ordered object: timestamp, version, skills[], summary)
- `SKILLPACK-METADATA-SUMMARY.md` (same basename with `-SUMMARY.md`)
- Optional update of `C:\dev\dashboard.html` `#manifest-data` script tag
- Env guard `$env:TOOLFORGE_METADATAGEN_RUNNING` - skip + exit `0` if already set; cleared at end
- `Write-IfChanged` with CRLF normalization and timestamp stripping

## Behavior

1. Load prior metadata (if any) so `created` / `lastValidation` survive regeneration.
2. For each skill with `SKILL.json`: build metadata (status, deps, health). Health `warn` when not present under the distributed skills tree; runtime `functional` vs `untested` from a regex hit in `SKILL-RUN-LOG.md`.
3. Sort skills by id; emit JSON via CRLF-preserving write helper.
4. If `dashboard.html` exists next to utilities' parent, replace `#manifest-data` JSON contents when changed.
5. Emit markdown summary inventory.

## Dependencies

- PowerShell (`$ErrorActionPreference = Stop`; uses `??` in places - PowerShell 7+ friendly)
- Canonical skills tree; optional distributed tree / run log / dashboard

## Entrypoint

- **File**: `C:\dev\utilities\toolforgeMetadataGenerator.ps1`

## Examples

```powershell
& "C:\dev\utilities\toolforgeMetadataGenerator.ps1"
& "C:\dev\utilities\toolforgeMetadataGenerator.ps1" -Verbose
```

## Notes

- Stable timestamps: new skills seed from SKILL.json mtime; existing ids keep prior `created` / `lastValidation`.
- Distributed path is hardcoded to `C:\dev\rewrite-mcp\toolforge\skills` (same family as the skill validator) - that is the distributed copy under rewrite-mcp, not a `C:\dev\toolforge` workspace root.
- Script filename is camelCase on disk (matches sibling Toolforge utilities).

## See Also

- [toolforgeDependencyGraph](toolforgeDependencyGraph.md)
- [toolforgeSkillValidator](toolforgeSkillValidator.md)
- [toolforgeSkillHealthCheck](toolforgeSkillHealthCheck.md)
- `C:\dev\skills\SKILLPACK-METADATA.json`
