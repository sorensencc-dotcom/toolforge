#!/usr/bin/env pwsh
<#
.SYNOPSIS
Register Toolforge CI pipeline with Windows Task Scheduler.

.DESCRIPTION
Creates two tasks:
1. Post-commit hook trigger (runs after git commit)
2. Nightly run (21:00 daily)

Both log to C:\dev\logs\ci

.PARAMETER Action
Register, Unregister, List, Test

.EXAMPLE
./setup-ci-scheduler.ps1 -Action Register
./setup-ci-scheduler.ps1 -Action Test
#>

param(
    [ValidateSet('Register', 'Unregister', 'List', 'Test')]
    [string]$Action = 'Register'
)

$ErrorActionPreference = 'Stop'
$taskName = 'Toolforge-CI-Pipeline'
$nightlyTaskName = 'Toolforge-CI-Nightly'
$scriptPath = 'C:\dev\ci-pipeline.ps1'
$logDir = 'C:\dev\logs\ci'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Register-Tasks {
    Write-Host "Registering Task Scheduler jobs..."

    # Post-commit trigger task
    $action = New-ScheduledTaskAction -Execute 'pwsh.exe' `
        -Argument "-NoProfile -File '$scriptPath' -Verbose" `
        -WorkingDirectory 'C:\dev'

    $trigger = New-ScheduledTaskTrigger -AtStartup

    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries -StartWhenAvailable

    Register-ScheduledTask -TaskName $taskName `
        -Action $action -Trigger $trigger -Settings $settings `
        -Force | Out-Null

    Write-Host "✓ Registered $taskName (on startup)"

    # Nightly task
    $nightlyTrigger = New-ScheduledTaskTrigger -Daily -At '21:00'

    Register-ScheduledTask -TaskName $nightlyTaskName `
        -Action $action -Trigger $nightlyTrigger -Settings $settings `
        -Force | Out-Null

    Write-Host "✓ Registered $nightlyTaskName (daily 21:00)"

    # Add git hook for post-commit
    New-PostCommitHook
}

function Unregister-Tasks {
    Write-Host "Unregistering tasks..."
    Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue |
        Unregister-ScheduledTask -Confirm:$false
    Get-ScheduledTask -TaskName $nightlyTaskName -ErrorAction SilentlyContinue |
        Unregister-ScheduledTask -Confirm:$false
    Write-Host "✓ Tasks removed"
}

function List-Tasks {
    Write-Host "Registered Toolforge CI tasks:"
    Get-ScheduledTask | Where-Object { $_.TaskName -like '*Toolforge-CI*' } |
        Format-Table TaskName, State, LastRunTime, NextRunTime -AutoSize
}

function Test-Pipeline {
    Write-Host "Testing CI pipeline..."
    & "$scriptPath" -Verbose
    $exitCode = $LASTEXITCODE
    Write-Host "Exit code: $exitCode"
    return $exitCode
}

function New-PostCommitHook {
    $gitDir = 'C:\dev\.git'
    if (-not (Test-Path $gitDir)) {
        Write-Host "⚠ Not in git repo, skipping post-commit hook"
        return
    }

    $hookPath = "$gitDir\hooks\post-commit"
    $hookContent = @"
#!/bin/bash
pwsh -NoProfile -File C:/dev/toolforge/ci-pipeline.ps1 -Verbose
"@

    $hookContent | Out-File -FilePath $hookPath -Encoding UTF8 -Force
    chmod +x $hookPath 2>$null
    Write-Host "✓ Post-commit hook installed"
}

switch ($Action) {
    'Register' { Register-Tasks }
    'Unregister' { Unregister-Tasks }
    'List' { List-Tasks }
    'Test' { Test-Pipeline }
}
