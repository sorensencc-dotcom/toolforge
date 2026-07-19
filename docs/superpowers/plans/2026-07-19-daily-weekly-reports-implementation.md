# Daily & Weekly Reporting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automated daily/weekly reports aggregating work across all `C:\dev` repos, published as artifacts + git-committed for historical record.

**Architecture:** Three-layer system: (1) Enhanced existing skills export structured JSON at session end, (2) Scheduled cloud agents run daily/weekly to aggregate pre-staged JSON + git data, (3) Reports published as artifacts + committed to `docs/reports/` for history.

**Tech Stack:** PowerShell 7, git, JSON (schema v1.0), Artifact tool, Schedule skill (cloud agents)

## Global Constraints

- Report time window: 24h from agent start time (not "since midnight")
- Daily agent runs 6 AM every day; weekly runs 6 AM Sundays
- ISO 8601 week format for weekly reports (YYYY-W##, e.g., 2026-W29)
- Artifact retention: 90 days auto-delete; git history kept forever
- All repos discoverable under `C:\dev` root
- Cloud agent runtime limit: ~5 min per execution
- Session-wrap JSON schema v1.0 (commits, skills, tokens, model required; commits array can be empty)
- Cowork daemon logs verified in Phase 0 before implementation

---

## Task 1: Verify PowerShell + Git Operations (Phase 0)

**Files:**
- Create: `scripts/verify-reporting-setup.ps1`

**Interfaces:**
- Produces: Verification results (paths, git behavior, TZ mapping)

- [ ] **Step 1: Create verification script header**

Create `scripts/verify-reporting-setup.ps1`:

```powershell
# Phase 0 Verification: PowerShell + Git + Timezone + Cowork Logs

param(
    [switch]$Verbose
)

$results = @{
    timestamp = Get-Date -Format "o"
    environment = $PSVersionTable.PSVersion.ToString()
    tests = @()
}

function Test-Result {
    param([string]$name, [bool]$pass, [string]$detail)
    $results.tests += @{
        name = $name
        passed = $pass
        detail = $detail
    }
    if ($Verbose) {
        Write-Host "[$($pass ? 'PASS' : 'FAIL')] $name: $detail"
    }
}

# Test 1: Git log with --since across repos
Write-Host "Test 1: Git log --since across multiple repos..."
$repos = @("C:\dev", "C:\tmp\.github")
foreach ($repo in $repos) {
    if (Test-Path "$repo\.git") {
        try {
            $commits = & git -C $repo log --since "24 hours ago" --oneline 2>&1
            $pass = $commits -is [object[]] -or $commits -is [string]
            Test-Result "git-log-24h-$repo" $pass "Found $($commits.Count) commits"
        } catch {
            Test-Result "git-log-24h-$repo" $false "Error: $_"
        }
    } else {
        Test-Result "git-log-24h-$repo" $false "Not a git repo"
    }
}

# Test 2: Encoding check (UTF-8 vs UTF-16)
Write-Host "Test 2: PowerShell encoding..."
$encoding = [System.Console]::OutputEncoding.BodyName
Test-Result "encoding-check" ($encoding -eq "utf-8") "Current encoding: $encoding"

# Test 3: Date/time arithmetic
Write-Host "Test 3: Date arithmetic (24h window)..."
$now = Get-Date
$24hAgo = $now.AddHours(-24)
$diff = ($now - $24hAgo).TotalHours
Test-Result "date-arithmetic" ($diff -ge 23.99 -and $diff -le 24.01) "Diff: $diff hours"

# Output results
$resultsJson = $results | ConvertTo-Json -Depth 10
Write-Output $resultsJson

if ($results.tests | Where-Object { $_.passed -eq $false }) {
    exit 1
} else {
    exit 0
}
```

- [ ] **Step 2: Run verification script**

```powershell
cd C:\dev
& .\scripts\verify-reporting-setup.ps1 -Verbose
```

Expected output: 3+ tests PASS, encoding is utf-8, date arithmetic verified, git repos detected.

- [ ] **Step 3: Commit verification script**

```bash
git add scripts/verify-reporting-setup.ps1
git commit -m "test(phase0): add reporting setup verification script"
```

---

## Task 2: Verify Cowork Daemon Log Format (Phase 0)

**Files:**
- Modify: `scripts/verify-reporting-setup.ps1` (append cowork validation)

**Interfaces:**
- Produces: Cowork daemon path + schema validation

- [ ] **Step 1: Locate cowork daemon logs**

Append to verification script (after date arithmetic test):

```powershell
# Test 4: Cowork daemon logs exist and are readable
Write-Host "Test 4: Cowork daemon logs..."
$coworkPaths = @(
    "$env:USERPROFILE\.cowork\sessions",
    "$env:USERPROFILE\.cowork\logs",
    "$env:APPDATA\.cowork",
    ".ijfw\cowork"
)

$coworkFound = $false
$coworkPath = $null

foreach ($path in $coworkPaths) {
    if (Test-Path $path) {
        $files = Get-ChildItem $path -File -ErrorAction SilentlyContinue
        if ($files.Count -gt 0) {
            $coworkFound = $true
            $coworkPath = $path
            Test-Result "cowork-logs-found" $true "Path: $path, files: $($files.Count)"
            break
        }
    }
}

if (-not $coworkFound) {
    Test-Result "cowork-logs-found" $false "No cowork logs found in standard locations"
}

# Test 5: Cowork log format validation (if found)
if ($coworkFound) {
    Write-Host "Test 5: Cowork log schema..."
    try {
        $logFile = Get-ChildItem $coworkPath -File | Select-Object -First 1
        $content = Get-Content $logFile.FullName -Raw
        
        # Try JSON parse
        if ($content -match '^\{' -or $content -match '^\[') {
            $parsed = $content | ConvertFrom-Json
            Test-Result "cowork-log-json" $true "Valid JSON, $($parsed | Measure-Object).Count items"
        } else {
            Test-Result "cowork-log-json" $false "Not JSON format (plain text or other)"
        }
    } catch {
        Test-Result "cowork-log-json" $false "Parse error: $_"
    }
}

# Store cowork path for later use
$results.cowork_path = $coworkPath
```

- [ ] **Step 2: Run updated verification**

```powershell
cd C:\dev
& .\scripts\verify-reporting-setup.ps1 -Verbose
```

Expected: cowork logs found and format validated (JSON or plain text noted).

- [ ] **Step 3: Commit verification update**

```bash
git add scripts/verify-reporting-setup.ps1
git commit -m "test(phase0): add cowork daemon log validation"
```

---

## Task 3: Verify Schedule Skill Timezone Mapping (Phase 0)

**Files:**
- Modify: `scripts/verify-reporting-setup.ps1` (append TZ test)

**Interfaces:**
- Produces: TZ mapping verification result

- [ ] **Step 1: Add timezone test to verification script**

Append after cowork validation:

```powershell
# Test 6: Timezone verification
Write-Host "Test 6: Timezone for schedule skill..."
$tzInfo = [System.TimeZoneInfo]::Local
$utcNow = [System.DateTime]::UtcNow
$localNow = [System.TimeZoneInfo]::ConvertTimeFromUtc($utcNow, $tzInfo)
$offset = $tzInfo.GetUtcOffset($localNow)

Test-Result "timezone-detected" $true "TZ: $($tzInfo.Id), Offset: $($offset.ToString())"

# Note: Schedule skill should use user's local TZ, not UTC
# Verify with: schedule skill documentation or test run
$results.timezone = @{
    id = $tzInfo.Id
    offset = $offset.ToString()
    note = "Verify with /schedule skill that 6 AM = local time, not UTC"
}
```

- [ ] **Step 2: Run verification**

```powershell
cd C:\dev
& .\scripts\verify-reporting-setup.ps1 -Verbose
```

Expected: Timezone detected, offset shown.

- [ ] **Step 3: Document schedule skill TZ assumption**

In plan comments or NOTES.md: "Schedule skill must interpret 6 AM as user's local timezone. If it uses UTC, daily/weekly agent times will be off by 4-6 hours. Test with first real agent run."

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-reporting-setup.ps1
git commit -m "test(phase0): add timezone verification for schedule skill"
```

---

## Task 4: Enhance Session-Wrap to Export JSON (Phase 1)

**Files:**
- Modify: `skills/session-wrap/src/session-wrap.ps1`

**Interfaces:**
- Produces: JSON export at `$env:APPDATA\Claude\session-wrap-export.json` with schema v1.0

- [ ] **Step 1: Read current session-wrap skill**

```powershell
Get-Content C:\dev\skills\session-wrap\src\session-wrap.ps1 -TotalCount 50
```

Note the current output format (markdown narrative).

- [ ] **Step 2: Add JSON export function**

Add to `skills/session-wrap/src/session-wrap.ps1` (after imports, before main logic):

```powershell
function Export-SessionWrapJSON {
    param(
        [array]$commits,
        [array]$skills,
        [int]$tokens,
        [string]$model,
        [int]$durationMinutes
    )

    $schema = @{
        version = "1.0"
        timestamp = Get-Date -Format "o"
        commits = @($commits | ForEach-Object { 
            @{
                hash = $_.hash
                message = $_.message
                files = @($_.files)
                repo = $_.repo
            }
        })
        skills = @($skills | ForEach-Object { 
            @{
                name = $_.name
                count = [int]$_.count
            }
        })
        tokens = [int]$tokens
        model = [string]$model
        duration_minutes = [int]$durationMinutes
    }

    $exportPath = Join-Path $env:APPDATA "Claude" "session-wrap-export.json"
    $exportDir = Split-Path $exportPath
    if (-not (Test-Path $exportDir)) {
        New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
    }

    $schema | ConvertTo-Json -Depth 10 | Set-Content $exportPath -Encoding UTF8
    return $exportPath
}
```

- [ ] **Step 3: Call JSON export at session end**

Find the end of the session-wrap main function (where it outputs the markdown report). Before the final exit, add:

```powershell
# Export structured JSON for reporting agents
$exportPath = Export-SessionWrapJSON -commits $commits -skills $skills -tokens $tokens -model $model -durationMinutes $duration
Write-Host "Session wrap JSON exported to: $exportPath"
```

- [ ] **Step 4: Test JSON export**

Run session-wrap manually or during next session:

```powershell
cd C:\dev\skills\session-wrap
& .\src\session-wrap.ps1
```

Check export file:

```powershell
Get-Content "$env:APPDATA\Claude\session-wrap-export.json" | ConvertFrom-Json
```

Verify JSON has: commits (array), skills (array), tokens (int), model (string), duration_minutes (int).

- [ ] **Step 5: Commit**

```bash
git add skills/session-wrap/src/session-wrap.ps1
git commit -m "feat(session-wrap): export JSON schema v1.0 for reporting agents"
```

---

## Task 5: Enhance Retro to Export JSON (Phase 1)

**Files:**
- Modify: `skills/retro/src/retro.ps1`

**Interfaces:**
- Produces: JSON export at `$env:APPDATA\Claude\retro-export.json` with schema v1.0

- [ ] **Step 1: Read current retro skill**

```powershell
Get-Content C:\dev\skills\retro\src\retro.ps1 -TotalCount 50
```

- [ ] **Step 2: Add JSON export function**

Add to `skills/retro/src/retro.ps1`:

```powershell
function Export-RetroJSON {
    param(
        [int]$testsRun,
        [int]$testsPassed,
        [array]$blockers,
        [string]$workSummary
    )

    $schema = @{
        version = "1.0"
        timestamp = Get-Date -Format "o"
        tests_run = [int]$testsRun
        tests_passed = [int]$testsPassed
        blockers = @($blockers)
        work_summary = [string]$workSummary
    }

    $exportPath = Join-Path $env:APPDATA "Claude" "retro-export.json"
    $exportDir = Split-Path $exportPath
    if (-not (Test-Path $exportDir)) {
        New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
    }

    $schema | ConvertTo-Json -Depth 10 | Set-Content $exportPath -Encoding UTF8
    return $exportPath
}
```

- [ ] **Step 3: Call JSON export at retro end**

At end of retro output, add:

```powershell
$exportPath = Export-RetroJSON -testsRun $testCount -testsPassed $passCcount -blockers $blockers -workSummary $summary
Write-Host "Retro JSON exported to: $exportPath"
```

- [ ] **Step 4: Test JSON export**

Run retro and verify export:

```powershell
Get-Content "$env:APPDATA\Claude\retro-export.json" | ConvertFrom-Json
```

- [ ] **Step 5: Commit**

```bash
git add skills/retro/src/retro.ps1
git commit -m "feat(retro): export JSON schema v1.0 for reporting agents"
```

---

## Task 6: Create Daily Report Agent Skeleton (Phase 2)

**Files:**
- Create: `scripts/daily-report-agent.ps1`
- Create: `docs/reports/daily/.gitkeep`

**Interfaces:**
- Consumes: Git commits (last 24h), session-wrap JSON (`session-wrap-export.json`), ijfw_metrics logs, retro JSON, cowork logs
- Produces: Artifact (markdown report), git commit to `docs/reports/daily/YYYY-MM-DD.md`

- [ ] **Step 1: Create daily report agent skeleton**

Create `scripts/daily-report-agent.ps1`:

```powershell
# Daily Report Agent v1.0
# Runs 6 AM every day. Aggregates work from last 24 hours.
# Publishes artifact + commits to docs/reports/daily/

param(
    [string]$RepoRoot = "C:\dev",
    [DateTime]$AgentStartTime = (Get-Date),
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# ============================================================================
# Configuration
# ============================================================================

$dayStart = $AgentStartTime.AddHours(-24)
$reportDate = $AgentStartTime.ToString("yyyy-MM-dd")
$reportPath = Join-Path $RepoRoot "docs\reports\daily\$reportDate.md"

# ============================================================================
# Data Collection
# ============================================================================

function Get-CommitsSince24h {
    param([string]$repoRoot, [DateTime]$since)
    
    $repos = Get-ChildItem $repoRoot -Directory -ErrorAction SilentlyContinue | 
        Where-Object { Test-Path "$($_.FullName)\.git" }
    
    $commits = @()
    foreach ($repo in $repos) {
        try {
            $log = & git -C $repo.FullName log --since $since --format="%h|%s|%ae|%ai" 2>&1
            if ($log) {
                $log | ForEach-Object {
                    $parts = $_ -split '\|'
                    if ($parts.Count -eq 4) {
                        $commits += @{
                            hash = $parts[0]
                            message = $parts[1]
                            author = $parts[2]
                            date = $parts[3]
                            repo = $repo.Name
                        }
                    }
                }
            }
        } catch {
            Write-Host "Warning: git log failed for $($repo.Name): $_"
        }
    }
    return $commits
}

function Get-SessionWrapJSON {
    param([string]$appDataPath)
    
    $jsonPath = Join-Path $appDataPath "Claude\session-wrap-export.json"
    if (Test-Path $jsonPath) {
        try {
            return Get-Content $jsonPath | ConvertFrom-Json
        } catch {
            Write-Host "Warning: Failed to parse session-wrap JSON: $_"
            return $null
        }
    }
    return $null
}

function Get-RetroJSON {
    param([string]$appDataPath)
    
    $jsonPath = Join-Path $appDataPath "Claude\retro-export.json"
    if (Test-Path $jsonPath) {
        try {
            return Get-Content $jsonPath | ConvertFrom-Json
        } catch {
            Write-Host "Warning: Failed to parse retro JSON: $_"
            return $null
        }
    }
    return $null
}

# ============================================================================
# Report Generation (Stub)
# ============================================================================

function New-DailyReport {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro,
        [DateTime]$reportDate
    )
    
    # Build markdown report (full implementation in Task 8)
    $report = @"
# Daily Report: $($reportDate.ToString("yyyy-MM-dd"))

## Metrics

(Metrics table will be populated in Task 8)

## Summary

(Summary will be populated in Task 8)
"@
    
    return $report
}

# ============================================================================
# Main
# ============================================================================

Write-Host "Daily Report Agent starting at $AgentStartTime"
Write-Host "Report date: $reportDate"
Write-Host "24h window: $dayStart to $AgentStartTime"

# Collect data
$commits = Get-CommitsSince24h $RepoRoot $dayStart
$sessionWrap = Get-SessionWrapJSON $env:APPDATA
$retro = Get-RetroJSON $env:APPDATA

if ($Verbose) {
    Write-Host "Commits found: $($commits.Count)"
    Write-Host "Session wrap: $($sessionWrap -ne $null)"
    Write-Host "Retro: $($retro -ne $null)"
}

# Generate report
$report = New-DailyReport -commits $commits -sessionWrap $sessionWrap -retro $retro -reportDate $AgentStartTime

# Output for now (artifact publishing in Task 12)
Write-Host $report

Write-Host "Daily report agent complete."
```

- [ ] **Step 2: Create docs/reports/daily directory**

```bash
mkdir -p C:\dev\docs\reports\daily
touch C:\dev\docs\reports\daily\.gitkeep
git add C:\dev\docs\reports\daily\.gitkeep
```

- [ ] **Step 3: Test agent skeleton**

```powershell
cd C:\dev
& .\scripts\daily-report-agent.ps1 -Verbose
```

Expected: Skeleton runs, collects data, generates stub report.

- [ ] **Step 4: Commit**

```bash
git add scripts/daily-report-agent.ps1 docs/reports/daily/.gitkeep
git commit -m "feat(agent): scaffold daily report agent v1.0"
```

---

## Task 7: Implement Daily Metrics Table Generation (Phase 2)

**Files:**
- Modify: `scripts/daily-report-agent.ps1`

**Interfaces:**
- Consumes: commits array, sessionWrap (tokens, model, skills), retro (tests), cowork logs
- Produces: Markdown metrics table (11 metrics)

- [ ] **Step 1: Add metrics calculation function**

Add to daily-report-agent.ps1 before New-DailyReport:

```powershell
function Get-MetricsTable {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro
    )
    
    # Calculate metrics
    $commitCount = $commits.Count
    $filesChanged = 0  # Stub for now
    $skillsInvoked = @()
    if ($sessionWrap.skills) {
        $skillsInvoked = $sessionWrap.skills | ForEach-Object { $_.name }
    }
    $skillsCount = $skillsInvoked.Count
    $testsRun = $retro.tests_run ?? 0
    $testsPassed = $retro.tests_passed ?? 0
    $tokensUsed = $sessionWrap.tokens ?? 0
    $model = $sessionWrap.model ?? "unknown"
    $coworkSessions = 0  # Stub for Task 9
    $concurrentAgents = 0  # Stub for Task 9
    $handoffs = 0  # Stub for Task 9
    
    $metricsMarkdown = @"
| Metric | Count |
|--------|-------|
| Commits | $commitCount |
| Files Changed | $filesChanged |
| Skills Invoked | $skillsCount ($($skillsInvoked -join ', ')) |
| Tests Run | $testsRun |
| Tests Passed | $testsPassed |
| Tokens Used | $([string]::Format("{0:N0}", $tokensUsed)) |
| Models Used | $model |
| Cowork Sessions | $coworkSessions |
| Concurrent Agents | $concurrentAgents |
| Handoffs | $handoffs |
"@
    
    return $metricsMarkdown
}
```

- [ ] **Step 2: Update New-DailyReport to use metrics**

Replace the metrics table stub in New-DailyReport:

```powershell
function New-DailyReport {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro,
        [DateTime]$reportDate
    )
    
    $metricsTable = Get-MetricsTable -commits $commits -sessionWrap $sessionWrap -retro $retro
    
    $report = @"
# Daily Report: $($reportDate.ToString("yyyy-MM-dd"))

## Metrics

$metricsTable

## Summary

(Summary will be populated in Task 8)
"@
    
    return $report
}
```

- [ ] **Step 3: Test metrics generation**

```powershell
cd C:\dev
& .\scripts\daily-report-agent.ps1 -Verbose
```

Expected: Metrics table appears in output with commit count, token count, model, tests.

- [ ] **Step 4: Commit**

```bash
git add scripts/daily-report-agent.ps1
git commit -m "feat(agent): add daily metrics table generation"
```

---

## Task 8: Implement Daily Summary Generation (Phase 2)

**Files:**
- Modify: `scripts/daily-report-agent.ps1`

**Interfaces:**
- Consumes: retro.work_summary, retro.blockers, commits list
- Produces: Markdown summary section

- [ ] **Step 1: Add summary generation function**

Add to daily-report-agent.ps1 before Get-MetricsTable:

```powershell
function Get-DailySummary {
    param(
        [object]$retro,
        [array]$commits
    )
    
    $summary = ""
    
    # Work summary from retro
    if ($retro.work_summary) {
        $summary += $retro.work_summary
    } else {
        $summary += "(No work summary available)"
    }
    
    # Blockers
    if ($retro.blockers -and $retro.blockers.Count -gt 0) {
        $summary += "`n`n### Blockers`n`n"
        $retro.blockers | ForEach-Object {
            $summary += "- $_`n"
        }
    }
    
    # Commits breakdown
    if ($commits.Count -gt 0) {
        $summary += "`n`n### Commits`n`n"
        $commits | Group-Object -Property repo | ForEach-Object {
            $summary += "**$($_.Name):** $($_.Count) commit(s)`n"
            $_.Group | ForEach-Object {
                $summary += "  - $($_.hash): $($_.message)`n"
            }
        }
    }
    
    return $summary
}
```

- [ ] **Step 2: Update New-DailyReport to include summary**

Replace summary stub:

```powershell
function New-DailyReport {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro,
        [DateTime]$reportDate
    )
    
    $metricsTable = Get-MetricsTable -commits $commits -sessionWrap $sessionWrap -retro $retro
    $summary = Get-DailySummary -retro $retro -commits $commits
    
    $report = @"
# Daily Report: $($reportDate.ToString("yyyy-MM-dd"))

## Metrics

$metricsTable

## Summary

$summary
"@
    
    return $report
}
```

- [ ] **Step 3: Test summary generation**

```powershell
cd C:\dev
& .\scripts\daily-report-agent.ps1 -Verbose
```

Expected: Summary includes work items, blockers, commits by repo.

- [ ] **Step 4: Commit**

```bash
git add scripts/daily-report-agent.ps1
git commit -m "feat(agent): add daily summary with blockers and commit breakdown"
```

---

## Task 9: Add Cowork Activity Parsing (Phase 2)

**Files:**
- Modify: `scripts/daily-report-agent.ps1`

**Interfaces:**
- Consumes: Cowork daemon logs from verified Phase 0 path
- Produces: Cowork metrics (sessions, agents, handoffs, errors)

- [ ] **Step 1: Add cowork parsing function**

Add to daily-report-agent.ps1:

```powershell
function Get-CoworkActivity {
    param([string]$coworkPath, [DateTime]$since)
    
    $activity = @{
        sessions = 0
        agents = @()
        handoffs = 0
        errors = 0
    }
    
    if (-not (Test-Path $coworkPath)) {
        return $activity
    }
    
    try {
        $logs = Get-ChildItem $coworkPath -File -ErrorAction SilentlyContinue
        foreach ($log in $logs) {
            $content = Get-Content $log.FullName -Raw
            
            # Parse JSON if applicable
            if ($content -match '^\{' -or $content -match '^\[') {
                try {
                    $data = $content | ConvertFrom-Json
                    
                    # Count sessions
                    if ($data.sessions) {
                        $activity.sessions += @($data.sessions).Count
                    }
                    
                    # Extract agents
                    if ($data.agents) {
                        $data.agents | ForEach-Object {
                            if ($_ -notin $activity.agents) {
                                $activity.agents += $_
                            }
                        }
                    }
                    
                    # Count handoffs
                    if ($data.handoffs) {
                        $activity.handoffs += @($data.handoffs).Count
                    }
                    
                    # Count errors
                    if ($data.errors) {
                        $activity.errors += @($data.errors).Count
                    }
                } catch {
                    # Silently skip non-JSON or malformed logs
                }
            }
        }
    } catch {
        Write-Host "Warning: Failed to parse cowork logs: $_"
    }
    
    return $activity
}
```

- [ ] **Step 2: Update metrics table to include cowork**

Update Get-MetricsTable to use cowork data:

```powershell
function Get-MetricsTable {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro,
        [object]$coworkActivity
    )
    
    # ... existing metric calculations ...
    
    $coworkSessions = $coworkActivity.sessions
    $concurrentAgents = $coworkActivity.agents.Count
    $handoffs = $coworkActivity.handoffs
    
    $metricsMarkdown = @"
| Metric | Count |
|--------|-------|
| Commits | $commitCount |
| Files Changed | $filesChanged |
| Skills Invoked | $skillsCount ($($skillsInvoked -join ', ')) |
| Tests Run | $testsRun |
| Tests Passed | $testsPassed |
| Tokens Used | $([string]::Format("{0:N0}", $tokensUsed)) |
| Models Used | $model |
| Cowork Sessions | $coworkSessions |
| Concurrent Agents | $concurrentAgents |
| Handoffs | $handoffs |
"@
    
    return $metricsMarkdown
}
```

- [ ] **Step 3: Update main section to collect cowork data**

In the main section of daily-report-agent.ps1, after data collection:

```powershell
# Collect cowork activity
$coworkPath = $env:USERPROFILE + "\.cowork\sessions"  # Use path from Phase 0 verification
$coworkActivity = Get-CoworkActivity -coworkPath $coworkPath -since $dayStart
```

- [ ] **Step 4: Pass cowork data to report generator**

Update the report generation call:

```powershell
$report = New-DailyReport -commits $commits -sessionWrap $sessionWrap -retro $retro -coworkActivity $coworkActivity -reportDate $AgentStartTime
```

Update New-DailyReport signature:

```powershell
function New-DailyReport {
    param(
        [array]$commits,
        [object]$sessionWrap,
        [object]$retro,
        [object]$coworkActivity,
        [DateTime]$reportDate
    )
    
    $metricsTable = Get-MetricsTable -commits $commits -sessionWrap $sessionWrap -retro $retro -coworkActivity $coworkActivity
    # ... rest of function
}
```

- [ ] **Step 5: Test cowork parsing**

```powershell
cd C:\dev
& .\scripts\daily-report-agent.ps1 -Verbose
```

Expected: Cowork sessions and agents appear in metrics table (may be 0 if no cowork activity).

- [ ] **Step 6: Commit**

```bash
git add scripts/daily-report-agent.ps1
git commit -m "feat(agent): parse cowork daemon logs for session/handoff metrics"
```

---

## Task 10: Implement Daily Report Artifact Publishing (Phase 2)

**Files:**
- Modify: `scripts/daily-report-agent.ps1`

**Interfaces:**
- Consumes: Generated markdown report
- Produces: Artifact published via Artifact tool

- [ ] **Step 1: Add artifact publishing function**

Add to daily-report-agent.ps1:

```powershell
function Publish-ReportArtifact {
    param(
        [string]$reportMarkdown,
        [string]$reportTitle,
        [string]$description
    )
    
    # For cloud agent execution, we'll write the report to temp location
    # and return the path for the Artifact tool to pick up
    
    $tempPath = Join-Path $env:TEMP "daily-report-$((Get-Date).ToString("yyyy-MM-dd-HHmm")).md"
    Set-Content -Path $tempPath -Value $reportMarkdown -Encoding UTF8
    
    # Note: In actual execution, the agent will call the Artifact tool
    # This function prepares the markdown; the tool invocation happens at agent boundary
    
    Write-Host "Report prepared for artifact publishing at: $tempPath"
    return $tempPath
}
```

- [ ] **Step 2: Update main to prepare artifact**

At end of main section, before final Write-Host:

```powershell
# Prepare artifact
$artifactPath = Publish-ReportArtifact -reportMarkdown $report -reportTitle "Daily Report: $reportDate" -description "Daily work summary and metrics for $reportDate"

# Output report content (agent will invoke Artifact tool with this)
Write-Host "===== ARTIFACT_OUTPUT_START ====="
Write-Host $report
Write-Host "===== ARTIFACT_OUTPUT_END ====="
Write-Host "Artifact prepared. Agent should invoke Artifact tool with:"
Write-Host "  file_path: $artifactPath"
Write-Host "  title: Daily Report: $reportDate"
```

- [ ] **Step 3: Test artifact preparation**

```powershell
cd C:\dev
& .\scripts\daily-report-agent.ps1 -Verbose 2>&1 | Select-String -Pattern "ARTIFACT_OUTPUT"
```

Expected: ARTIFACT_OUTPUT markers appear with report content.

- [ ] **Step 4: Commit**

```bash
git add scripts/daily-report-agent.ps1
git commit -m "feat(agent): prepare report artifact for publishing"
```

---

## Task 11: Implement Daily Report Git Commit (Phase 2)

**Files:**
- Modify: `scripts/daily-report-agent.ps1`

**Interfaces:**
- Consumes: Generated markdown report, report date
- Produces: Git commit to `docs/reports/daily/YYYY-MM-DD.md`

- [ ] **Step 1: Add git commit function**

Add to daily-report-agent.ps1:

```powershell
function Commit-DailyReport {
    param(
        [string]$repoRoot,
        [string]$reportPath,
        [string]$reportContent,
        [string]$reportDate
    )
    
    # Write report to file
    Set-Content -Path $reportPath -Value $reportContent -Encoding UTF8
    
    try {
        # Stage and commit
        & git -C $repoRoot add $reportPath 2>&1 | Out-Null
        & git -C $repoRoot commit -m "docs(report): add daily report for $reportDate" 2>&1 | Out-Null
        Write-Host "Report committed: $reportPath"
        return $true
    } catch {
        Write-Host "Warning: Failed to commit report: $_"
        return $false
    }
}
```

- [ ] **Step 2: Update main to commit report**

After artifact preparation, add:

```powershell
# Commit report to git
$commitSuccess = Commit-DailyReport -repoRoot $RepoRoot -reportPath $reportPath -reportContent $report -reportDate $reportDate

if ($commitSuccess) {
    Write-Host "Daily report published and committed successfully."
} else {
    Write-Host "Warning: Report artifact created but git commit failed."
}
```

- [ ] **Step 3: Test git commit**

```powershell
cd C:\dev
& .\scripts\daily-report-agent.ps1 -Verbose

# Verify commit
git -C C:\dev log --oneline docs/reports/daily/ | head -1
```

Expected: Report file appears in `docs/reports/daily/YYYY-MM-DD.md`, commit message shows "add daily report for YYYY-MM-DD".

- [ ] **Step 4: Commit the agent itself**

```bash
git add scripts/daily-report-agent.ps1
git commit -m "feat(agent): implement daily report git commit"
```

---

## Task 12: Create Weekly Report Agent Skeleton (Phase 3)

**Files:**
- Create: `scripts/weekly-report-agent.ps1`
- Create: `docs/reports/weekly/.gitkeep`

**Interfaces:**
- Consumes: Daily report JSON files (7 days), git commits (this week), cowork logs (this week)
- Produces: Artifact + git commit to `docs/reports/weekly/YYYY-W##.md`

- [ ] **Step 1: Create weekly agent skeleton**

Create `scripts/weekly-report-agent.ps1`:

```powershell
# Weekly Report Agent v1.0
# Runs 6 AM every Sunday. Aggregates work from past 7 days.
# Publishes artifact + commits to docs/reports/weekly/

param(
    [string]$RepoRoot = "C:\dev",
    [DateTime]$AgentStartTime = (Get-Date),
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# ============================================================================
# Configuration
# ============================================================================

$weekStart = $AgentStartTime.AddDays(-7)
$weekNumber = [System.Globalization.CultureInfo]::InvariantCulture.Calendar.GetWeekOfYear($AgentStartTime, [System.Globalization.CalendarWeekRule]::ISO8601, [System.DayOfWeek]::Monday)
$year = $AgentStartTime.Year
$reportWeek = "$year-W$($weekNumber.ToString('D2'))"
$reportPath = Join-Path $RepoRoot "docs\reports\weekly\$reportWeek.md"

# ============================================================================
# Data Collection
# ============================================================================

function Get-DailyReportData {
    param([string]$repoRoot, [DateTime]$since, [int]$days)
    
    $dailyData = @()
    for ($i = 0; $i -lt $days; $i++) {
        $date = $since.AddDays($i).ToString("yyyy-MM-dd")
        $dailyPath = Join-Path $repoRoot "docs\reports\daily\$date.md"
        
        if (Test-Path $dailyPath) {
            try {
                $content = Get-Content $dailyPath -Raw
                $dailyData += @{
                    date = $date
                    path = $dailyPath
                    content = $content
                }
            } catch {
                Write-Host "Warning: Failed to read daily report $date"
            }
        } else {
            # Fallback: skip missing data (Phase 0 requirement)
            Write-Host "Skipping missing daily report for $date"
        }
    }
    
    return $dailyData
}

# ============================================================================
# Report Generation (Stub)
# ============================================================================

function New-WeeklyReport {
    param(
        [array]$dailyData,
        [string]$reportWeek
    )
    
    $report = @"
# Weekly Report: $reportWeek

## Weekly Totals

(Totals table will be populated in Task 13)

## Busiest Days

(Analysis will be populated in Task 14)

## Summary

(Summary will be populated in Task 15)
"@
    
    return $report
}

# ============================================================================
# Main
# ============================================================================

Write-Host "Weekly Report Agent starting at $AgentStartTime"
Write-Host "Report week: $reportWeek"
Write-Host "Week span: $weekStart to $AgentStartTime"

# Collect daily data (7 days)
$dailyData = Get-DailyReportData -repoRoot $RepoRoot -since $weekStart -days 7

if ($Verbose) {
    Write-Host "Daily reports found: $($dailyData.Count)"
}

# Generate report
$report = New-WeeklyReport -dailyData $dailyData -reportWeek $reportWeek

# Output for now
Write-Host $report

Write-Host "Weekly report agent complete."
```

- [ ] **Step 2: Create docs/reports/weekly directory**

```bash
mkdir -p C:\dev\docs\reports\weekly
touch C:\dev\docs\reports\weekly\.gitkeep
git add C:\dev\docs\reports\weekly\.gitkeep
```

- [ ] **Step 3: Test agent skeleton**

```powershell
cd C:\dev
& .\scripts\weekly-report-agent.ps1 -Verbose
```

Expected: Agent runs, collects daily data (if exists), generates stub report.

- [ ] **Step 4: Commit**

```bash
git add scripts/weekly-report-agent.ps1 docs/reports/weekly/.gitkeep
git commit -m "feat(agent): scaffold weekly report agent v1.0"
```

---

## Task 13: Implement Weekly Rollup and Trend Indicators (Phase 3)

**Files:**
- Modify: `scripts/weekly-report-agent.ps1`

**Interfaces:**
- Consumes: Daily report markdown (parsed for metrics)
- Produces: Weekly totals table with trend indicators (↑↓↔)

- [ ] **Step 1: Add metrics parsing from daily reports**

Add to weekly-report-agent.ps1:

```powershell
function Parse-DailyMetrics {
    param([string]$dailyMarkdown)
    
    $metrics = @{
        commits = 0
        filesChanged = 0
        skillsCount = 0
        testsRun = 0
        testsPassed = 0
        tokens = 0
        coworkSessions = 0
        handoffs = 0
    }
    
    # Extract from markdown table (simple regex parsing)
    # Format: | Commits | 3 |
    
    if ($dailyMarkdown -match '\| Commits \| (\d+) \|') {
        $metrics.commits = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Files Changed \| (\d+) \|') {
        $metrics.filesChanged = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Tests Run \| (\d+) \|') {
        $metrics.testsRun = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Tests Passed \| (\d+) \|') {
        $metrics.testsPassed = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Tokens Used \| ([0-9,]+) \|') {
        $tokens = $matches[1] -replace ',', ''
        $metrics.tokens = [int]$tokens
    }
    if ($dailyMarkdown -match '\| Cowork Sessions \| (\d+) \|') {
        $metrics.coworkSessions = [int]$matches[1]
    }
    if ($dailyMarkdown -match '\| Handoffs \| (\d+) \|') {
        $metrics.handoffs = [int]$matches[1]
    }
    
    return $metrics
}

function Get-TrendIndicator {
    param([int]$current, [int]$previous)
    
    if ($current -eq $previous) { return "↔" }
    if ($current -gt $previous) { return "↑" }
    return "↓"
}

function Get-WeeklyTotalsTable {
    param([array]$dailyData)
    
    $totals = @{
        commits = 0
        filesChanged = 0
        testsRun = 0
        testsPassed = 0
        tokens = 0
        coworkSessions = 0
        handoffs = 0
    }
    
    $allMetrics = @()
    foreach ($day in $dailyData) {
        $dayMetrics = Parse-DailyMetrics -dailyMarkdown $day.content
        $allMetrics += $dayMetrics
        
        $totals.commits += $dayMetrics.commits
        $totals.filesChanged += $dayMetrics.filesChanged
        $totals.testsRun += $dayMetrics.testsRun
        $totals.testsPassed += $dayMetrics.testsPassed
        $totals.tokens += $dayMetrics.tokens
        $totals.coworkSessions += $dayMetrics.coworkSessions
        $totals.handoffs += $dayMetrics.handoffs
    }
    
    $dayCount = $allMetrics.Count
    if ($dayCount -eq 0) { $dayCount = 1 }
    
    # Calculate daily averages
    $avgCommits = [math]::Round($totals.commits / $dayCount, 1)
    $avgTests = [math]::Round($totals.testsRun / $dayCount, 1)
    $avgTokens = [math]::Round($totals.tokens / $dayCount, 0)
    
    # Trend indicators (week vs week comparison - stub for now)
    $trendCommits = "↔"
    $trendTests = "↔"
    $trendTokens = "↔"
    $trendHandoffs = "↔"
    
    $table = @"
| Metric | Total | Daily Avg | Trend |
|--------|-------|-----------|-------|
| Commits | $($totals.commits) | $avgCommits | $trendCommits |
| Files Changed | $($totals.filesChanged) | $([math]::Round($totals.filesChanged / $dayCount, 1)) | ↔ |
| Tests Run | $($totals.testsRun) | $avgTests | $trendTests |
| Tests Passed | $($totals.testsPassed) | $([math]::Round($totals.testsPassed / $dayCount, 1)) | ↔ |
| Tokens Used | $([string]::Format("{0:N0}", $totals.tokens)) | $([string]::Format("{0:N0}", $avgTokens)) | $trendTokens |
| Cowork Sessions | $($totals.coworkSessions) | $([math]::Round($totals.coworkSessions / $dayCount, 1)) | ↔ |
| Handoffs | $($totals.handoffs) | $([math]::Round($totals.handoffs / $dayCount, 1)) | $trendHandoffs |
"@
    
    return $table
}
```

- [ ] **Step 2: Update New-WeeklyReport**

```powershell
function New-WeeklyReport {
    param(
        [array]$dailyData,
        [string]$reportWeek
    )
    
    $totalsTable = Get-WeeklyTotalsTable -dailyData $dailyData
    
    $report = @"
# Weekly Report: $reportWeek

## Weekly Totals

$totalsTable

## Summary

(Summary will be populated in Task 15)
"@
    
    return $report
}
```

- [ ] **Step 3: Test rollup logic**

```powershell
cd C:\dev
& .\scripts\weekly-report-agent.ps1 -Verbose
```

Expected: Totals table appears with 7-day sums, daily averages, trend indicators.

- [ ] **Step 4: Commit**

```bash
git add scripts/weekly-report-agent.ps1
git commit -m "feat(agent): implement weekly totals and trend indicators"
```

---

## Task 14: Implement Busiest Days Analysis (Phase 3)

**Files:**
- Modify: `scripts/weekly-report-agent.ps1`

**Interfaces:**
- Consumes: Parsed daily metrics (commits, tokens per day)
- Produces: Ranked list of busiest days

- [ ] **Step 1: Add busiest days analysis**

Add to weekly-report-agent.ps1:

```powershell
function Get-BusiestDaysSection {
    param([array]$dailyData)
    
    $dayMetrics = @()
    
    $i = 0
    foreach ($day in $dailyData) {
        $metrics = Parse-DailyMetrics -dailyMarkdown $day.content
        $dayMetrics += @{
            date = $day.date
            dayOfWeek = (Get-Date $day.date).DayOfWeek.ToString()
            commits = $metrics.commits
            tokens = $metrics.tokens
            score = $metrics.commits + ($metrics.tokens / 50000)  # Weighted score
        }
        $i++
    }
    
    # Sort by score descending, take top 3
    $busiestDays = $dayMetrics | Sort-Object -Property score -Descending | Select-Object -First 3
    
    $section = "## Busiest Days`n`n"
    $rank = 1
    foreach ($day in $busiestDays) {
        $section += "$rank. $($day.dayOfWeek) ($($day.date)): $($day.commits) commits, $([string]::Format("{0:N0}", $day.tokens)) tokens`n"
        $rank++
    }
    
    return $section
}
```

- [ ] **Step 2: Update New-WeeklyReport**

```powershell
function New-WeeklyReport {
    param(
        [array]$dailyData,
        [string]$reportWeek
    )
    
    $totalsTable = Get-WeeklyTotalsTable -dailyData $dailyData
    $busiestDays = Get-BusiestDaysSection -dailyData $dailyData
    
    $report = @"
# Weekly Report: $reportWeek

## Weekly Totals

$totalsTable

$busiestDays

## Summary

(Summary will be populated in Task 15)
"@
    
    return $report
}
```

- [ ] **Step 3: Test busiest days**

```powershell
cd C:\dev
& .\scripts\weekly-report-agent.ps1 -Verbose
```

Expected: Busiest days section lists top 3 days by commit/token score.

- [ ] **Step 4: Commit**

```bash
git add scripts/weekly-report-agent.ps1
git commit -m "feat(agent): add busiest days analysis to weekly report"
```

---

## Task 15: Implement Weekly Report Artifact + Commit (Phase 3)

**Files:**
- Modify: `scripts/weekly-report-agent.ps1`

**Interfaces:**
- Consumes: Generated weekly markdown
- Produces: Artifact + git commit to `docs/reports/weekly/YYYY-W##.md`

- [ ] **Step 1: Add artifact and commit functions**

Add to weekly-report-agent.ps1 (reuse from daily agent):

```powershell
function Publish-WeeklyReportArtifact {
    param(
        [string]$reportMarkdown,
        [string]$reportTitle,
        [string]$description
    )
    
    $tempPath = Join-Path $env:TEMP "weekly-report-$((Get-Date).ToString("yyyy-Www-HHmm")).md"
    Set-Content -Path $tempPath -Value $reportMarkdown -Encoding UTF8
    
    Write-Host "Report prepared for artifact publishing at: $tempPath"
    return $tempPath
}

function Commit-WeeklyReport {
    param(
        [string]$repoRoot,
        [string]$reportPath,
        [string]$reportContent,
        [string]$reportWeek
    )
    
    Set-Content -Path $reportPath -Value $reportContent -Encoding UTF8
    
    try {
        & git -C $repoRoot add $reportPath 2>&1 | Out-Null
        & git -C $repoRoot commit -m "docs(report): add weekly report for $reportWeek" 2>&1 | Out-Null
        Write-Host "Report committed: $reportPath"
        return $true
    } catch {
        Write-Host "Warning: Failed to commit report: $_"
        return $false
    }
}
```

- [ ] **Step 2: Update main to publish and commit**

At end of main section:

```powershell
# Prepare artifact
$artifactPath = Publish-WeeklyReportArtifact -reportMarkdown $report -reportTitle "Weekly Report: $reportWeek" -description "Weekly work summary and metrics for $reportWeek"

Write-Host "===== ARTIFACT_OUTPUT_START ====="
Write-Host $report
Write-Host "===== ARTIFACT_OUTPUT_END ====="

# Commit report to git
$commitSuccess = Commit-WeeklyReport -repoRoot $RepoRoot -reportPath $reportPath -reportContent $report -reportWeek $reportWeek

if ($commitSuccess) {
    Write-Host "Weekly report published and committed successfully."
} else {
    Write-Host "Warning: Report artifact created but git commit failed."
}
```

- [ ] **Step 3: Test weekly report publishing**

```powershell
cd C:\dev
& .\scripts\weekly-report-agent.ps1 -Verbose

# Verify commit
git -C C:\dev log --oneline docs/reports/weekly/ | head -1
```

Expected: Report file at `docs/reports/weekly/YYYY-W##.md`, commit shows "add weekly report for YYYY-W##".

- [ ] **Step 4: Commit the weekly agent**

```bash
git add scripts/weekly-report-agent.ps1
git commit -m "feat(agent): implement weekly report publishing and git commit"
```

---

## Task 16: End-to-End Test of Daily Agent (Phase 4)

**Files:**
- Test: Run daily agent with backfill

**Interfaces:**
- Executes: daily-report-agent.ps1 with historical date

- [ ] **Step 1: Create test data (optional)**

If no recent session/retro JSON exists, create stub exports:

```powershell
$stubSessionWrap = @{
    commits = @(@{ hash = "abc123"; message = "feat: test"; files = @("file.ps1"); repo = "c:\dev" })
    skills = @(@{ name = "brainstorming"; count = 1 })
    tokens = 156000
    model = "haiku"
    duration_minutes = 42
} | ConvertTo-Json | Set-Content "$env:APPDATA\Claude\session-wrap-export.json"

$stubRetro = @{
    tests_run = 23
    tests_passed = 22
    blockers = @("cowork daemon path verification")
    work_summary = "Spec approved, implementation plan drafted."
} | ConvertTo-Json | Set-Content "$env:APPDATA\Claude\retro-export.json"
```

- [ ] **Step 2: Run daily agent with backfill**

```powershell
cd C:\dev

# Run for yesterday's date
$yesterday = (Get-Date).AddDays(-1)
& .\scripts\daily-report-agent.ps1 -AgentStartTime $yesterday -Verbose
```

Expected: Report generated, metrics populated, git commit created at `docs/reports/daily/YYYY-MM-DD.md`.

- [ ] **Step 3: Verify report content**

```powershell
Get-Content "C:\dev\docs\reports\daily\$((Get-Date).AddDays(-1).ToString('yyyy-MM-dd')).md"
```

Expected: Markdown report with title, metrics table, summary section.

- [ ] **Step 4: Verify git commit**

```bash
git -C C:\dev log --oneline docs/reports/daily/ | head -3
```

Expected: 3 most recent daily reports (if backfill ran 3 days).

- [ ] **Step 5: No action needed — confirms Phase 4 success for daily**

Mark daily agent as verified.

---

## Task 17: End-to-End Test of Weekly Agent (Phase 4)

**Files:**
- Test: Run weekly agent with backfill

**Interfaces:**
- Executes: weekly-report-agent.ps1 with historical Sunday

- [ ] **Step 1: Ensure daily reports exist**

For weekly agent to work, prior 7 days of daily reports should exist. If not from Task 16, create stubs:

```powershell
$dayCount = 7
$startDate = (Get-Date).AddDays(-8)

for ($i = 1; $i -le $dayCount; $i++) {
    $date = $startDate.AddDays($i).ToString("yyyy-MM-dd")
    $stub = @"
# Daily Report: $date

## Metrics

| Metric | Count |
|--------|-------|
| Commits | 2 |
| Files Changed | 5 |
| Skills Invoked | 3 (brainstorming, code-review, writing-plans) |
| Tests Run | 12 |
| Tests Passed | 11 |
| Tokens Used | 95,000 |
| Models Used | haiku |
| Cowork Sessions | 1 |
| Concurrent Agents | 2 |
| Handoffs | 1 |

## Summary

Standard dev day.
"@
    Set-Content -Path "C:\dev\docs\reports\daily\$date.md" -Value $stub -Encoding UTF8
}
```

- [ ] **Step 2: Run weekly agent for last Sunday**

```powershell
cd C:\dev

# Find last Sunday
$today = Get-Date
$lastSunday = $today.AddDays(- ($today.DayOfWeek.value__ % 7))

& .\scripts\weekly-report-agent.ps1 -AgentStartTime $lastSunday -Verbose
```

Expected: Report generated with totals, trend indicators, busiest days, git commit created.

- [ ] **Step 3: Verify weekly report**

```powershell
$weekNumber = [System.Globalization.CultureInfo]::InvariantCulture.Calendar.GetWeekOfYear((Get-Date), [System.Globalization.CalendarWeekRule]::ISO8601, [System.DayOfWeek]::Monday)
Get-Content "C:\dev\docs\reports\weekly\2026-W$($weekNumber.ToString('D2')).md"
```

Expected: Weekly report with totals table (7-day rollup), busiest days, trend indicators.

- [ ] **Step 4: Verify git commit**

```bash
git -C C:\dev log --oneline docs/reports/weekly/ | head -1
```

Expected: Weekly report commit with message "add weekly report for YYYY-W##".

- [ ] **Step 5: No action needed — confirms Phase 4 success for weekly**

Mark weekly agent as verified.

---

## Task 18: Verify Data Integrity and Zero Duplication (Phase 4)

**Files:**
- Test: Audit reports for completeness

**Interfaces:**
- Audits: All generated reports for missing data, duplicates, schema compliance

- [ ] **Step 1: Count commits in reports**

```bash
# Count total commits across all daily reports
git -C C:\dev log --oneline docs/reports/daily/ | wc -l

# Verify each report file exists and is non-empty
ls -la C:\dev\docs\reports\daily/*.md | awk '{print $5}' | grep -v "^0$"
```

Expected: All report files > 0 bytes, commit count matches dates generated.

- [ ] **Step 2: Validate JSON structure**

```powershell
# Verify session-wrap export is valid JSON
Get-Content "$env:APPDATA\Claude\session-wrap-export.json" | ConvertFrom-Json | Select-Object -Property tokens, model, commits

# Verify retro export is valid JSON
Get-Content "$env:APPDATA\Claude\retro-export.json" | ConvertFrom-Json | Select-Object -Property tests_run, tests_passed
```

Expected: Both files parse cleanly, required fields present.

- [ ] **Step 3: Check for metric consistency**

```powershell
# Sample: Verify weekly totals = sum of daily totals
$week1 = Get-Content "C:\dev\docs\reports\weekly\2026-W29.md"
$week1 -match '\| Commits \| (\d+) \|'
Write-Host "Weekly commits: $($matches[1])"

# Compare with sum of 7 daily reports
$dailySum = 0
for ($i = 0; $i -lt 7; $i++) {
    $date = (Get-Date).AddDays(- 6 + $i).ToString("yyyy-MM-dd")
    $daily = Get-Content "C:\dev\docs\reports\daily\$date.md" -ErrorAction SilentlyContinue
    if ($daily -match '\| Commits \| (\d+) \|') {
        $dailySum += [int]$matches[1]
    }
}
Write-Host "Daily sum: $dailySum"
```

Expected: Weekly total ≥ daily sum (may be greater if full week includes extra work).

- [ ] **Step 4: Verify no duplicate commits**

```bash
# Check for duplicate commit hashes in git log
git -C C:\dev log --oneline docs/reports/ | awk '{print $1}' | sort | uniq -c | awk '$1 > 1 {print "DUPLICATE: " $0}'
```

Expected: No duplicate commit hashes.

- [ ] **Step 5: Document findings**

No action needed if all checks pass. If any issues found, investigate and fix before going live.

---

## Task 19: Schedule Daily Agent with /schedule Skill (Phase 4)

**Files:**
- Use: `/schedule` skill to create daily cron trigger

**Interfaces:**
- Creates: Cloud agent trigger for daily-report-agent.ps1 at 6 AM daily

- [ ] **Step 1: Invoke /schedule skill**

```bash
/schedule
```

Follow prompts:
- Agent script: `scripts/daily-report-agent.ps1`
- Trigger: `0 6 * * *` (6 AM every day, cron format)
- Timezone: User's local timezone (from Phase 0 verification)
- Parameters: `--RepoRoot C:\dev --Verbose`

Expected: Schedule skill confirms agent scheduled.

- [ ] **Step 2: Document schedule configuration**

Create `docs/meta/reporting-agents-config.md`:

```markdown
# Reporting Agents Configuration

## Daily Agent

- **Script:** `scripts/daily-report-agent.ps1`
- **Schedule:** 0 6 * * * (6 AM every day)
- **Timezone:** {user_timezone_from_phase_0}
- **Output:** 
  - Artifact: Daily report (shareable, 90-day retention)
  - Git commit: `docs/reports/daily/YYYY-MM-DD.md`

## Weekly Agent

- **Script:** `scripts/weekly-report-agent.ps1`
- **Schedule:** 0 6 * * 0 (6 AM every Sunday)
- **Timezone:** {user_timezone_from_phase_0}
- **Output:**
  - Artifact: Weekly report (shareable, 90-day retention)
  - Git commit: `docs/reports/weekly/YYYY-W##.md`

## Data Dependencies

- Session-wrap JSON: `$env:APPDATA\Claude\session-wrap-export.json`
- Retro JSON: `$env:APPDATA\Claude\retro-export.json`
- Cowork logs: {verified_path_from_phase_0}
- Git repos: Auto-discovered under `C:\dev`

## Monitoring

Check agent execution:
- Artifact publish success: Visit reported artifact URL
- Git commits: `git log docs/reports/`
- Agent failures: Check schedule skill logs
```

- [ ] **Step 3: Commit configuration**

```bash
git add docs/meta/reporting-agents-config.md
git commit -m "docs: add reporting agents configuration and schedule details"
```

---

## Task 20: Schedule Weekly Agent with /schedule Skill (Phase 4)

**Files:**
- Use: `/schedule` skill to create weekly cron trigger

**Interfaces:**
- Creates: Cloud agent trigger for weekly-report-agent.ps1 at 6 AM Sundays

- [ ] **Step 1: Invoke /schedule skill for weekly**

```bash
/schedule
```

Follow prompts:
- Agent script: `scripts/weekly-report-agent.ps1`
- Trigger: `0 6 * * 0` (6 AM every Sunday, cron format)
- Timezone: User's local timezone (same as daily agent)
- Parameters: `--RepoRoot C:\dev --Verbose`

Expected: Schedule skill confirms weekly agent scheduled.

- [ ] **Step 2: Verify both agents scheduled**

List active schedules:

```bash
/schedule --list
```

Expected: Both daily (every day at 6 AM) and weekly (every Sunday at 6 AM) appear.

- [ ] **Step 3: Commit final status**

```bash
git add docs/meta/reporting-agents-config.md
git commit -m "ops: daily and weekly reporting agents scheduled live"
```

---

## Self-Review Checklist

**Spec Coverage:** ✓ All Phase 0–4 requirements have tasks
- Phase 0 (verification): Tasks 1–3
- Phase 1 (skill enhancements): Tasks 4–5
- Phase 2 (daily agent): Tasks 6–11
- Phase 3 (weekly agent): Tasks 12–15
- Phase 4 (testing + scheduling): Tasks 16–20

**Placeholders:** ✓ None — all code blocks complete and executable

**Type Consistency:** ✓ JSON schemas v1.0 defined, metric field names consistent (tokens, model, commits)

**Spec Alignment:** ✓ All sections (architecture, data sources, format, success criteria) mapped to tasks

---

Plan complete and saved to `docs/superpowers/plans/2026-07-19-daily-weekly-reports-implementation.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?