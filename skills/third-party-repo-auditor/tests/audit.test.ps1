# Unit tests for third-party-repo-auditor

$scriptPath = Join-Path $PSScriptRoot "..\src\audit.ps1"
if (-not (Test-Path $scriptPath)) {
    throw "Audit script not found at: $scriptPath"
}

Write-Host "Running tests for third-party-repo-auditor..."

# Test 1: JSON output structure
$jsonOutput = & pwsh -NoProfile -File $scriptPath -Fetch:$false -Json | ConvertFrom-Json
if ($null -eq $jsonOutput.GitRepositories -or $jsonOutput.GitRepositories.Count -eq 0) {
    throw "Test 1 Failed: Expected non-empty GitRepositories array."
}
if ($null -eq $jsonOutput.DockerImages -or $jsonOutput.DockerImages.Count -eq 0) {
    throw "Test 1 Failed: Expected non-empty DockerImages array."
}
Write-Host "✓ Test 1 Passed: JSON output returned $($jsonOutput.GitRepositories.Count) Git repos and $($jsonOutput.DockerImages.Count) Docker images."

# Test 2: Field integrity on Git repos
$sample = $jsonOutput.GitRepositories[0]
$requiredFields = @("Repository", "Path", "Remote", "Branch", "Commit", "Status", "Behind", "Ahead", "DirtyFiles")
foreach ($field in $requiredFields) {
    if (-not ($sample.PSObject.Properties.Name -contains $field)) {
        throw "Test 2 Failed: Missing required field '$field' on audit result."
    }
}
Write-Host "✓ Test 2 Passed: Git output schema contains all required telemetry fields."

# Test 3: Field integrity on Docker images
$dockerSample = $jsonOutput.DockerImages[0]
$dockerFields = @("Image", "Type", "Status", "ImageID")
foreach ($field in $dockerFields) {
    if (-not ($dockerSample.PSObject.Properties.Name -contains $field)) {
        throw "Test 3 Failed: Missing required field '$field' on Docker image result."
    }
}
Write-Host "✓ Test 3 Passed: Docker output schema contains all required telemetry fields."

Write-Host "`nAll third-party-repo-auditor tests PASSED successfully."
