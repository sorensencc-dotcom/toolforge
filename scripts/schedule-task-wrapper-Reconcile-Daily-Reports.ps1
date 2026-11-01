#!/usr/bin/env pwsh
<#
.SYNOPSIS
Windows Scheduled Task wrapper for Daily Report Reconciliation Engine under \Ironbots\ or \toolforge\.

.DESCRIPTION
Automates the 3x daily differential reconciliation passes:
- 06:30 AM EST: Preflights and cleanses the knowledge plane before the 07:00 AM Morning Ingestion pass.
- 11:15 AM EST: Runs 30 minutes before the 11:45 AM Daily Intelligence Briefing to verify daemon heartbeats,
                ensure the SEV-1 banner trips if a runner stalled, and purge completed cards.
- 06:00 PM EST: Catches afternoon git commits and closes out the working day.

Supports unattended execution ("Run whether user is logged on or not") via S4U with Highest runlevel (Elevated no login).
#>

[CmdletBinding()]
param(
    [ValidateSet('Register', 'Unregister', 'Status', 'Run', 'Test')]
    [string]$Action = 'Register',

    [string]$RepoRoot = $(if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { 'C:\dev' }),
    [string]$NodePath = 'node.exe',
    [string]$LogDirectory = $(Join-Path $(if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { 'C:\dev' }) 'logs'),
    [string[]]$ScheduleTimes = @('06:30', '11:15', '18:00'),
    [string]$TaskName = 'Daily-Report-Reconciliation',
    [string]$TaskPath = '\Ironbots\',
    [switch]$DryRun,
    [switch]$Force = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $RepoRoot 'scripts\reconcile-daily-reports.mjs'
$stdoutLog = Join-Path $LogDirectory 'reconcile-daily-reports.stdout.log'
$stderrLog = Join-Path $LogDirectory 'reconcile-daily-reports.stderr.log'

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

function Get-NodeArguments {
    $arguments = @("`"$scriptPath`"")
    if ($DryRun) {
        $arguments += '--dry-run'
    }
    return $arguments -join ' '
}

switch ($Action) {
    'Register' {
        if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
            throw "Reconcile daily reports script does not exist: $scriptPath"
        }

        if (-not (Test-Path -LiteralPath $LogDirectory)) {
            New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        }
        Ensure-TaskFolder -Path $TaskPath

        $cmdArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"& '$NodePath' $(Get-NodeArguments) 1>> '$stdoutLog' 2>> '$stderrLog'`""
        $PwshPath = (Get-Command pwsh.exe -ErrorAction SilentlyContinue)?.Source
        if (-not $PwshPath) { $PwshPath = 'C:\Program Files\PowerShell\7\pwsh.exe' }
        $taskAction = New-ScheduledTaskAction -Execute $PwshPath -Argument $cmdArgs -WorkingDirectory $RepoRoot

        $triggers = @()
        foreach ($timeStr in $ScheduleTimes) {
            $triggers += New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($timeStr, 'HH:mm', $null))
        }

        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
            -MultipleInstances IgnoreNew `
            -StartWhenAvailable

        $description = 'Automated 3x daily differential report validator, zombie cleanser, heartbeat monitor, and gap reconciler (06:30, 11:15, 18:00 EST).'

        # Elevated no login: S4U + Highest run level
        try {
            $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
            Register-ScheduledTask `
                -TaskName $TaskName `
                -TaskPath $TaskPath `
                -Action $taskAction `
                -Trigger $triggers `
                -Settings $settings `
                -Principal $principal `
                -Description $description `
                -Force:$Force | Out-Null
            Write-Host "[OK] Registered elevated unattended task '$TaskPath$TaskName' at $($ScheduleTimes -join ', ') daily (S4U: runs elevated without interactive login)." -ForegroundColor Green
        } catch {
            Write-Warning "S4U registration note: $($_.Exception.Message). Falling back to HighestAvailable / interactive."
            try {
                $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
                Register-ScheduledTask `
                    -TaskName $TaskName `
                    -TaskPath $TaskPath `
                    -Action $taskAction `
                    -Trigger $triggers `
                    -Settings $settings `
                    -Principal $principal `
                    -Description $description `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered task '$TaskPath$TaskName' with Highest privileges." -ForegroundColor Green
            } catch {
                Register-ScheduledTask `
                    -TaskName $TaskName `
                    -TaskPath $TaskPath `
                    -Action $taskAction `
                    -Trigger $triggers `
                    -Settings $settings `
                    -Description $description `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered task '$TaskPath$TaskName'." -ForegroundColor Yellow
            }
        }
    }

    'Unregister' {
        try {
            Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false -ErrorAction Stop
            Write-Host "[OK] Unregistered scheduled task '$TaskPath$TaskName'." -ForegroundColor Green
        } catch {
            Write-Warning "Task '$TaskPath$TaskName' not found or could not be unregistered: $($_.Exception.Message)"
        }
    }

    'Status' {
        try {
            $task = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction Stop
            $info = Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
            Write-Host "Task: $($task.TaskPath)$($task.TaskName)" -ForegroundColor Cyan
            Write-Host "  State:          $($task.State)"
            Write-Host "  Last Run Time:  $($info.LastRunTime)"
            Write-Host "  Last Result:    $($info.LastTaskResult)"
            Write-Host "  Next Run Time:  $($info.NextRunTime)"
            Write-Host "  Triggers:       $(($task.Triggers | ForEach-Object { $_.StartBoundary }) -join ', ')"
            Write-Host "  LogonType:      $($task.Principal.LogonType)"
            Write-Host "  RunLevel:       $($task.Principal.RunLevel)"
        } catch {
            Write-Warning "Task '$TaskPath$TaskName' is not currently registered."
        }
    }

    'Run' {
        try {
            Start-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction Stop
            Write-Host "[OK] Triggered scheduled task '$TaskPath$TaskName' manually." -ForegroundColor Green
        } catch {
            Write-Error "Failed to start task '$TaskPath$TaskName': $($_.Exception.Message)"
        }
    }

    'Test' {
        Write-Host "[TEST] Executing script directly via node..." -ForegroundColor Cyan
        & $NodePath $scriptPath --dry-run --verbose
    }
}
