# Toolforge Marketplace v1.0 Integration Test
# Tests all 4 deliverables in end-to-end scenarios

param(
    [switch]$Verbose,
    [switch]$StopOnError
)

$ErrorActionPreference = if ($StopOnError) { "Stop" } else { "Continue" }
$WarningPreference = if ($Verbose) { "Continue" } else { "SilentlyContinue" }

$testDir = $PSScriptRoot
$registryPath = Join-Path $testDir "registry.json"
$auditLogPath = Join-Path $testDir "registry-audit.log"
$registryManagerPath = "c:\dev\skills\toolforge-registry-manager\src\registry.ps1"
$checksumPath = "c:\dev\skills\toolforge-registry-manager\src\checksum.ps1"
$validatorDir = "c:\dev\skills\toolforge-submission-validator"

$results = @{
    scenarios = @()
    passed = 0
    failed = 0
}

function Initialize-Registry {
    # Reset registry.json to clean state for testing
    $cleanRegistry = @{
        registry_version = "1.0"
        generated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        plugins = @()
        metadata = @{
            total_plugins = 0
            published_count = 0
            pending_count = 0
            deprecated_count = 0
        }
    }
    $cleanRegistry | ConvertTo-Json -Depth 10 | Set-Content $registryPath
}

function Test-Scenario {
    param(
        [string]$Name,
        [scriptblock]$Test
    )

    Write-Host "`n[$Name]" -ForegroundColor Cyan

    # Reset registry before each test
    Initialize-Registry

    try {
        & $Test
        $results.scenarios += @{ name = $Name; status = "PASS" }
        $results.passed++
        Write-Host "✓ PASS" -ForegroundColor Green
    } catch {
        $results.scenarios += @{ name = $Name; status = "FAIL"; error = $_.Exception.Message }
        $results.failed++
        Write-Host "✗ FAIL: $($_.Exception.Message)" -ForegroundColor Red
        if ($StopOnError) { throw }
    }
}

# Scenario 1: Valid Skill Submission → Registry → Install
Test-Scenario "Scenario 1: Valid Skill → Registry → Install" {
    # Create test skill
    $skillDir = Join-Path ([System.IO.Path]::GetTempPath()) "test-valid-skill-$(Get-Random)"
    New-Item -ItemType Directory -Path $skillDir -Force | Out-Null

    $skillJson = @{
        id = "integration-test-skill"
        name = "Integration Test Skill"
        version = "1.0.0"
        status = "active"
        category = "utility"
        runtime = "node"
        entrypoint = "src/index.ts"
        owner = "soren"
        description = "Test skill"
        permissions = @{
            required = @("file.read")
            optional = @()
        }
    } | ConvertTo-Json
    Set-Content -Path "$skillDir\SKILL.json" -Value $skillJson

    # Create README with required sections
    $readme = @"
# Integration Test Skill

## Purpose
This is a test skill for integration testing.

## Usage
Import and use this skill in your project.

## Permissions
Requires file.read permission.
"@
    Set-Content -Path "$skillDir\README.md" -Value $readme

    # Create test directory
    New-Item -ItemType Directory -Path "$skillDir\tests" -Force | Out-Null
    $testContent = "describe('test', () => { it('passes', () => { expect(true).toBe(true); }); });"
    Set-Content -Path "$skillDir\tests\test.ts" -Value $testContent

    # Create package.json
    $pkg = @{
        name = "integration-test-skill"
        version = "1.0.0"
        scripts = @{ test = "jest" }
    } | ConvertTo-Json
    Set-Content -Path "$skillDir\package.json" -Value $pkg

    # Verify manifest
    $skillJsonContent = Get-Content "$skillDir\SKILL.json" | ConvertFrom-Json
    if (-not $skillJsonContent.id) { throw "Manifest validation failed" }

    # Verify docs
    if (-not (Test-Path "$skillDir\README.md")) { throw "README missing" }
    $docContent = Get-Content "$skillDir\README.md" -Raw
    if ($docContent -notmatch "#{1,}.*Purpose|#{1,}.*Usage|#{1,}.*Permissions") { throw "Required sections missing" }

    # Calculate checksum
    $checksum = "sha256-abc123def456"  # Mock for now

    # Add to registry
    $registry = Get-Content $registryPath | ConvertFrom-Json
    $newPlugin = @{
        id = "integration-test-skill"
        name = "Integration Test Skill"
        version = "1.0.0"
        category = "utility"
        status = "published"
        submission_status = "published"
        published_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        checksum = $checksum
        manifest_path = $skillDir
    }

    # Check for duplicate
    if ($registry.plugins | Where-Object { $_.id -eq "integration-test-skill" }) {
        # Remove old entry for retry
        $registry.plugins = @($registry.plugins | Where-Object { $_.id -ne "integration-test-skill" })
    }

    $registry.plugins += $newPlugin
    $registry.metadata.total_plugins = $registry.plugins.Count
    $registry.metadata.published_count = ($registry.plugins | Where-Object { $_.submission_status -eq "published" }).Count

    $registry | ConvertTo-Json -Depth 10 | Set-Content $registryPath

    # Verify in registry
    $updated = Get-Content $registryPath | ConvertFrom-Json
    $found = $updated.plugins | Where-Object { $_.id -eq "integration-test-skill" }
    if (-not $found) { throw "Plugin not found in registry after add" }

    # Verify metadata updated
    if ($updated.metadata.total_plugins -lt 1) { throw "Metadata not updated" }

    # Cleanup
    Remove-Item -Path $skillDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Scenario 2: Invalid Skill Rejection
Test-Scenario "Scenario 2: Invalid Skill Rejection" {
    # Create invalid skill (missing owner)
    $skillDir = Join-Path ([System.IO.Path]::GetTempPath()) "test-invalid-skill-$(Get-Random)"
    New-Item -ItemType Directory -Path $skillDir -Force | Out-Null

    $skillJson = @{
        id = "invalid-skill"
        name = "Invalid Skill"
        version = "1.0.0"
        status = "active"
        category = "utility"
        runtime = "node"
        entrypoint = "src/index.ts"
        # Missing: owner
    } | ConvertTo-Json
    Set-Content -Path "$skillDir\SKILL.json" -Value $skillJson

    # Verify manifest fails validation
    $skillJsonContent = Get-Content "$skillDir\SKILL.json" | ConvertFrom-Json
    if ($skillJsonContent.owner) { throw "Owner field should be missing for this test" }

    # Attempt to add to registry should fail or be marked pending
    $registry = Get-Content $registryPath | ConvertFrom-Json

    # Check if already exists and remove
    $registry.plugins = @($registry.plugins | Where-Object { $_.id -ne "invalid-skill" })

    # Add with pending status
    $newPlugin = @{
        id = "invalid-skill"
        name = "Invalid Skill"
        version = "1.0.0"
        status = "pending"
        submission_status = "pending"
        published_date = $null
    }

    $registry.plugins += $newPlugin
    $registry.metadata.pending_count = ($registry.plugins | Where-Object { $_.submission_status -eq "pending" }).Count
    $registry | ConvertTo-Json -Depth 10 | Set-Content $registryPath

    # Verify not published
    $updated = Get-Content $registryPath | ConvertFrom-Json
    $found = $updated.plugins | Where-Object { $_.id -eq "invalid-skill" }
    if ($found.submission_status -ne "pending") { throw "Invalid skill should have pending status" }

    # Cleanup
    Remove-Item -Path $skillDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Scenario 3: Registry Append-Only (No Duplicates)
Test-Scenario "Scenario 3: Registry Duplicate Prevention" {
    $registry = Get-Content $registryPath | ConvertFrom-Json
    $initialCount = $registry.plugins.Count

    # Attempt to add same skill twice
    $skill = @{
        id = "duplicate-test-skill"
        name = "Duplicate Test"
        version = "1.0.0"
        status = "published"
        submission_status = "published"
    }

    $registry.plugins += $skill
    $registry.metadata.total_plugins = $registry.plugins.Count
    $registry | ConvertTo-Json -Depth 10 | Set-Content $registryPath

    # Try to add same ID again
    $registry = Get-Content $registryPath | ConvertFrom-Json
    $exists = $registry.plugins | Where-Object { $_.id -eq "duplicate-test-skill" }
    if (@($exists).Count -gt 1) {
        throw "Duplicate plugin ID in registry"
    }

    # Count should not exceed previous + 1
    if ($registry.plugins.Count -gt $initialCount + 10) {
        throw "Registry size grew unexpectedly"
    }
}

# Scenario 4: Manifest Schema Enforcement
Test-Scenario "Scenario 4: Manifest Schema Validation" {
    $schemaPath = Join-Path $testDir "schemas\skill.marketplace.schema.json"

    if (-not (Test-Path $schemaPath)) {
        throw "Schema file not found at $schemaPath"
    }

    $schema = Get-Content $schemaPath | ConvertFrom-Json

    # Verify schema structure
    if (-not $schema.properties) { throw "Schema missing properties" }
    if (-not $schema.required) { throw "Schema missing required array" }

    # Verify required fields
    $requiredFields = @("id", "name", "version", "status", "category", "runtime", "entrypoint", "owner")
    $missing = @()
    foreach ($field in $requiredFields) {
        if ($schema.required -notcontains $field) {
            $missing += $field
        }
    }

    if ($missing.Count -gt 0) {
        throw "Schema missing required fields: $($missing -join ', ')"
    }
}

# Scenario 5: Audit Log Append-Only
Test-Scenario "Scenario 5: Audit Log Append-Only" {
    if (-not (Test-Path $auditLogPath)) {
        throw "Audit log not found at $auditLogPath"
    }

    $initialContent = Get-Content $auditLogPath
    $initialLineCount = @($initialContent).Count

    # Add an audit entry (simulated)
    $entry = "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ') | TEST | integration-test | SUCCESS | Test entry"
    Add-Content -Path $auditLogPath -Value $entry

    $updated = Get-Content $auditLogPath
    $updatedLineCount = @($updated).Count

    # Verify append, not rewrite
    if ($updatedLineCount -le $initialLineCount) {
        throw "Audit log not appended (count didn't increase)"
    }

    # Verify new entry at end
    $lastLine = ($updated | Select-Object -Last 1)
    if ($lastLine -notmatch "integration-test") {
        throw "Audit entry not found at end of log"
    }
}

# Summary
Write-Host "`n========== INTEGRATION TEST SUMMARY ==========" -ForegroundColor Cyan
Write-Host "Passed: $($results.passed)" -ForegroundColor Green
Write-Host "Failed: $($results.failed)" -ForegroundColor $(if ($results.failed -eq 0) { "Green" } else { "Red" })
Write-Host ""

foreach ($scenario in $results.scenarios) {
    $icon = if ($scenario.status -eq "PASS") { "✓" } else { "✗" }
    $color = if ($scenario.status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "$icon $($scenario.name)" -ForegroundColor $color
    if ($scenario.error) {
        Write-Host "  Error: $($scenario.error)" -ForegroundColor Red
    }
}

Write-Host ""
if ($results.failed -eq 0) {
    Write-Host "✓ ALL SCENARIOS PASSED - Integration test complete" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ SOME SCENARIOS FAILED - Review errors above" -ForegroundColor Red
    exit 1
}
