# Node/Git Process Janitor

Conservative cleaner for duplicate / orphaned `node.exe` daemons and orphaned Git for Windows `fsmonitor--daemon` processes on the Windows Toolforge box.

## Usage

```powershell
cd C:\dev\utilities
# or: cd <toolforge-clone>\utilities

# Dry-run (default) — list candidates only
./node-process-janitor.ps1

# Terminate candidates
./node-process-janitor.ps1 -Apply

# Also consider sigil-related node processes (excluded by default)
./node-process-janitor.ps1 -Apply -IncludeSigil

# Raise age cutoff for hung node --test / vitest workers (default 30)
./node-process-janitor.ps1 -TestMaxAgeMinutes 60

# Node only (skip git fsmonitor rule)
./node-process-janitor.ps1 -Apply -SkipGit
```

## Rules

1. **Orphan (node)** — `node.exe` whose parent PID is dead.
2. **Duplicate singleton** — keep newest `CreationDate` only for:
   - `dashboard-server`
   - `mcp-memory-server`
   - `ijfw-mcp-server` (paths containing `mcp-server/src/server.js`)
   - `http-server`
3. **Aged test workers** — `node --test` / vitest older than `-TestMaxAgeMinutes`.
4. **Orphan (git fsmonitor)** — `git.exe` running `fsmonitor--daemon` whose parent PID is dead (Task Manager label: "Git for Windows").

Sigil daemons are skipped unless `-IncludeSigil` is set. Git cleanup is on by default; pass `-SkipGit` to disable.

## Output

Prints candidates with `pid` / `name` / `reason` / `class` / `age` / `cmd`. After `-Apply`, prints `killed_count`, `node_remaining`, and `git_fsmonitor_remaining`.
