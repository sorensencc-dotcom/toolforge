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

function New-DailyReport {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro,
        [DateTime]$reportDate
    )

    # Build markdown report (full implementation in Task 8)
    $report = @"
# Daily Report: $($reportDate.ToString("yyyy-MM-dd"))

## Metrics

(Metrics table will be populated in Task 8)

## Summary

(Summary will be populated in Task 8)
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
