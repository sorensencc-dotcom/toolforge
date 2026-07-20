#!/usr/bin/env pwsh
<#
.SYNOPSIS
Migrate retro JSON files from v0.1/v0.2/v0.3 to canonical v1.0 schema.

.DESCRIPTION
Reads all *.json files in the current directory, detects schema version,
transforms to canonical v1.0, writes updated file + .backup.

Schema versions:
- v0.1 (07-12): nested metrics{}, streak_days, unpushed_commits
- v0.2 (07-15/16): flat top-level (loc_*, feat_count, etc.)
- v0.3 (07-16-4+): nested metrics{}, session_focus{}

All transform to v1.0:
- Top-level: date, window, since, until, base_branch, prior_retro_baseline, note
- metrics{}: all numeric fields nested
- authors{}
- session_focus{}: optional (summary, incidents, learnings)
#>

param(
  [string]$Path = (Get-Location),
  [switch]$DryRun = $false
)

function Detect-SchemaVersion {
  param([PSObject]$Data)

  if ($Data.PSObject.Properties.Name -contains 'metrics' -and $Data.metrics.commits) {
    if ($Data.PSObject.Properties.Name -contains 'session_focus') {
      return @{ version = '0.3'; variant = 'final' }
    } else {
      return @{ version = '0.3'; variant = 'early' }
    }
  } elseif ($Data.PSObject.Properties.Name -contains 'commits' -and -not $Data.metrics) {
    return @{ version = '0.2'; variant = 'flat' }
  } else {
    return @{ version = '0.1'; variant = 'nested' }
  }
}

function Transform-ToV1 {
  param([PSObject]$Data, [string]$FileName)

  $v1 = @{
    date = $Data.date
    window = $Data.window ?? '7d'
    since = $Data.since ?? "$($Data.date)T00:00:00"
    until = $Data.until ?? "$($Data.date)T23:59:59"
    base_branch = $Data.base_branch ?? 'main'
    prior_retro_baseline = $Data.prior_retro_baseline
    note = $Data.note
    metrics = @{}
    authors = $Data.authors ?? @{}
  }

  # Extract or calculate metrics
  $m = $v1.metrics

  if ($Data.metrics) {
    # v0.3: copy from nested metrics{}
    foreach ($key in $Data.metrics.PSObject.Properties.Name) {
      $m[$key] = $Data.metrics.$key
    }
  } else {
    # v0.1 or v0.2: extract from top-level or calculate
    $m.commits = $Data.commits ?? $Data.metrics.commits ?? 0
    $m.commits_no_merge = $Data.commits_no_merge ?? 0
    $m.contributors = $Data.contributors ?? $Data.PSObject.Properties['authors'].Count
    $m.automation_commits = $Data.automation_commits ?? 0

    # LOC metrics (rename loc_* to insertions/deletions)
    $m.insertions_raw = $Data.insertions ?? $Data.loc_insertions_raw ?? 0
    $m.deletions_raw = $Data.deletions ?? $Data.loc_deletions_raw ?? 0
    $m.net_loc_raw = ($m.insertions_raw - $m.deletions_raw)
    $m.insertions_filtered = $Data.insertions_filtered ?? $Data.loc_insertions_filtered ?? $m.insertions_raw
    $m.deletions_filtered = $Data.deletions_filtered ?? $Data.loc_deletions_filtered ?? $m.deletions_raw
    $m.net_loc_filtered = ($m.insertions_filtered - $m.deletions_filtered)
    $m.filter_note = $Data.filter_note ?? "raw LOC excludes lockfiles (package-lock.json, yarn.lock, etc.) and auto-generated reports"

    # Test metrics
    $m.test_loc_insertions = $Data.test_loc_insertions ?? $Data.test_loc ?? 0
    $m.test_ratio_pct = $Data.test_loc_ratio_pct ?? $Data.test_ratio ?? 0

    # Commit breakdown (convert counts to percentages if needed)
    $total_commits = $Data.feat_count + $Data.chore_count + $Data.fix_count + $Data.docs_count + $Data.test_count + ($Data.refactor_count ?? 0)
    if ($total_commits -gt 0) {
      $m.feat_pct = [Math]::Round(($Data.feat_count / $total_commits) * 100, 1)
      $m.fix_pct = [Math]::Round(($Data.fix_count / $total_commits) * 100, 1)
      $m.docs_pct = [Math]::Round(($Data.docs_count / $total_commits) * 100, 1)
      $m.chore_pct = [Math]::Round(($Data.chore_count / $total_commits) * 100, 1)
      $m.test_pct = [Math]::Round(($Data.test_count / $total_commits) * 100, 1)
    } else {
      $m.feat_pct = 0
      $m.fix_pct = 0
      $m.docs_pct = 0
      $m.chore_pct = 0
      $m.test_pct = 0
    }

    # Time metrics
    $m.active_days = $Data.active_days ?? 0
    $m.sessions = $Data.sessions ?? 0
    $m.deep_sessions = $Data.deep_sessions ?? 0
    $m.peak_hour = $Data.peak_hour ?? 12
    $m.late_night_commits_22_to_04 = $Data.late_night_commits_22_to_04 ?? ($Data.late_night_commits_00_05 + $Data.late_night_commits_23 ?? 0)

    # Streaks and health
    $m.team_streak_days = $Data.team_streak_days ?? $Data.shipping_streak_days ?? $Data.streak_days ?? 0
    $m.personal_streak_days = $Data.personal_streak_days ?? $Data.streak_days ?? 0
    $m.backlog_open_todos = $Data.backlog_open_todos ?? $Data.backlog_open ?? 0
    $m.backlog_closed_this_period = $Data.backlog_closed_this_period ?? $Data.backlog_completed_this_period ?? 0

    # Release/version
    $m.version_range = $Data.version_range ?? @()
    $m.release_commits = $Data.release_commits ?? $Data.automation_commits ?? 0
    $m.focus_area = $Data.focus_area ?? "unknown"
  }

  # session_focus (optional but documented)
  if ($Data.session_focus) {
    $v1.session_focus = $Data.session_focus
  } else {
    $v1.session_focus = @{
      summary = ""
      incidents = @()
      process_learnings = @()
    }
  }

  return $v1
}

# Main
Write-Host "Retro Schema Migration v1.0" -ForegroundColor Green
Write-Host "======================="
Write-Host ""

$retros = Get-ChildItem -Path $Path -Filter "*.json" | Sort-Object Name
$results = @{ migrated = 0; skipped = 0; errors = 0 }

foreach ($file in $retros) {
  Write-Host "Processing: $($file.Name)" -ForegroundColor Cyan

  try {
    $data = Get-Content $file.FullName | ConvertFrom-Json -ErrorAction Stop
    $version = Detect-SchemaVersion $data
    Write-Host "  Schema: v$($version.version) ($($version.variant))" -ForegroundColor Gray

    $v1 = Transform-ToV1 $data $file.Name

    if (-not $DryRun) {
      # Backup original
      Copy-Item $file.FullName "$($file.FullName).backup" -Force

      # Write v1.0
      $v1 | ConvertTo-Json -Depth 10 | Set-Content $file.FullName
      Write-Host "  ✓ Migrated to v1.0" -ForegroundColor Green
    } else {
      Write-Host "  [DRY RUN] Would migrate to v1.0" -ForegroundColor Yellow
    }
    $results.migrated++
  } catch {
    Write-Host "  ✗ ERROR: $_" -ForegroundColor Red
    $results.errors++
  }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Green
Write-Host "  Migrated: $($results.migrated)"
Write-Host "  Skipped: $($results.skipped)"
Write-Host "  Errors: $($results.errors)"
Write-Host ""
if ($DryRun) {
  Write-Host "DRY RUN completed. No changes made." -ForegroundColor Yellow
}
