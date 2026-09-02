# Toolforge Drift Detection System

**Status**: Operational  
**Version**: 1.0.0  
**Detector**: `C:\dev\toolforge\utilities\toolforgeDriftDetector.ps1`  
**Report**: `C:\dev\toolforge\drift\DRIFT-REPORT.md`

---

## Overview

Continuous monitoring system that detects divergence between:
- **Canonical**: `C:\dev\toolforge\` (source of truth)
- **Distributed**: `C:\dev\rewrite-mcp\toolforge\` (replica)

Runs daily at **09:00 UTC** via Windows Task Scheduler.

---

## What It Detects

### Structure Drifts
- Missing directories in distributed
- Extra directories in distributed (unexpected)
- Structure violations

### Tools Drifts
- Missing tool files in distributed (sync-tools, adapters, daemons, etc.)
- Extra tool files in distributed

### Skills Drifts
- Missing skills/ directory in distributed
- Missing individual skills
- Version mismatches in skill.json

### Documentation Drifts
- Missing docs in distributed

### Manifest Drifts
- Version mismatches
- Skill count mismatches
- Missing manifest.json in distributed

---

## Current Status

**Generated**: 2026-06-28T15:23:34.9620055Z

| Category | Drifts | Status |
|----------|--------|--------|
| Structure | 2 | ⚠️ Drifted |
| Tools | 0 | ✓ In Sync |
| Skills | 2 | ⚠️ Drifted |
| Docs | 0 | ✓ In Sync |
| Manifest | 5 | ⚠️ Drifted |

**Total Drifts**: 9  
**Overall Status**: ⚠️ **DRIFTED**

### Detected Issues

1. **Missing in Distributed**:
   - `drift/` directory
   - `health/` directory
   - `audit/` directory
   - `skills/` directory
   - `roadmap-validator` skill

2. **Manifest Mismatches**:
   - Skill count: canonical 2, distributed 0
   - Missing manifest entries for distributed skills

---

## Usage

### Run Manual Detection
```powershell
./toolforgeDriftDetector.ps1
./toolforgeDriftDetector.ps1 -Verbose
```

### View Latest Report
```powershell
Get-Content "C:\dev\toolforge\drift\DRIFT-REPORT.md"
```

### Run Scheduled Task
```powershell
Start-ScheduledTask -TaskName "Toolforge Drift Detector"
```

### View in Task Scheduler
```
taskschd.msc
# Navigate to: Task Scheduler Library > Toolforge Drift Detector
```

---

## Remediation

### For Missing Directories/Skills

1. **Run sync tool**:
   ```powershell
   ./toolforgeSkillSync.ps1
   ```

2. **Verify sync**:
   ```powershell
   ./toolforgeDriftDetector.ps1 -Verbose
   ```

3. **Test distributed tools/skills**:
   ```powershell
   cd C:\dev\rewrite-mcp\toolforge
   ./run-tool.ps1 -List
   ```

### For Manifest Mismatches

1. **Refresh distributed manifest**:
   ```powershell
   cd C:\dev\rewrite-mcp\toolforge
   ./run-tool.ps1 -Refresh
   ```

2. **Verify manifest.json updated**:
   ```powershell
   Get-Content manifest.json | ConvertFrom-Json | Select-Object version, @{N='skills';E={$_.skills.Count}}
   ```

### For Temporary Drifts

If drift is intentional (development branch, experimental feature):
1. Document in `DRIFT-NOTES.md`
2. Add exemption in detector config (if needed)
3. Plan remediation timeline

---

## Detection Rules Reference

### Structure
- Canonical directory structure should exist in distributed
- Extra items in distributed are flagged as informational

### Tools
- All executable tools in canonical should exist in distributed
- Checked in: sync-tools/, adapters/, daemons/, utilities/, mcp-servers/

### Skills
- All skills/ subdirectories should exist in distributed
- All skill.json files should have matching versions

### Docs
- Documentation files are checked for presence (informational only)

### Manifest
- manifest.json version should match between canonical and distributed
- Skill counts in manifest should match
- All skill entries in canonical should exist in distributed

---

## Schedule

**Task Name**: Toolforge Drift Detector  
**Frequency**: Daily  
**Time**: 09:00 UTC  
**Platform**: Windows Task Scheduler  
**Status**: Operational

### View Details
```powershell
Get-ScheduledTask -TaskName "Toolforge Drift Detector" | Select-Object *
Get-ScheduledTask -TaskName "Toolforge Drift Detector" | Get-ScheduledTaskInfo
```

### Modify Schedule
```powershell
# Edit in Task Scheduler GUI
taskschd.msc

# Or programmatically:
$trigger = New-ScheduledTaskTrigger -Daily -At 10:00  # Change time
Set-ScheduledTask -TaskName "Toolforge Drift Detector" -Trigger $trigger
```

---

## Report Structure

### File Format
- **Location**: `C:\dev\toolforge\drift\DRIFT-REPORT.md`
- **Format**: Markdown
- **Updates**: Daily (overwritten)
- **Archive**: Manual snapshots in `DRIFT-REPORT-ARCHIVE/`

### Report Contents
1. Executive summary (table)
2. Detailed findings by category
3. Remediation steps
4. Detection rules reference
5. Schedule information

### Creating Archive
```powershell
$date = Get-Date -Format "yyyyMMdd"
Copy-Item "DRIFT-REPORT.md" "DRIFT-REPORT-ARCHIVE\DRIFT-REPORT-$date.md"
```

---

## Integration Points

### Slack Notifications (Future)
```powershell
# Add to detector for automated alerts
$webhook = $env:SLACK_WEBHOOK_URL
$payload = @{
  text = "Toolforge drift detected: 9 issues"
  attachments = @(...)
}
```

### Continuous Integration
Add to GitHub Actions:
```yaml
- name: Check Toolforge Drift
  run: |
    pwsh -Command "& 'C:\dev\toolforge\utilities\toolforgeDriftDetector.ps1'"
```

### Health Dashboard
Feed drift report to monitoring system for visualization.

---

## Troubleshooting

### Task Not Running
```powershell
# Check task status
Get-ScheduledTask -TaskName "Toolforge Drift Detector" | Select-Object State
Get-ScheduledTask -TaskName "Toolforge Drift Detector" | Get-ScheduledTaskInfo

# View task history
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" | 
  Where-Object {$_.Message -like "*Toolforge*"} | 
  Select-Object TimeCreated, Message -First 10
```

### Script Execution Issues
```powershell
# Test script directly
& "C:\dev\toolforge\utilities\toolforgeDriftDetector.ps1" -Verbose

# Check execution policy
Get-ExecutionPolicy

# Set if needed (admin required)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
```

### Report Not Generated
```powershell
# Verify drift directory
Test-Path "C:\dev\toolforge\drift\"

# Create if missing
New-Item -ItemType Directory -Path "C:\dev\toolforge\drift\" -Force
```

---

## Performance

- **Execution Time**: ~2-5 seconds (typical)
- **Resource Usage**: Minimal (file I/O only)
- **Report Size**: ~5-10 KB
- **Schedule Impact**: None (runs at fixed time)

---

## Related Tools

- **toolforgeSkillValidator.ps1** — Validates individual skills
- **toolforgeDriftDetector.ps1** — Detects canonical/distributed divergence
- **toolforgeSkillSync.ps1** — Syncs skills to distributed
- **run-tool.ps1** — Discovers and executes tools/skills

---

## Support & Feedback

For issues or improvements:
1. Check detector output with `-Verbose` flag
2. Review DRIFT-REPORT.md for detailed findings
3. Consult troubleshooting section above
4. Check Toolforge documentation

---

## Version History

### 1.0.0 (2026-06-28)
- Initial release
- Daily scheduling via Task Scheduler
- Full drift detection across all categories
- Markdown report generation
- Remediation guidance

---

**Drift Detection System v1.0.0** | Toolforge Team
