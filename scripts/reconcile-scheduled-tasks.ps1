#!/usr/bin/env pwsh
<#
.SYNOPSIS
Reconciles and audits all custom Windows Scheduled Tasks across Toolforge, Ironbots, CIC, TRM, and KB-Sync.

.DESCRIPTION
Ensures all tasks:
1. Have a categorized TaskPath (e.g., \Ironbots\, \toolforge\, \CIC\, \TRM\, \KB-SYNC\, \Helix\, \Sigil\, \RewriteLabs\, \Cua\).
2. Are configured for unattended execution (LogonType: S4U, RunLevel: Highest) so they run whether the user is logged on or not.
3. Retires deprecated/broken legacy tasks in the root folder.
4. Provides self-elevation via UAC if executed without Administrator rights.

.PARAMETER AuditOnly
Only inspects and displays the current state vs desired state without making changes.

.PARAMETER Apply
Applies the categorization and S4U configuration to all scheduled tasks.

.PARAMETER Elevate
Launches an elevated PowerShell session to apply changes with full Administrator privileges.
#>

[CmdletBinding()]
param(
    [switch]$AuditOnly,
    [switch]$Apply,
    [switch]$Elevate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$currentIdentity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

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
        # Best effort COM fallback
    }
}

# Desired Task Definitions & Categorization Map
$TaskDefinitions = @(
    # --- \Ironbots\ Fleet ---
    @{
        TaskName = "Notebook-Ingester"
        Category = "\Ironbots\"
        Script = "C:\dev\scripts\schedule-task-wrapper-Notebook-Ingester.ps1"
        Description = "Ironbots: SQLite FTS5 Knowledge Base and NotebookLM indexer."
        TriggerType = "Daily"
        TriggerTime = "02:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& 'node.exe' C:\dev\scripts\notebook-ingester-bot.mjs 1>> 'C:\dev\logs\notebook-ingester-bot.stdout.log' 2>> 'C:\dev\logs\notebook-ingester-bot.stderr.log'`""
    },
    @{
        TaskName = "KB-Sentinel"
        Category = "\Ironbots\"
        Script = "C:\dev\scripts\schedule-task-wrapper-KB-Sentinel.ps1"
        Description = "Ironbots: Knowledge Base drift detection and autohealing sentinel."
        TriggerType = "Daily"
        TriggerTime = "03:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& 'node.exe' C:\dev\scripts\kb-sentinel-bot.mjs 1>> 'C:\dev\logs\kb-sentinel-bot.stdout.log' 2>> 'C:\dev\logs\kb-sentinel-bot.stderr.log'`""
    },
    @{
        TaskName = "TRM-Bot"
        Category = "\Ironbots\"
        Script = "C:\dev\scripts\schedule-task-wrapper-TRM-Bot.ps1"
        Description = "Ironbots: Research gap triage, local SQLite FTS5 search, and RFC drafting."
        TriggerType = "Daily"
        TriggerTime = "04:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& 'node.exe' C:\dev\scripts\trm-bot-runner.mjs 1>> 'C:\dev\logs\trm-bot-runner.stdout.log' 2>> 'C:\dev\logs\trm-bot-runner.stderr.log'`""
    },
    @{
        TaskName = "Watchlist-Miner"
        Category = "\Ironbots\"
        Script = "C:\dev\scripts\schedule-task-wrapper-Watchlist-Miner.ps1"
        Description = "Ironbots: Watchlist and competitor drift miner."
        TriggerType = "Daily"
        TriggerTime = "05:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& 'node.exe' C:\dev\scripts\watchlist-miner-bot.mjs 1>> 'C:\dev\logs\watchlist-miner-bot.stdout.log' 2>> 'C:\dev\logs\watchlist-miner-bot.stderr.log'`""
    },
    @{
        TaskName = "Daemon-Healer"
        Category = "\Ironbots\"
        Script = "C:\dev\scripts\schedule-task-wrapper-Daemon-Healer.ps1"
        Description = "Ironbots: Port 8080 health supervisor and auto-recovery daemon."
        TriggerType = "Repeating"
        RepetitionInterval = (New-TimeSpan -Minutes 15)
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& 'node.exe' C:\dev\scripts\daemon-healer-bot.mjs 1>> 'C:\dev\logs\daemon-healer-bot.stdout.log' 2>> 'C:\dev\logs\daemon-healer-bot.stderr.log'`""
    },
    @{
        TaskName = "CI-Watchdog"
        Category = "\Ironbots\"
        Script = "C:\dev\scripts\schedule-task-wrapper-CI-Watchdog.ps1"
        Description = "Ironbots: GitHub Actions workflow failure triage and alert emitter."
        TriggerType = "Daily"
        TriggerTime = "06:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& 'node.exe' C:\dev\scripts\ci-watchdog-bot.mjs 1>> 'C:\dev\logs\ci-watchdog-bot.stdout.log' 2>> 'C:\dev\logs\ci-watchdog-bot.stderr.log'`""
    },
    @{
        TaskName = "Ironbots-Reporter"
        Category = "\Ironbots\"
        Script = "C:\dev\scripts\schedule-task-wrapper-Ironbots-Reporter.ps1"
        Description = "Ironbots: Daily fleet activity and telemetry aggregator."
        TriggerType = "Daily"
        TriggerTime = "06:30"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"& 'node.exe' C:\dev\scripts\ironbots-daily-reporter.mjs 1>> 'C:\dev\logs\ironbots-reporter.stdout.log' 2>> 'C:\dev\logs\ironbots-reporter.stderr.log'`""
    },

    # --- \toolforge\ Tasks ---
    @{
        TaskName = "toolforge-daily-report-agent"
        Category = "\toolforge\"
        OldPath = "\"
        Description = "Toolforge: Daily reporting agent."
        TriggerType = "Daily"
        TriggerTime = "06:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"C:\dev\scripts\daily-report-agent.ps1`" -RepoRoot `"C:\dev`""
    },
    @{
        TaskName = "toolforge-retro-audit-agent"
        Category = "\toolforge\"
        OldPath = "\"
        Description = "Toolforge: Retro audit agent."
        TriggerType = "Daily"
        TriggerTime = "04:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"C:\dev\scripts\retro-audit-agent.ps1`" -RepoRoot `"C:\dev`""
    },
    @{
        TaskName = "toolforge-weekly-report-agent"
        Category = "\toolforge\"
        OldPath = "\"
        OldName = "ToolforgeWeeklyRetro"
        Description = "Toolforge: Weekly retro report generation."
        TriggerType = "Weekly"
        TriggerDay = "Sunday"
        TriggerTime = "18:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"C:\dev\scripts\run-weekly-retro.ps1`" -RepoRoot `"C:\dev`""
    },
    @{
        TaskName = "Toolforge-CI-Nightly"
        Category = "\toolforge\"
        OldPath = "\"
        Description = "Toolforge: Nightly CI pipeline validation."
        TriggerType = "Daily"
        TriggerTime = "01:00"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -File `"C:\dev\ci-pipeline.ps1`" -Verbose"
    },
    @{
        TaskName = "Toolforge-Drift-Detector"
        Category = "\toolforge\"
        OldPath = "\"
        OldName = "Toolforge Drift Detector"
        Description = "Toolforge: Continuous repository drift detector and auto-fixer."
        TriggerType = "Daily"
        TriggerTime = "02:30"
        ActionExe = "powershell.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"`& 'C:\dev\utilities\toolforgeDriftDetector.ps1' -AutoFix; exit 0`""
    },
    @{
        TaskName = "Daily-Roadmap-Sync"
        Category = "\toolforge\"
        OldPath = "\"
        OldName = "Daily Roadmap Sync"
        Description = "Toolforge: Multi-repository roadmap synchronization."
        TriggerType = "Daily"
        TriggerTime = "07:00"
        ActionExe = "node.exe"
        ActionArgs = "C:\dev\tools\multiRepoRoadmapSync.cjs"
    },

    # --- \CIC\ Tasks ---
    @{
        TaskName = "CIC-Daily-Status"
        Category = "\CIC\"
        Description = "Cast Iron Charlie: Daily status generation."
    },
    @{
        TaskName = "CIC-ImageBuild-Daily"
        Category = "\CIC\"
        Description = "Cast Iron Charlie: Daily image build."
    },
    @{
        TaskName = "CIC-Mirror-ClaudeMemory"
        Category = "\CIC\"
        Description = "Cast Iron Charlie: Mirror Claude memory."
    },
    @{
        TaskName = "CIC-Vault-Sync-rl"
        Category = "\CIC\"
        Description = "Cast Iron Charlie: Vault sync."
    },
    @{
        TaskName = "CIC-WhichLLM-Weekly-Sweep"
        Category = "\CIC\"
        Description = "Cast Iron Charlie: WhichLLM weekly sweep."
    },
    @{
        TaskName = "CastIronCharlie-DailyResearch"
        Category = "\CIC\"
        OldPath = "\CastIronCharlie\"
        Description = "Cast Iron Charlie: Daily research collector."
    },
    @{
        TaskName = "CIC-Nightly-Notebook-Mining"
        Category = "\CIC\"
        OldPath = "\"
        Description = "Cast Iron Charlie: Nightly notebook mining."
        TriggerType = "Daily"
        TriggerTime = "01:30"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"C:\dev\scripts\run-daily-notebook-mining.ps1`""
    },

    # --- \TRM\ Tasks ---
    @{
        TaskName = "toolforge-trm-sync-treatment"
        Category = "\TRM\"
        Description = "TRM: Sync treatment pipeline."
    },
    @{
        TaskName = "TRM-Notebooklm-Chat-Archive"
        Category = "\TRM\"
        Description = "TRM: NotebookLM chat archive extractor."
    },
    @{
        TaskName = "TRM-Notebooklm-Mine"
        Category = "\TRM\"
        Description = "TRM: NotebookLM miner."
    },
    @{
        TaskName = "CIC-TRM-ClosedLoop-Nightly-Miner"
        Category = "\TRM\"
        OldPath = "\"
        Description = "TRM: Closed-loop nightly sibling checker and pack consolidator."
        TriggerType = "Daily"
        TriggerTime = "03:30"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"node scripts/run-sibling-check-v2.mjs --mode=check; node scripts/consolidate-pack.mjs --category=willow-run *>> 'C:\dev\logs\trm-miner-scheduled.log'`""
    },

    # --- \KB-SYNC\ Tasks ---
    @{
        TaskName = "KB-Sync-Master-Pipeline"
        Category = "\KB-SYNC\"
        Description = "KB-Sync: Master synchronization pipeline."
    },
    @{
        TaskName = "KB-Sync-TRM-Triage"
        Category = "\KB-SYNC\"
        Description = "KB-Sync: TRM triage ingestion pipeline."
    },
    @{
        TaskName = "KB-Sync-Dashboard-Server"
        Category = "\KB-SYNC\"
        OldPath = "\"
        Description = "KB-Sync: Dashboard server supervisor."
        TriggerType = "Logon"
        ActionExe = "powershell.exe"
        ActionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"C:\dev\kb-sync\scripts\ensure-dashboard-server.ps1`""
    },

    # --- Subsystem Daemons ---
    @{
        TaskName = "HelixDaemon"
        Category = "\Helix\"
        OldPath = "\"
        Description = "Helix: Local background daemon."
        TriggerType = "Logon"
        ActionExe = "C:\Program Files\PowerShell\7\pwsh.exe"
        ActionArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"C:\dev\helix\scripts\start-helix-daemon.ps1`""
    },
    @{
        TaskName = "SigilMeshDaemon"
        Category = "\Sigil\"
        OldPath = "\"
        Description = "Sigil: P2P Mesh daemon."
        TriggerType = "Logon"
        ActionExe = "pwsh.exe"
        ActionArgs = "-NoProfile -WindowStyle Hidden -File `"C:\dev\scripts\run-sigil-daemon.ps1`""
    },
    @{
        TaskName = "RewriteLabsDailyBackup"
        Category = "\RewriteLabs\"
        OldPath = "\"
        Description = "RewriteLabs: Daily automated system backup."
        TriggerType = "Daily"
        TriggerTime = "00:00"
        ActionExe = "powershell.exe"
        ActionArgs = "-File `"C:\Users\soren\rewritelabs.io\backup\backup.ps1`""
    },
    @{
        TaskName = "cua-driver-serve"
        Category = "\Cua\"
        OldPath = "\"
        Description = "CUA: Local automation driver service."
        TriggerType = "Logon"
        ActionExe = "powershell.exe"
        ActionArgs = "-NoProfile -WindowStyle Hidden -NonInteractive -Command `"Start-Process -FilePath 'C:\Users\soren\AppData\Local\Programs\Cua\cua-driver\bin\cua-driver.exe' -ArgumentList 'serve' -WindowStyle Hidden -WorkingDirectory 'C:\Users\soren'`""
    }
)

# Obsolete / Deprecated Tasks to Remove
$ObsoleteTasks = @(
    @{ TaskName = "Autoheal Sweeper"; TaskPath = "\" },
    @{ TaskName = "ICF-Dashboard-Server"; TaskPath = "\" },
    @{ TaskName = "ToolforgeWeeklyRetro"; TaskPath = "\" },
    @{ TaskName = "Toolforge Drift Detector"; TaskPath = "\" },
    @{ TaskName = "Daily Roadmap Sync"; TaskPath = "\" }
)

$isAdmin = Test-IsAdministrator

if ($Elevate) {
    if ($isAdmin) {
        Write-Host "[INFO] Already running with Administrator privileges." -ForegroundColor Green
    } else {
        Write-Host "[ELEVATING] Spawning Administrator PowerShell session to configure S4U..." -ForegroundColor Cyan
        $scriptPath = $MyInvocation.MyCommand.Definition
        Start-Process pwsh.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Apply"
        exit 0
    }
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Scheduled Tasks Audit & Categorization / S4U Reconciler" -ForegroundColor Cyan
Write-Host " Running as Admin: $isAdmin | User: $env:USERNAME" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$allTasks = Get-ScheduledTask | Where-Object { 
    $_.TaskPath -notlike "\Microsoft\*" -and 
    $_.TaskName -notlike "OneDrive*" -and 
    $_.TaskName -notlike "SoftLanding*" -and 
    $_.TaskPath -notlike "\GoogleUserPEH*" -and 
    $_.TaskName -notlike "Git for Windows*" -and 
    $_.TaskName -notlike "Autorun for*" 
}

$auditReport = @()

foreach ($t in $allTasks) {
    $matchedDef = $TaskDefinitions | Where-Object { 
        $_.TaskName -eq $t.TaskName -or ($_.ContainsKey('OldName') -and $_['OldName'] -eq $t.TaskName)
    } | Select-Object -First 1

    $isObsolete = $ObsoleteTasks | Where-Object { 
        $_.TaskName -eq $t.TaskName -and $_.TaskPath -eq $t.TaskPath 
    }

    $targetCat = if ($matchedDef) { $matchedDef.Category } else { "Unmanaged ($($t.TaskPath))" }
    $catMatches = ($t.TaskPath -eq $targetCat)
    $isS4U = ($t.Principal.LogonType -eq 'S4U' -or $t.Principal.LogonType -eq 'Password')

    $auditReport += [PSCustomObject]@{
        TaskName       = $t.TaskName
        CurrentPath    = $t.TaskPath
        TargetCategory = $targetCat
        LogonType      = $t.Principal.LogonType
        RunLevel       = $t.Principal.RunLevel
        Unattended     = $isS4U
        CategoryMatch  = $catMatches
        Obsolete       = [bool]$isObsolete
        State          = $t.State
    }
}

$auditReport | Format-Table -AutoSize

if ($AuditOnly -or (-not $Apply)) {
    $needsCat = $auditReport | Where-Object { -not $_.CategoryMatch -and -not $_.Obsolete }
    $needsS4U = $auditReport | Where-Object { -not $_.Unattended -and -not $_.Obsolete }
    $obsoletes = $auditReport | Where-Object { $_.Obsolete }

    Write-Host "--- Summary ---" -ForegroundColor Cyan
    Write-Host "Tasks needing category relocation: $($needsCat.Count)" -ForegroundColor $(if ($needsCat.Count -gt 0) { "Yellow" } else { "Green" })
    Write-Host "Tasks needing S4U unattended mode: $($needsS4U.Count)" -ForegroundColor $(if ($needsS4U.Count -gt 0) { "Yellow" } else { "Green" })
    Write-Host "Obsolete/stale tasks to clean up:   $($obsoletes.Count)" -ForegroundColor $(if ($obsoletes.Count -gt 0) { "Yellow" } else { "Green" })
    Write-Host ""

    if (-not $isAdmin) {
        Write-Host "💡 To automatically apply all categories and S4U unattended settings across all tasks," -ForegroundColor Yellow
        Write-Host "   run with -Elevate:" -ForegroundColor Yellow
        Write-Host "   pwsh -NoProfile -File scripts/reconcile-scheduled-tasks.ps1 -Elevate" -ForegroundColor Cyan
    } else {
        Write-Host "💡 Run with -Apply to execute all changes." -ForegroundColor Cyan
    }
    exit 0
}

# --- Applying Changes ---
Write-Host "[APPLY] Reconciling categories and configuring S4U unattended execution..." -ForegroundColor Green

# 1. Clean up obsolete tasks
foreach ($obs in $ObsoleteTasks) {
    $existingObs = Get-ScheduledTask -TaskName $obs.TaskName -TaskPath $obs.TaskPath -ErrorAction SilentlyContinue
    if ($existingObs) {
        try {
            Unregister-ScheduledTask -TaskName $obs.TaskName -TaskPath $obs.TaskPath -Confirm:$false
            Write-Host "[REMOVED] Obsolete task '$($obs.TaskPath)$($obs.TaskName)'" -ForegroundColor DarkGray
        } catch {
            Write-Warning "Could not remove obsolete task '$($obs.TaskPath)$($obs.TaskName)': $_"
        }
    }
}

# 2. Register / Re-register all tasks with desired category and S4U principal
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable

$principal = if ($isAdmin) {
    New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
} else {
    New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
}

foreach ($def in $TaskDefinitions) {
    Ensure-TaskFolder -Path $def.Category

    # Check if existing task exists in old path or old name
    if ($def.ContainsKey('OldPath') -and $def['OldPath']) {
        $oldPath = $def['OldPath']
        $oldName = if ($def.ContainsKey('OldName') -and $def['OldName']) { $def['OldName'] } else { $def.TaskName }
        $oldTask = Get-ScheduledTask -TaskName $oldName -TaskPath $oldPath -ErrorAction SilentlyContinue
        if ($oldTask -and ($oldPath -ne $def.Category -or $oldName -ne $def.TaskName)) {
            try {
                Unregister-ScheduledTask -TaskName $oldName -TaskPath $oldPath -Confirm:$false
                Write-Host "[MIGRATED] Removed old un-categorized task '$oldPath$oldName'" -ForegroundColor DarkCyan
            } catch {
                Write-Warning "Could not remove old task: $_"
            }
        }
    }

    $existing = Get-ScheduledTask -TaskName $def.TaskName -TaskPath $def.Category -ErrorAction SilentlyContinue

    # If action/trigger specified, (re)create
    if ($def.ContainsKey('ActionExe') -and $def['ActionExe']) {
        $actionArgs = if ($def.ContainsKey('ActionArgs')) { $def['ActionArgs'] } else { "" }
        $action = New-ScheduledTaskAction -Execute $def['ActionExe'] -Argument $actionArgs -WorkingDirectory "C:\dev"
        $trigger = $null

        $triggerType = if ($def.ContainsKey('TriggerType')) { $def['TriggerType'] } else { "Daily" }
        if ($triggerType -eq "Daily" -and $def.ContainsKey('TriggerTime')) {
            $trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($def['TriggerTime'], 'HH:mm', $null))
        } elseif ($triggerType -eq "Weekly" -and $def.ContainsKey('TriggerTime') -and $def.ContainsKey('TriggerDay')) {
            $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $def['TriggerDay'] -At ([datetime]::ParseExact($def['TriggerTime'], 'HH:mm', $null))
        } elseif ($triggerType -eq "Repeating" -and $def.ContainsKey('RepetitionInterval')) {
            $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval $def['RepetitionInterval']
        } elseif ($triggerType -eq "Logon") {
            $trigger = New-ScheduledTaskTrigger -AtLogOn
        }

        try {
            Register-ScheduledTask `
                -TaskName $def.TaskName `
                -TaskPath $def.Category `
                -Action $action `
                -Trigger $trigger `
                -Settings $settings `
                -Principal $principal `
                -Description $def.Description `
                -Force | Out-Null
            Write-Host "[OK] Task '$($def.Category)$($def.TaskName)' configured (LogonType: $($principal.LogonType), Category: $($def.Category))" -ForegroundColor Green
        } catch {
            Write-Warning "Failed to register '$($def.Category)$($def.TaskName)': $_"
        }
    } elseif ($existing -and $isAdmin) {
        # Update existing task principal to S4U
        try {
            Set-ScheduledTask -TaskName $def.TaskName -TaskPath $def.Category -Principal $principal | Out-Null
            Write-Host "[UPDATED] Task '$($def.Category)$($def.TaskName)' updated to S4U unattended." -ForegroundColor Green
        } catch {
            Write-Warning "Failed to update '$($def.Category)$($def.TaskName)' to S4U: $_"
        }
    }
}

Write-Host ""
Write-Host "[COMPLETE] Scheduled tasks reconciliation finished." -ForegroundColor Green
