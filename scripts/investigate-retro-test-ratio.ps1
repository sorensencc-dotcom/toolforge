#!/usr/bin/env pwsh
<#
.SYNOPSIS
Explain a retro test-ratio value using commit-diff and repository-wide evidence.
#>

param(
  [Parameter(Mandatory = $true)][string]$RetroFile,
  [string]$RepoRoot = (Get-Location)
)

$retroPath = Join-Path $RepoRoot $RetroFile
if (-not (Test-Path $retroPath)) { throw "Retro file not found: $retroPath" }
$retro = Get-Content $retroPath -Raw | ConvertFrom-Json
$since = [DateTime]::Parse($retro.since).ToUniversalTime().ToString('o')
$until = [DateTime]::Parse($retro.until).ToUniversalTime().ToString('o')

$rows = @(git -C $RepoRoot log --numstat --format='COMMIT|%H|%s' --since=$since --until=$until)
$testInsertions = 0
$testDeletions = 0
$changedTestFiles = [System.Collections.Generic.HashSet[string]]::new()
$commitsWithTestChanges = [System.Collections.Generic.HashSet[string]]::new()
$currentCommit = $null
foreach ($row in $rows) {
  if ($row -like 'COMMIT|*') { $currentCommit = $row.Split('|')[1]; continue }
  if ($row -match '^(\d+)\s+(\d+)\s+(.+)$') {
    $insertions = [int]$Matches[1]
    $deletions = [int]$Matches[2]
    $path = $Matches[3]
    if ($path -match '(^|/)(test|tests|__tests__)(/|$)|\.test\.|\.spec\.') {
      $testInsertions += $insertions
      $testDeletions += $deletions
      [void]$changedTestFiles.Add($path)
      if ($currentCommit) { [void]$commitsWithTestChanges.Add($currentCommit) }
    }
  }
}

$testFiles = @(Get-ChildItem (Join-Path $RepoRoot 'src'), (Join-Path $RepoRoot 'tests'), (Join-Path $RepoRoot 'toolforge-pdf') -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '\.(test|spec)\.' })
$sourceFiles = @(Get-ChildItem (Join-Path $RepoRoot 'src') -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in '.js', '.mjs', '.ts', '.tsx' })

[pscustomobject]@{
  retro = $RetroFile
  window = @{ since = $retro.since; until = $retro.until }
  recorded_test_ratio_pct = $retro.metrics.test_ratio_pct
  changed_test_loc = @{ insertions = $testInsertions; deletions = $testDeletions }
  changed_test_files = $changedTestFiles.Count
  commits_with_test_changes = $commitsWithTestChanges.Count
  repository_test_files = $testFiles.Count
  repository_source_files = $sourceFiles.Count
  interpretation = 'Commit-diff test ratio measures inserted test LOC in the window; repository test-file count measures existing test surface. They are not interchangeable coverage metrics.'
} | ConvertTo-Json -Depth 5
