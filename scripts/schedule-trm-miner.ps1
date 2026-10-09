#!/usr/bin/env pwsh
<#
.SYNOPSIS
Windows Scheduled Task wrapper for TRM Closed-Loop Nightly Miner & Autoheal pipeline under \Ironbots\ category.

.DESCRIPTION
Configures an unattended, idempotent Windows Scheduled Task to run the TRM Closed-Loop
Mining, wiki autohealing, and knowledge pack consolidation nightly.
Runs via S4U (Service-for-User) authentication ("whether user is logged on or not")
without requiring login, password prompts, or interactive session waiting.

Category / Folder: \Ironbots\
#>

[CmdletBinding()]
param(
    [ValidateSet('Register', 'Unregister', 'Status', 'Test')]
    [string]$Action = 'Register',

    [string]$RepoRoot = $(if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { 'C:\dev' }),
    [string]$NodePath = 'node.exe',
    [string]$LogDirectory = $(Join-Path $(if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { 'C:\dev' }) 'logs'),
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
    [string]$ScheduleTime = '02:00',
    [string]$TaskName = 'TRM-Miner',
    [string]$TaskPath = '\Ironbots\',
    [switch]$Unattended,
    [switch]$RunNow,
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$stdoutLog = Join-Path $LogDirectory 'trm-miner.stdout.log'
$stderrLog = Join-Path $LogDirectory 'trm-miner.stderr.log'

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

function Get-PipelineCommand {
    $autohealFlag = if ($DryRun) { '--dry-run' } else { '--fix' }
    $pipeline = "node scripts/run-sibling-check-v2.mjs --mode=check; node kb-sync/modules/wiki/autoheal-sweeper.mjs --vault-root=kb-sync/obsidian/vault $autohealFlag; node scripts/consolidate-pack.mjs --category=willow-run"
    return "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"$pipeline 1>> '$stdoutLog' 2>> '$stderrLog'`""
}

switch ($Action) {
    'Register' {
        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        Ensure-TaskFolder -Path $TaskPath

        $cmdArgs = Get-PipelineCommand
        $taskAction = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument $cmdArgs -WorkingDirectory $RepoRoot

        $trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($ScheduleTime, 'HH:mm', $null))

        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
            -MultipleInstances IgnoreNew `
            -StartWhenAvailable `
            -Priority 7

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
                    -Description 'Ironbots: Unattended TRM Closed-Loop Mining, Autoheal Sweeper & Knowledge Pack Consolidation.' `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered unattended task '$TaskPath$TaskName' at $ScheduleTime daily (S4U: runs whether logged in or not, no login, no waiting)." -ForegroundColor Green
            } catch {
                Write-Warning "Unattended S4U registration failed (requires Admin elevation). Registering in standard user mode."
                Register-ScheduledTask `
                    -TaskName $TaskName `
                    -TaskPath $TaskPath `
                    -Action $taskAction `
                    -Trigger $trigger `
                    -Settings $settings `
                    -Description 'Ironbots: TRM Closed-Loop Mining, Autoheal Sweeper & Knowledge Pack Consolidation.' `
                    -Force:$Force | Out-Null
                Write-Host "[OK] Registered task '$TaskPath$TaskName' at $ScheduleTime daily." -ForegroundColor Yellow
                Write-Host "💡 To run when not logged in, execute from an Administrator PowerShell prompt." -ForegroundColor Cyan
            }
        } else {
            Register-ScheduledTask `
                -TaskName $TaskName `
                -TaskPath $TaskPath `
                -Action $taskAction `
                -Trigger $trigger `
                -Settings $settings `
                -Description 'Ironbots: TRM Closed-Loop Mining, Autoheal Sweeper & Knowledge Pack Consolidation.' `
                -Force:$Force | Out-Null
            Write-Host "[OK] Registered task '$TaskPath$TaskName' at $ScheduleTime daily." -ForegroundColor Green
            Write-Host "💡 To run when not logged in, execute from an Administrator PowerShell prompt." -ForegroundColor Cyan
        }

        if ($RunNow) {
            Write-Host "[INFO] Triggering immediate task run..." -ForegroundColor Cyan
            Start-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath
            Write-Host "[OK] Task '$TaskPath$TaskName' triggered. Logs stream to $stdoutLog." -ForegroundColor Green
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
        Write-Host "State:        $($task.State)" -ForegroundColor Green
        Write-Host "Logon Type:   $($task.Principal.LogonType)" -ForegroundColor Green
        Write-Host "Last Run:     $($info.LastRunTime)" -ForegroundColor Cyan
        Write-Host "Next Run:     $($info.NextRunTime)" -ForegroundColor Cyan
        Write-Host "Action:       $($task.Actions.Execute) $($task.Actions.Arguments)" -ForegroundColor Gray
        Write-Host "Working Dir:  $($task.Actions.WorkingDirectory)" -ForegroundColor Gray
    }

    'Test' {
        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
        Write-Host "[TEST] Running pipeline in test mode (DryRun: $DryRun)..." -ForegroundColor Cyan
        
        $autohealFlag = if ($DryRun) { '--dry-run' } else { '--fix' }
        Set-Location -LiteralPath $RepoRoot

        Write-Host "[1/3] Running sibling check..." -ForegroundColor Yellow
        & $NodePath scripts/run-sibling-check-v2.mjs --mode=check
        if ($LASTEXITCODE -ne 0) { throw "Sibling check failed with exit code $LASTEXITCODE" }

        Write-Host "[2/3] Running autoheal sweeper ($autohealFlag)..." -ForegroundColor Yellow
        & $NodePath kb-sync/modules/wiki/autoheal-sweeper.mjs --vault-root=kb-sync/obsidian/vault $autohealFlag
        if ($LASTEXITCODE -ne 0) { throw "Autoheal sweeper failed with exit code $LASTEXITCODE" }

        Write-Host "[3/3] Running pack consolidation..." -ForegroundColor Yellow
        & $NodePath scripts/consolidate-pack.mjs --category=willow-run
        if ($LASTEXITCODE -ne 0) { throw "Pack consolidation failed with exit code $LASTEXITCODE" }

        Write-Host "[OK] Test run completed successfully." -ForegroundColor Green
    }
}
