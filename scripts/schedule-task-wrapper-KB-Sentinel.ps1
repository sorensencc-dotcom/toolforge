#!/usr/bin/env pwsh
<#
.SYNOPSIS
Windows Scheduled Task wrapper for KB-Sync Drift & Autoheal Sentinel Bot under \Ironbots\ category.

.DESCRIPTION
Automates periodic execution of scripts/kb-sentinel-bot.mjs to maintain
knowledge base health, link hygiene, and frontmatter integrity.
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
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
    [string]$ScheduleTime = '03:00',
    [string]$TaskName = 'KB-Sentinel',
    [string]$TaskPath = '\Ironbots\',
    [switch]$Unattended,
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $RepoRoot 'scripts\kb-sentinel-bot.mjs'
$stdoutLog = Join-Path $LogDirectory 'kb-sentinel-bot.stdout.log'
$stderrLog = Join-Path $LogDirectory 'kb-sentinel-bot.stderr.log'

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
    } else {
        $arguments += '--fix'
    }
    return $arguments -join ' '
}

switch ($Action) {
    'Register' {
        if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
            throw "Sentinel script does not exist: $scriptPath"
        }

        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        Ensure-TaskFolder -Path $TaskPath

        $cmdArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& '$NodePath' $(Get-NodeArguments) 1>> '$stdoutLog' 2>> '$stderrLog'`""
        $taskAction = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument $cmdArgs -WorkingDirectory $RepoRoot

        $trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($ScheduleTime, 'HH:mm', $null))

        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
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
                    -Description 'Ironbots: Periodic Knowledge Base drift and autoheal sentinel audit (Unattended).' `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered unattended task '$TaskPath$TaskName' at $ScheduleTime daily (S4U: runs whether logged in or not)." -ForegroundColor Green
            } catch {
                Write-Warning "Unattended registration failed (requires Admin elevation). Registering in standard user mode."
                Register-ScheduledTask `
                    -TaskName $TaskName `
                    -TaskPath $TaskPath `
                    -Action $taskAction `
                    -Trigger $trigger `
                    -Settings $settings `
                    -Description 'Ironbots: Periodic Knowledge Base drift and autoheal sentinel audit.' `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered task '$TaskPath$TaskName' at $ScheduleTime daily." -ForegroundColor Yellow
                Write-Host "💡 To run when not logged in, run PowerShell as Administrator and execute this command." -ForegroundColor Cyan
            }
        } else {
            Register-ScheduledTask `
                -TaskName $TaskName `
                -TaskPath $TaskPath `
                -Action $taskAction `
                -Trigger $trigger `
                -Settings $settings `
                -Description 'Ironbots: Periodic Knowledge Base drift and autoheal sentinel audit.' `
                -Force:$Force | Out-Null
            Write-Host "[OK] Registered task '$TaskPath$TaskName' at $ScheduleTime daily." -ForegroundColor Green
            Write-Host "💡 To run when not logged in, execute from an Administrator PowerShell prompt." -ForegroundColor Cyan
        }
    }

    'Unregister' {
        Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "[OK] Scheduled task '$TaskPath$TaskName' unregistered." -ForegroundColor Yellow
    }

    'Status' {
        $task = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if ($null -eq $task) {
            Write-Host "[INFO] Scheduled task '$TaskPath$TaskName' is not currently registered." -ForegroundColor Cyan
            break
        }

        $info = $task | Get-ScheduledTaskInfo
        Write-Host "Category:     $TaskPath" -ForegroundColor Green
        Write-Host "Task Name:    $TaskName" -ForegroundColor Green
        Write-Host "State:        $($task.State)"
        Write-Host "Logon Type:   $($task.Principal.LogonType)"
        Write-Host "Last Run:     $($info.LastRunTime)"
        Write-Host "Next Run:     $($info.NextRunTime)"
        Write-Host "Last Result:  $($info.LastTaskResult)"
    }

    'Test' {
        if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
            throw "Sentinel script does not exist: $scriptPath"
        }

        Write-Host "[Test] Executing KB-Sentinel bot directly..." -ForegroundColor Cyan
        & $NodePath $scriptPath --dry-run
    }
}
