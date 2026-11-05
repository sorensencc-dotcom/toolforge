<#
.SYNOPSIS
    Tests the update.ps1 script of third-party-repo-auditor.
#>
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$updateScript = Join-Path (Split-Path -Parent $scriptDir) "src\update.ps1"

Write-Host "Running tests for third-party-repo-auditor (update.ps1)..." -ForegroundColor Cyan

# Test 1: JSON DryRun execution returns structured results without error
$rawJson = & pwsh -NoProfile -File $updateScript -DryRun -SkipFetch -Json
if ($LASTEXITCODE -ne 0) {
    Write-Error "Test 1 Failed: update.ps1 exited with non-zero exit code $LASTEXITCODE in DryRun mode"
    exit 1
}

$parsed = $rawJson | ConvertFrom-Json
$results = $parsed.UpdatedRepositories
if (-not $results -or $results.Count -eq 0) {
    Write-Error "Test 1 Failed: update.ps1 returned empty result set"
    exit 1
}
Write-Host "✓ Test 1 Passed: DryRun returned $($results.Count) repository status objects." -ForegroundColor Green

# Test 2: Output schema contains required telemetry fields
$first = $results[0]
$expectedFields = @("Repository", "Action", "Before", "After", "Behind", "Ahead", "Status")
foreach ($field in $expectedFields) {
    if (-not ($first.PSObject.Properties.Name -contains $field)) {
        Write-Error "Test 2 Failed: Result object missing expected property '$field'"
        exit 1
    }
}
Write-Host "✓ Test 2 Passed: Output schema contains all expected properties." -ForegroundColor Green

# Test 3: Parameter validation on missing path
$testDummyPath = "C:\dev\non-existent-repo-path-for-test-39281"
$dummyRaw = & pwsh -NoProfile -File $updateScript -Repositories @($testDummyPath) -DryRun -SkipFetch -Json
$dummyParsed = if ($dummyRaw) { $dummyRaw | ConvertFrom-Json } else { $null }
$dummyResults = if ($dummyParsed) { $dummyParsed.UpdatedRepositories } else { @() }
if ($dummyResults -and $dummyResults.Count -gt 0) {
    Write-Error "Test 3 Failed: Missing repo should return empty list"
    exit 1
}
Write-Host "✓ Test 3 Passed: Non-existent repositories are skipped cleanly." -ForegroundColor Green

Write-Host "`nAll update.ps1 tests PASSED successfully.`n" -ForegroundColor Green
exit 0
