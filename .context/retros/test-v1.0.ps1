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
$wrapperScript = Join-Path $scriptDir "validate.ps1"

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

  # Test 5: Wrapper resolves repository root from its own location, not a Windows drive.
  Write-Host "Test 5: Cross-platform wrapper root resolution" -ForegroundColor Yellow
  Push-Location $tmpDir
  try {
    & $wrapperScript | Out-Null
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  Assert-Test "Wrapper passes from a non-repository working directory" ($exitCode -eq 0) "Expected exit code 0, got $exitCode"

  # Test 6: Changed-file gate passes when no event metadata is present and no files are changed.
  Write-Host "Test 6: Changed retro gate no-op" -ForegroundColor Yellow
  $oldEventPath = $env:GITHUB_EVENT_PATH
  $oldSha = $env:GITHUB_SHA
  Remove-Item Env:GITHUB_EVENT_PATH -ErrorAction SilentlyContinue
  Remove-Item Env:GITHUB_SHA -ErrorAction SilentlyContinue
  try {
    & (Join-Path $scriptDir "validate-changed.ps1") | Out-Null
    $exitCode = $LASTEXITCODE
  } finally {
    if ($oldEventPath) { $env:GITHUB_EVENT_PATH = $oldEventPath }
    if ($oldSha) { $env:GITHUB_SHA = $oldSha }
  }
  Assert-Test "Changed-file gate passes without CI event metadata" ($exitCode -eq 0) "Expected exit code 0, got $exitCode"

  # Test 7: Changed-file gate validates dated retros, never retro inbox entries.
  Write-Host "Test 7: Changed retro gate skips inbox entries" -ForegroundColor Yellow
  $gateRepo = Join-Path $tmpDir "gate-repo"
  $gateRetros = Join-Path $gateRepo ".context/retros"
  New-Item -ItemType Directory -Path $gateRetros -Force | Out-Null
  Copy-Item $validatorScript, $wrapperScript, (Join-Path $scriptDir "validate-changed.ps1") $gateRetros
  git -C $gateRepo init -q -b main
  git -C $gateRepo config user.email "t@example.com"
  git -C $gateRepo config user.name "t"

  function Add-GateCommit([hashtable]$Files) {
    foreach ($relative in $Files.Keys) {
      $file = Join-Path $gateRepo $relative
      New-Item -ItemType Directory -Path (Split-Path $file -Parent) -Force | Out-Null
      [System.IO.File]::WriteAllText($file, $Files[$relative])
    }
    git -C $gateRepo add -A
    git -C $gateRepo commit -q -m "fixture"
  }

  function Invoke-ChangedGate {
    $output = & (Join-Path $gateRetros "validate-changed.ps1") *>&1 | Out-String
    $exit = $LASTEXITCODE
    $validated = [regex]::Matches($output, 'Validating changed retro: (\S+)') | ForEach-Object { $_.Groups[1].Value }
    [pscustomobject]@{ Exit = $exit; Validated = $validated -join ', ' }
  }

  $datedRetro = @'
{
  "date": "2026-10-17",
  "window": "7d",
  "since": "2026-10-10T00:00:00-04:00",
  "until": "2026-10-17T00:00:00-04:00",
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
  "authors": { "Dev": { "commits": 10, "role": "human" } },
  "session_focus": { "summary": "fixture", "incidents": [], "process_learnings": [] }
}
'@
  $inboxEntry = @'
{
  "schema": "retro-inbox/1",
  "agent": "claude",
  "repo": "toolforge",
  "date": "2026-10-17",
  "findings": [
    {
      "id": "RF-707f88a76982",
      "tag": "GATE",
      "severity": "high",
      "summary": "retro-schema CI job validates inbox entries as v1.0 retros",
      "evidence": [".context/retros/validate-changed.ps1:15"]
    }
  ]
}
'@

  $oldEventPath = $env:GITHUB_EVENT_PATH
  $oldSha = $env:GITHUB_SHA
  Remove-Item Env:GITHUB_EVENT_PATH, Env:GITHUB_SHA -ErrorAction SilentlyContinue
  try {
    Add-GateCommit @{}
    $baseSha = git -C $gateRepo rev-parse HEAD
    Add-GateCommit @{
      ".context/retros/2026-10-17-1.json" = $datedRetro
      ".context/retros/inbox/claude/2026-10-17-retro-gate-scans-inbox.json" = $inboxEntry
    }
    Add-GateCommit @{ ".context/retros/inbox/codex/2026-10-17-incomplete.json" = '{ "schema": "retro-inbox/1", "agent": "codex" }' }
    $headSha = git -C $gateRepo rev-parse HEAD

    $r = Invoke-ChangedGate
    Assert-Test "Changed-file gate skips an invalid inbox entry" ($r.Exit -eq 0 -and $r.Validated -eq "") "Exit code $($r.Exit), validated: $($r.Validated)"

    Add-GateCommit @{ ".context/retros/2026-10-18-1.json" = '{ "date": "2026-10-18" }' }
    $r = Invoke-ChangedGate
    Assert-Test "Changed-file gate still fails an invalid dated retro" ($r.Exit -eq 1 -and $r.Validated -eq ".context/retros/2026-10-18-1.json") "Exit code $($r.Exit), validated: $($r.Validated)"

    $eventFile = Join-Path $tmpDir "push-event.json"
    [System.IO.File]::WriteAllText($eventFile, (@{ before = $baseSha; after = $headSha } | ConvertTo-Json))
    $env:GITHUB_EVENT_PATH = $eventFile
    $r = Invoke-ChangedGate
    Assert-Test "Changed-file gate validates only the dated retro in a push with inbox entries" ($r.Exit -eq 0 -and $r.Validated -eq ".context/retros/2026-10-17-1.json") "Exit code $($r.Exit), validated: $($r.Validated)"
  } finally {
    if ($oldEventPath) { $env:GITHUB_EVENT_PATH = $oldEventPath } else { Remove-Item Env:GITHUB_EVENT_PATH -ErrorAction SilentlyContinue }
    if ($oldSha) { $env:GITHUB_SHA = $oldSha }
  }

  # Test 8: Inbox entries and harvest files commit with a plain git add, and new dated retros still need git add -f.
  Write-Host "Test 8: Retro inbox and harvest files are trackable" -ForegroundColor Yellow
  $repoRoot = (Resolve-Path (Join-Path $scriptDir "../..")).Path
  git -C $repoRoot check-ignore --no-index -q ".context/retros/inbox/claude/2026-10-17-retro-gate-scans-inbox.json"
  Assert-Test "Inbox entries are not ignored" ($LASTEXITCODE -eq 1) "check-ignore exit code $LASTEXITCODE"
  $harvestExits = foreach ($harvestFile in ".context/retros/harvest/config.json", ".context/retros/harvest/ledger.jsonl") {
    git -C $repoRoot check-ignore --no-index -q $harvestFile
    $LASTEXITCODE
  }
  Assert-Test "Harvest config and ledger are not ignored" (($harvestExits -join ',') -eq '1,1') "check-ignore exit codes $($harvestExits -join ',')"
  git -C $repoRoot check-ignore --no-index -q ".context/retros/2026-10-18-1.json"
  Assert-Test "New dated retros stay ignored" ($LASTEXITCODE -eq 0) "check-ignore exit code $LASTEXITCODE"

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
