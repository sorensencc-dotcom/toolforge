#!/usr/bin/env pwsh
<#
.SYNOPSIS
Validate retro JSON files against canonical v1.0 schema.

.DESCRIPTION
Checks core fields for trend analysis:
- Top-level: date, window, base_branch, metrics, authors, session_focus
- Metrics: commits, contributors, LOC (insertions/deletions), test metrics, percentages
- Warnings: missing optional fields (filter_note, focus_area, etc.)

Outputs: per-file validation report + summary.
#>

param(
  [string]$Path = (Get-Location)
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

  # Core required fields
  $required = @('date', 'window', 'metrics', 'authors', 'session_focus', 'base_branch')
  foreach ($field in $required) {
    if ($null -eq $data.$field) {
      $issues += "Missing core field: $field"
    }
  }

  # Validate date format
  if ($data.date -and -not ($data.date -match '^\d{4}-\d{2}-\d{2}$')) {
    $issues += "Invalid date format: $($data.date) (expected YYYY-MM-DD)"
  }

  # Validate metrics core fields
  if ($data.metrics) {
    $m = $data.metrics

    # Critical for trend: commits, contributors, LOC
    if ($null -eq $m.commits) { $issues += "Missing metrics.commits" }
    if ($null -eq $m.contributors) { $issues += "Missing metrics.contributors" }

    # LOC - accept variant field names: insertions_raw, insertions, raw_insertions, filtered_insertions
    $has_raw_loc = $null -ne $m.insertions_raw -or $null -ne $m.insertions -or $null -ne $m.raw_insertions -or $null -ne $m.filtered_insertions
    $has_raw_del = $null -ne $m.deletions_raw -or $null -ne $m.deletions -or $null -ne $m.raw_deletions -or $null -ne $m.filtered_deletions
    if (-not $has_raw_loc) { $issues += "Missing LOC insertions (expected: insertions_raw, insertions, raw_insertions, or filtered_insertions)" }
    if (-not $has_raw_del) { $issues += "Missing LOC deletions (expected: deletions_raw, deletions, raw_deletions, or filtered_deletions)" }

    # Test metrics - accept both v0.x and v1.0 names
    $has_test_loc = $null -ne $m.test_loc_insertions -or $null -ne $m.test_loc
    $has_test_ratio = $null -ne $m.test_ratio_pct -or $null -ne $m.test_ratio
    if (-not $has_test_loc) { $warnings += "Missing test LOC (test_loc or test_loc_insertions)" }
    if (-not $has_test_ratio) { $warnings += "Missing test ratio (test_ratio or test_ratio_pct)" }

    # Commit type percentages - warn if missing (not critical)
    $has_pct = $null -ne $m.feat_pct -or $null -ne $m.fix_pct -or $null -ne $m.docs_pct
    if (-not $has_pct) { $warnings += "Missing commit-type percentages (feat_pct, fix_pct, etc.)" }
  }

  # Validate timestamps if present
  if ($data.since -and -not (Test-ISO8601 $data.since)) {
    if ($data.since -notmatch "^(7 days|today)") {  # Allow relative timestamps
      $issues += "Invalid ISO8601 timestamp: since = $($data.since)"
    }
  }
  if ($data.until -and -not (Test-ISO8601 $data.until)) {
    if ($data.until -notmatch "^(7 days|today)") {
      $issues += "Invalid ISO8601 timestamp: until = $($data.until)"
    }
  }

  # Validate authors count if present
  if ($data.authors -and $data.metrics.contributors) {
    $author_count = $data.authors.PSObject.Properties.Count
    if ($author_count -gt 0 -and $author_count -ne $data.metrics.contributors) {
      $warnings += "Authors count ($author_count) ≠ contributors ($($data.metrics.contributors))"
    }
  }

  $valid = $issues.Count -eq 0
  return @{ file = $FileName; valid = $valid; issues = $issues; warnings = $warnings }
}

# Main
Write-Host "Retro Validator (Pragmatic Schema)" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

$retros = Get-ChildItem -Path $Path -Filter "*.json" | Where-Object { $_.Name -notlike "*.backup" } | Sort-Object Name
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
  Write-Host "All files valid (core fields present)." -ForegroundColor Green
  exit 0
}
