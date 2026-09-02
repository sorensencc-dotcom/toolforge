<#
Mints run_id + run_started_utc for a new SDD run and writes the seq-0 handoff
artifact line. Spec: docs/meta/governance/multi-agent-handoff-protocol.md §13.1.
#>
param(
    [Parameter(Mandatory = $true)][string]$CharterId,
    [Parameter(Mandatory = $true)][string]$PredecessorAgent,
    [Parameter(Mandatory = $true)][int]$TotalTasks,
    [Parameter(Mandatory = $true)][string]$EntryPoint
)

$ErrorActionPreference = "Stop"

$timestamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmss")
$runId = "$CharterId-$timestamp"
$runStartedUtc = [DateTime]::UtcNow.ToString("o")

$handoffsDir = Join-Path $PSScriptRoot "..\.ijfw\handoffs"
New-Item -ItemType Directory -Force -Path $handoffsDir | Out-Null

$artifactPath = Join-Path $handoffsDir "$runId-0.jsonl"

$record = [ordered]@{
    run_id              = $runId
    seq                 = 0
    timestamp_utc       = $runStartedUtc
    predecessor_agent   = $PredecessorAgent
    successor_agent     = $null
    task_state          = [ordered]@{
        current_task = 0
        total_tasks  = $TotalTasks
        status       = "in_progress"
    }
    commit_coverage     = @()
    review_status       = [ordered]@{}
    picked_up_utc       = $null
    entry_point         = $EntryPoint
    closed_utc          = $null
}

($record | ConvertTo-Json -Depth 10 -Compress) | Out-File -FilePath $artifactPath -Encoding utf8 -Append

Write-Output "run_id=$runId"
Write-Output "run_started_utc=$runStartedUtc"
Write-Output "artifact=$artifactPath"
