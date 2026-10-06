#!/usr/bin/env pwsh
<#
.SYNOPSIS
Windows Scheduled Task wrapper for Toolforge / Ironbots Weekly Retro Reporter.

.DESCRIPTION
Compiles and publishes the weekly retro report into .icf-retros/weekly/
Schedule: Weekly on Sunday @ 18:00
Supports unattended execution ("Run whether user is logged on or not") via S4U + Highest privileges.
#>

[CmdletBinding()]
param(
    [ValidateSet('Register', 'Unregister', 'Status', 'Run')]
    [string]$Action = 'Status',

    [string]$RepoRoot = $(if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { 'C:\dev' }),
    [string]$NodePath = 'node.exe',
    [string]$LogDirectory = $(Join-Path $(if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { 'C:\dev' }) 'logs\retro'),
    [string]$TaskName = 'toolforge-weekly-report-agent',
    [string]$TaskPath = '\toolforge\',
    [switch]$Unattended,
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $RepoRoot 'scripts\compile-weekly-retro.mjs'
$stdoutLog = Join-Path $LogDirectory 'weekly-retro.stdout.log'
$stderrLog = Join-Path $LogDirectory 'weekly-retro.stderr.log'

function Ensure-TaskFolder {
    param([string]$Path)
    $cleanPath = $Path.Trim('\')
    if ([string]::IsNullOrWhiteSpace($cleanPath)) { return }
    try {
        $service = New-Object -ComObject("Schedule.Service")
        $service.Connect()
        $root = $service.GetFolder("\")
        try {
            $root.GetFolder($cleanPath) | Out-Null
        } catch {
            $root.CreateFolder($cleanPath) | Out-Null
        }
    } catch {
        Write-Verbose "Task folder registration note for $($Path): $($_.Exception.Message)"
    }
}

switch ($Action) {
    'Register' {
        if (-not (Test-Path $LogDirectory)) {
            New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        }
        Ensure-TaskFolder -Path $TaskPath

        $fullTaskName = "$TaskPath$TaskName"
        $cmdArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& '$NodePath' '$scriptPath' 1>> '$stdoutLog' 2>> '$stderrLog'`""
        $taskAction = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument $cmdArgs -WorkingDirectory $RepoRoot
        
        # Weekly trigger on Sunday at 18:00
        $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '18:00'

        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -MultipleInstances IgnoreNew `
            -ExecutionTimeLimit (New-TimeSpan -Hours 1)

        try {
            $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
            Register-ScheduledTask `
                -TaskName $TaskName `
                -TaskPath $TaskPath `
                -Action $taskAction `
                -Trigger $trigger `
                -Settings $settings `
                -Principal $principal `
                -Description 'Toolforge: Weekly Retro Report deterministic compiler and publisher (Unattended S4U).' `
                -Force | Out-Null
            Write-Host "[OK] Scheduled task registered: $fullTaskName (Weekly Sunday at 18:00, Unattended S4U Highest)" -ForegroundColor Green
        } catch {
            Write-Warning "S4U registration failed ($($_.Exception.Message)). Falling back to interactive logon registration..."
            $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
            Register-ScheduledTask `
                -TaskName $TaskName `
                -TaskPath $TaskPath `
                -Action $taskAction `
                -Trigger $trigger `
                -Settings $settings `
                -Principal $principal `
                -Description 'Toolforge: Weekly Retro Report deterministic compiler and publisher.' `
                -Force | Out-Null
            Write-Host "[OK] Scheduled task registered: $fullTaskName (Weekly Sunday at 18:00, Interactive)" -ForegroundColor Yellow
        }
    }

    'Unregister' {
        $existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if ($existing) {
            Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
            Write-Host "[OK] Unregistered task: $TaskPath$TaskName" -ForegroundColor Green
        } else {
            Write-Host "Task not found: $TaskPath$TaskName"
        }
    }

    'Run' {
        Write-Host "Triggering task: $TaskPath$TaskName..."
        Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName | Start-ScheduledTask
        Start-Sleep -Seconds 2
        $info = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName | Get-ScheduledTaskInfo
        Write-Host "Task status: LastRunTime=$($info.LastRunTime), Result=$($info.LastTaskResult)"
    }

    'Status' {
        $existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if ($existing) {
            $info = $existing | Get-ScheduledTaskInfo
            Write-Host "Task Name:        $($existing.TaskPath)$($existing.TaskName)"
            Write-Host "State:            $($existing.State)"
            Write-Host "Logon Type:       $($existing.Principal.LogonType)"
            Write-Host "Run Level:        $($existing.Principal.RunLevel)"
            Write-Host "User ID:          $($existing.Principal.UserId)"
            Write-Host "Last Run Time:    $($info.LastRunTime)"
            Write-Host "Last Task Result: $($info.LastTaskResult)"
            Write-Host "Next Run Time:    $($info.NextRunTime)"
        } else {
            Write-Host "Task not found: $TaskPath$TaskName" -ForegroundColor Yellow
        }
    }
}
