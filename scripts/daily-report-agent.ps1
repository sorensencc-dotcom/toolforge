# Daily Report Agent v1.0
# Runs 6 AM every day. Aggregates work from last 24 hours.
# Publishes artifact + commits to docs/reports/daily/

param(
    [string]$RepoRoot = "C:\dev",
    [DateTime]$AgentStartTime = (Get-Date),
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# ============================================================================
# Configuration
# ============================================================================

$dayStart = $AgentStartTime.AddHours(-24)
$reportDate = $AgentStartTime.ToString("yyyy-MM-dd")
$reportPath = Join-Path $RepoRoot "docs\reports\daily\$reportDate.md"

# ============================================================================
# Data Collection
# ============================================================================

function Get-CommitsSince24h {
    param([string]$repoRoot, [DateTime]$since)

    $repos = Get-ChildItem $repoRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path "$($_.FullName)\.git" }

    $commits = @()
    foreach ($repo in $repos) {
        try {
            $log = & git -C $repo.FullName log --since $since --format="%h|%s|%ae|%ai" 2>&1
            if ($log) {
                $log | ForEach-Object {
                    $parts = $_ -split '\|'
                    if ($parts.Count -eq 4) {
                        $commits += @{
                            hash = $parts[0]
                            message = $parts[1]
                            author = $parts[2]
                            date = $parts[3]
                            repo = $repo.Name
                        }
                    }
                }
            }
        } catch {
            Write-Host "Warning: git log failed for $($repo.Name): $_"
        }
    }
    return $commits
}

function Get-SessionWrapJSON {
    param([string]$appDataPath)

    $jsonPath = Join-Path $appDataPath "Claude\session-wrap-export.json"
    if (Test-Path $jsonPath) {
        try {
            return Get-Content $jsonPath | ConvertFrom-Json
        } catch {
            Write-Host "Warning: Failed to parse session-wrap JSON: $_"
            return $null
        }
    }
    return $null
}

function Get-RetroJSON {
    param([string]$appDataPath)

    $jsonPath = Join-Path $appDataPath "Claude\retro-export.json"
    if (Test-Path $jsonPath) {
        try {
            return Get-Content $jsonPath | ConvertFrom-Json
        } catch {
            Write-Host "Warning: Failed to parse retro JSON: $_"
            return $null
        }
    }
    return $null
}

# ============================================================================
# Report Generation (Stub)
# ============================================================================

function Get-DailySummary {
    param(
        [object]$retro,
        [array]$commits
    )

    $summary = ""

    # Work summary from retro
    if ($retro.work_summary) {
        $summary += $retro.work_summary
    } else {
        $summary += "(No work summary available)"
    }

    # Blockers
    if ($retro.blockers -and $retro.blockers.Count -gt 0) {
        $summary += "`n`n### Blockers`n`n"
        $retro.blockers | ForEach-Object {
            $summary += "- $_`n"
        }
    }

    # Commits breakdown
    if ($commits.Count -gt 0) {
        $summary += "`n`n### Commits`n`n"
        $commits | Group-Object -Property repo | ForEach-Object {
            $summary += "**$($_.Name):** $($_.Count) commit(s)`n"
            $_.Group | ForEach-Object {
                $summary += "  - $($_.hash): $($_.message)`n"
            }
        }
    }

    return $summary
}

function Get-MetricsTable {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro
    )

    # Calculate metrics
    $commitCount = $commits.Count
    $filesChanged = 0  # Stub for now
    $skillsInvoked = @()
    if ($sessionWrap.skills) {
        $skillsInvoked = $sessionWrap.skills | ForEach-Object { $_.name }
    }
    $skillsCount = $skillsInvoked.Count
    $testsRun = $retro.tests_run ?? 0
    $testsPassed = $retro.tests_passed ?? 0
    $tokensUsed = $sessionWrap.tokens ?? 0
    $model = $sessionWrap.model ?? "unknown"
    $coworkSessions = 0  # Stub for Task 9
    $concurrentAgents = 0  # Stub for Task 9
    $handoffs = 0  # Stub for Task 9

    $metricsMarkdown = @"
| Metric | Count |
|--------|-------|
| Commits | $commitCount |
| Files Changed | $filesChanged |
| Skills Invoked | $skillsCount ($($skillsInvoked -join ', ')) |
| Tests Run | $testsRun |
| Tests Passed | $testsPassed |
| Tokens Used | $([string]::Format("{0:N0}", $tokensUsed)) |
| Models Used | $model |
| Cowork Sessions | $coworkSessions |
| Concurrent Agents | $concurrentAgents |
| Handoffs | $handoffs |
"@

    return $metricsMarkdown
}

function New-DailyReport {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro,
        [DateTime]$reportDate
    )

    $metricsTable = Get-MetricsTable -commits $commits -sessionWrap $sessionWrap -retro $retro
    $summary = Get-DailySummary -retro $retro -commits $commits

    $report = @"
# Daily Report: $($reportDate.ToString("yyyy-MM-dd"))

## Metrics

$metricsTable

## Summary

$summary
"@

    return $report
}

# ============================================================================
# Main
# ============================================================================

Write-Host "Daily Report Agent starting at $AgentStartTime"
Write-Host "Report date: $reportDate"
Write-Host "24h window: $dayStart to $AgentStartTime"

# Collect data
$commits = Get-CommitsSince24h $RepoRoot $dayStart
$sessionWrap = Get-SessionWrapJSON $env:APPDATA
$retro = Get-RetroJSON $env:APPDATA

if ($Verbose) {
    Write-Host "Commits found: $($commits.Count)"
    Write-Host "Session wrap: $($sessionWrap -ne $null)"
    Write-Host "Retro: $($retro -ne $null)"
}

# Generate report
$report = New-DailyReport -commits $commits -sessionWrap $sessionWrap -retro $retro -reportDate $AgentStartTime

# Output for now (artifact publishing in Task 12)
Write-Host $report

Write-Host "Daily report agent complete."
