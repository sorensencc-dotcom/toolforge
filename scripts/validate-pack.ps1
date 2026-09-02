[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Pack,

    [string]$CategoriesPath = "C:\dev\kb-sync\core\categories.json",
    [string]$RegistryPath = "C:\dev\notebooklm-registry.json"
)

$ErrorActionPreference = "Stop"

function Write-Success($msg) { Write-Host "✓ [VALIDATE-PACK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "✗ [VALIDATE-PACK] [ERROR] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  [VALIDATE-PACK] $msg" -ForegroundColor Cyan }

if (-not (Test-Path $Pack)) {
    Write-Fail "Pack file not found: $Pack"
    exit 1
}

$packItem = Get-Item $Pack
$packSize = $packItem.Length
if ($packSize -eq 0) {
    Write-Fail "Pack file is empty (0 bytes): $Pack"
    exit 1
}

$content = Get-Content -Path $Pack -Raw -Encoding utf8

# 1. Validate Header Structure
$packMatch = [regex]::Match($content, '# PACK:\s*([^\r\n]+)')
$statusMatch = [regex]::Match($content, '# STATUS:\s*([^\r\n]+)')
$targetMatch = [regex]::Match($content, '# TARGET_NOTEBOOK:\s*([^\r\n]+)')
$fileCountMatch = [regex]::Match($content, '# FILE_COUNT:\s*(\d+)')

if (-not $packMatch.Success) {
    Write-Fail "Missing '# PACK:' declaration in header."
    exit 1
}

$packName = $packMatch.Groups[1].Value.Trim()
$status = if ($statusMatch.Success) { $statusMatch.Groups[1].Value.Trim() } else { "unknown" }
$targetNotebook = if ($targetMatch.Success) { $targetMatch.Groups[1].Value.Trim() } else { "" }
$fileCount = if ($fileCountMatch.Success) { [int]$fileCountMatch.Groups[1].Value } else { 0 }

Write-Info "Pack Name:        $packName"
Write-Info "Status:           $status"
Write-Info "Target Notebook:  $targetNotebook"
Write-Info "Declared Files:   $fileCount"
Write-Info "Pack Size:        $(([math]::Round($packSize / 1024, 2))) KB"

# 2. Invariant Check: Reject unmapped placeholder packs
if ($status -eq "unmapped" -or $packName -like "placeholder::*") {
    Write-Fail "Pack is marked as unmapped placeholder ($packName). Operator override/mapping required before release."
    exit 1
}

# 3. Validate Provenance Blocks
$provenanceMatches = [regex]::Matches($content, '=== PROVENANCE ===')
if ($provenanceMatches.Count -eq 0) {
    Write-Fail "Pack contains zero '=== PROVENANCE ===' metadata blocks."
    exit 1
}

if ($fileCount -gt 0 -and $provenanceMatches.Count -ne $fileCount) {
    Write-Host "⚠ [VALIDATE-PACK] [WARN] Declared file count ($fileCount) differs from provenance block count ($($provenanceMatches.Count))." -ForegroundColor Yellow
}

# 4. Validate Target in Registry or Categories
$isValidTarget = $false
if (Test-Path $CategoriesPath) {
    $catJson = Get-Content -Path $CategoriesPath -Raw | ConvertFrom-Json
    foreach ($prop in $catJson.categories.PSObject.Properties) {
        if ($prop.Value.target -eq $targetNotebook) {
            $isValidTarget = $true
            break
        }
    }
}

if (-not $isValidTarget -and (Test-Path $RegistryPath)) {
    $regJson = Get-Content -Path $RegistryPath -Raw | ConvertFrom-Json
    foreach ($nb in $regJson.notebooks) {
        if ($nb.notebook_id -eq $targetNotebook) {
            $isValidTarget = $true
            break
        }
    }
}

if (-not $isValidTarget) {
    Write-Host "⚠ [VALIDATE-PACK] [WARN] Target Notebook UUID ($targetNotebook) not found in canonical categories or registry." -ForegroundColor Yellow
} else {
    Write-Success "Target Notebook UUID ($targetNotebook) verified against canonical registry."
}

# 5. Compute SHA-256 Hash
$sha256 = (Get-FileHash -Path $Pack -Algorithm SHA256).Hash
Write-Info "Pack SHA-256:     $sha256"

# 6. Log Validation Entry to Audit Trail
$logPath = "C:\dev\wiki\Log.md"
if (Test-Path $logPath) {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $logEntry = "`n- [$timestamp] VALIDATE-PACK: Verified $Pack (Pack: $packName, Items: $($provenanceMatches.Count), SHA256: $sha256, Target: $targetNotebook)."
    Add-Content -Path $logPath -Value $logEntry -Encoding utf8
    Write-Success "Appended validation record to wiki/Log.md"
}

Write-Success "Pack verification passed successfully."
exit 0
