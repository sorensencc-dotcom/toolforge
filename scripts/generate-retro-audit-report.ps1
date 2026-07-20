#!/usr/bin/env pwsh
<#
.SYNOPSIS
Generate audit findings from retro trend data.

.DESCRIPTION
Analyzes trend data for anomalies:
- Commit drops / spikes
- LOC production changes
- Test ratio regressions
- Streak breaks
- Quality flags (many commits, low LOC)

Outputs: structured findings report.
#>

param(
  [string]$RetroFile = "2026-07-19-1.json",
  [string]$Path = (Get-Location),
  [switch]$Verbose = $false
)

function Get-Findings {
  param([array]$Timeseries)

  $findings = @()

  if ($timeseries.Count -lt 2) {
    return $findings
  }

  $latest = $timeseries[-1]
  $previous = $timeseries[-2]

  # Commit trend
  if ($latest.commits -and $previous.commits -and $previous.commits -gt 0) {
    $change = ($latest.commits - $previous.commits) / $previous.commits
    if ($change -lt -0.3) {
      $findings += @{
        severity = "YELLOW"
        category = "productivity"
        finding = "Commits down significantly"
        detail = "$($previous.commits) → $($latest.commits) commits ($([Math]::Round($change*100,1))%)"
      }
    } elseif ($change -gt 0.5) {
      $findings += @{
        severity = "BLUE"
        category = "productivity"
        finding = "Commit spike detected"
        detail = "$($previous.commits) → $($latest.commits) commits (+$([Math]::Round($change*100,1))%)"
      }
    }
  }

  # LOC trend
  if ($latest.insertions -and $latest.deletions -and $previous.insertions -and $previous.deletions) {
    $ln = $latest.insertions - $latest.deletions
    $pn = $previous.insertions - $previous.deletions
    if ($pn -ne 0) {
      $change = ($ln - $pn) / $pn
      if ($change -lt -0.4) {
        $findings += @{
          severity = "YELLOW"
          category = "delivery"
          finding = "LOC production down significantly"
          detail = "$pn → $ln net LOC ($([Math]::Round($change*100,1))%)"
        }
      }
    }
  }

  # Test ratio regression
  if ($latest.test_ratio -and $previous.test_ratio -and $previous.test_ratio -gt 0) {
    if ($latest.test_ratio -lt ($previous.test_ratio * 0.7)) {
      $findings += @{
        severity = "RED"
        category = "quality"
        finding = "Test ratio regressed"
        detail = "$([Math]::Round($previous.test_ratio*100,1))% → $([Math]::Round($latest.test_ratio*100,1))% (-30%)"
      }
    }
  }

  # Streak break
  if ($previous.team_streak -gt 0 -and ($latest.team_streak -eq 0 -or $null -eq $latest.team_streak)) {
    $findings += @{
      severity = "YELLOW"
      category = "health"
      finding = "Team streak broken"
      detail = "Streak of $($previous.team_streak) days ended"
    }
  }

  # Quality flag: many commits but low LOC
  if ($latest.commits -gt 50) {
    $ln = if ($latest.insertions -and $latest.deletions) { $latest.insertions - $latest.deletions } else { 0 }
    if ($ln -gt 0 -and $ln -lt ($latest.commits * 100)) {
      $findings += @{
        severity = "BLUE"
        category = "quality"
        finding = "Commit velocity high, LOC low"
        detail = "$($latest.commits) commits but only $ln net LOC (~$([Math]::Round($ln/$latest.commits,1)) LOC/commit)"
      }
    }
  }

  return $findings
}

# Read trend data (run analyzer to get timeseries)
$analyzer_script = Join-Path (Split-Path $PSCommandPath) "analyze-trends.ps1"
if (-not (Test-Path $analyzer_script)) {
  Write-Host "✗ Trend analyzer not found: $analyzer_script" -ForegroundColor Red
  exit 1
}

Write-Host "Audit Report Generator" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host ""

Write-Host "Running trend analyzer..." -ForegroundColor Cyan
$trend_json = & $analyzer_script -RetroFile $RetroFile -Path $Path 2>/dev/null | ConvertFrom-Json

if (-not $trend_json -or $trend_json.timeseries.Count -eq 0) {
  Write-Host "✗ No trend data available" -ForegroundColor Red
  exit 1
}

Write-Host "Analyzed $($trend_json.retros_count) retros, analyzing for findings..."
Write-Host ""

$findings = Get-Findings $trend_json.timeseries

if ($findings.Count -eq 0) {
  Write-Host "✅ No anomalies detected. All metrics healthy." -ForegroundColor Green
  Write-Host ""
  Write-Host "Summary:" -ForegroundColor Green
  Write-Host "  Latest: $($trend_json.timeseries[-1].commits) commits"
  Write-Host "  LOC: $($trend_json.timeseries[-1].insertions - $trend_json.timeseries[-1].deletions) net"
  Write-Host "  Team streak: $($trend_json.timeseries[-1].team_streak) days"
} else {
  Write-Host "📋 Found $($findings.Count) items:" -ForegroundColor Cyan
  Write-Host ""

  foreach ($f in $findings) {
    $icon = @{ RED = "🔴"; YELLOW = "🟡"; BLUE = "🔵" }[$f.severity] ?? "⚪"
    Write-Host "$icon [$($f.severity)] $($f.finding)" -ForegroundColor (
      @{ RED = "Red"; YELLOW = "Yellow"; BLUE = "Cyan" }[$f.severity] ?? "Gray"
    )
    Write-Host "   $($f.detail)" -ForegroundColor Gray
    Write-Host ""
  }
}

# Output structured report
$report = @{
  generated_date = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
  retros_analyzed = $trend_json.retros_count
  findings_count = $findings.Count
  findings = $findings
  summary = @{
    latest_date = $trend_json.timeseries[-1].date
    commits = $trend_json.timeseries[-1].commits
    net_loc = $trend_json.timeseries[-1].insertions - $trend_json.timeseries[-1].deletions
    contributors = $trend_json.timeseries[-1].contributors
    team_health = if ($trend_json.timeseries[-1].team_streak -gt 0) { "HEALTHY" } else { "DISRUPTED" }
  }
}

Write-Host "Report (JSON):" -ForegroundColor Green
$report | ConvertTo-Json -Depth 10
