# Unit tests for third-party-repo-auditor

$scriptPath = Join-Path $PSScriptRoot "..\src\audit.ps1"
if (-not (Test-Path $scriptPath)) {
    throw "Audit script not found at: $scriptPath"
}

Write-Host "Running tests for third-party-repo-auditor..."

# Test 1: JSON output structure
$jsonOutput = & pwsh -NoProfile -File $scriptPath -Fetch:$false -Json | ConvertFrom-Json
if ($null -eq $jsonOutput -or $jsonOutput.Count -eq 0) {
    throw "Test 1 Failed: Expected non-empty JSON array of audited repositories."
}
Write-Host "✓ Test 1 Passed: JSON output returned $($jsonOutput.Count) repository records."

# Test 2: Field integrity
$sample = $jsonOutput[0]
$requiredFields = @("Repository", "Path", "Remote", "Branch", "Commit", "Status", "Behind", "Ahead", "DirtyFiles")
foreach ($field in $requiredFields) {
    if (-not ($sample.PSObject.Properties.Name -contains $field)) {
        throw "Test 2 Failed: Missing required field '$field' on audit result."
    }
}
Write-Host "✓ Test 2 Passed: Output schema contains all required telemetry fields."

# Test 3: Specific repository filter
$singleRepo = & pwsh -NoProfile -File $scriptPath -Repositories @("C:\dev\dev-sandbox\open-notebook") -Fetch:$false -Json | ConvertFrom-Json
if ($singleRepo.Count -ne 1 -or $singleRepo[0].Repository -ne "open-notebook") {
    throw "Test 3 Failed: Filtered repository run did not return single open-notebook record."
}
Write-Host "✓ Test 3 Passed: Repository filtering works as expected."

Write-Host "`nAll third-party-repo-auditor tests PASSED successfully."
