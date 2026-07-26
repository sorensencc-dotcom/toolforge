#!/usr/bin/env pwsh
<#
.SYNOPSIS
Validate retro JSON files against canonical v1.0 schema strictly.

.DESCRIPTION
Enforces canonical v1.0 retro schema rules:
- Required top-level: date, window, since, until, base_branch, metrics, authors, session_focus
- Required metrics: commits, commits_no_merge, contributors, automation_commits,
  insertions_raw, deletions_raw, net_loc_raw, insertions_filtered, deletions_filtered,
  net_loc_filtered, filter_note, test_loc_insertions, test_ratio_pct,
  feat_pct, fix_pct, docs_pct, chore_pct, test_pct, active_days, sessions,
  deep_sessions, peak_hour, late_night_commits_22_to_04, team_streak_days,
  personal_streak_days, backlog_open_todos, backlog_closed_this_period,
  version_range, release_commits, focus_area
- Rejects legacy drift fields (commits_human, commits_bot, sessions_detected, test_loc, etc.)
- Validates prior_retro_baseline file existence if specified.

Outputs: per-file validation report + exit code 0 (success) or 1 (failure).
#>

param(
  [string]$Path = $PSScriptRoot
)

function Test-ISO8601 {
  param([string]$Value)
  try {
    [DateTime]::Parse($Value, [Globalization.CultureInfo]::InvariantCulture) | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Test-RetroFile {
  param([string]$FilePath, [string]$FileName)

  $issues = @()
  $warnings = @()

  try {
    $data = Get-Content $FilePath -Raw | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return @{ file = $FileName; valid = $false; issues = @("JSON parse error: $_"); warnings = @() }
  }

  # 1. Top-level required fields
  $required = @('date', 'window', 'since', 'until', 'base_branch', 'metrics', 'authors', 'session_focus')
  foreach ($field in $required) {
    if ($null -eq $data.$field) {
      $issues += "Missing required top-level field: $field"
    }
  }

  # 2. Date format
  if ($data.date -and -not ($data.date -match '^\d{4}-\d{2}-\d{2}$')) {
    $issues += "Invalid date format: '$($data.date)' (expected YYYY-MM-DD)"
  }

  # 3. Timestamps
  if ($data.since -and -not (Test-ISO8601 $data.since)) {
    $issues += "Invalid ISO8601 timestamp: since = '$($data.since)'"
  }
  if ($data.until -and -not (Test-ISO8601 $data.until)) {
    $issues += "Invalid ISO8601 timestamp: until = '$($data.until)'"
  }

  # 4. Metrics verification
  if ($data.metrics) {
    $m = $data.metrics

    # Strict required v1.0 metrics
    $requiredMetrics = @(
      'commits', 'commits_no_merge', 'contributors', 'automation_commits',
      'insertions_raw', 'deletions_raw', 'net_loc_raw',
      'insertions_filtered', 'deletions_filtered', 'net_loc_filtered', 'filter_note',
      'test_loc_insertions', 'test_ratio_pct',
      'feat_pct', 'fix_pct', 'docs_pct', 'chore_pct', 'test_pct',
      'active_days', 'sessions', 'deep_sessions', 'peak_hour', 'late_night_commits_22_to_04',
      'team_streak_days', 'personal_streak_days', 'backlog_open_todos', 'backlog_closed_this_period',
      'version_range', 'release_commits', 'focus_area'
    )

    foreach ($mfield in $requiredMetrics) {
      if ($null -eq $m.$mfield) {
        $issues += "Missing metrics.$mfield"
      }
    }

    # Reject non-canonical legacy fields
    $legacyMetrics = @('commits_human', 'commits_bot', 'sessions_detected', 'test_loc', 'commits_per_day', 'avg_session_minutes')
    foreach ($lfield in $legacyMetrics) {
      if ($null -ne $m.$lfield) {
        $issues += "Non-canonical legacy field in metrics: $lfield (must be migrated to v1.0 equivalent)"
      }
    }

    # Range and sanity checks
    if ($null -ne $m.peak_hour -and ($m.peak_hour -lt 0 -or $m.peak_hour -gt 23)) {
      $issues += "metrics.peak_hour out of bounds (0-23): $($m.peak_hour)"
    }

    if ($null -ne $m.version_range) {
      if (-not ($m.version_range -is [array]) -or $m.version_range.Count -ne 2) {
        $issues += "metrics.version_range must be array of 2 version strings [min, max]"
      }
    }
  }

  # 5. session_focus validation
  if ($data.session_focus) {
    $sf = $data.session_focus
    if ($null -eq $sf.summary) { $issues += "Missing session_focus.summary" }
    if ($null -eq $sf.incidents) { $issues += "Missing session_focus.incidents" }
    if ($null -eq $sf.process_learnings) { $issues += "Missing session_focus.process_learnings" }
  }

  # 6. prior_retro_baseline file existence check
  if ($data.prior_retro_baseline) {
    $baselinePath = [System.IO.Path]::Combine((Split-Path $FilePath -Parent), [System.IO.Path]::GetFileName($data.prior_retro_baseline))
    if (-not (Test-Path $baselinePath)) {
      $issues += "prior_retro_baseline file does not exist: '$($data.prior_retro_baseline)'"
    }
  }

  # 7. Authors vs contributors check
  if ($data.authors -and $data.metrics -and $null -ne $data.metrics.contributors) {
    $authorCount = ($data.authors.PSObject.Properties | Measure-Object).Count
    if ($authorCount -gt 0 -and $authorCount -ne [int]$data.metrics.contributors) {
      $warnings += "Authors count ($authorCount) != contributors count ($($data.metrics.contributors))"
    }
  }

  $valid = $issues.Count -eq 0
  return @{ file = $FileName; valid = $valid; issues = $issues; warnings = $warnings }
}

# Main
Write-Host "Canonical v1.0 Retro Schema Validator" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

$targetDir = $Path
if (Test-Path -PathType Leaf $Path) {
  $targetDir = Split-Path $Path -Parent
  $retros = @(Get-Item $Path)
} else {
  $retros = Get-ChildItem -Path $Path -Filter "*.json" | Where-Object { $_.Name -notlike "*.backup" -and $_.Name -ne "retro.schema.json" } | Sort-Object Name
}

$results = @()

foreach ($file in $retros) {
  $result = Test-RetroFile $file.FullName $file.Name
  $results += $result

  $status = if ($result.valid) { "✓ PASS" } else { "✗ FAIL" }
  $color = if ($result.valid) { "Green" } else { "Red" }
  Write-Host "$($result.file): $status" -ForegroundColor $color

  if ($result.issues.Count -gt 0) {
    Write-Host "  Issues:" -ForegroundColor Red
    foreach ($issue in $result.issues) {
      Write-Host "    ✗ $issue" -ForegroundColor Red
    }
  }

  if ($result.warnings.Count -gt 0) {
    Write-Host "  Warnings:" -ForegroundColor Yellow
    foreach ($warning in $result.warnings) {
      Write-Host "    ⚠ $warning" -ForegroundColor Yellow
    }
  }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Green
$pass_count = ($results | Where-Object { $_.valid }).Count
$fail_count = ($results | Where-Object { -not $_.valid }).Count
Write-Host "  PASS: $pass_count / $($results.Count)"
Write-Host "  FAIL: $fail_count / $($results.Count)"
Write-Host ""

if ($fail_count -gt 0) {
  exit 1
} else {
  Write-Host "All retro files valid against Canonical v1.0 Schema." -ForegroundColor Green
  exit 0
}
