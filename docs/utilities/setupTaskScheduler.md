# setupTaskScheduler

**Category**: utilities  
**Version**: 1.0.0  
**Status**: active  
**Owner**: soren  

## Purpose

Registers one Windows scheduled task, `Daily Roadmap Sync`, that runs the multi-repo roadmap sync once a day.

## Tags

setup, scheduling, windows

## Inputs

Script: [`utilities/setup-task-scheduler.ps1`](../../utilities/setup-task-scheduler.ps1). Parameters:

- `-SlackWebhook <url>`: warns if left at the placeholder. The value is only checked; it is not stored in the task.
- `-TaskName <name>`: default `Daily Roadmap Sync`.
- `-Schedule <cron>`: default `0 9 * * *`. The script does not read it; the trigger is hardcoded to daily at 09:00.

There is no `-Install`, `-Remove`, or `-Test` parameter. Passing one fails with a parameter-binding error.

## Outputs

- One scheduled task (`Daily Roadmap Sync`), registered with `-Force`, so a re-run replaces it.
- Console messages on success; `Failed to register task` and exit code 1 on failure.

## Behavior

1. Warn if the Slack webhook is the placeholder.
2. Build a daily trigger at 09:00 in machine-local time. The script comments and console text say UTC; the trigger carries no timezone.
3. Build an action that runs `node.exe C:\dev\sync-tools\multiRepoRoadmapSync.cjs` with working directory `C:\dev`.
4. Register the task. Settings: start on battery, start when available after a missed run, run only with network.

The script has no Administrator check and registers the task for the current user. Run it elevated if registration is denied.

## Dependencies

- PowerShell 7+
- Node.js on `PATH` (`node.exe`)

## Entrypoint

- **File**: `utilities/setup-task-scheduler.ps1`
- **Runtime**: PowerShell 7+

## Configuration

Task name and webhook come from parameters. The script path, working directory, trigger time, and settings are hardcoded.

## Examples

```powershell
# Register the task
.\utilities\setup-task-scheduler.ps1 -SlackWebhook https://hooks.slack.com/services/XXX

# Check it
Get-ScheduledTask -TaskName "Daily Roadmap Sync" | Get-ScheduledTaskInfo

# Run it now
Start-ScheduledTask -TaskName "Daily Roadmap Sync"

# Remove it (no script option)
Unregister-ScheduledTask -TaskName "Daily Roadmap Sync" -Confirm:$false
```

## Registered tasks

| Task name | Schedule | Action | Purpose |
|-----------|----------|--------|---------|
| Daily Roadmap Sync | Daily 09:00 local | `node.exe C:\dev\sync-tools\multiRepoRoadmapSync.cjs` | Sync roadmaps |

The `Toolforge-Daily-09UTC`, `Toolforge-Manifest-15min`, `Toolforge-Docs-OnDemand`, and `Toolforge-Index-OnDemand` tasks that earlier versions of this page listed are not registered by any script in the repo.

## See Also

- [OPERATOR_GUIDE.md](../../OPERATOR_GUIDE.md) — How to use Task Scheduler
- `docs/daemons/` — Daemon design notes (stubs; excluded from the docs build)
