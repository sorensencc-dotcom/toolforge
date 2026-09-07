# roadmapOrphanCleanup

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

Delete orphan `ROADMAP.md` files identified by the consolidation audit. Prefers `orphans_list` from the audit JSON (what the current scanner emits). If that array is missing (older audits), falls back to a legacy targeted scan of known orphan locations, with a count reconciliation warning.

## Tags

roadmap, cleanup, orphans

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-AuditReport` | latest `C:\dev\audit\roadmap-consolidation-audit-*.json` | Audit JSON path |
| `-Force` | `$false` | `$true` = delete without typing `yes` |
| `-DryRun` | off | List orphans only; no delete / no prompt |

## Outputs

- Console list of orphan paths, reconcile OK/warning vs `cleanup.orphans_found`
- Deletes (when confirmed) with per-file Deleted/FAILED lines and summary counts
- Exit `0` if none / cancelled / all deleted; `1` if audit missing/unparseable or any delete failed

## Behavior

1. Resolve audit report (explicit path or newest matching file).
2. Prefer `$audit.orphans_list`; else legacy scan:
   - `rewrite-mcp\.claude\worktrees\**\roadmap.md`
   - `docs\archive\build-output\**\roadmap.md`
   - known smart-buffer ROADMAP under archive node_modules
   - `charlie-deep-research\**\*ROADMAP*`
   - `rewrite-docs\.planning\ROADMAP.md`
3. Dedupe/sort; reconcile count to `audit.cleanup.orphans_found`.
4. Dry-run exits after listing. Otherwise prompt for exact `yes` unless `-Force $true`.
5. `Remove-Item -Force` each path; verify absence.

## Dependencies

- PowerShell
- Consolidation audit JSON (from `roadmap-consolidation-scanner.ps1`)

## Entrypoint

- **File**: `C:\dev\utilities\roadmap-orphan-cleanup.ps1`

## Examples

```powershell
& "C:\dev\utilities\roadmap-orphan-cleanup.ps1" -DryRun
& "C:\dev\utilities\roadmap-orphan-cleanup.ps1"
& "C:\dev\utilities\roadmap-orphan-cleanup.ps1" -Force $true
```

## Notes

- Supported path: re-run the consolidation scanner, then this cleanup so `orphans_list` is present. Legacy scan remains only for older audit JSON.
- Destructive: dry-run first, then confirm. No archive-move step and no `archives_moved` metric - deletes only.

## See Also

- [roadmapConsolidationScanner](roadmapConsolidationScanner.md)
- [roadmapDriftChecker](roadmapDriftChecker.md)
