# toolforgeManifestSync

**Category**: daemons  
**Version**: 0.1.0  
**Status**: beta (stub; design only, 2026-10-06 review)  
**Owner**: soren  

## Current state (verified 2026-10-06)

[`daemons/toolforge-manifest-sync.ps1`](../../daemons/toolforge-manifest-sync.ps1) is a one-line stub. It prints `\Syncing manifest...\`, backslashes included, and does nothing else. `toolforge-install.ps1:157-167` wrote the stub with escaped quotes. The sections below describe the intended design, not shipped behavior. Nothing here is implemented:

- No scheduled task named `Toolforge-Manifest-15min` is registered by any script in this repo. [`utilities/setup-task-scheduler.ps1`](../../utilities/setup-task-scheduler.ps1) registers only `Daily Roadmap Sync`.
- `manifest.json` has no entry for this daemon.
- `daemons/README.md` does not exist. The See Also bullet below names the missing file in plain text.
- `OPERATOR_GUIDE.md` calls the task `toolforge-manifest-sync`; this note calls it `Toolforge-Manifest-15min`. Neither is registered, so both are design names.

## Purpose (intended)

Background daemon that syncs the toolforge manifest index. Rescans all tool directories, detects changes, and updates manifest.json with latest metadata.

## Tags

daemon, metadata

## Inputs

None (runs on schedule via Task Scheduler). Reads from:
- All category directories: `sync-tools/`, `daemons/`, `utilities/`, etc.
- Existing `manifest.json` (if present)

## Outputs

- **manifest.json**: Updated with discovered tools and metadata
- **Console**: Progress messages (tools found, changes detected)
- **Logs**: `C:\dev\logs\manifest-sync-*.log`

## Behavior

1. Scan all 7 Toolforge category directories
2. Discover files: `*.ps1`, `*.cjs`, `*.ts`, `*.sh`, `*.js`
3. Identify entrypoints and extract metadata:
   - Tool name (directory name)
   - Category (parent directory)
   - Entrypoint file (file with matching name)
   - Status (active/beta/archived)
   - Version (from VERSION.md if present)
4. Merge with existing manifest (preserves schedule, lastRun, custom metadata)
5. Write updated manifest.json
6. Log changes (new tools, removed tools, metadata updates)

## Dependencies

- PowerShell 7+

## Entrypoint

- **File**: `daemons/toolforge-manifest-sync.ps1` (stub)
- **Runtime**: PowerShell 7+

## Schedule (intended)

- **Frequency**: Every 15 minutes
- **Registration**: Windows Task Scheduler
- **Task Name**: `Toolforge-Manifest-15min`

## Error Handling (intended)

- Exit code 0: Success
- Exit code 1+: Failure (logged to event log)
- Errors trigger retry on next interval
- Manifest backup created before updates

## Examples (intended)

```powershell
# Run manually
& "C:\dev\toolforge\daemons\toolforge-manifest-sync.ps1"

# Check last run
Get-ScheduledTaskInfo -TaskName "Toolforge-Manifest-15min"

# View manifest
Get-Content C:\dev\toolforge\manifest.json | ConvertFrom-Json | Select -ExpandProperty tools
```

## Notes

- Daemon runs silently (no user interaction)
- Detects new tools automatically
- Preserves custom manifest fields (schedule, owner, tags, etc.)
- `run-tool.ps1` does not depend on this daemon. `run-tool.ps1 -Refresh` rescans and rewrites `toolforge\manifest.json` itself; that is the only manifest refresh that works today

## See Also

- daemons/README.md — does not exist (dead link removed)
- [manifest.json](../../manifest.json) — Tool registry
- [run-tool.ps1](../../run-tool.ps1) — Tool runner (`-Refresh` rewrites the manifest itself)
