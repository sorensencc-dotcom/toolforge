# TRM sync-treatment Daily Agent v1.1
# Runs a dry-run reconciliation across all TRM vault topics; if there's
# anything new (facts, skips, collisions), commits the real run and appends
# a summary to TODOS.md + a memory file.
#
# v1.1: stdout-substring detection ("new facts" / "skipped" / "factKey
# collision") was unreliable -- the CLI unconditionally prints a
# "new facts / skipped topics reported" line on every invocation, so those
# flags were always true and the no-op branch was dead code. Detection now
# parses the structured report file the CLI writes (YAML frontmatter +
# "Total new facts:" summary line) instead of matching human-readable stdout.

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

# Parses a trm sync-treatment report file's contents into structured signals.
# Exposed as a standalone function so it can be exercised directly against
# synthetic report text (e.g. to verify the no-op branch) without needing a
# live CLI run that happens to produce zero activity.
function Get-SyncReportSignals {
    param([string]$ReportContent)

    $collisionsMatch = [regex]::Match($ReportContent, '(?m)^factKeyCollisions:\s*(\d+)\s*$')
    $collisionsCount = if ($collisionsMatch.Success) { [int]$collisionsMatch.Groups[1].Value } else { 0 }

    $skippedMatch = [regex]::Match($ReportContent, '(?m)^topicsSkipped:\s*(\[.*\])\s*$')
    $skippedTopics = @()
    if ($skippedMatch.Success) {
        try {
            $parsed = $skippedMatch.Groups[1].Value | ConvertFrom-Json
            if ($null -ne $parsed) {
                $skippedTopics = @($parsed)
            }
        } catch {
            Write-Log "WARN: failed to parse topicsSkipped JSON array: $($skippedMatch.Groups[1].Value)"
        }
    }

    $newFactsMatch = [regex]::Match($ReportContent, '(?m)^Total new facts:\s*(\d+)\s*$')
    $newFactsCount = if ($newFactsMatch.Success) { [int]$newFactsMatch.Groups[1].Value } else { 0 }

    # Optional detail: "## Skipped topics" body section has per-topic reasons.
    $skippedDetailLines = @()
    $skippedSectionMatch = [regex]::Match($ReportContent, '(?ms)^## Skipped topics\s*\r?\n\r?\n(.*?)(?:\r?\n\r?\n|\r?\n## |\z)')
    if ($skippedSectionMatch.Success) {
        $skippedDetailLines = $skippedSectionMatch.Groups[1].Value -split '\r?\n' | Where-Object { $_.Trim() -ne '' }
    }

    [PSCustomObject]@{
        FactKeyCollisions  = $collisionsCount
        HasCollisions      = $collisionsCount -gt 0
        TopicsSkipped      = $skippedTopics
        HasSkips           = $skippedTopics.Count -gt 0
        SkippedDetailLines = $skippedDetailLines
        NewFactsCount      = $newFactsCount
        HasNewFacts        = $newFactsCount -gt 0
    }
}

Write-Log "AGENT_STARTED|trm-sync-treatment-v1.1|$($AgentStartTime.ToString('yyyy-MM-dd HH:mm:ss'))"

if (-not (Test-Path $VaultRoot)) {
    Write-Log "ERROR: vault root not found at $VaultRoot"
    exit 1
}
if (-not (Test-Path $TrmCli)) {
    Write-Log "ERROR: trm CLI not built at $TrmCli (run 'npm run build' in C:\dev\trm)"
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Log "ERROR: 'node' not found on PATH. Cannot invoke trm CLI."
    exit 1
}

Push-Location $VaultRoot
try {
    Write-Log "Running dry-run reconciliation..."
    $dryRunOutput = & node $TrmCli sync-treatment --narrative-root $NarrativeRoot --dry-run 2>&1
    $dryRunExit = $LASTEXITCODE
    $dryRunOutput | ForEach-Object { Write-Log "  $_" }

    if (-not $dryRunOutput -or $dryRunOutput.Count -eq 0) {
        Write-Log "ERROR: dry-run produced no output; cannot locate report path."
        Pop-Location
        exit 1
    }

    $dryRunReportPath = ($dryRunOutput | Select-Object -First 1).ToString().Trim()
    if (-not (Test-Path $dryRunReportPath)) {
        Write-Log "ERROR: expected report file not found at parsed path: $dryRunReportPath"
        Pop-Location
        exit 1
    }

    $dryRunReportContent = Get-Content -Path $dryRunReportPath -Raw
    $signals = Get-SyncReportSignals -ReportContent $dryRunReportContent

    $hasNewFacts = $signals.HasNewFacts
    $hasCollisions = $signals.HasCollisions
    $hasSkips = $signals.HasSkips

    Write-Log "Parsed report ($dryRunReportPath): newFacts=$($signals.NewFactsCount) collisions=$($signals.FactKeyCollisions) skipped=$($signals.TopicsSkipped -join ',')"

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
    $summaryLines += "- factKey collisions found ($($signals.FactKeyCollisions)) — topic(s) skipped, needs manual review. See report: $dryRunReportPath"
}
if ($hasSkips) {
    $summaryLines += "- Skipped topics:"
    if ($signals.SkippedDetailLines.Count -gt 0) {
        foreach ($s in $signals.SkippedDetailLines) { $summaryLines += "  - $($s.Trim())" }
    } else {
        foreach ($t in $signals.TopicsSkipped) { $summaryLines += "  - $t" }
    }
}
if ($hasNewFacts -and -not $hasCollisions) {
    $summaryLines += "- New facts reconciled into treatment doc (real run committed): $($signals.NewFactsCount) fact(s)."
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
