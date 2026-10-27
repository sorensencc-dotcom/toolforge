<#
.SYNOPSIS
    Runs the full CIC + Rewrite Labs daily status pipeline: mirror protected
    Claude memory -> aggregate status JSON -> render HTML artifact.

.DESCRIPTION
    Chains the three status scripts so the whole thing can run unattended
    from Windows Task Scheduler, with no Claude session required:
      1. Mirror-ClaudeMemory.ps1  (C:\Users\<you>\.claude\projects\c--dev\memory -> C:\dev\_status-feed\claude-memory)
      2. aggregate_status.py      (scans C:\dev + mirrored memory -> C:\dev\_status-feed\daily_status.json)
      3. render_status_html.py    (renders the JSON -> CIC_Daily_Status.html in the CIC project folder)

    Requires Python 3 on PATH (`python` or `python3`).

.NOTES
    Run manually first to confirm output, then use -Register to schedule it
    daily via Windows Task Scheduler.
#>

[CmdletBinding()]
param(
    [string]$ScriptDir = "",
    [string]$OutHtml   = "C:\Users\soren\OneDrive\Documents\Claude\Projects\CIC\CIC_Daily_Status.html",
    [switch]$Register,
    [string]$RegisterTime = "07:00"
)

$ErrorActionPreference = "Stop"

# $PSScriptRoot can come back empty as a param default in some invocation modes
# (e.g. powershell.exe -File from certain parent shells). Resolve robustly instead.
if ([string]::IsNullOrWhiteSpace($ScriptDir)) {
    if ($PSScriptRoot) {
        $ScriptDir = $PSScriptRoot
    } elseif ($MyInvocation.MyCommand.Path) {
        $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    } else {
        $ScriptDir = (Get-Location).Path
    }
}

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

if ($Register) {
    $thisScript = $MyInvocation.MyCommand.Path
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$thisScript`" -OutHtml `"$OutHtml`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $RegisterTime
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries
    Register-ScheduledTask -TaskName "CIC-Daily-Status" `
        -Action $action -Trigger $trigger -Settings $settings -Force `
        -Description "Generates the CIC + Rewrite Labs daily project status HTML (kb-sync, TODOS, memory, handoff, TRM pipeline)."
    Write-Log "Registered scheduled task 'CIC-Daily-Status' to run daily at $RegisterTime."
    Write-Log "Tip: also register Mirror-ClaudeMemory.ps1 -Register with an earlier time so its output is fresh before this runs."
    return
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) {
    Write-Error "Python 3 not found on PATH. Install it or add it to PATH, then re-run."
    exit 1
}

Write-Log "Step 1/3: Mirroring Claude project memory..."
& (Join-Path $ScriptDir "Mirror-ClaudeMemory.ps1")

Write-Log "Step 2/3: Aggregating status sources..."
& $python.Path (Join-Path $ScriptDir "aggregate_status.py") "C:\dev\_status-feed\daily_status.json"

# Sync to Iron Command Forge dashboard data path
$icfTarget = "C:\dev\icf\dashboard\daily_status.json"
if (Test-Path "C:\dev\_status-feed\daily_status.json") {
    Copy-Item -Path "C:\dev\_status-feed\daily_status.json" -Destination $icfTarget -Force -ErrorAction SilentlyContinue
    Write-Log "Synced status feed to $icfTarget"
}
$icfHistoryTarget = "C:\dev\icf\dashboard\trm_history"
if (Test-Path "C:\dev\_status-feed\trm_history") {
    if (-not (Test-Path $icfHistoryTarget)) { New-Item -ItemType Directory -Path $icfHistoryTarget -Force | Out-Null }
    Copy-Item -Path "C:\dev\_status-feed\trm_history\*" -Destination $icfHistoryTarget -Force -ErrorAction SilentlyContinue
    Write-Log "Synced TRM history snapshots to $icfHistoryTarget"
}

Write-Log "Step 3/3: Rendering HTML artifact..."
& $python.Path (Join-Path $ScriptDir "render_status_html.py") "C:\dev\_status-feed\daily_status.json" $OutHtml

Write-Log "Done. Open: $OutHtml"
