# Node Process Janitor

Conservative cleaner for duplicate / orphaned `node.exe` daemons on the Windows Toolforge box.

## Usage

```powershell
cd C:\dev\toolforge\utilities

# Dry-run (default) — list candidates only
./node-process-janitor.ps1

# Terminate candidates
./node-process-janitor.ps1 -Apply

# Also consider sigil-related node processes (excluded by default)
./node-process-janitor.ps1 -Apply -IncludeSigil

# Raise age cutoff for hung node --test / vitest workers (default 30)
./node-process-janitor.ps1 -TestMaxAgeMinutes 60
```

## Rules

1. **Orphan** — `node.exe` whose parent PID is dead.
2. **Duplicate singleton** — keep newest `CreationDate` only for:
   - `dashboard-server`
   - `mcp-memory-server`
   - `ijfw-mcp-server` (paths containing `mcp-server/src/server.js`)
   - `http-server`
3. **Aged test workers** — `node --test` / vitest older than `-TestMaxAgeMinutes`.

Sigil daemons are skipped unless `-IncludeSigil` is set.

## Output

Prints candidates with `pid` / `reason` / `class` / `age` / `cmd`. After `-Apply`, prints `killed_count` and `node_remaining`.
