#!/usr/bin/env pwsh
<#
.SYNOPSIS
Test suite for Retro Schema v1.0 validator and migration tool.

.DESCRIPTION
Runs unit & integration tests against validate-v1.0.ps1 and migrate-to-v1.0.ps1
using temporary mock retro JSON files.
#>

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$validatorScript = Join-Path $scriptDir "validate-v1.0.ps1"
$migrationScript = Join-Path $scriptDir "migrate-to-v1.0.ps1"

Write-Host "Running Retro Schema v1.0 Test Suite..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0

function Assert-Test {
  param(
    [string]$Name,
    [bool]$Condition,
    [string]$FailureMessage = ""
  )

  if ($Condition) {
    Write-Host "  ✓ PASS: $Name" -ForegroundColor Green
    $script:testsPassed++
  } else {
    Write-Host "  ✗ FAIL: $Name ($FailureMessage)" -ForegroundColor Red
    $script:testsFailed++
  }
}

# Test 1: All existing repo retros pass strict v1.0 validation
Write-Host "Test 1: Repository retros compliance" -ForegroundColor Yellow
& $validatorScript -Path $scriptDir | Out-Null
$exitCode = $LASTEXITCODE
Assert-Test "All existing retro JSON files pass validate-v1.0.ps1" ($exitCode -eq 0) "Exit code was $exitCode"

# Create a temporary directory for synthetic test fixtures
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

try {
  # Test 2: Legacy retro file (v0.x) fails strict v1.0 validation
  Write-Host "Test 2: Legacy retro file rejection" -ForegroundColor Yellow
  $legacyJson = @'
{
  "date": "2026-07-25",
  "window": "7d",
  "since": "2026-07-18T00:00:00",
  "user": "Chris Sorensen",
  "metrics": {
    "commits_human": 10,
    "commits_bot": 2,
    "contributors": 2,
    "insertions": 100,
    "deletions": 20,
    "sessions_detected": 5
  }
}
'@
  $legacyFile = Join-Path $tmpDir "2026-07-25-1.json"
  [System.IO.File]::WriteAllText($legacyFile, $legacyJson)

  & $validatorScript -Path $legacyFile | Out-Null
  $exitCode = $LASTEXITCODE
  Assert-Test "Legacy v0.x retro JSON fails validate-v1.0.ps1" ($exitCode -ne 0) "Expected non-zero exit code for legacy fields"

  # Test 3: Migration script transforms legacy retro to canonical v1.0
  Write-Host "Test 3: Migration script transformation" -ForegroundColor Yellow
  & $migrationScript -Path $tmpDir | Out-Null
  & $validatorScript -Path $legacyFile | Out-Null
  $exitCode = $LASTEXITCODE
  Assert-Test "Migrated legacy retro passes validate-v1.0.ps1" ($exitCode -eq 0) "Expected exit code 0 after migration"

  # Verify migrated metrics contents
  $migratedData = Get-Content $legacyFile -Raw | ConvertFrom-Json
  Assert-Test "Migrated commits equal human+bot" ($migratedData.metrics.commits -eq 12) "Commits was $($migratedData.metrics.commits)"
  Assert-Test "Migrated automation_commits equal bot commits" ($migratedData.metrics.automation_commits -eq 2) "automation_commits was $($migratedData.metrics.automation_commits)"
  Assert-Test "Migrated sessions field present" ($migratedData.metrics.sessions -eq 5) "sessions was $($migratedData.metrics.sessions)"
  Assert-Test "Legacy fields removed from metrics" ($null -eq $migratedData.metrics.commits_human) "commits_human should be null"

  # Test 4: Missing required field fails validation
  Write-Host "Test 4: Invalid retro rejection (missing session_focus)" -ForegroundColor Yellow
  $invalidJson = @'
{
  "date": "2026-07-25",
  "window": "7d",
  "since": "2026-07-18T00:00:00-04:00",
  "until": "2026-07-25T23:59:59-04:00",
  "base_branch": "main",
  "metrics": {
    "commits": 10, "commits_no_merge": 10, "contributors": 1, "automation_commits": 0,
    "insertions_raw": 100, "deletions_raw": 10, "net_loc_raw": 90,
    "insertions_filtered": 100, "deletions_filtered": 10, "net_loc_filtered": 90,
    "filter_note": "none", "test_loc_insertions": 10, "test_ratio_pct": 11.1,
    "feat_pct": 50, "fix_pct": 50, "docs_pct": 0, "chore_pct": 0, "test_pct": 0,
    "active_days": 5, "sessions": 5, "deep_sessions": 2, "peak_hour": 14,
    "late_night_commits_22_to_04": 0, "team_streak_days": 5, "personal_streak_days": 5,
    "backlog_open_todos": 0, "backlog_closed_this_period": 0,
    "version_range": ["v1.0.0", "v1.0.1"], "release_commits": 0, "focus_area": "core"
  },
  "authors": { "Dev": { "commits": 10, "role": "human" } }
}
'@
  $invalidFile = Join-Path $tmpDir "invalid.json"
  [System.IO.File]::WriteAllText($invalidFile, $invalidJson)

  & $validatorScript -Path $invalidFile | Out-Null
  $exitCode = $LASTEXITCODE
  Assert-Test "Missing session_focus fails validate-v1.0.ps1" ($exitCode -ne 0) "Expected non-zero exit code for missing session_focus"

} finally {
  Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Test Suite Summary:" -ForegroundColor Cyan
Write-Host "  Passed: $testsPassed" -ForegroundColor Green
Write-Host "  Failed: $testsFailed" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($testsFailed -gt 0) {
  exit 1
} else {
  exit 0
}
