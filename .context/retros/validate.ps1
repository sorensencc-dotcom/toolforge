# Retro JSON Schema Validator
# Validates all .context/retros/*.json files
# Core requirement: valid JSON + user field present
# Used by pre-commit hook to prevent invalid retro data from being committed

param(
    [switch]$Strict = $false,
    [string]$RepoRoot = "C:\dev",
    [int]$DaysOld = 7
)

$ErrorActionPreference = "SilentlyContinue"
$retrosDir = Join-Path $RepoRoot ".context\retros"

if (-not (Test-Path $retrosDir)) {
    Write-Host "No retros directory found" -ForegroundColor Yellow
    exit 0
}

$retroFiles = Get-ChildItem $retrosDir -Filter "*.json" | Where-Object { $_.Name -ne "retro.schema.json" }

if ($retroFiles.Count -eq 0) {
    Write-Host "No retro files to validate" -ForegroundColor Green
    exit 0
}

$failedFiles = @()
$validFiles = 0
$skippedFiles = 0
$cutoffDate = (Get-Date).AddDays(-$DaysOld)

foreach ($file in $retroFiles) {
    # Extract date from filename (YYYY-MM-DD-N.json)
    if ($file.BaseName -match '(\d{4}-\d{2}-\d{2})') {
        $fileDate = [datetime]::ParseExact($matches[1], 'yyyy-MM-dd', $null)
        # Skip old retros (before cutoff date) - only validate recent files
        if ($fileDate -lt $cutoffDate) {
            Write-Host "- $($file.Name) (historical, skipped)" -ForegroundColor Gray
            $skippedFiles++
            continue
        }
    }

    try {
        $content = Get-Content $file.FullName -Raw
        $json = $content | ConvertFrom-Json -ErrorAction Stop

        # Core validation: user field must exist and be non-empty
        if ($null -eq $json.user -or [string]::IsNullOrWhiteSpace($json.user)) {
            throw "Missing or empty required field: user"
        }

        $validFiles++
        Write-Host "✓ $($file.Name)" -ForegroundColor Green

    } catch {
        $failedFiles += @{
            file = $file.Name
            error = $_.Exception.Message
        }
        Write-Host "✗ $($file.Name)" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkRed
    }
}

Write-Host ""
Write-Host "Validation complete: $validFiles validated, $skippedFiles historical (skipped)" -ForegroundColor Cyan

if ($failedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed files:" -ForegroundColor Red
    foreach ($failed in $failedFiles) {
        Write-Host "  - $($failed.file): $($failed.error)" -ForegroundColor DarkRed
    }

    if ($Strict) {
        exit 1
    } else {
        Write-Host ""
        Write-Host "Note: Use -Strict flag to fail on validation errors" -ForegroundColor Yellow
        exit 0
    }
}

exit 0
