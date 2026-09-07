# roadmapConsolidationScanner

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

One-shot audit of all `ROADMAP.md` files under a root (default `C:\dev`). Classifies location / project ownership, picks a canonical per allowed root via tie-breakers, and writes a dated JSON audit report for cleanup / migration follow-ups.

## Tags

roadmap, audit, consolidation

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-RootPath` | `C:\dev` | Scan root |
| `-OutputDir` | `C:\dev\audit` | Where to write the audit JSON |

## Outputs

- `C:\dev\audit\roadmap-consolidation-audit-YYYY-MM-DD.json` (date in UTC)
- Console: file count, canonical count, conflicts, orphans, report path

Report shape (high level): `timestamp`, `allowed_roots` (docs/meta, cic-ingestion, rewrite-docs, rewrite-mcp, kb-sync), `cleanup` (`orphans_found`, `conflicts_flagged`), `orphans_list` (array of absolute path strings), `conflicts[]`.

## Behavior

1. Recurse for `ROADMAP.md` (Windows filter is case-insensitive; single pass - no double-count).
2. **Allowed roots**: `docs\meta`, `cic-ingestion`, `rewrite-docs`, `rewrite-mcp`, `kb-sync`.
3. **Classify location** (forbidden patterns first): ephemeral worktree (`.claude/worktrees`), archive folder, system folder (`node_modules` / `.git`), else allowed_root or forbidden_location.
4. Group by project root; only `allowed_root` entries can be canonical. Others become orphans.
5. Tie-breaker when multiple allowed copies: fresher `lastModified` wins, then prefer path at project root; losers become conflicts (`superseded_by_fresher` or `manual_review_needed` if dates tie).
6. Emit `orphans_list` from the same orphan set counted in `cleanup.orphans_found` (paths only).
7. Write JSON; create `OutputDir` if needed.

## Dependencies

- PowerShell
- Read access under the scan root

## Entrypoint

- **File**: `C:\dev\utilities\roadmap-consolidation-scanner.ps1`

## Examples

```powershell
& "C:\dev\utilities\roadmap-consolidation-scanner.ps1"
& "C:\dev\utilities\roadmap-consolidation-scanner.ps1" -RootPath "C:\dev" -OutputDir "C:\dev\audit"
```

## Notes

- `orphans_list` is the supported handoff to [roadmapOrphanCleanup](roadmapOrphanCleanup.md). Older audits without that array still work via the cleanup script's legacy scan fallback.
- This scanner does not move archives or delete files. It only reports.

## See Also

- [roadmapOrphanCleanup](roadmapOrphanCleanup.md)
- [roadmapDriftChecker](roadmapDriftChecker.md)
- [roadmapMigrationHelper](roadmapMigrationHelper.md)
