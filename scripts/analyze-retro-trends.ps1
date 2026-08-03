#!/usr/bin/env pwsh
<#
.SYNOPSIS
Analyze metric trends across retro baseline chain.

.DESCRIPTION
Reads current retro, follows prior_retro_baseline chain, calculates deltas.
#>

param(
  [string]$RetroFile = "2026-07-19-1.json",
  [string]$Path = (Get-Location)
)

function Get-MetricValue {
  param([PSObject]$Metrics, [string[]]$Names)
  foreach ($name in $Names) {
    if ($null -ne $metrics.$name) { return $metrics.$name }
  }
  return $null
}

function Get-NormalizedRate {
  param([PSObject]$Metrics, [string[]]$Names)
  foreach ($name in $Names) {
    $value = $metrics.$name
    if ($null -ne $value) {
      # Retro generator emitted both fractions (0.105) and whole percentages
      # (10.5). Keep analyzer output canonical: fraction in [0,1].
      if ([double]$value -gt 100) { return $null }
      if ([double]$value -gt 1) { return [double]$value / 100 }
      if ([double]$value -lt 0) { return $null }
      return [double]$value
    }
  }
  return $null
}

function Get-RateSourceUnit {
  param([PSObject]$Metrics, [string[]]$Names)
  foreach ($name in $Names) {
    if ($null -ne $metrics.$name) {
      if ([double]$metrics.$name -gt 1) { return 'percent' }
      return 'fraction'
    }
  }
  return $null
}

function Get-WindowStatus {
  param([PSObject]$Retro)
  if (-not $Retro.since -or -not $Retro.until) {
    return @{ valid = $false; span_days = $null; reason = 'missing since/until' }
  }
  try {
    $since = [DateTime]::Parse($Retro.since)
    $until = [DateTime]::Parse($Retro.until)
    $span = ($until - $since).TotalDays
    $valid = $Retro.window -eq '7d' -and $span -ge 6.5 -and $span -le 7.5
    $reason = if ($valid) { $null } else { "window=$($Retro.window), span_days=$([Math]::Round($span,2))" }
    return @{ valid = $valid; span_days = [Math]::Round($span, 2); reason = $reason }
  } catch {
    return @{ valid = $false; span_days = $null; reason = 'invalid since/until' }
  }
}

function Read-Retro {
  param([string]$FilePath)
  if (-not (Test-Path $FilePath)) { return $null }
  try {
    return Get-Content $FilePath -Raw | ConvertFrom-Json -ErrorAction Stop
  } catch {
    Write-Error "Failed to read $($FilePath): $_"
    return $null
  }
}

function Resolve-RetroPath {
  param([string]$RelPath, [string]$BasePath)

  if ([System.IO.Path]::IsPathRooted($RelPath)) {
    return $RelPath
  }

  # .context/retros/filename.json -> just use filename.json in current BasePath
  if ($RelPath -match '\.context[\\\/]retros[\\\/](.+)$') {
    $filename = $matches[1]
    return Join-Path $BasePath $filename
  }

  return Join-Path $BasePath $RelPath
}

function Build-Chain {
  param([string]$StartFile, [string]$BasePath)

  $chain = @()
  $path = $StartFile
  $seen = @{}

  for ($i = 0; $i -lt 30; $i++) {
    if ([string]::IsNullOrEmpty($path) -or $seen.ContainsKey($path)) { break }
    $seen[$path] = $true

    $full_path = Resolve-RetroPath $path $BasePath
    $retro = Read-Retro $full_path

    if ($null -eq $retro) { break }

    $chain += @{ date = $retro.date; data = $retro }
    $path = $retro.prior_retro_baseline
  }

  return $chain
}

# Main
Write-Host "Retro Trend Analyzer" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host ""

$full_path = if ([System.IO.Path]::IsPathRooted($RetroFile)) { $RetroFile } else { Join-Path $Path $RetroFile }

if (-not (Test-Path $full_path)) {
  Write-Host "✗ File not found: $full_path" -ForegroundColor Red
  exit 1
}

Write-Host "Reading: $RetroFile" -ForegroundColor Cyan
$chain = Build-Chain $full_path $Path
Write-Host "Chain found: $($chain.Count) retros" -ForegroundColor Gray

# Sort by date (oldest first)
$sorted = @($chain | Sort-Object { [DateTime]::Parse($_.date) })

Write-Host "Analyzing $($sorted.Count) retros..." -ForegroundColor Cyan
Write-Host ""

$report = @{
  analysis_date = Get-Date -Format "yyyy-MM-dd"
  retros_count = $sorted.Count
  timeseries = @()
  trends = @{}
}

# Build timeseries
foreach ($item in $sorted) {
  $m = $item.data.metrics
  $window = Get-WindowStatus $item.data
  $report.timeseries += @{
    date = $item.date
    window = $item.data.window
    window_span_days = $window.span_days
    comparable_window = $window.valid
    window_issue = $window.reason
    commits = Get-MetricValue $m @('commits')
    insertions = Get-MetricValue $m @('insertions_raw', 'insertions', 'raw_insertions', 'filtered_insertions')
    deletions = Get-MetricValue $m @('deletions_raw', 'deletions', 'raw_deletions', 'filtered_deletions')
    test_ratio = Get-NormalizedRate $m @('test_ratio_pct', 'test_ratio')
    feat_pct = Get-NormalizedRate $m @('feat_pct')
    fix_pct = Get-NormalizedRate $m @('fix_pct')
    docs_pct = Get-NormalizedRate $m @('docs_pct')
    feat_pct_source_unit = Get-RateSourceUnit $m @('feat_pct')
    fix_pct_source_unit = Get-RateSourceUnit $m @('fix_pct')
    docs_pct_source_unit = Get-RateSourceUnit $m @('docs_pct')
    test_ratio_source_unit = Get-RateSourceUnit $m @('test_ratio_pct', 'test_ratio')
    rate_issue = if (@('feat_pct','fix_pct','docs_pct','test_ratio_pct','test_ratio') | Where-Object { $null -ne $m.$_ -and ([double]$m.$_ -lt 0 -or [double]$m.$_ -gt 100) }) { 'rate outside 0..100 percent' } else { $null }
    contributors = Get-MetricValue $m @('contributors')
    team_streak = Get-MetricValue $m @('team_streak_days')
  }
}

# Display timeseries
Write-Host "Timeseries:"
foreach ($ts in $report.timeseries) {
  $net_loc = if ($ts.insertions -and $ts.deletions) { $ts.insertions - $ts.deletions } else { "N/A" }
  Write-Host "  $($ts.date): $($ts.commits) commits | $net_loc net LOC | $($ts.contributors) contrib | streak: $($ts.team_streak)d"
}

# Trend analysis
if ($report.timeseries.Count -ge 2) {
  Write-Host ""
  Write-Host "Trends:"
  $latest = $report.timeseries[-1]
  $previous = $report.timeseries[-2]

  if (-not $latest.comparable_window -or -not $previous.comparable_window) {
    Write-Host "  Window trends: [SKIPPED] non-comparable window ($($previous.window_issue) -> $($latest.window_issue))" -ForegroundColor Yellow
  } elseif ($latest.commits -and $previous.commits -and $previous.commits -gt 0) {
    $ct = ($latest.commits - $previous.commits) / $previous.commits
    $dir = if ($ct -gt 0.1) { "[UP]" } elseif ($ct -lt -0.1) { "[DOWN]" } else { "[FLAT]" }
    Write-Host "  Commits: $dir $($latest.commits) (was $($previous.commits), $([Math]::Round($ct*100,1))%)"
  }

  if ($latest.comparable_window -and $previous.comparable_window -and $latest.insertions -and $latest.deletions -and $previous.insertions -and $previous.deletions) {
    $ln = $latest.insertions - $latest.deletions
    $pn = $previous.insertions - $previous.deletions
    if ($pn -ne 0) {
      $lt = ($ln - $pn) / $pn
      $dir = if ($lt -gt 0.1) { "[UP]" } elseif ($lt -lt -0.1) { "[DOWN]" } else { "[FLAT]" }
      Write-Host "  LOC Net: $dir $ln (was $pn, $([Math]::Round($lt*100,1))%)"
    }
  }

  $health = if ($latest.team_streak -gt 0) { "[HEALTHY]" } else { "[DISRUPTED]" }
  Write-Host "  Team Health: $health (streak: $($latest.team_streak)d)"
}

Write-Host ""
$report | ConvertTo-Json -Depth 10
