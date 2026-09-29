#!/usr/bin/env pwsh
<#
.SYNOPSIS
Sequential catch-up runner for all scheduled daily tasks.

.DESCRIPTION
Executes all missed or collided daily tasks in strict dependency order with proper spacing:
  Stage 1: Core CI & Drift Audits
  Stage 2: Knowledge Base Master Sync & Indexing
  Stage 3: Research Triage & Gap Analysis
  Stage 4: Fleet Telemetry & Daily Reports
#>

[CmdletBinding()]
param(
    [int]$SpacingSeconds = 5
)

$ErrorActionPreference = "Continue"
$RepoRoot = "C:\dev"
$LogDir = Join-Path $RepoRoot "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "catchup-pipeline-$Timestamp.log"

function Log-Step([string]$Stage, [string]$TaskName, [string]$Status, [string]$Details = "") {
    $timeStr = Get-Date -Format "HH:mm:ss"
    $msg = "[$timeStr] [$Stage] $TaskName : $Status $Details"
    Write-Host $msg -ForegroundColor $(if ($Status -eq "PASS") { "Green" } elseif ($Status -eq "RUNNING") { "Cyan" } else { "Red" })
    Add-Content -Path $LogFile -Value $msg
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  DAILY SCHEDULED TASKS SEQUENTIAL CATCH-UP RUNNER" -ForegroundColor Cyan
Write-Host "  Log file: $LogFile" -ForegroundColor Gray
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

$Results = @()

function Run-Task([string]$Stage, [string]$TaskName, [scriptblock]$Command) {
    Log-Step $Stage $TaskName "RUNNING"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & $Command
        $exit = $LASTEXITCODE
        $sw.Stop()
        if ($exit -eq 0 -or $null -eq $exit) {
            Log-Step $Stage $TaskName "PASS" "($([math]::Round($sw.Elapsed.TotalSeconds, 1))s)"
            $script:Results += [PSCustomObject]@{ Stage = $Stage; Task = $TaskName; Status = "PASS"; Duration = "$([math]::Round($sw.Elapsed.TotalSeconds, 1))s" }
        } else {
            Log-Step $Stage $TaskName "FAIL" "(Exit Code: $exit, $([math]::Round($sw.Elapsed.TotalSeconds, 1))s)"
            $script:Results += [PSCustomObject]@{ Stage = $Stage; Task = $TaskName; Status = "FAIL ($exit)"; Duration = "$([math]::Round($sw.Elapsed.TotalSeconds, 1))s" }
        }
    } catch {
        $sw.Stop()
        Log-Step $Stage $TaskName "ERROR" "($_, $([math]::Round($sw.Elapsed.TotalSeconds, 1))s)"
        $script:Results += [PSCustomObject]@{ Stage = $Stage; Task = $TaskName; Status = "ERROR"; Duration = "$([math]::Round($sw.Elapsed.TotalSeconds, 1))s" }
    }
    Start-Sleep -Seconds $SpacingSeconds
}

# --- STAGE 1: CORE CI & DRIFT AUDITS ---
Write-Host "`n>>> STAGE 1: Core CI & Drift Audits" -ForegroundColor Yellow
Run-Task "STAGE 1" "Toolforge-CI-Nightly" {
    pwsh -NoProfile -NonInteractive -WindowStyle Hidden -File "$RepoRoot\ci-pipeline.ps1"
}

Run-Task "STAGE 1" "Toolforge-Drift-Detector" {
    powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command "& '$RepoRoot\utilities\toolforgeDriftDetector.ps1' -AutoFix; exit 0"
}

Run-Task "STAGE 1" "KB-Sentinel" {
    node "$RepoRoot\scripts\kb-sentinel-bot.mjs"
}

# --- STAGE 2: KNOWLEDGE BASE MASTER SYNC & INDEXING ---
Write-Host "`n>>> STAGE 2: Knowledge Base Master Sync & Indexing" -ForegroundColor Yellow
Run-Task "STAGE 2" "KB-Sync-Master-Pipeline" {
    pwsh -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$RepoRoot\kb-sync\scripts\schedule-task-wrapper-KB-Sync-Master.ps1"
}

Run-Task "STAGE 2" "Notebook-Ingester" {
    node "$RepoRoot\scripts\notebook-ingester-bot.mjs"
}

Run-Task "STAGE 2" "CIC-Nightly-Notebook-Mining" {
    pwsh -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$RepoRoot\scripts\run-daily-notebook-mining.ps1" -DryRun
}

# --- STAGE 3: RESEARCH TRIAGE & GAP ANALYSIS ---
Write-Host "`n>>> STAGE 3: Research Triage & Gap Analysis" -ForegroundColor Yellow
Run-Task "STAGE 3" "CIC-TRM-ClosedLoop-Nightly-Miner" {
    node "$RepoRoot\scripts\run-sibling-check-v2.mjs" --mode=check
    node "$RepoRoot\scripts\consolidate-pack.mjs" --category=willow-run
}

Run-Task "STAGE 3" "KB-Sync-TRM-Triage" {
    pwsh -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$RepoRoot\kb-sync\scripts\schedule-task-wrapper-TRM-Triage.ps1"
}

Run-Task "STAGE 3" "TRM-Bot" {
    node "$RepoRoot\scripts\trm-bot-runner.mjs"
}

Run-Task "STAGE 3" "Watchlist-Miner" {
    node "$RepoRoot\scripts\watchlist-miner-bot.mjs"
}

# --- STAGE 4: FLEET TELEMETRY & DAILY REPORTS ---
Write-Host "`n>>> STAGE 4: Fleet Telemetry & Daily Reports" -ForegroundColor Yellow
Run-Task "STAGE 4" "CI-Watchdog" {
    node "$RepoRoot\scripts\ci-watchdog-bot.mjs"
}

Run-Task "STAGE 4" "toolforge-daily-report-agent" {
    pwsh -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$RepoRoot\scripts\daily-report-agent.ps1" -RepoRoot "$RepoRoot"
}

Run-Task "STAGE 4" "toolforge-retro-audit-agent" {
    pwsh -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$RepoRoot\scripts\retro-audit-agent.ps1" -RepoRoot "$RepoRoot"
}

Run-Task "STAGE 4" "toolforge-trm-sync-treatment" {
    pwsh -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$RepoRoot\scripts\trm-sync-treatment-agent.ps1"
}

Run-Task "STAGE 4" "Ironbots-Reporter" {
    node "$RepoRoot\scripts\ironbots-daily-reporter.mjs"
}

Run-Task "STAGE 4" "Daily-Roadmap-Sync" {
    node "$RepoRoot\sync-tools\multiRepoRoadmapSync.cjs"
}

Run-Task "STAGE 4" "CIC-Daily-Status" {
    $script = "C:\Users\soren\OneDrive\Documents\Claude\Projects\CIC\scripts\Run-DailyStatus.ps1"
    if (Test-Path $script) {
        pwsh -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File $script -OutHtml "C:\Users\soren\OneDrive\Documents\Claude\Projects\CIC\CIC_Daily_Status.html"
    }
}

Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  CATCH-UP PIPELINE EXECUTION SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
$Results | Format-Table -AutoSize
Write-Host "Log written to: $LogFile" -ForegroundColor Gray
