---
name: session-2026-07-12-wmi-solution
description: Windows Task Manager — WMI Schedule.Service solution to bypass schtasks Node.js blocker
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d49ba3a-3854-47ba-bbae-fb62a8e34701
---

## Status: SOLUTION IMPLEMENTED ✅

Blocked: Node.js `child_process.execSync('schtasks /query')` hangs/fails while PowerShell works instantly.

**Workaround:** Bypassed schtasks entirely. Use Schedule.Service COM object (native Windows Task Scheduler API).

## Files Created

### 1. `C:\dev\windows-task-manager\harvester\get-tasks.ps1`
- **Approach:** Schedule.Service COM object instead of schtasks.exe
- **Properties captured:**
  - Task enabled/disabled status
  - Triggers (type, enabled, metadata: subscription, time boundary, daily interval, user ID)
  - Actions (type, path, arguments, working directory)
  - State (Unknown/Disabled/Queued/Ready/Running)
  - Last run time, next run time, last result code
  - Author, description, run-as user
- **Output:** JSON array with full structure
- **Recursion:** Walks all task folders including subfolders

### 2. `C:\dev\windows-task-manager\harvester\test-get-tasks.ps1`
- Directly test `get-tasks.ps1` before running server
- Shows task counts, enabled/disabled breakdown
- Dumps sample task structure with triggers and actions
- Validates JSON output format

### 3. `C:\dev\windows-task-manager\harvester\server.js` (updated)
- Changed from `taskQueryWMI.ps1` to `get-tasks.ps1`
- Added `-AsJson` flag to PowerShell invocation
- Increased maxBuffer to 10MB (handles large task lists)
- Transform WMI output to dashboard format
- Cache TTL: 15 seconds

## Why This Works

| Approach | Issue | Win? |
|---|---|---|
| schtasks /query | Hangs from Node.js child_process | ❌ |
| WMI Query (Get-WmiObject Win32_ScheduledTask) | Incomplete property coverage | ⚠️ |
| **Schedule.Service COM** | **Native API, full property access** | ✅ |

Schedule.Service is the PowerShell Task Scheduler cmdlets' underlying object. Direct COM access bypasses both schtasks.exe and high-level WMI constraints.

## Test Commands

```powershell
# Direct test
& C:\dev\windows-task-manager\harvester\test-get-tasks.ps1

# Then start server
cd C:\dev\windows-task-manager\harvester
node server.js

# In browser
http://localhost:7777
```

## Dashboard Integration

Server `/windows-tasks` endpoint now returns:
```json
{
  "timestamp": "2026-07-12T...",
  "taskCount": 247,
  "tasks": [
    {
      "name": "UpdateTask",
      "path": "\\Microsoft\\Windows\\...",
      "enabled": true,
      "state": "Ready",
      "lastRunTime": "2026-07-12T10:30:00Z",
      "nextRunTime": "2026-07-12T14:00:00Z",
      "triggers": [
        { "Type": 3, "Enabled": true, "DaysInterval": 1 }
      ],
      "actions": [
        { "Type": 0, "Path": "C:\\Windows\\System32\\...", "Arguments": "..." }
      ]
    }
  ]
}
```

## Process Management Redesign ✅

**Problem:** Port conflicts required manual `Stop-Process -Name node -Force` every session.

**Solution:** Created startup wrapper script with auto-kill, graceful shutdown, multi-port support.

### New Workflow

**Before:**
```powershell
node server.js
# Port 7777 already in use. Kill existing process and retry.
❌ Manual intervention required
```

**After:**
```powershell
./start-server.ps1
# Auto-kills if needed
# Starts fresh
# Shows URLs and logs
✅ Just works
```

### Files Created

- `start-server.ps1` — Wrapper with port detection/auto-kill
- `README.md` — Full documentation (APIs, endpoints, trigger types)
- `STARTUP.md` — Quick reference (workflow, troubleshooting, usage)

### Features

✅ Auto-kill existing process (no manual intervention)  
✅ Support custom ports (./start-server.ps1 -Port 8888)  
✅ Graceful shutdown (Ctrl+C closes cleanly)  
✅ Clear logging (startup messages, API calls, errors)  
✅ Multi-instance support (different ports)  

## Testing

1. Test `get-tasks.ps1` directly: `./test-get-tasks.ps1` ✅
2. Start server via wrapper: `./start-server.ps1` ✅
3. Verify dashboard: http://localhost:7777 ✅
4. Check API: http://localhost:7777/windows-tasks ✅
5. Test enable/disable buttons (ready to test)
6. Monitor performance on 195-task list

## Trigger Type Reference

- 1 = EVENT (subscribed log)
- 2 = ONCE (one-time)
- 3 = DAILY (recurring daily)
- 5 = LOGON (at user logon)
- 7 = IDLE (when idle)

## Action Type Reference

- 0 = EXECUTE (run executable)
- 1 = COMSCRIPT (run COM script)
- 5 = SENDEMAIL (send email)
- 6 = SHOWMESSAGE (show message)

See comments in get-tasks.ps1 for mapping.
