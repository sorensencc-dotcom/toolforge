[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Write-Step($title) { Write-Host "`n=== [TEST SUITE] $title ===" -ForegroundColor Cyan }
function Write-Pass($msg) { Write-Host "  ✔ [PASS] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  ✗ [FAIL] $msg" -ForegroundColor Red; exit 1 }

Write-Step "1. Category Registry Invariant Validation"
$catFile = "C:\dev\kb-sync\core\categories.json"
if (-not (Test-Path $catFile)) { Write-Fail "Missing categories.json" }
$catData = Get-Content -Path $catFile -Raw | ConvertFrom-Json
if ($catData.version -ne "2026-08-29-1") { Write-Fail "Invalid categories.json version: $($catData.version)" }
if (-not $catData.categories."cuban-seizures") { Write-Fail "cuban-seizures category not found in categories.json" }
Write-Pass "categories.json conforms to schema version 2026-08-29-1 with cuban-seizures target."

Write-Step "2. Topic Triage Lifecycle Test Harness"
$triageOutput = node C:\dev\scripts\triage-topics.mjs --test-lifecycle
if ($LASTEXITCODE -ne 0) { Write-Fail "Topic triage lifecycle test failed." }
Write-Pass "Topic triage lifecycle self-test passed cleanly."

Write-Step "3. Multi-Modal Property Record Extraction"
$extractOutput = node C:\dev\scripts\extract-property-records.mjs
if ($LASTEXITCODE -ne 0) { Write-Fail "Property extraction failed." }
$propDir = "C:\dev\wiki\research\properties"
$propFiles = Get-ChildItem -Path $propDir -Filter "*.md" | Where-Object { $_.Name -ne "_errors.md" }
if ($propFiles.Count -eq 0) { Write-Fail "No property profiles generated in $propDir" }
Write-Pass "Property extraction emitted $($propFiles.Count) standardized property profiles."

Write-Step "4. Automated Deep Web Harvester & Idempotency"
$harvestRun1 = (node C:\dev\scripts\trm-web-harvester.mjs --category cuban-seizures) -join "`n"
if ($LASTEXITCODE -ne 0) { Write-Fail "Harvester initial run failed." }
$harvestRun2 = (node C:\dev\scripts\trm-web-harvester.mjs --category cuban-seizures) -join "`n"
if ($harvestRun2 -notmatch "0 processed, 2 skipped") { Write-Fail "Harvester idempotency test failed." }
Write-Pass "Deep web harvester successfully executed and verified idempotency on re-run."

Write-Step "5. Thematic Pack Consolidation"
$consolidateOutput = node C:\dev\scripts\consolidate-pack.mjs
if ($LASTEXITCODE -ne 0) { Write-Fail "Consolidation failed." }
$packFile = "C:\dev\.nlm_pack\pack_cuban_seizures.txt"
if (-not (Test-Path $packFile)) { Write-Fail "Missing pack_cuban_seizures.txt" }
Write-Pass "Thematic consolidation emitted self-describing packs into .nlm_pack/"

Write-Step "6. Pack Validation Suite"
pwsh -NoProfile -File C:\dev\scripts\validate-pack.ps1 -Pack $packFile
if ($LASTEXITCODE -ne 0) { Write-Fail "Pack validation failed for $packFile" }
Write-Pass "Pack validation passed for pack_cuban_seizures.txt"

Write-Step "7. Negative Validation: Placeholder Rejection"
$placeholderPack = Get-ChildItem -Path "C:\dev\.nlm_pack" -Filter "pack_placeholder_*.txt" | Select-Object -First 1
if ($placeholderPack) {
    $out = & pwsh -NoProfile -File C:\dev\scripts\validate-pack.ps1 -Pack $placeholderPack.FullName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Pass "Negative test verified: Placeholder pack ($($placeholderPack.Name)) was correctly rejected."
    } else {
        Write-Fail "Placeholder pack was unexpectedly accepted."
    }
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "🎉 ALL RESEARCH AUTOMATION SUITE TESTS PASSED (100% INVARIANT CONFORMANCE)" -ForegroundColor Green
Write-Host "======================================================================`n" -ForegroundColor Green
exit 0
