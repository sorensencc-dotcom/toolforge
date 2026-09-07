# toolforgeDependencyGraph

**Category**: utilities  
**Version**: Phase 1.4  
**Status**: active  
**Owner**: soren  

## Purpose

Build a skill dependency graph from canonical `SKILL.json` files: adjacency (inbound/outbound), depth, cycle detection, missing internal deps, and orphan skills. Writes a markdown pack via `Write-IfChanged` so timestamp-only churn does not rewrite the file.

## Tags

skills, dependencies, graph, governance

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-OutputPath` | `C:\dev\skills\SKILLPACK-DEPENDENCY-GRAPH.md` | Report path |
| `-Verbose` | off | Detailed load / cycle / orphan logs |

Repo root is resolved as parent of `C:\dev\utilities` - expects `skills\` and `manifest.json` beside it (`C:\dev`).

## Outputs

- Markdown report at `-OutputPath` (summary tables, adjacency, depths, cycles, missing, orphans, health summary)
- Console phase banners + "Dependency graph complete"
- Env guard: if `$env:TOOLFORGE_DEPGRAPH_RUNNING` is set, prints skip message and exits `0` (loop prevention); cleared at end

## Behavior

1. **Load** - each skill dir under `skills\` (exclude `_TEMPLATE`) with `SKILL.json`; capture internal/external deps.
2. **Adjacency** - outbound from internal+external; inbound only for internal; missing internals recorded.
3. **Cycles** - DFS with recursion stack; records cycle node lists.
4. **Depth** - leaf = 0; else max(dep depth) + 1 (memoized).
5. **Orphans** - skills with no inbound / never referenced as a dependency.
6. **Report** - markdown; `Write-IfChanged` strips ISO timestamps before compare.

## Dependencies

- PowerShell (`$ErrorActionPreference = Stop`)
- Canonical skills tree with `SKILL.json` files

## Entrypoint

- **File**: `C:\dev\utilities\toolforgeDependencyGraph.ps1`

## Schedule

On-demand; often chained from validators / cowork sync phases.

## Examples

```powershell
& "C:\dev\utilities\toolforgeDependencyGraph.ps1"
& "C:\dev\utilities\toolforgeDependencyGraph.ps1" -Verbose
```

## Notes

- Uses PowerShell 7+ null-coalescing (`??`) in places when reading JSON fields.
- Prefer reading the generated markdown over grepping the ~13 KB script day-to-day.
- Script filename is camelCase on disk (matches sibling Toolforge utilities), not kebab-case.

## See Also

- [toolforgeSkillValidator](toolforgeSkillValidator.md)
- [toolforgeMetadataGenerator](toolforgeMetadataGenerator.md)
- `C:\dev\skills\SKILLPACK-DEPENDENCY-GRAPH.md`
