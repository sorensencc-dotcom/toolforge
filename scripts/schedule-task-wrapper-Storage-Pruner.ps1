#!/usr/bin/env pwsh
<#
.SYNOPSIS
Windows Scheduled Task wrapper for Autonomous Storage & Telemetry Compactor (Storage-Pruner) under \Ironbots\ category.

.DESCRIPTION
Performs weekly SQLite database vacuuming (.kb_cache, .ijfw, reporting DBs), historical telemetry gzip compression,
and .harness task pruning.
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
    [string]$TaskName = 'Storage-Pruner',
    [string]$TaskPath = '\Ironbots\',
    [switch]$Unattended,
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $RepoRoot 'scripts\storage-pruner.mjs'
$stdoutLog = Join-Path $LogDirectory 'storage-pruner.stdout.log'
$stderrLog = Join-Path $LogDirectory 'storage-pruner.stderr.log'

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
    return ($arguments -join ' ')
}

switch ($Action) {
    'Register' {
        if (-not (Test-Path $LogDirectory)) {
            New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        }
        Ensure-TaskFolder -Path $TaskPath

        $fullTaskName = "$TaskPath$TaskName"
        $existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue

        if ($existing -and -not $Force) {
            Write-Host "[Storage-Pruner] Task '$fullTaskName' already exists. Use -Force to overwrite."
            return
        }

        $argString = Get-NodeArguments
        $actionObj = New-ScheduledTaskAction -Execute $NodePath -Argument $argString -WorkingDirectory $RepoRoot
        
        # Weekly trigger on Sunday at 03:30 AM
        $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '03:30'

        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

        if ($isAdmin -or $Unattended) {
            try {
                $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
                Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Action $actionObj -Trigger $trigger -Settings $settings -Principal $principal -Description 'Ironbots: Autonomous SQLite vacuuming, telemetry compression, and harness task pruning (Unattended).' -Force | Out-Null
                Write-Host "[Storage-Pruner] Scheduled task registered: $fullTaskName (Weekly Sunday at 03:30 AM, Unattended S4U Highest)"
            } catch {
                Write-Warning "S4U registration failed ($($_.Exception.Message)). Falling back to interactive logon registration..."
                $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
                Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Action $actionObj -Trigger $trigger -Settings $settings -Principal $principal -Description 'Ironbots: Autonomous SQLite vacuuming, telemetry compression, and harness task pruning.' -Force | Out-Null
                Write-Host "[Storage-Pruner] Scheduled task registered: $fullTaskName (Weekly Sunday at 03:30 AM, Interactive)"
            }
        } else {
            $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
            Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Action $actionObj -Trigger $trigger -Settings $settings -Principal $principal -Description 'Ironbots: Autonomous SQLite vacuuming, telemetry compression, and harness task pruning.' -Force | Out-Null
            Write-Host "[Storage-Pruner] Scheduled task registered: $fullTaskName (Weekly Sunday at 03:30 AM, Interactive)"
        }
    }

    'Unregister' {
        $existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if ($existing) {
            Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
            Write-Host "[Storage-Pruner] Unregistered task '$TaskPath$TaskName'"
        } else {
            Write-Host "[Storage-Pruner] Task '$TaskPath$TaskName' not found."
        }
    }

    'Status' {
        $existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host "[Storage-Pruner] Task: $TaskPath$TaskName | State: $($existing.State)"
        } else {
            Write-Host "[Storage-Pruner] Task '$TaskPath$TaskName' is not registered."
        }
    }

    'Test' {
        Write-Host "[Storage-Pruner] Executing test run..."
        & $NodePath $scriptPath $(if ($DryRun) { '--dry-run' })
    }
}
