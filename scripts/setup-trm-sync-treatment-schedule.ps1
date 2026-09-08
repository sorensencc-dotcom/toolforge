#!/usr/bin/env pwsh
<#
.SYNOPSIS
Register Windows scheduled task for daily trm sync-treatment reconciliation.

.DESCRIPTION
Creates a Windows Task Scheduler task that runs trm-sync-treatment-agent.ps1
every day at 6:30 AM (after the 6:00 AM morning-ingestion task).
Requires admin privileges.
#>

param(
  [switch]$Force = $false
)

$taskName = "toolforge-trm-sync-treatment"
$taskPath = "\toolforge\"
$script = "C:\dev\scripts\trm-sync-treatment-agent.ps1"

if (-not (Test-Path $script)) {
  Write-Host "[ERROR] Script not found: $script" -ForegroundColor Red
  exit 1
}

# Check for actual admin elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$principal = if ($isAdmin) {
  New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
} else {
  New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U
}

Write-Host "TRM sync-treatment Daily Task Registration" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

$existing = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
if ($existing) {
  if (-not $Force) {
    Write-Host "[!] Task already exists. Use -Force to overwrite." -ForegroundColor Yellow
    exit 1
  }
  Write-Host "Removing existing task..." -ForegroundColor Cyan
  Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false | Out-Null
}

$action = New-ScheduledTaskAction `
  -Execute "pwsh.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory "C:\dev"

$trigger = New-ScheduledTaskTrigger `
  -Daily `
  -At "06:30"

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -MultipleInstances IgnoreNew

Write-Host "Registering task: $taskName" -ForegroundColor Cyan
Write-Host "  Schedule: Daily at 6:30 AM" -ForegroundColor Gray
Write-Host "  Script: $script" -ForegroundColor Gray
Write-Host "  Timeout: 1 hour" -ForegroundColor Gray

try {
  Register-ScheduledTask `
    -TaskName $taskName `
    -TaskPath $taskPath `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Daily trm sync-treatment reconciliation" `
    -Force | Out-Null

  Write-Host ""
  Write-Host "[OK] Task registered successfully." -ForegroundColor Green
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Green
  Write-Host "  View task: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  Write-Host "  Run now:   Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  Write-Host "  Logs:      C:\dev\logs\trm-sync-treatment-*.log" -ForegroundColor Gray
} catch {
  Write-Host "[ERROR] Failed to register task: $_" -ForegroundColor Red
  exit 1
}
