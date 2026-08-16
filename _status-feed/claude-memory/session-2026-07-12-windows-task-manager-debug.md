---
name: session-2026-07-12-windows-task-manager-debug
description: Session debugging Windows Task Manager dashboard; identified critical Node.js + schtasks integration blocker
metadata: 
  node_type: memory
  type: project
  originSessionId: 8a8343c8-95b2-4e2a-8cba-c872687f7c97
---

## Session 2026-07-12: Windows Task Manager Dashboard Debug

### Critical Blocker: Node.js + schtasks Integration
**Status:** UNRESOLVED  
**Impact:** Dashboard cannot load real task data; reverted to mock data.

**Issue:** Node.js `execSync` and `execAsync` (via child_process) **completely fail** to execute `schtasks /query /fo list /v`:
- Command works instantly (1.36s) when run directly in PowerShell
- Same command hangs/fails when called from Node via execSync, exec, or PowerShell wrapper
- Error: "Command failed: ..." with no stderr detail
- Tried: execSync with timeout, execAsync with maxBuffer, cmd /c wrapper, PowerShell -NoProfile wrapper — all fail

**Root cause:** Unknown. Likely:
1. Node/child_process environment isolation issue
2. Windows Task Scheduler access restriction from Node process
3. Output buffering/encoding issue with large task list

**Workaround applied:** Return static mock data for 4 tasks. Allows dashboard UI to render + test filtering/styling.

### What Got Done
- ✅ Added border-radius: 6px to all panels (rounded corners, CIC design compliance)
- ✅ Changed "Task Monitor" heading color from white to brass (#B8922A)
- ✅ Fixed CSP header to allow Google Fonts (style-src added https://fonts.googleapis.com)
- ✅ Fixed font-src for gstatic.com (Baskerville, Playfair, Barlow loads now)
- ✅ Dashboard UI rendering + styling stable

### What's Broken
- ❌ Enable/Disable buttons don't work (schtasks /change also affected by blocker)
- ❌ Real task data doesn't load (using mock 4-task dataset)
- ❌ Category filter (My Tasks / Vendor / System) works client-side but no real data to filter
- ❌ Health indicator, Triggers, Timeline panels show no data

### Next Session Actions
1. **Investigate schtasks + Node blocker:**
   - Try WMI via PowerShell.Automation assembly (different API surface)
   - Try C# interop via node-ffi or spawn with stream handling
   - Check Windows Event Logs for schtasks access errors
   - Test on different user account (admin vs standard)

2. **Interim fix options:**
   - Cache schtasks output in a JSON file (Windows Service writes, Node reads)
   - Use WMI instead of schtasks (Root\CIMV2 Win32_ScheduledTask)
   - Delegate to PowerShell Remoting or named pipe

3. **Polish (lower priority):**
   - Health monitor positioning (user said they moved it — confirm where)
   - Verify all 4 columns + panels render without layout breaks
   - Test enable/disable once schtasks works again

### Files Changed
- C:\dev\windows-task-manager\harvester\server.js — mock data + async structure
- C:\dev\windows-task-manager\dashboard\index.html — border-radius, brass color, CIC variables
- C:\dev\windows-task-manager\harvester\server.js — CSP header update (fonts)

### Session Length Issue
Session hit context limits after ~2 hours of:
- 3x server restart cycles
- 10+ schtasks exec strategy attempts
- CSS debug rounds
- Browser cache issues

Recommend: **Narrower scope next time** — split into separate sessions:
- Session A: Design system + UI styling
- Session B: schtasks integration (requires focused debugging, not UI tweaks)
