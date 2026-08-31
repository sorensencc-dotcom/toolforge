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
  $report.timeseries += @{
    date = $item.date
    commits = Get-MetricValue $m @('commits')
    insertions = Get-MetricValue $m @('insertions_raw', 'insertions', 'raw_insertions', 'filtered_insertions')
    deletions = Get-MetricValue $m @('deletions_raw', 'deletions', 'raw_deletions', 'filtered_deletions')
    test_ratio = Get-MetricValue $m @('test_ratio_pct', 'test_ratio')
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

  if ($latest.commits -and $previous.commits -and $previous.commits -gt 0) {
    $ct = ($latest.commits - $previous.commits) / $previous.commits
    $dir = if ($ct -gt 0.1) { "↑" } elseif ($ct -lt -0.1) { "↓" } else { "→" }
    Write-Host "  Commits: $dir $($latest.commits) (was $($previous.commits), $([Math]::Round($ct*100,1))%)"
  }

  if ($latest.insertions -and $latest.deletions -and $previous.insertions -and $previous.deletions) {
    $ln = $latest.insertions - $latest.deletions
    $pn = $previous.insertions - $previous.deletions
    if ($pn -ne 0) {
      $lt = ($ln - $pn) / $pn
      $dir = if ($lt -gt 0.1) { "↑" } elseif ($lt -lt -0.1) { "↓" } else { "→" }
      Write-Host "  LOC Net: $dir $ln (was $pn, $([Math]::Round($lt*100,1))%)"
    }
  }

  $health = if ($latest.team_streak -gt 0) { "🟢 HEALTHY" } else { "🔴 DISRUPTED" }
  Write-Host "  Team Health: $health (streak: $($latest.team_streak)d)"
}

Write-Host ""
$report | ConvertTo-Json -Depth 10
