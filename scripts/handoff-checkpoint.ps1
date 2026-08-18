<#
Appends one checkpoint line to a run's checkpoint log (§13.2). Cadence is
manual until SDD-runner wiring lands (gate 2 / Integration Points) — call
this at 60min wall-clock or every 15 tasks (runs with total_tasks >= 15).
#>
param(
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][int]$CurrentTask,
    [Parameter(Mandatory = $true)][int]$TotalTasks,
    [string]$Blockers = "none"
)

$ErrorActionPreference = "Stop"

$handoffsDir = Join-Path $PSScriptRoot "..\.ijfw\handoffs"
$bootstrapArtifact = Join-Path $handoffsDir "$RunId-0.jsonl"

if (-not (Test-Path $bootstrapArtifact)) {
    throw "No seq-0 artifact found for run_id '$RunId'. Run handoff-bootstrap.ps1 first."
}

$firstLine = Get-Content $bootstrapArtifact -First 1 | ConvertFrom-Json
$runStartedUtc = [DateTime]::Parse($firstLine.timestamp_utc, $null, [System.Globalization.DateTimeStyles]::RoundtripKind)
$now = [DateTime]::UtcNow
$elapsedHours = [Math]::Round((($now - $runStartedUtc).TotalHours), 2)

if ($CurrentTask -gt 0) {
    $remainingEstimate = [Math]::Round((($elapsedHours / $CurrentTask) * ($TotalTasks - $CurrentTask)), 2)
    $remainingText = "${remainingEstimate}h left"
} else {
    $remainingText = "estimating"
}

$line = "[$CurrentTask/$TotalTasks tasks] ${elapsedHours}h burned, $remainingText, blockers: $Blockers"
$checkpointPath = Join-Path $handoffsDir "$RunId-checkpoints.log"
$timestamped = "$($now.ToString('o')) $line"

$timestamped | Out-File -FilePath $checkpointPath -Encoding utf8 -Append

Write-Output $timestamped
