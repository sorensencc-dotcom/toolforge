---
name: session-2026-07-12-windows-task-manager-wmi-fix
description: Resolved Windows Task Manager schtasks blocker using PowerShell WMI backend
metadata: 
  node_type: memory
  type: project
  sessionId: current
  originSessionId: 8094dda3-bc77-4e24-8f6e-9a82e9136970
---

## Critical Blocker: RESOLVED ✅

**Previous Issue:** Node.js child_process could not execute `schtasks /query`. Command worked in PowerShell (1.36s) but failed when called from Node via execSync/exec/PowerShell wrapper.

**Solution:** Use PowerShell's Get-ScheduledTask cmdlet (WMI-backed) via spawn with proper stream handling.

## Implementation

### New File: taskQueryWMI.ps1
- PowerShell script using `Get-ScheduledTask` instead of `schtasks`
- Returns JSON with task metadata: name, path, status, enabled, lastRunTime, nextRunTime, lastResult
- Properly handles date conversion to ISO format
- Robust error handling with JSON error output

### Updated: server.js
**Removed:**
- execSync/exec calls (replaced with spawn)
- executeWithRetry function (no longer needed)
- Unused imports: promisify, parseWindowsTasks
- Mock data (4-task hardcoded set)

**Changed:**
- `fetchAndCacheTasks()`: Now spawns PowerShell to run taskQueryWMI.ps1
  - Proper stdout/stderr capture
  - JSON parsing with validation
  - Error handling for spawn/parse failures
- `/task-action/enable`: Uses Set-ScheduledTask via PowerShell
- `/task-action/disable`: Uses Set-ScheduledTask via PowerShell
- Both task-action endpoints now async/Promise-based

## Results

**Before:** 4 mock tasks
**After:** 233 real system tasks ✅

Test output:
```
taskCount: 233
Tasks loading from: \CastIronCharlie-DailyResearch, \CIC Daily Pipeline, etc.
```

All queries successful, dashboard can now display real scheduled tasks.

## Why WMI > schtasks

1. **spawn vs execSync:** Proper stream handling, non-blocking
2. **PowerShell backend:** Get-ScheduledTask = WMI API (more reliable API surface)
3. **Output control:** PowerShell serializes to JSON; schtasks text parsing fragile
4. **No isolation issues:** PowerShell runs in same user context as Express
