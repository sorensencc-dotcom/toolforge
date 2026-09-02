#!/usr/bin/env pwsh
<#
.SYNOPSIS
Register Windows scheduled task for daily retro history audit.

.DESCRIPTION
Creates a Windows Task Scheduler task that runs retro-audit-agent.ps1 every day at 6 PM.
Requires admin privileges.
#>

param(
  [switch]$Force = $false
)

$taskName = "toolforge-retro-audit-agent"
$taskPath = "\toolforge\"
$script = "C:\dev\scripts\retro-audit-agent.ps1"
$repoRoot = "C:\dev"

# Verify script exists
if (-not (Test-Path $script)) {
  Write-Host "[ERROR] Script not found: $script" -ForegroundColor Red
  exit 1
}

# Check for actual admin elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$principal = if ($isAdmin) {
  New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
} else {
  New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
}

Write-Host "Retro Audit Task Registration" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""

# Check if task exists
$existing = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
if ($existing) {
  if (-not $Force) {
    Write-Host "[!] Task already exists. Use -Force to overwrite." -ForegroundColor Yellow
    exit 1
  }
  Write-Host "Removing existing task..." -ForegroundColor Cyan
  Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false | Out-Null
}

# Create task action
$action = New-ScheduledTaskAction `
  -Execute "pwsh.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -RepoRoot `"$repoRoot`"" `
  -WorkingDirectory "C:\dev"

# Create task trigger: Daily at 6 PM
$trigger = New-ScheduledTaskTrigger `
  -Daily `
  -At "18:00"

# Create task settings with timeout
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -MultipleInstances IgnoreNew

# Create and register task
Write-Host "Registering task: $taskName" -ForegroundColor Cyan
Write-Host "  Schedule: Daily at 6:00 PM" -ForegroundColor Gray
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
    -Description "Daily retro history validation and audit report" `
    -Force | Out-Null

  Write-Host ""
  Write-Host "[OK] Task registered successfully." -ForegroundColor Green
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Green
  Write-Host "  View task: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  Write-Host "  Run now:   Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  Write-Host "  Logs:      C:\dev\logs\retro-audit-*.log" -ForegroundColor Gray
} catch {
  Write-Host "[ERROR] Failed to register task: $_" -ForegroundColor Red
  exit 1
}
