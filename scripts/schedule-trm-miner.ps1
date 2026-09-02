<#
.SYNOPSIS
    Registers a Windows Scheduled Task for the TRM Closed-Loop Orchestrator.
.DESCRIPTION
    Configures an idempotent Windows Scheduled Task to run the TRM Closed-Loop
    Mining and NotebookLM synchronization pipeline nightly.
    Uses S4U (Service-for-User) authentication so it runs unattended ("whether user is
    logged on or not") WITHOUT requiring or storing a Windows password.
.VERSION
    2.1.0
.DATE
    2026-09-02
#>

[CmdletBinding()]
param(
    [string]$Time = "02:00",
    [string]$TaskName = "CIC-TRM-ClosedLoop-Nightly-Miner",
    [switch]$RunNow
)

$ErrorActionPreference = "Stop"
$root = "C:\dev"
$logDir = "$root\logs"
$logFile = "$logDir\trm-miner-scheduled.log"

Write-Host "`n=== [TRM CLOSED-LOOP UNATTENDED SCHEDULER SETUP] ===" -ForegroundColor Cyan

# 1. Ensure log directory exists
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# 2. Verify runtime dependencies
Write-Host "1. Verifying environment prerequisites..." -ForegroundColor Yellow

$pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
if (-not $pwshCmd) {
    Write-Error "PowerShell 7 (pwsh) was not found in PATH."
    exit 1
}
Write-Host "  ✔ pwsh found: $($pwshCmd.Source)" -ForegroundColor Green

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Error "Node.js was not found in PATH."
    exit 1
}
Write-Host "  ✔ node found: $($nodeCmd.Source)" -ForegroundColor Green

# 3. Build task action, trigger, and S4U principal (runs without password when not logged on)
Write-Host "`n2. Registering Unattended Scheduled Task '$TaskName' for $Time daily..." -ForegroundColor Yellow

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Removing existing scheduled task..." -ForegroundColor DarkGray
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$taskCmd = "pwsh.exe"
$taskArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"node scripts/run-sibling-check-v2.mjs --mode=check; node scripts/consolidate-pack.mjs --category=willow-run *>> '$logFile'`""

$action = New-ScheduledTaskAction `
    -Execute $taskCmd `
    -Argument $taskArgs `
    -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($Time, "HH:mm", $null))

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# S4U Principal allows task to execute when user is not logged on without storing credentials
$username = $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $username -LogonType S4U -RunLevel Limited

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Nightly Topic Research Mining (TRM) Closed-Loop Orchestrator and NotebookLM Synchronization (Unattended S4U)." `
        -Force | Out-Null
    Write-Host "  ✔ Scheduled task '$TaskName' registered successfully with S4U (Unattended, No Password)." -ForegroundColor Green
} catch {
    Write-Warning "S4U registration failed (requires Administrator elevation). Falling back to interactive principal."
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Nightly Topic Research Mining (TRM) Closed-Loop Orchestrator and NotebookLM Synchronization (Interactive)." `
        -Force | Out-Null
    Write-Host "  ✔ Scheduled task '$TaskName' registered in Interactive mode (runs when logged on)." -ForegroundColor Yellow
    Write-Host "  💡 To upgrade to unattended execution, run PowerShell as Administrator and execute this script." -ForegroundColor DarkGray
}

# 4. Optional Immediate Run
if ($RunNow) {
    Write-Host "`n3. Triggering immediate task run..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "  Task triggered. Check $logFile for output." -ForegroundColor Green
}

Write-Host "`n================================================================================"
Write-Host "Setup complete. Task scheduled at $Time daily." -ForegroundColor Green
Write-Host "===============================================================================`n"
