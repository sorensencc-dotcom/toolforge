<#
Appends one handoff-event record to a run's jsonl log (§13.1, append-only,
never rewritten). Requires the run already bootstrapped via
handoff-bootstrap.ps1 (seq 0 exists).
#>
param(
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][int]$Seq,
    [Parameter(Mandatory = $true)][string]$PredecessorAgent,
    [string]$SuccessorAgent = $null,
    [Parameter(Mandatory = $true)][int]$CurrentTask,
    [Parameter(Mandatory = $true)][int]$TotalTasks,
    [Parameter(Mandatory = $true)][ValidateSet("in_progress", "blocked", "complete")][string]$Status,
    [Parameter(Mandatory = $true)][string]$EntryPoint,
    [string[]]$CommitCoverage = @(),
    [switch]$PickedUp,
    [switch]$Closed
)

$ErrorActionPreference = "Stop"

$handoffsDir = Join-Path $PSScriptRoot "..\.ijfw\handoffs"
$artifactPath = Join-Path $handoffsDir "$RunId-$Seq.jsonl"

if (-not (Test-Path (Join-Path $handoffsDir "$RunId-0.jsonl"))) {
    throw "No seq-0 artifact found for run_id '$RunId'. Run handoff-bootstrap.ps1 first."
}

$record = [ordered]@{
    run_id              = $RunId
    seq                 = $Seq
    timestamp_utc       = [DateTime]::UtcNow.ToString("o")
    predecessor_agent   = $PredecessorAgent
    successor_agent     = if ([string]::IsNullOrEmpty($SuccessorAgent)) { $null } else { $SuccessorAgent }
    task_state          = [ordered]@{
        current_task = $CurrentTask
        total_tasks  = $TotalTasks
        status       = $Status
    }
    commit_coverage     = $CommitCoverage
    review_status       = [ordered]@{}
    picked_up_utc       = if ($PickedUp) { [DateTime]::UtcNow.ToString("o") } else { $null }
    entry_point         = $EntryPoint
    closed_utc          = if ($Closed) { [DateTime]::UtcNow.ToString("o") } else { $null }
}

($record | ConvertTo-Json -Depth 10 -Compress) | Out-File -FilePath $artifactPath -Encoding utf8 -Append

Write-Output "appended $artifactPath"
