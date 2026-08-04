# TRM sync-treatment Daily Agent v1.2
# Runs a dry-run reconciliation across all TRM vault topics; if there's
# anything new (facts, skips, collisions), runs the real reconciliation
# per-topic and appends a summary to TODOS.md + a memory file.
#
# v1.1: stdout-substring detection ("new facts" / "skipped" / "factKey
# collision") was unreliable -- the CLI unconditionally prints a
# "new facts / skipped topics reported" line on every invocation, so those
# flags were always true and the no-op branch was dead code. Detection now
# parses the structured report file the CLI writes (YAML frontmatter +
# "Total new facts:" summary line) instead of matching human-readable stdout.
#
# v1.2: two fixes from final review.
# (1) Real reconciliation is now per-topic, not all-or-nothing. Previously
#     one colliding topic (e.g. benson-ford) blocked reconciliation of every
#     OTHER topic forever, even when those topics had zero collisions of
#     their own. Now each topic with new facts and no skip reason is run
#     individually via `sync-treatment <topic>`.
# (2) Native `node` invocations are wrapped so stderr output (which the CLI
#     writes on every factKey collision) doesn't throw a terminating error
#     under Windows PowerShell 5.1's stricter native-command handling.
#
# v1.3: exit-code semantics + log rotation from TODOS.md follow-ups.
# (1) trm's exit code 2 ("topics skipped") is now remapped to 0 for this
#     agent's own exit code. benson-ford's factKey collision is permanent, so
#     without this Task Scheduler's "Last Run Result" showed "failed" every
#     day forever regardless of whether the automation actually worked. Exit
#     1 (real agent-level failure) still propagates unchanged.
# (2) Logs older than 30 days are pruned at the top of each run.

param(
    [string]$VaultRoot = "C:\Users\soren\trm-vault",
    [string]$NarrativeRoot = "C:\dev\charlie-deep-research",
    [string]$TrmCli = "C:\dev\trm\dist\cli\index.js",
    [string]$TodosPath = "C:\dev\TODOS.md",
    [string]$MemoryDir = "C:\Users\soren\.claude\projects\c--dev\memory",
    [DateTime]$AgentStartTime = (Get-Date)
)

$ErrorActionPreference = "Stop"
# Engine-independent native stderr handling. Under pwsh 7.3+ (the registered
# scheduled-task engine as of v1.2) this disables the newer opt-in behavior
# where a native command's stderr write is treated as a terminating error.
# Under Windows PowerShell 5.1 this variable doesn't exist -- setting it is a
# harmless no-op there, so per-call scoping (below, around each `& node ...`
# call) is kept as belt-and-braces for that case.
$PSNativeCommandUseErrorActionPreference = $false
$dateStamp = $AgentStartTime.ToString("yyyy-MM-dd")
$logDir = "C:\dev\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logPath = Join-Path $logDir "trm-sync-treatment-$dateStamp.log"
$logRetentionDays = 30
Get-ChildItem -Path $logDir -Filter "trm-sync-treatment-*.log" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$logRetentionDays) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

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

    # Per-topic new-fact counts, parsed from the report's "## Summary" section
    # (fixed format from reportWriter.ts's buildSummarySection: "- <topic>: <N> new fact(s)").
    $topicNewFacts = @{}
    $topicNewFactsMatches = [regex]::Matches($ReportContent, '(?m)^- (.+): (\d+) new fact\(s\)$')
    foreach ($m in $topicNewFactsMatches) {
        $topicNewFacts[$m.Groups[1].Value] = [int]$m.Groups[2].Value
    }

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
        TopicNewFacts      = $topicNewFacts
    }
}

Write-Log "AGENT_STARTED|trm-sync-treatment-v1.2|$($AgentStartTime.ToString('yyyy-MM-dd HH:mm:ss'))"

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
    $ErrorActionPreference = 'Continue'
    $dryRunOutput = & node $TrmCli sync-treatment --narrative-root $NarrativeRoot --dry-run 2>&1
    $dryRunExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
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

    # Per-topic real reconciliation: run each topic that has new facts and is
    # not in topicsSkipped individually, so one colliding topic (e.g.
    # benson-ford) no longer blocks reconciliation of every other topic.
    $realRunResults = @()
    $topicsToRun = @($signals.TopicNewFacts.Keys | Where-Object {
        $signals.TopicNewFacts[$_] -gt 0 -and ($signals.TopicsSkipped -notcontains $_)
    })

    if ($topicsToRun.Count -gt 0) {
        Write-Log "Running real reconciliation per-topic for: $($topicsToRun -join ', ')"
        foreach ($topic in $topicsToRun) {
            Write-Log "Real run: topic '$topic'..."
            $ErrorActionPreference = 'Continue'
            $topicOutput = & node $TrmCli sync-treatment $topic --narrative-root $NarrativeRoot 2>&1
            $topicExit = $LASTEXITCODE
            $ErrorActionPreference = 'Stop'
            $topicOutput | ForEach-Object { Write-Log "  [$topic] $_" }
            $realRunResults += [PSCustomObject]@{ Topic = $topic; ExitCode = $topicExit; NewFacts = $signals.TopicNewFacts[$topic] }
            Write-Log "Real run complete for '$topic'. Exit code: $topicExit"
        }
    } else {
        Write-Log "No topics eligible for real reconciliation (no new facts, or all blocked by skip/collision)."
    }

    $rawExit = if ($realRunResults.Count -gt 0) {
        ($realRunResults | Measure-Object -Property ExitCode -Maximum).Maximum
    } else {
        $dryRunExit
    }
    # trm sync-treatment exit codes: 0 = clean, 2 = ran fine but topics were
    # skipped (collision / missing extract — known, expected states like
    # benson-ford's permanent collision), 1 = real agent-level failure (crash,
    # unhandled exception). Task Scheduler's health signal only means something
    # if exit 2 doesn't look identical to exit 1 every single day, so remap
    # "skips present, agent completed successfully" down to 0 and reserve
    # non-zero for actual failures.
    $realExit = if ($rawExit -eq 2) { 0 } else { $rawExit }
} finally {
    Pop-Location
}

# Build summary
$summaryLines = @()
$summaryLines += "### Automated TRM sync-treatment run: $dateStamp"
$summaryLines += ""
if ($hasCollisions) {
    # FactKeyCollisions counts topics-with-a-collision, not collision pairs --
    # derive the actual topic names from the skipped-topics detail so the
    # wording doesn't imply a pair count.
    $collisionTopicNames = @()
    foreach ($line in $signals.SkippedDetailLines) {
        $m = [regex]::Match($line, '`([^`]+)`:\s*(.+)$')
        if ($m.Success -and $m.Groups[2].Value -match 'factKey collision') {
            if ($collisionTopicNames -notcontains $m.Groups[1].Value) { $collisionTopicNames += $m.Groups[1].Value }
        }
    }
    $summaryLines += "- $($signals.FactKeyCollisions) topic(s) with factKey collisions (see report for pair detail): $($collisionTopicNames -join ', ')"
    $summaryLines += "  Report: $dryRunReportPath"
}
if ($hasSkips) {
    $summaryLines += "- Skipped topics:"
    if ($signals.SkippedDetailLines.Count -gt 0) {
        foreach ($s in $signals.SkippedDetailLines) {
            $trimmed = $s.Trim() -replace '^-\s*', ''
            $summaryLines += "  - $trimmed"
        }
    } else {
        foreach ($t in $signals.TopicsSkipped) { $summaryLines += "  - $t" }
    }
}
if ($realRunResults.Count -gt 0) {
    $summaryLines += "- New facts reconciled into treatment doc (real run committed), per topic:"
    foreach ($r in $realRunResults) {
        $status = if ($r.ExitCode -eq 0) { "ok" } else { "exit $($r.ExitCode)" }
        $summaryLines += "  - $($r.Topic): $($r.NewFacts) fact(s) ($status)"
    }
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
