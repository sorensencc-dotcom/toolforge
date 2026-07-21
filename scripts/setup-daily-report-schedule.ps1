#!/usr/bin/env pwsh
<#
.SYNOPSIS
Register Windows scheduled task for daily report generation.

.DESCRIPTION
Creates a Windows Task Scheduler task that runs daily-report-agent.ps1 every day at 6 AM.
Requires admin privileges.
#>

param(
  [switch]$Force = $false
)

$taskName = "toolforge-daily-report"
$taskPath = "\toolforge\"
$script = "C:\dev\scripts\daily-report-agent.ps1"
$repoRoot = "C:\dev"

# Verify script exists
if (-not (Test-Path $script)) {
  Write-Host "[ERROR] Script not found: $script" -ForegroundColor Red
  exit 1
}

# Check for admin
$admin = [Security.Principal.WindowsIdentity]::GetCurrent().Groups -contains `
  "S-1-5-32-544" # Local Administrators SID

if (-not $admin) {
  Write-Host "[ERROR] Admin privileges required. Run as Administrator." -ForegroundColor Red
  exit 1
}

Write-Host "Daily Report Task Registration" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green
Write-Host ""

# Check if task exists
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  if (-not $Force) {
    Write-Host "[!] Task already exists. Use -Force to overwrite." -ForegroundColor Yellow
    exit 1
  }
  Write-Host "Removing existing task..." -ForegroundColor Cyan
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false | Out-Null
}

# Create task action
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -RepoRoot `"$repoRoot`"" `
  -WorkingDirectory "C:\dev"

# Create task trigger: Daily at 6 AM
$trigger = New-ScheduledTaskTrigger `
  -Daily `
  -At "06:00"

# Create task settings with timeout
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -MultipleInstancePolicy IgnoreNew

# Create and register task
Write-Host "Registering task: $taskName" -ForegroundColor Cyan
Write-Host "  Schedule: Daily at 6:00 AM" -ForegroundColor Gray
Write-Host "  Script: $script" -ForegroundColor Gray
Write-Host "  Timeout: 1 hour" -ForegroundColor Gray

try {
  Register-ScheduledTask `
    -TaskName $taskName `
    -TaskPath $taskPath `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Daily work aggregation and reporting" `
    -RunLevel Highest `
    -Force | Out-Null

  Write-Host ""
  Write-Host "[OK] Task registered successfully." -ForegroundColor Green
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Green
  Write-Host "  View task: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  Write-Host "  Run now:   Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  Write-Host "  Logs:      C:\dev\logs\daily-report-*.log" -ForegroundColor Gray
} catch {
  Write-Host "[ERROR] Failed to register task: $_" -ForegroundColor Red
  exit 1
}
