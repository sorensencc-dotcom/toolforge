#!/usr/bin/env pwsh
<#
.SYNOPSIS
Multi-repo CI orchestrator. Runs pipeline across all 7 registered repos.

.DESCRIPTION
Coordinates CI/validation runs across all repos in registry:
1. Loads repo-registry.json
2. Runs CI pipeline for each repo
3. Aggregates results
4. Generates report
5. Exit code: 0=all pass, 1=blocking failure, 2=warnings

Exit codes:
0 = all repos passed
1 = blocking failure in any repo
2 = warnings in any repo

.PARAMETER Stage
Run specific CI stage across all repos. Options: validator, metadata, graph, health, all
Default: all

.PARAMETER Parallel
Run repos in parallel (experimental, default: sequential)

.PARAMETER SkipRepos
Comma-separated list of repo names to skip

.PARAMETER ReportOnly
Generate report from existing logs, don't run pipeline

.PARAMETER Verbose
Enable verbose output

.EXAMPLE
./multi-repo-orchestrator.ps1 -Verbose
./multi-repo-orchestrator.ps1 -Stage validator
./multi-repo-orchestrator.ps1 -SkipRepos "claude-skills,toolforge"
./multi-repo-orchestrator.ps1 -Parallel
#>

param(
    [ValidateSet('validator', 'metadata', 'graph', 'health', 'all')]
    [string]$Stage = 'all',
    [switch]$Parallel,
    [string]$SkipRepos = '',
    [switch]$ReportOnly,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$registryPath = 'C:\dev\repo-registry.json'
$logDir = 'C:\dev\toolforge\logs\orchestrator'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$reportFile = "$logDir\orchestrator-report-$timestamp.json"
$logFile = "$logDir\orchestrator-$timestamp.log"

function Write-Log {
    param([string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR', 'PASS', 'FAIL')]$Level = 'INFO')
    $prefix = "[$(Get-Date -Format 'HH:mm:ss')] [$Level]"
    "$prefix $Message" | Tee-Object -FilePath $logFile -Append
}

function Load-Registry {
    if (-not (Test-Path $registryPath)) {
        Write-Log "Registry not found: $registryPath" ERROR
        exit 1
    }

    $registry = Get-Content $registryPath | ConvertFrom-Json
    Write-Log "Loaded registry: $($registry.metadata.totalRepos) repos" INFO
    return $registry
}

function Get-SkipList {
    if (-not $SkipRepos) { return @() }
    return $SkipRepos.Split(',') | ForEach-Object { $_.Trim() }
}

function Run-RepoCI {
    param(
        [PSCustomObject]$Repo,
        [int]$Index,
        [int]$Total
    )

    $repoName = $Repo.name
    $repoPath = $Repo.path
    $logPath = "$logDir\repo-$repoName-$timestamp.log"

    Write-Log "[$Index/$Total] Starting: $repoName at $repoPath" INFO

    if (-not (Test-Path $repoPath)) {
        Write-Log "  ✗ Repo path not found: $repoPath" WARN
        return @{
            name = $repoName
            path = $repoPath
            status = 'SKIP'
            reason = 'Path not found'
            duration = 0
            exitCode = -1
        }
    }

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        # Change to repo directory and run CI
        Push-Location $repoPath
        $ciScript = 'C:\dev\toolforge\ci-pipeline.ps1'

        if (-not (Test-Path $ciScript)) {
            Write-Log "  ✗ CI script not found" ERROR
            return @{
                name = $repoName
                path = $repoPath
                status = 'FAIL'
                reason = 'CI script not found'
                duration = 0
                exitCode = -1
            }
        }

        # Run CI pipeline for this repo (always skip cowork to avoid orchestrator recursion)
        & $ciScript -Stage $Stage -Verbose:$Verbose | Tee-Object -FilePath $logPath -Append
        $exitCode = $LASTEXITCODE

        Pop-Location
        $stopwatch.Stop()

        $status = switch ($exitCode) {
            0 { 'PASS' }
            1 { 'FAIL' }
            2 { 'WARN' }
            default { 'ERROR' }
        }

        Write-Log "  ✓ $repoName completed: $status (${$stopwatch.ElapsedMilliseconds}ms, exit: $exitCode)" $status

        return @{
            name = $repoName
            path = $repoPath
            status = $status
            exitCode = $exitCode
            duration = $stopwatch.ElapsedMilliseconds
            logFile = $logPath
        }
    }
    catch {
        $stopwatch.Stop()
        Write-Log "  ✗ $repoName failed: $_" FAIL
        return @{
            name = $repoName
            path = $repoPath
            status = 'FAIL'
            reason = $_.ToString()
            duration = $stopwatch.ElapsedMilliseconds
            exitCode = 1
            logFile = $logPath
        }
    }
}

function Run-OrchestrationSequential {
    param([array]$Repos)

    Write-Log "Running CI pipeline sequentially across $($Repos.Count) repos" INFO
    Write-Log "Stage: $Stage | Parallel: $Parallel | Skip: $SkipRepos" INFO

    $results = @()
    $index = 1

    foreach ($repo in $Repos) {
        $result = Run-RepoCI -Repo $repo -Index $index -Total $Repos.Count
        $results += $result
        $index++
    }

    return $results
}

function Run-OrchestrationParallel {
    param([array]$Repos)

    Write-Log "Running CI pipeline in parallel across $($Repos.Count) repos" WARN
    Write-Log "Stage: $Stage | Parallel: $Parallel | Skip: $SkipRepos" INFO

    $results = $Repos | ForEach-Object -Parallel {
        $ciScript = 'C:\dev\toolforge\ci-pipeline.ps1'
        & $ciScript -Stage $using:Stage -Verbose:$using:Verbose -SkipCowork
        return @{
            name = $_.name
            exitCode = $LASTEXITCODE
            status = $LASTEXITCODE -eq 0 ? 'PASS' : ($LASTEXITCODE -eq 2 ? 'WARN' : 'FAIL')
        }
    } -ThrottleLimit 4

    return $results
}

function Generate-Report {
    param([array]$Results)

    $passed = ($Results | Where-Object { $_.status -eq 'PASS' }).Count
    $warned = ($Results | Where-Object { $_.status -eq 'WARN' }).Count
    $failed = ($Results | Where-Object { $_.status -eq 'FAIL' }).Count
    $skipped = ($Results | Where-Object { $_.status -eq 'SKIP' }).Count

    $report = @{
        timestamp = Get-Date -Format 'o'
        stage = $Stage
        parallel = $Parallel
        summary = @{
            total = $Results.Count
            passed = $passed
            warned = $warned
            failed = $failed
            skipped = $skipped
        }
        results = $Results
        logFile = $logFile
    }

    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile -Encoding UTF8

    Write-Log "" INFO
    Write-Log "=== ORCHESTRATOR SUMMARY ===" INFO
    Write-Log "Total: $($Results.Count) | Passed: $passed | Warned: $warned | Failed: $failed | Skipped: $skipped" INFO
    Write-Log "Report: $reportFile" INFO
    Write-Log "Log: $logFile" INFO

    return $report
}

# Main execution
if ($ReportOnly) {
    Write-Log "Report-only mode (not implemented)" WARN
    exit 0
}

$registry = Load-Registry
$skipList = Get-SkipList
$repos = $registry.repos | Where-Object { $_.'ci-enabled' -and $_.name -notin $skipList }

Write-Log "=== MULTI-REPO ORCHESTRATOR ===" INFO
Write-Log "Repos: $($repos.Count) | Stage: $Stage | Parallel: $Parallel" INFO

$results = if ($Parallel) {
    Run-OrchestrationParallel -Repos $repos
}
else {
    Run-OrchestrationSequential -Repos $repos
}

$report = Generate-Report -Results $results

# Exit codes
$blockingFails = ($results | Where-Object { $_.exitCode -eq 1 }).Count
$anyWarnings = ($results | Where-Object { $_.exitCode -eq 2 }).Count

if ($blockingFails -gt 0) {
    Write-Log "ORCHESTRATION FAILED ($blockingFails blocking errors)" FAIL
    exit 1
}
elseif ($anyWarnings -gt 0) {
    Write-Log "ORCHESTRATION COMPLETED WITH WARNINGS" WARN
    exit 2
}
else {
    Write-Log "ORCHESTRATION PASSED" PASS
    exit 0
}
