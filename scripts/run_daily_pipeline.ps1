#Requires -Version 5.1
<#
.SYNOPSIS
    Daily CIC pipeline: aggregate status -> render HTML -> render dashboard
.DESCRIPTION
    Orchestrates the morning status pipeline from C:\dev\scripts.
#>

param(
    [string]$LogPath = "C:\dev\_status-feed\pipeline.log"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { "C:\dev\scripts" }
$StatusFeed = "C:\dev\_status-feed"

$pythonCmd = Get-Command python.exe, python, python3.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if (-not $pythonCmd) { $pythonCmd = "python" }

$logEntries = [System.Collections.Generic.List[string]]::new()

function Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $formatted = "[$ts] [$Level] $Message"
    Write-Host $formatted
    $script:logEntries.Add($formatted)
}

function Run-Step {
    param(
        [string]$Name,
        [string]$Command,
        [string[]]$StepArgs = @()
    )

    Log "Starting: $Name"
    try {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $pythonCmd
        $pinfo.Arguments = if ($StepArgs.Count -gt 0) { "`"$Command`" " + ($StepArgs -join ' ') } else { "`"$Command`"" }
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.UseShellExecute = $false
        $pinfo.CreateNoWindow = $true

        $p = [System.Diagnostics.Process]::Start($pinfo)
        $stdout = $p.StandardOutput.ReadToEnd()
        $stderr = $p.StandardError.ReadToEnd()
        $p.WaitForExit()

        $combinedOutput = ($stdout + "`n" + $stderr).Trim()

        if ($p.ExitCode -eq 0) {
            Log "[OK] $Name completed" "SUCCESS"
            return $true
        } else {
            Log "[FAIL] $Name failed with exit code $($p.ExitCode)" "ERROR"
            if ($combinedOutput) { Log "Output: $combinedOutput" "ERROR" }
            return $false
        }
    } catch {
        Log "[FAIL] $Name threw exception: $_" "ERROR"
        return $false
    }
}

Log "=== CIC Daily Pipeline Start ===" "INFO"
Log "Status feed: $StatusFeed"

$mirrorScript = Join-Path $ScriptDir "Mirror-ClaudeMemory.ps1"
if (Test-Path $mirrorScript) {
    Log "Mirroring Claude memory..." "INFO"
    try {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $mirrorScript
    } catch {
        Log "Warning: Memory mirror step reported: $_" "WARN"
    }
}

$steps = @(
    @{ Name = "Aggregate Status"; Script = "aggregate_status.py"; Args = @() },
    @{ Name = "Render Status HTML"; Script = "render_status_html.py"; Args = @() },
    @{ Name = "Render Dashboard"; Script = "render_dashboard.py"; Args = @() }
)

$failed = @()

foreach ($step in $steps) {
    $scriptPath = Join-Path $ScriptDir $step.Script
    if (-not (Test-Path $scriptPath)) {
        Log "[FAIL] Script not found: $scriptPath" "ERROR"
        $failed += $step.Name
        continue
    }

    $ok = Run-Step -Name $step.Name -Command $scriptPath -StepArgs $step.Args
    if (-not $ok) {
        $failed += $step.Name
    }
}

Log "=== Pipeline Complete ===" "INFO"
if ($failed.Count -eq 0) {
    Log "[OK] All steps succeeded" "SUCCESS"
    $exitCode = 0

    $icfTarget = "C:\dev\icf\dashboard\daily_status.json"
    if (Test-Path "$StatusFeed\daily_status.json") {
        Copy-Item -Path "$StatusFeed\daily_status.json" -Destination $icfTarget -Force -ErrorAction SilentlyContinue
        Log "Synced status feed to $icfTarget" "INFO"
    }
    $icfHistoryTarget = "C:\dev\icf\dashboard\trm_history"
    if (Test-Path "$StatusFeed\trm_history") {
        if (-not (Test-Path $icfHistoryTarget)) { New-Item -ItemType Directory -Path $icfHistoryTarget -Force | Out-Null }
        Copy-Item -Path "$StatusFeed\trm_history\*" -Destination $icfHistoryTarget -Force -ErrorAction SilentlyContinue
        Log "Synced TRM history snapshots to $icfHistoryTarget" "INFO"
    }
} else {
    Log "[FAIL] Failed steps: $($failed -join ', ')" "ERROR"
    $exitCode = 1
}

if ($LogPath) {
    $logDir = Split-Path -Parent $LogPath
    if ($logDir -and -not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    $script:logEntries | Add-Content -Path $LogPath -Encoding UTF8
}

exit $exitCode
