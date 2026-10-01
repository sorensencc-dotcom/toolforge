#!/usr/bin/env pwsh
<#
.SYNOPSIS
Windows Scheduled Task wrapper for IronLedger Sentinel & Supervisor Bot under \Ironbots\ category.

.DESCRIPTION
Automates recurring health supervision, invariant verification, sync task auditing,
and container self-healing for IronLedger rooted at C:\dev\IronLedger.
Category / Folder: \Ironbots\
Supports unattended execution ("Run whether user is logged on or not") via S4U.
#>

[CmdletBinding()]
param(
    [ValidateSet('Register', 'Unregister', 'Status', 'Test')]
    [string]$Action = 'Status',

    [string]$RepoRoot = $(if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { 'C:\dev' }),
    [string]$NodePath = 'node.exe',
    [string]$LogDirectory = $(Join-Path $(if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { 'C:\dev' }) 'logs'),
    [int]$IntervalMinutes = 15,
    [string]$TaskName = 'IronLedger-Sentinel',
    [string]$TaskPath = '\Ironbots\',
    [switch]$Unattended,
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $RepoRoot 'scripts\ironledger-sentinel-bot.mjs'
$stdoutLog = Join-Path $LogDirectory 'ironledger-sentinel-bot.stdout.log'
$stderrLog = Join-Path $LogDirectory 'ironledger-sentinel-bot.stderr.log'

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
    $arguments = @($scriptPath)
    if ($DryRun) {
        $arguments += '--dry-run'
    }
    return $arguments -join ' '
}

switch ($Action) {
    'Register' {
        if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
            throw "IronLedger sentinel script does not exist: $scriptPath"
        }

        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        Ensure-TaskFolder -Path $TaskPath

        $cmdArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& '$NodePath' $(Get-NodeArguments) 1>> '$stdoutLog' 2>> '$stderrLog'`""
        $taskAction = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument $cmdArgs -WorkingDirectory $RepoRoot

        # Trigger repeating every X minutes
        $trigger = New-ScheduledTaskTrigger -Once -At "00:00" -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)

        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
            -MultipleInstances IgnoreNew `
            -StartWhenAvailable

        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

        if ($isAdmin -or $Unattended) {
            try {
                $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
                Register-ScheduledTask `
                    -TaskName $TaskName `
                    -TaskPath $TaskPath `
                    -Action $taskAction `
                    -Trigger $trigger `
                    -Settings $settings `
                    -Principal $principal `
                    -Description 'Ironbots: Automated IronLedger workbench health supervisor, invariant checker, and container healer (Unattended).' `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered unattended task '$TaskPath$TaskName' every $IntervalMinutes minutes (S4U: runs whether logged in or not)." -ForegroundColor Green
            } catch {
                Write-Warning "Unattended registration failed (requires Admin elevation). Registering in standard user mode."
                Register-ScheduledTask `
                    -TaskName $TaskName `
                    -TaskPath $TaskPath `
                    -Action $taskAction `
                    -Trigger $trigger `
                    -Settings $settings `
                    -Description 'Ironbots: Automated IronLedger workbench health supervisor, invariant checker, and container healer.' `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered task '$TaskPath$TaskName' every $IntervalMinutes minutes (Interactive user mode)." -ForegroundColor Green
            }
        } else {
            Register-ScheduledTask `
                -TaskName $TaskName `
                -TaskPath $TaskPath `
                -Action $taskAction `
                -Trigger $trigger `
                -Settings $settings `
                -Description 'Ironbots: Automated IronLedger workbench health supervisor, invariant checker, and container healer.' `
                -Force:$Force | Out-Null
            Write-Host "[OK] Registered task '$TaskPath$TaskName' every $IntervalMinutes minutes." -ForegroundColor Green
        }
    }

    'Unregister' {
        $existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if ($existing) {
            Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
            Write-Host "[OK] Unregistered scheduled task '$TaskPath$TaskName'." -ForegroundColor Yellow
        } else {
            Write-Host "Task '$TaskPath$TaskName' not found; nothing to unregister." -ForegroundColor DarkGray
        }
    }

    'Status' {
        $task = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if (-not $task) {
            Write-Host "Task '$TaskPath$TaskName' is NOT registered." -ForegroundColor Red
            return
        }

        $info = Get-ScheduledTaskInfo -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            TaskName       = $task.TaskName
            TaskPath       = $task.TaskPath
            State          = $task.State
            LastRunTime    = $info.LastRunTime
            LastTaskResult = $info.LastTaskResult
            NextRunTime    = $info.NextRunTime
        } | Format-List
    }

    'Test' {
        Write-Host "Executing IronLedger Sentinel synchronously..." -ForegroundColor Cyan
        & $NodePath $scriptPath @(if ($DryRun) { '--dry-run' })
    }
}
