# Retro JSON Schema Validator (Wrapper for Canonical v1.0)
# Validates .context/retros/*.json files against canonical v1.0 schema
# Used by pre-commit hook and CI to prevent invalid or non-canonical retro data

param(
    [switch]$Strict = $true,
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
    [string]$File = $null
)

$ErrorActionPreference = "Stop"
$retrosDir = Join-Path $RepoRoot ".context\retros"
$validatorV1 = Join-Path $retrosDir "validate-v1.0.ps1"

if (-not (Test-Path $retrosDir)) {
    Write-Host "No retros directory found at $retrosDir" -ForegroundColor Yellow
    exit 0
}

if (-not (Test-Path $validatorV1)) {
    Write-Error "Canonical validator script not found: $validatorV1"
    exit 1
}

$targetPath = if ($File) {
    if ([System.IO.Path]::IsPathRooted($File)) { $File } else { Join-Path $RepoRoot $File }
} else {
    $retrosDir
}

Write-Host "Running Canonical v1.0 Retro Schema Gate..." -ForegroundColor Cyan
& $validatorV1 -Path $targetPath
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "Retro validation failed canonical v1.0 gate!" -ForegroundColor Red
    exit $exitCode
}

Write-Host "Retro validation passed!" -ForegroundColor Green
exit 0
