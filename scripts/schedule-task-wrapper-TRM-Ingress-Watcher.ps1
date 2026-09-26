#!/usr/bin/env pwsh
<#
.SYNOPSIS
Windows Scheduled Task wrapper for TRM-Drive-Sync Ingress Watcher Bot under \Ironbots\ category.

.DESCRIPTION
Automates continuous monitoring and periodic sweeps of TRM Drive staging inboxes,
staging action items into .harness/tasks/pending and logging telemetry.
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
    [string]$TaskName = 'TRM-Drive-Sync',
    [string]$TaskPath = '\Ironbots\',
    [switch]$Unattended,
    [switch]$Continuous,
    [switch]$Once,
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $RepoRoot 'scripts\trm-ingress-watcher.mjs'
$stdoutLog = Join-Path $LogDirectory 'trm-drive-sync.stdout.log'
$stderrLog = Join-Path $LogDirectory 'trm-drive-sync.stderr.log'

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
    # Background service registration defaults to continuous watch unless -Once is specified
    if ($Once -or ($Action -eq 'Test' -and -not $Continuous)) {
        $arguments += '--once'
    }
    return $arguments -join ' '
}

switch ($Action) {
    'Register' {
        if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
            throw "TRM ingress watcher script does not exist: $scriptPath"
        }

        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        Ensure-TaskFolder -Path $TaskPath

        $cmdArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& '$NodePath' $(Get-NodeArguments) 1>> '$stdoutLog' 2>> '$stderrLog'`""
        $taskAction = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument $cmdArgs -WorkingDirectory $RepoRoot

        # Trigger at startup / continuous with hourly repetition or on-logon
        $trigger = New-ScheduledTaskTrigger -AtStartup

        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -ExecutionTimeLimit (New-TimeSpan -Hours 24) `
            -RestartCount 3 `
            -RestartInterval (New-TimeSpan -Minutes 5) `
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
                    -Description 'Ironbots: TRM Google Drive and mobile inbox sync watcher (Unattended).' `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered unattended task '$TaskPath$TaskName' (S4U: runs whether logged in or not)." -ForegroundColor Green
            } catch {
                Write-Warning "S4U registration failed ($($_.Exception.Message)). Falling back to interactive logon registration..."
                $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
                Register-ScheduledTask `
                    -TaskName $TaskName `
                    -TaskPath $TaskPath `
                    -Action $taskAction `
                    -Trigger $trigger `
                    -Settings $settings `
                    -Principal $principal `
                    -Description 'Ironbots: TRM Google Drive and mobile inbox sync watcher (Interactive).' `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered interactive task '$TaskPath$TaskName'." -ForegroundColor Green
            }
        } else {
            $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
            Register-ScheduledTask `
                -TaskName $TaskName `
                -TaskPath $TaskPath `
                -Action $taskAction `
                -Trigger $trigger `
                -Settings $settings `
                -Principal $principal `
                -Description 'Ironbots: TRM Google Drive and mobile inbox sync watcher.' `
                -Force:$Force | Out-Null
            Write-Host "[OK] Registered interactive task '$TaskPath$TaskName'." -ForegroundColor Green
        }
    }

    'Unregister' {
        $task = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($null -ne $task) {
            Unregister-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -Confirm:$false
            Write-Host "[OK] Unregistered task '$TaskPath$TaskName'." -ForegroundColor Yellow
        } else {
            Write-Host "[INFO] Task '$TaskPath$TaskName' is not registered." -ForegroundColor Gray
        }
    }

    'Status' {
        $task = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($null -eq $task) {
            Write-Host "[STATUS] Task '$TaskPath$TaskName' is NOT registered." -ForegroundColor Red
            return
        }

        $info = Get-ScheduledTaskInfo -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
        Write-Host "Task Name:        $TaskPath$TaskName" -ForegroundColor Cyan
        Write-Host "State:            $($task.State)" -ForegroundColor Yellow
        Write-Host "Last Run Time:    $($info.LastRunTime)"
        Write-Host "Last Task Result: $($info.LastTaskResult)"
        Write-Host "Next Run Time:    $($info.NextRunTime)"
        Write-Host "Log (stdout):     $stdoutLog"
        Write-Host "Log (stderr):     $stderrLog"
    }

    'Test' {
        $testArgs = @($scriptPath)
        if ($DryRun) { $testArgs += '--dry-run' }
        if ($Once -or -not $Continuous) { $testArgs += '--once' }
        Write-Host "[TEST] Executing test for $TaskName (Args: $($testArgs -join ' '))..." -ForegroundColor Cyan
        & $NodePath @testArgs
    }
}
