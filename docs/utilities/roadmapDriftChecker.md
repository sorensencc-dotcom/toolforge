# roadmapDriftChecker

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

Weekly (or on-demand) drift scan for `ROADMAP.md` files sitting outside allowed project roots and outside `archive/`. Classifies violations, writes a dated JSON report, optionally posts Slack, and attempts to register a Sunday 02:00 Task Scheduler job.

## Tags

roadmap, drift, ops, scheduled

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-OutputDir` | `C:\dev\audit` | Drift report directory |
| `-SlackWebhook` | `""` | Incoming webhook URL; empty skips Slack |

Hardcoded scan root: `C:\dev`. Allowed roots match the consolidation scanner (`docs\meta`, `cic-ingestion`, `rewrite-docs`, `rewrite-mcp`, `kb-sync`).

## Outputs

- `roadmap-drift-report-YYYY-MM-DD.json` under `-OutputDir`
- Console violation count + report path
- Optional Slack payload when violations > 0 and webhook set
- May register `\Toolforge\Roadmap Drift Checker` (SYSTEM, weekly Sunday 02:00) if missing
- Does not delete files - report + recommend only

## Behavior

1. Recurse `ROADMAP.md` under `C:\dev`, dedupe by `FullName`.
2. Skip allowed roots and any path under `archive/`.
3. Classify remaining: ephemeral_worktree, claude_metadata, system_folder, orphan_backup, sync_artifact, nested_clone (`\toolforge\`), else orphan - each with a DELETE/AUDIT recommendation string.
4. Write JSON (`drift_found`, `violation_count`, `violations[]`).
5. Slack: top 3 violations in a Block Kit-ish payload (best-effort; failures are logged, not fatal).
6. Task Scheduler registration is best-effort on Windows; skips on non-Windows hosts.

## Dependencies

- PowerShell (Slack path uses `Invoke-WebRequest`; top-3 join uses `Join-String` - prefer PowerShell 7+)
- Optional: Slack webhook, Task Scheduler / admin rights for registration

## Entrypoint

- **File**: `C:\dev\utilities\roadmap-drift-checker.ps1`

## Schedule

Intended: weekly Sunday 02:00 UTC (self-registers when possible). Also fine on-demand.

## Examples

```powershell
& "C:\dev\utilities\roadmap-drift-checker.ps1"
& "C:\dev\utilities\roadmap-drift-checker.ps1" -SlackWebhook "https://hooks.slack.com/services/..."
```

## Notes

- Safe to re-run: existing scheduled task is left alone.
- Classification label `nested_clone` fires on any `\toolforge\` path segment - that is the script's heuristic, not a claim that `C:\dev\toolforge` exists.

## See Also

- [roadmapConsolidationScanner](roadmapConsolidationScanner.md)
- [roadmapOrphanCleanup](roadmapOrphanCleanup.md)
- [setupTaskScheduler](setupTaskScheduler.md)
