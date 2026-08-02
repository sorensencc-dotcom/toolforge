# TRM sync-treatment Daily Agent v1.0
# Runs a dry-run reconciliation across all TRM vault topics; if there's
# anything new (facts, skips, collisions), commits the real run and appends
# a summary to TODOS.md + a memory file.

param(
    [string]$VaultRoot = "C:\Users\soren\trm-vault",
    [string]$NarrativeRoot = "C:\dev\charlie-deep-research",
    [string]$TrmCli = "C:\dev\trm\dist\cli\index.js",
    [string]$TodosPath = "C:\dev\TODOS.md",
    [string]$MemoryDir = "C:\Users\soren\.claude\projects\c--dev\memory",
    [DateTime]$AgentStartTime = (Get-Date)
)

$ErrorActionPreference = "Stop"
$dateStamp = $AgentStartTime.ToString("yyyy-MM-dd")
$logDir = "C:\dev\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logPath = Join-Path $logDir "trm-sync-treatment-$dateStamp.log"

function Write-Log {
    param([string]$Message)
    $line = "[$((Get-Date).ToString('HH:mm:ss'))] $Message"
    Write-Host $line
    Add-Content -Path $logPath -Value $line
}

Write-Log "AGENT_STARTED|trm-sync-treatment-v1.0|$($AgentStartTime.ToString('yyyy-MM-dd HH:mm:ss'))"

if (-not (Test-Path $VaultRoot)) {
    Write-Log "ERROR: vault root not found at $VaultRoot"
    exit 1
}
if (-not (Test-Path $TrmCli)) {
    Write-Log "ERROR: trm CLI not built at $TrmCli (run 'npm run build' in C:\dev\trm)"
    exit 1
}

Push-Location $VaultRoot
try {
    Write-Log "Running dry-run reconciliation..."
    $dryRunOutput = & node $TrmCli sync-treatment --narrative-root $NarrativeRoot --dry-run 2>&1
    $dryRunExit = $LASTEXITCODE
    $dryRunOutput | ForEach-Object { Write-Log "  $_" }

    $hasNewFacts = $dryRunOutput -join "`n" -match "new facts"
    $hasCollisions = ($dryRunOutput | Select-String "factKey collision").Count -gt 0
    $hasSkips = $dryRunOutput -join "`n" -match "skipped"

    if (-not $hasNewFacts -and -not $hasCollisions -and -not $hasSkips) {
        Write-Log "No new facts, collisions, or skips. Nothing to report. Exiting cleanly."
        Pop-Location
        exit 0
    }

    $realExit = $dryRunExit
    if ($hasNewFacts -and -not $hasCollisions) {
        Write-Log "New facts found, no collisions. Running real reconciliation..."
        $realOutput = & node $TrmCli sync-treatment --narrative-root $NarrativeRoot 2>&1
        $realExit = $LASTEXITCODE
        $realOutput | ForEach-Object { Write-Log "  $_" }
    } else {
        Write-Log "Collisions present or no new facts — skipping real run, dry-run report stands."
    }
} finally {
    Pop-Location
}

# Build summary
$summaryLines = @()
$summaryLines += "### Automated TRM sync-treatment run: $dateStamp"
$summaryLines += ""
if ($hasCollisions) {
    $collisionLines = $dryRunOutput | Select-String "factKey collision"
    $summaryLines += "- factKey collisions found (topic skipped, needs manual review):"
    foreach ($c in $collisionLines) { $summaryLines += "  - $($c.Line.Trim())" }
}
if ($hasSkips) {
    $skipLines = $dryRunOutput | Select-String "skipped"
    $summaryLines += "- Skipped topics:"
    foreach ($s in $skipLines) { $summaryLines += "  - $($s.Line.Trim())" }
}
if ($hasNewFacts -and -not $hasCollisions) {
    $summaryLines += "- New facts reconciled into treatment doc (real run committed)."
}
$summaryLines += ""
$summary = $summaryLines -join "`n"

# Append to TODOS.md under a dedicated section (create the section if absent)
$todosContent = Get-Content -Path $TodosPath -Raw
$sectionHeader = "## Automated: TRM sync-treatment"
if ($todosContent -notmatch [regex]::Escape($sectionHeader)) {
    Add-Content -Path $TodosPath -Value "`n$sectionHeader`n"
}
Add-Content -Path $TodosPath -Value $summary
Write-Log "Appended summary to $TodosPath"

# Write memory file
if (-not (Test-Path $MemoryDir)) { New-Item -ItemType Directory -Path $MemoryDir -Force | Out-Null }
$memoryPath = Join-Path $MemoryDir "session-wrap-$dateStamp-trm-sync-treatment-auto.md"
$memoryContent = @"
---
name: session-wrap-$dateStamp-trm-sync-treatment-auto
description: "Automated daily trm sync-treatment run: $dateStamp"
metadata:
  type: project
---

Automated run of ``trm sync-treatment`` against $VaultRoot -> $NarrativeRoot.

$summary
"@
Set-Content -Path $memoryPath -Value $memoryContent -Encoding UTF8
Write-Log "Wrote memory file: $memoryPath"

Write-Log "trm-sync-treatment-agent complete. Exit code: $realExit"
exit $realExit
