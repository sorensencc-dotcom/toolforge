[CmdletBinding()]
param(
    [string]$Time = "21:00",
    [switch]$RunNow
)

$ErrorActionPreference = "Stop"
$taskName = "CIC-Nightly-Notebook-Mining"
$root = "C:\dev"
$runnerScript = "$root\scripts\run-daily-notebook-mining.ps1"

Write-Host "`n=== [CIC NIGHTLY MINING TASK SCHEDULER SETUP] ===" -ForegroundColor Cyan

# 1. Preflight Checks
Write-Host "1. Checking Dependencies & Scripts..." -ForegroundColor Yellow
if (-not (Test-Path $runnerScript)) {
    Write-Error "Runner script not found at $runnerScript"
    exit 1
}
Write-Host "  ✔ Runner script exists: $runnerScript" -ForegroundColor Green

$pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
if (-not $pwshCmd) {
    Write-Error "pwsh (PowerShell 7) not found on PATH."
    exit 1
}
Write-Host "  ✔ pwsh located at: $($pwshCmd.Source)" -ForegroundColor Green

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Error "node not found on PATH."
    exit 1
}
Write-Host "  ✔ node located at: $($nodeCmd.Source)" -ForegroundColor Green

# Tor Port Probe (advisory)
$torTest = Test-NetConnection -ComputerName 127.0.0.1 -Port 9050 -WarningAction SilentlyContinue
if ($torTest.TcpTestSucceeded) {
    Write-Host "  ✔ Tor SOCKS5 proxy active on 127.0.0.1:9050" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Tor SOCKS5 proxy on 127.0.0.1:9050 is not active (Harvester will fail-soft to direct HTTPS)" -ForegroundColor Yellow
}

# 2. Idempotent Task Replacement
Write-Host "`n2. Registering Scheduled Task '$taskName'..." -ForegroundColor Yellow

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Unregistering existing scheduled task..." -ForegroundColor DarkGray
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerScript`"" `
    -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($Time, "HH:mm", $null))

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -Priority 5

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Description "CIC Automated Daily Research Mining with Torquery Routing across all canonical Google Notebooks" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal | Out-Null

$createdTask = Get-ScheduledTask -TaskName $taskName
Write-Host "  ✔ Successfully registered Scheduled Task '$taskName' (Trigger: Daily at $Time)`n" -ForegroundColor Green

if ($RunNow) {
    Write-Host "3. Triggering test execution..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 3
    $status = Get-ScheduledTask -TaskName $taskName
    Write-Host "  Task State: $($status.State)" -ForegroundColor Green
}

Write-Host "Scheduled Task Configuration Complete.`n" -ForegroundColor Green
