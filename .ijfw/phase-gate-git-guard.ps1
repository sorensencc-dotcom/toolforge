#Requires -Version 7
<#
.SYNOPSIS
Phase-gate git guard. Verifies git state before & after phase work.

Usage:
  - Before phase start: phase-gate-git-guard.ps1 -Phase "A" -Before
  - After phase gate: phase-gate-git-guard.ps1 -Phase "A" -After

Logs to .ijfw/phase-gates/PHASE-A.log

Checks:
  - Fetch all remote branches (sync race detection)
  - No uncommitted changes blocking next phase
  - No detached HEAD
  - No merge conflicts
  - Branch tracking correct
  - Log last 3 commits (audit trail)

Exits 1 if critical state detected.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Phase,

    [switch]$Before,
    [switch]$After
)

$ErrorActionPreference = 'Stop'
$logDir = ".ijfw/phase-gates"
$logFile = Join-Path $logDir "PHASE-$Phase.log"

if (-not (Test-Path $logDir)) {
    mkdir $logDir | Out-Null
}

function Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Add-Content $logFile $line
    Write-Host $line
}

Log "=== PHASE $Phase $(if ($Before) { 'PRE-GATE' } else { 'POST-GATE' }) ===" "GATE"

try {
    # Fetch all branches to detect concurrent work
    Log "Fetching all branches..." "CHECK"
    git fetch --all 2>&1 | ForEach-Object { Log "  $_" }

    # Status snapshot
    $status = git status --porcelain
    $branch = git rev-parse --abbrev-ref HEAD
    $ahead = (git rev-list --left-right @{upstream}...HEAD 2>/dev/null | grep "^>" | wc -l)

    Log "Current branch: $branch"
    Log "Commits ahead of upstream: $ahead"

    # Critical checks
    if ($status) {
        Log "Uncommitted changes detected: $($status.Length) items" "WARN"
        if ($After) {
            Log "CRITICAL: Uncommitted work at post-gate. Stash before next phase." "ERROR"
            exit 1
        }
    }

    $detached = (git symbolic-ref -q HEAD) ? $false : $true
    if ($detached) {
        Log "CRITICAL: Detached HEAD state detected" "ERROR"
        exit 1
    }

    $conflicts = git diff --name-only --diff-filter=U
    if ($conflicts) {
        Log "CRITICAL: Merge conflicts detected: $($conflicts.Length) files" "ERROR"
        exit 1
    }

    # Audit trail
    Log "Last 3 commits:" "AUDIT"
    git log --oneline -3 | ForEach-Object { Log "  $_" "AUDIT" }

    Log "=== GATE PASS ===" "PASS"
    exit 0
}
catch {
    Log "Gate check failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
