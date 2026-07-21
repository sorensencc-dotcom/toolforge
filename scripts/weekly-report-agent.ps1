# Weekly Report Agent v1.0
# Runs 6 AM every Sunday. Aggregates work from past 7 days.
# Publishes artifact + commits to docs/reports/weekly/

param(
    [string]$RepoRoot = "C:\dev",
    [DateTime]$AgentStartTime = (Get-Date),
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# ============================================================================
# Configuration
# ============================================================================

$weekStart = $AgentStartTime.AddDays(-7)
$weekNumber = [System.Globalization.CultureInfo]::InvariantCulture.Calendar.GetWeekOfYear($AgentStartTime, [System.Globalization.CalendarWeekRule]::FirstFourDayWeek, [System.DayOfWeek]::Monday)
$year = $AgentStartTime.Year
$reportWeek = "$year-W$($weekNumber.ToString('D2'))"
$reportPath = Join-Path $RepoRoot "docs\reports\weekly\$reportWeek.md"

# ============================================================================
# Data Collection
# ============================================================================

function Get-DailyReportData {
    param([string]$repoRoot, [DateTime]$since, [int]$days)

    $dailyData = @()
    for ($i = 0; $i -lt $days; $i++) {
        $date = $since.AddDays($i).ToString("yyyy-MM-dd")
        $dailyPath = Join-Path $repoRoot "docs\reports\daily\$date.md"

        if (Test-Path $dailyPath) {
            try {
                $content = Get-Content $dailyPath -Raw
                $dailyData += @{
                    date = $date
                    path = $dailyPath
                    content = $content
                }
            } catch {
                Write-Host "Warning: Failed to read daily report $date"
            }
        } else {
            # Fallback: skip missing data (Phase 0 requirement)
            Write-Host "Skipping missing daily report for $date"
        }
    }

    return $dailyData
}

# ============================================================================
# Metrics Parsing
# ============================================================================

function Parse-DailyMetrics {
    param([string]$dailyMarkdown)

    $metrics = @{
        commits = 0
        filesChanged = 0
        skillsCount = 0
        testsRun = 0
        testsPassed = 0
        tokens = 0
        coworkSessions = 0
        handoffs = 0
    }

    # Extract from markdown table (simple regex parsing)
    # Format: | Commits | 3 |

    if ($dailyMarkdown -match '\| Commits \| (\d+) \|') {
        $metrics.commits = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Files Changed \| (\d+) \|') {
        $metrics.filesChanged = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Tests Run \| (\d+) \|') {
        $metrics.testsRun = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Tests Passed \| (\d+) \|') {
        $metrics.testsPassed = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Tokens Used \| ([0-9,]+) \|') {
        $tokens = $matches[1] -replace ',', ''
        $metrics.tokens = [int]$tokens
    }
    if ($dailyMarkdown -match '\| Cowork Sessions \| (\d+) \|') {
        $metrics.coworkSessions = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Handoffs \| (\d+) \|') {
        $metrics.handoffs = [int]$matches[1]
    }

    return $metrics
}

function Get-TrendIndicator {
    param([int]$current, [int]$previous)

    if ($current -eq $previous) { return "=" }
    if ($current -gt $previous) { return "↑" }
    return "↓"
}

function Get-BusiestDaysSection {
    param([array]$dailyData)

    $dayMetrics = @()

    foreach ($day in $dailyData) {
        $metrics = Parse-DailyMetrics -dailyMarkdown $day.content
        $dayMetrics += @{
            date = $day.date
            dayOfWeek = (Get-Date $day.date).DayOfWeek.ToString()
            commits = $metrics.commits
            tokens = $metrics.tokens
            score = $metrics.commits + ($metrics.tokens / 50000)  # Weighted score
        }
    }

    # Sort by score descending, take top 3
    $busiestDays = $dayMetrics | Sort-Object -Property score -Descending | Select-Object -First 3

    $section = "## Busiest Days`n`n"
    if ($busiestDays.Count -eq 0) {
        $section += "(No daily data available)`n"
    } else {
        $rank = 1
        foreach ($day in $busiestDays) {
            $section += "$rank. $($day.dayOfWeek) ($($day.date)): $($day.commits) commits, $([string]::Format("{0:N0}", $day.tokens)) tokens`n"
            $rank++
        }
    }

    return $section
}

function Get-WeeklyTotalsTable {
    param([array]$dailyData)

    $totals = @{
        commits = 0
        filesChanged = 0
        testsRun = 0
        testsPassed = 0
        tokens = 0
        coworkSessions = 0
        handoffs = 0
    }

    $allMetrics = @()
    foreach ($day in $dailyData) {
        $dayMetrics = Parse-DailyMetrics -dailyMarkdown $day.content
        $allMetrics += $dayMetrics

        $totals.commits += $dayMetrics.commits
        $totals.filesChanged += $dayMetrics.filesChanged
        $totals.testsRun += $dayMetrics.testsRun
        $totals.testsPassed += $dayMetrics.testsPassed
        $totals.tokens += $dayMetrics.tokens
        $totals.coworkSessions += $dayMetrics.coworkSessions
        $totals.handoffs += $dayMetrics.handoffs
    }

    $dayCount = $allMetrics.Count
    if ($dayCount -eq 0) { $dayCount = 1 }

    # Calculate daily averages
    $avgCommits = [math]::Round($totals.commits / $dayCount, 1)
    $avgTests = [math]::Round($totals.testsRun / $dayCount, 1)
    $avgTokens = [math]::Round($totals.tokens / $dayCount, 0)

    # Trend indicators (week vs week comparison - stub for now)
    $trendCommits = "="
    $trendTests = "="
    $trendTokens = "="
    $trendHandoffs = "="

    $table = "| Metric | Total | Daily Avg | Trend |`n" +
             "|--------|-------|-----------|-------|`n" +
             "| Commits | $($totals.commits) | $avgCommits | $trendCommits |`n" +
             "| Files Changed | $($totals.filesChanged) | $([math]::Round($totals.filesChanged / $dayCount, 1)) | $trendCommits |`n" +
             "| Tests Run | $($totals.testsRun) | $avgTests | $trendTests |`n" +
             "| Tests Passed | $($totals.testsPassed) | $([math]::Round($totals.testsPassed / $dayCount, 1)) | $trendCommits |`n" +
             "| Tokens Used | $([string]::Format('{0:N0}', $totals.tokens)) | $([string]::Format('{0:N0}', $avgTokens)) | $trendTokens |`n" +
             "| Cowork Sessions | $($totals.coworkSessions) | $([math]::Round($totals.coworkSessions / $dayCount, 1)) | $trendCommits |`n" +
             "| Handoffs | $($totals.handoffs) | $([math]::Round($totals.handoffs / $dayCount, 1)) | $trendHandoffs |"

    return $table
}

# ============================================================================
# Report Generation
# ============================================================================

function New-WeeklyReport {
    param(
        [array]$dailyData,
        [string]$reportWeek
    )

    $totalsTable = Get-WeeklyTotalsTable -dailyData $dailyData
    $busiestDays = Get-BusiestDaysSection -dailyData $dailyData

    $report = @"
# Weekly Report: $reportWeek

## Weekly Totals

$totalsTable

$busiestDays

## Summary

Week overview: Tasks from daily reports aggregated above. Full historical record maintained in git.
"@

    return $report
}

# ============================================================================
# Artifact Publishing & Commit
# ============================================================================

function Publish-WeeklyReportArtifact {
    param(
        [string]$reportMarkdown,
        [string]$reportTitle,
        [string]$description
    )

    # For cloud agent execution, we'll write the report to temp location
    # and return the path for the Artifact tool to pick up

    $tempPath = Join-Path $env:TEMP "weekly-report-$((Get-Date).ToString("yyyy-Www-HHmm")).md"
    Set-Content -Path $tempPath -Value $reportMarkdown -Encoding UTF8

    # Note: In actual execution, the agent will call the Artifact tool
    # This function prepares the markdown; the tool invocation happens at agent boundary

    Write-Host "Report prepared for artifact publishing at: $tempPath"
    return $tempPath
}

function Commit-WeeklyReport {
    param(
        [string]$repoRoot,
        [string]$reportPath,
        [string]$reportContent,
        [string]$reportWeek
    )

    # Write report to file
    Set-Content -Path $reportPath -Value $reportContent -Encoding UTF8

    try {
        # Stage and commit
        & git -C $repoRoot add $reportPath 2>&1 | Out-Null
        & git -C $repoRoot commit -m "docs(report): add weekly report for $reportWeek" 2>&1 | Out-Null
        Write-Host "Report committed: $reportPath"
        return $true
    } catch {
        Write-Host "Warning: Failed to commit report: $_"
        return $false
    }
}

# ============================================================================
# Main
# ============================================================================

Write-Host "Weekly Report Agent starting at $AgentStartTime"
Write-Host "Report week: $reportWeek"
Write-Host "Week span: $weekStart to $AgentStartTime"

# Collect daily data (7 days)
$dailyData = Get-DailyReportData -repoRoot $RepoRoot -since $weekStart -days 7

if ($Verbose) {
    Write-Host "Daily reports found: $($dailyData.Count)"
}

# Generate report
$report = New-WeeklyReport -dailyData $dailyData -reportWeek $reportWeek

# Prepare artifact
$artifactPath = Publish-WeeklyReportArtifact -reportMarkdown $report -reportTitle "Weekly Report: $reportWeek" -description "Weekly work summary and metrics for $reportWeek"

# Commit report to git
$commitSuccess = Commit-WeeklyReport -repoRoot $RepoRoot -reportPath $reportPath -reportContent $report -reportWeek $reportWeek

if ($commitSuccess) {
    Write-Host "Weekly report published and committed successfully."
} else {
    Write-Host "Warning: Report artifact created but git commit failed."
}

# Output report content (agent will invoke Artifact tool with this)
Write-Host "===== ARTIFACT_OUTPUT_START ====="
Write-Host $report
Write-Host "===== ARTIFACT_OUTPUT_END ====="
Write-Host "Artifact prepared. Agent should invoke Artifact tool with:"
Write-Host "  file_path: $artifactPath"
Write-Host "  title: Weekly Report: $reportWeek"

Write-Host "Weekly report agent complete."
