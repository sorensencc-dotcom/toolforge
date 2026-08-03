#!/usr/bin/env pwsh
<##
.SYNOPSIS
  Validate only retro JSON files changed by the current CI event.
##>

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$eventPath = $env:GITHUB_EVENT_PATH
$event = if ($eventPath -and (Test-Path $eventPath)) { Get-Content $eventPath -Raw | ConvertFrom-Json } else { $null }
$base = if ($event.pull_request.base.sha) { $event.pull_request.base.sha } elseif ($event.before) { $event.before } else { $null }
$head = if ($event.after) { $event.after } elseif ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { 'HEAD' }

if ($base -and $base -notmatch '^0+$') {
  $changed = @(git -C $repoRoot diff --name-only $base $head -- '.context/retros/*.json')
} else {
  $changed = @(git -C $repoRoot diff-tree --no-commit-id --name-only -r $head -- '.context/retros/*.json')
}

$changed = @($changed | Where-Object { $_ -and $_ -notmatch 'retro\.schema\.json$' })
if ($changed.Count -eq 0) {
  Write-Host 'No retro JSON files changed; changed-file gate passes.' -ForegroundColor Green
  exit 0
}

$validator = Join-Path $PSScriptRoot 'validate.ps1'
$failed = $false
foreach ($file in $changed) {
  Write-Host "Validating changed retro: $file" -ForegroundColor Cyan
  & $validator -RepoRoot $repoRoot -File $file
  if ($LASTEXITCODE -ne 0) { $failed = $true }
}
if ($failed) { exit 1 }
Write-Host "Changed retro gate passed: $($changed.Count) file(s)." -ForegroundColor Green
