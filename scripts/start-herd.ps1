# scripts/start-herd.ps1
param (
    [string]$ProfileName = "claude-code",
    [switch]$SkipConnectorCheck,
    [switch]$VerifySchema
)

$ErrorActionPreference = "Stop"

Write-Host "=== Herdr + Toolforge + Sigil Fleet Launcher ===" -ForegroundColor Cyan

# 1. Schema Validation Pre-check
if ($VerifySchema) {
    Write-Host "[PREFLIGHT] Validating Toolforge manifest schema..." -ForegroundColor Cyan
    $schemaCheck = node --test tests/schema-validator.test.mjs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Schema validation failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Schema validation passed." -ForegroundColor Green
}

# 2. Check Sigil Connector
$connectorUrl = $env:SIGIL_CONNECTOR_URL
if (-not $connectorUrl) {
    $connectorUrl = "http://127.0.0.1:8787"
    $env:SIGIL_CONNECTOR_URL = $connectorUrl
}

if (-not $SkipConnectorCheck) {
    try {
        $response = Invoke-WebRequest -Uri "$connectorUrl/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "[OK] Sigil connector is online at $connectorUrl" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Sigil connector not responding on $connectorUrl. Running in local guard mode." -ForegroundColor Yellow
    }
}

# 3. Verify Toolforge Manifest
$manifestPath = Join-Path (Get-Location) "manifest.json"
if (Test-Path $manifestPath) {
    Write-Host "[OK] Toolforge global registry verified at $manifestPath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Toolforge registry not found at $manifestPath" -ForegroundColor Red
    exit 1
}

# 4. Check Herdr Server Port (8792)
$herdrPort = 8792
$portActive = Get-NetTCPConnection -LocalPort $herdrPort -State Listen -ErrorAction SilentlyContinue

if ($portActive) {
    Write-Host "[OK] Herdr daemon is already listening on port $herdrPort." -ForegroundColor Green
} else {
    Write-Host "[INFO] Herdr daemon not detected on port $herdrPort. Ready to spawn." -ForegroundColor Cyan
}

Write-Host "Fleet environment initialized for profile: $ProfileName" -ForegroundColor Green
