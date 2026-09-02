#!/usr/bin/env pwsh
<# Focused regression tests for analyzer unit normalization and window safety. #>

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'analyze-retro-trends.ps1'
$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('retro-analyzer-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "FAIL: $Message" }
  Write-Host "PASS: $Message" -ForegroundColor Green
}

try {
  $old = [DateTime]::Parse('2026-07-12T00:00:00Z')
  $day = [DateTime]::Parse('2026-07-12T23:59:59Z')
  $week = [DateTime]::Parse('2026-07-19T00:00:00Z')
  $template = @{
    date = '2026-07-12'; window = '7d'; since = $old.ToString('o'); until = $day.ToString('o')
    metrics = @{ commits = 1; contributors = 1; insertions = 10; deletions = 1; feat_pct = 0.043; fix_pct = 10.5; docs_pct = 0.0; test_ratio_pct = 30.6 }
    authors = @{}; session_focus = @{}; base_branch = 'main'
  }
  $latest = $template.Clone(); $latest.date = '2026-07-19'; $latest.since = $old.ToString('o'); $latest.until = $week.ToString('o'); $latest.prior_retro_baseline = 'old.json'
  ($template | ConvertTo-Json -Depth 8) | Set-Content (Join-Path $fixtureRoot 'old.json')
  ($latest | ConvertTo-Json -Depth 8) | Set-Content (Join-Path $fixtureRoot 'latest.json')

  $output = & $scriptPath -RetroFile 'latest.json' -Path $fixtureRoot | Out-String
  $json = $output.Substring($output.IndexOf('{')) | ConvertFrom-Json
  $oldTs = $json.timeseries | Where-Object date -eq '2026-07-12'
  $latestTs = $json.timeseries | Where-Object date -eq '2026-07-19'

  Assert-True ($oldTs.feat_pct -eq 0.043) 'fraction metric remains canonical'
  Assert-True ($oldTs.fix_pct -eq 0.105) 'whole-percent metric normalizes to fraction'
  Assert-True ($oldTs.test_ratio -eq 0.306) 'test ratio normalizes to fraction'
  Assert-True ($oldTs.fix_pct_source_unit -eq 'percent') 'source unit recorded per metric'
  Assert-True (-not $oldTs.comparable_window) 'same-day mislabeled 7d window is not comparable'
  Assert-True ($latestTs.comparable_window) 'genuine 7d window is comparable'
  Assert-True ($null -eq $json.trends.commits -and $null -eq $json.trends.loc_net) 'cross-window trend is skipped'

  $invalid = $template.Clone(); $invalid.metrics = @{ commits = 1; contributors = 1; feat_pct = 101 }
  ($invalid | ConvertTo-Json -Depth 8) | Set-Content (Join-Path $fixtureRoot 'invalid.json')
  $invalidOutput = & $scriptPath -RetroFile 'invalid.json' -Path $fixtureRoot | Out-String
  $invalidJson = $invalidOutput.Substring($invalidOutput.IndexOf('{')) | ConvertFrom-Json
  Assert-True ($null -eq $invalidJson.timeseries[0].feat_pct) 'impossible rate is not charted'
  Assert-True ($invalidJson.timeseries[0].rate_issue -eq 'rate outside 0..100 percent') 'impossible rate is flagged'
} finally {
  if (Test-Path $fixtureRoot) { Remove-Item -LiteralPath $fixtureRoot -Recurse -Force }
}

Write-Host 'All retro analyzer regression tests passed.' -ForegroundColor Green
