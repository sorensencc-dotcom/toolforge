<#
.SYNOPSIS
    Registers and hardens all TRM and KB-Sync scheduled tasks with S4U / Highest privileges.

.DESCRIPTION
    Configures:
    1. \TRM\TRM-Notebooklm-Auth-Heartbeat (Every 2 hours - keeps *PSIDTS tokens active)
    2. \TRM\TRM-Notebooklm-Chat-Archive (19:45 Daily - universal chat harvest & sync)
    3. \KB-SYNC\KB-Sync-Master-Pipeline (20:00 Daily - Obsidian validation, sync & drift audit)
    4. \KB-SYNC\KB-Sync-TRM-Triage (20:30 Daily - TRM cognitive gap triage & export)

    Enforces:
    - LogonType: S4U (Runs whether user is logged on or not, no password required)
    - RunLevel: Highest (Administrative elevation)
    - StartWhenAvailable: True (Catches up immediately if machine was sleeping)
    - AllowStartIfOnBatteries: True / DontStopIfGoingOnBatteries: True
#>

[CmdletBinding()]
param()

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$Principal = if ($isAdmin) {
    New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
} else {
    Write-Warning "Running in non-elevated session. Tasks will be registered with Interactive token. Run as Administrator for S4U unattended privileges."
    New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
}

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -WakeToRun

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " Registering Hardened TRM & KB-Sync Scheduled Tasks" -ForegroundColor Cyan
Write-Host " Principal LogonType: $($Principal.LogonType)" -ForegroundColor Gray
Write-Host " Principal RunLevel:  $($Principal.RunLevel)" -ForegroundColor Gray
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. TRM-Notebooklm-Auth-Heartbeat (Every 2 hours)
$HeartbeatAction = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"C:\dev\trm\schedule-task-wrapper-TRM-Notebooklm-Auth-Heartbeat.ps1`"" `
    -WorkingDirectory "C:\dev\trm"

$HeartbeatTrigger = New-ScheduledTaskTrigger -Daily -At "00:00"
$HeartbeatTrigger.Repetition = (New-ScheduledTaskTrigger -Once -At "00:00" -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 3650)).Repetition

Register-ScheduledTask -TaskName "TRM-Notebooklm-Auth-Heartbeat" -TaskPath "\TRM\" -Action $HeartbeatAction -Trigger $HeartbeatTrigger -Settings $Settings -Principal $Principal -Description "Automated 2-hour Google NotebookLM auth keep-alive heartbeat" -Force | Out-Null
Write-Host "✔ \TRM\TRM-Notebooklm-Auth-Heartbeat registered (Every 2 hours)" -ForegroundColor Green

# 2. TRM-Notebooklm-Chat-Archive (19:45)
$ChatAction = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"C:\dev\trm\schedule-task-wrapper-TRM-Notebooklm-Chat-Archive.ps1`"" `
    -WorkingDirectory "C:\dev\trm"

$ChatTrigger = New-ScheduledTaskTrigger -Daily -At "19:45"
Register-ScheduledTask -TaskName "TRM-Notebooklm-Chat-Archive" -TaskPath "\TRM\" -Action $ChatAction -Trigger $ChatTrigger -Settings $Settings -Principal $Principal -Description "Universal NotebookLM chat archive and knowledge harvester (19:45 daily)" -Force | Out-Null
Write-Host "✔ \TRM\TRM-Notebooklm-Chat-Archive registered (19:45 daily)" -ForegroundColor Green

# 3. KB-Sync-Master-Pipeline (20:00)
$MasterAction = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"C:\dev\kb-sync\scripts\schedule-task-wrapper-KB-Sync-Master.ps1`"" `
    -WorkingDirectory "C:\dev\kb-sync"

$MasterTrigger = New-ScheduledTaskTrigger -Daily -At "20:00"
Register-ScheduledTask -TaskName "KB-Sync-Master-Pipeline" -TaskPath "\KB-SYNC\" -Action $MasterAction -Trigger $MasterTrigger -Settings $Settings -Principal $Principal -Description "KB Sync Master Pipeline (20:00 daily)" -Force | Out-Null
Write-Host "✔ \KB-SYNC\KB-Sync-Master-Pipeline registered (20:00 daily)" -ForegroundColor Green

# 4. KB-Sync-TRM-Triage (20:30)
$TriageAction = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"C:\dev\kb-sync\scripts\schedule-task-wrapper-TRM-Triage.ps1`"" `
    -WorkingDirectory "C:\dev\kb-sync"

$TriageTrigger = New-ScheduledTaskTrigger -Daily -At "20:30"
Register-ScheduledTask -TaskName "KB-Sync-TRM-Triage" -TaskPath "\KB-SYNC\" -Action $TriageAction -Trigger $TriageTrigger -Settings $Settings -Principal $Principal -Description "TRM Gap Triage & RFC exporter (20:30 daily)" -Force | Out-Null
Write-Host "✔ \KB-SYNC\KB-Sync-TRM-Triage registered (20:30 daily)" -ForegroundColor Green

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " All 4 tasks successfully registered and hardened." -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
