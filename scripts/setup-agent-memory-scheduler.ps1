#!/usr/bin/env pwsh
<#
.SYNOPSIS
Register Toolforge Multi-Agent Memory Synchronization with Windows Task Scheduler.

.DESCRIPTION
Creates a background task that automatically synchronizes agent memories (Claude Code,
Antigravity, Codex, Grok, Local Models) to the canonical Obsidian Vault across workspaces.

.PARAMETER Action
Register, Unregister, Status, RunNow

.PARAMETER IntervalMinutes
Recurrence interval in minutes (default: 60)
#>

param(
    [ValidateSet('Register', 'Unregister', 'Status', 'RunNow')]
    [string]$Action = 'Register',
    [int]$IntervalMinutes = 60
)

$ErrorActionPreference = 'Stop'
$taskName = 'Toolforge-AgentMemorySync'
$scriptPath = 'C:\dev\toolforge.ps1'
$logDir = 'C:\dev\logs\agent-memory'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Register-MemoryTask {
    Write-Host "[Scheduler] Registering $taskName in Windows Task Scheduler..."

    $action = New-ScheduledTaskAction -Execute 'pwsh.exe' `
        -Argument "-NoProfile -NonInteractive -File '$scriptPath' -AgentMemorySync" `
        -WorkingDirectory 'C:\dev'

    $trigger = New-ScheduledTaskTrigger -AtLogOn

    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

    Register-ScheduledTask -TaskName $taskName `
        -Action $action -Trigger $trigger -Settings $settings `
        -Description "Toolforge Multi-Agent Memory Sync to Obsidian Vault" `
        -Force | Out-Null

    Write-Host "[Scheduler] Successfully registered $taskName (runs at logon and context refresh)"
}

function Unregister-MemoryTask {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "[Scheduler] Successfully unregistered $taskName"
    } else {
        Write-Host "[Scheduler] Task $taskName is not registered."
    }
}

function Get-MemoryTaskStatus {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        $info = Get-ScheduledTaskInfo -TaskName $taskName
        Write-Host "[Scheduler] Task: $($task.TaskName)"
        Write-Host "[Scheduler] State: $($task.State)"
        Write-Host "[Scheduler] Last Run: $($info.LastRunTime) (Result: $($info.LastTaskResult))"
        Write-Host "[Scheduler] Next Run: $($info.NextRunTime)"
    } else {
        Write-Host "[Scheduler] Task $taskName is NOT registered."
    }
}

function Invoke-MemoryTaskNow {
    Write-Host "[Scheduler] Triggering live sync now..."
    & pwsh.exe -NoProfile -File $scriptPath -AgentMemorySync
}

switch ($Action) {
    'Register'   { Register-MemoryTask }
    'Unregister' { Unregister-MemoryTask }
    'Status'     { Get-MemoryTaskStatus }
    'RunNow'     { Invoke-MemoryTaskNow }
}
