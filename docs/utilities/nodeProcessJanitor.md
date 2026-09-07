# nodeProcessJanitor

**Category**: utilities  
**Version**: current (updated 2026-09-07)  
**Status**: active  
**Owner**: soren  

## Purpose

Conservative cleaner for orphaned / duplicate `node.exe` daemons and orphaned Git for Windows `fsmonitor--daemon` processes. Default is dry-run. Pass `-Apply` only when you mean it.

## Tags

ops, windows, cleanup, node, git

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-Apply` | off | Actually `Stop-Process -Force` candidates |
| `-IncludeSigil` | off | Also consider command lines mentioning `sigil` |
| `-SkipGit` | off | Skip git fsmonitor orphan rule |
| `-TestMaxAgeMinutes` | 30 | Age cutoff for hung `node --test` / vitest workers (1–1440) |

## Outputs

- Candidate table: pid, name, reason, class, age, truncated cmd
- After `-Apply`: `killed_count`, optional `kill_failed`, `node_remaining`, `git_fsmonitor_remaining`
- Always exits `0` (even when nothing matched)

## Behavior

Rules (node unless noted):

1. **orphan-dead-parent** — parent PID not in the live process set
2. **duplicate-singleton** — for `dashboard-server`, `mcp-memory-server`, `ijfw-mcp-server`, `http-server`: keep newest `CreationDate`, mark older duplicates
3. **test-worker-age** — `--test` / vitest older than the age threshold
4. **git-fsmonitor** — `git.exe` with `fsmonitor--daemon` and a dead parent

Sigil-related node processes are skipped unless `-IncludeSigil`.

## Dependencies

- PowerShell with CIM (`Win32_Process`)
- Windows (process model assumes Windows PIDs / `node.exe` / `git.exe`)

## Entrypoint

- **File**: `C:\dev\utilities\node-process-janitor.ps1`
- Sibling quick note: `C:\dev\utilities\node-process-janitor.md` (usage cheat sheet; this page is the hub doc)

## Configuration

Singleton class matching and exclusions are coded in the script (no external config file).

## Schedule

No Task Scheduler entry found in the Sep 2026 pass. Run by hand when the box feels sticky with leftover Node/Git daemons.

## Error Handling

`$ErrorActionPreference = Continue`. Failed kills are counted and printed; script still exits 0.

## Examples

```powershell
cd C:\dev\utilities
./node-process-janitor.ps1
./node-process-janitor.ps1 -Apply
./node-process-janitor.ps1 -Apply -IncludeSigil
./node-process-janitor.ps1 -TestMaxAgeMinutes 60
./node-process-janitor.ps1 -Apply -SkipGit
```

## Notes

- Dry-run first. Always.
- Keeps the newest singleton instance on purpose so one dashboard / MCP server survives.

## See Also

- Local cheat sheet: `C:\dev\utilities\node-process-janitor.md`
