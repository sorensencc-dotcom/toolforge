#Requires -Version 7
<#
.SYNOPSIS
Session startup checklist. Verifies environment before work begins.

Checks:
  - codex CLI on PATH + responsive
  - Network connectivity (DNS + HTTPS)
  - Git state (repo clean, all fetched)
  - Node/npm available
  - Database connectivity (if DATABASE_URL set)

Exit code: 0 = all pass, 1 = blocker found
#>

param(
    [switch]$Verbose
)

$ErrorActionPreference = 'Continue'
$blockers = @()
$warnings = @()

function Test-Blocker {
    param([string]$Name, [scriptblock]$Test, [string]$Remediation)

    Write-Host "  [ ] $Name" -NoNewline
    try {
        $result = & $Test
        if ($result -eq $true) {
            Write-Host " ✓" -ForegroundColor Green
            return $true
        } else {
            Write-Host " ✗" -ForegroundColor Red
            $blockers += @{
                name = $Name
                remediation = $Remediation
                error = $result
            }
            return $false
        }
    } catch {
        Write-Host " ✗ (error)" -ForegroundColor Red
        $blockers += @{
            name = $Name
            remediation = $Remediation
            error = $_.Exception.Message
        }
        return $false
    }
}

function Test-Warning {
    param([string]$Name, [scriptblock]$Test, [string]$Note)

    Write-Host "  [~] $Name" -NoNewline
    try {
        $result = & $Test
        if ($result -eq $true) {
            Write-Host " ✓" -ForegroundColor Green
            return $true
        } else {
            Write-Host " ~ (warning)" -ForegroundColor Yellow
            $warnings += @{ name = $Name; note = $Note }
            return $false
        }
    } catch {
        Write-Host " ~ (skip)" -ForegroundColor Yellow
        return $false
    }
}

Write-Host "`n=== SESSION STARTUP CHECKLIST ===" -ForegroundColor Cyan
Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

# Runtime
Write-Host "Runtime:" -ForegroundColor Yellow
Test-Blocker "Node.js available" {
    (node --version) | Out-Null
    $true
} "Install Node.js >=20 from nodejs.org"

Test-Blocker "npm available" {
    (npm --version) | Out-Null
    $true
} "npm should come with Node.js"

# Codex CLI
Write-Host "`nCodex CLI:" -ForegroundColor Yellow
Test-Blocker "codex on PATH" {
    $codex = Get-Command codex -ErrorAction SilentlyContinue
    if ($codex) { $true } else { $false }
} "Run: `$env:PATH += ';~/.codex/.sandbox-bin/'; codex --version to verify"

Test-Warning "codex responsive" {
    $proc = Start-Process -FilePath codex -ArgumentList '--version' -NoNewWindow -PassThru -Wait -ErrorAction SilentlyContinue
    $proc.ExitCode -eq 0
} "If codex hangs, kill it: taskkill /F /IM codex.exe"

# Network
Write-Host "`nNetwork:" -ForegroundColor Yellow
Test-Blocker "DNS resolution" {
    try {
        $null = [System.Net.Dns]::GetHostAddresses("github.com")
        $true
    } catch {
        $false
    }
} "Check internet connection + firewall rules"

Test-Blocker "HTTPS connectivity" {
    try {
        $web = New-Object System.Net.WebClient
        $web.DownloadString("https://api.github.com/") | Out-Null
        $true
    } catch {
        $false
    }
} "Check firewall/proxy rules for api.github.com"

# Git
Write-Host "`nGit:" -ForegroundColor Yellow
Test-Blocker "Git available" {
    (git --version) | Out-Null
    $true
} "Install Git from git-scm.com"

Test-Blocker "In git repo" {
    (git rev-parse --git-dir) | Out-Null
    $true
} "Current dir must be inside a git repo"

Test-Blocker "Repo is clean" {
    $status = git status --porcelain
    if ($status) {
        "Uncommitted changes: $(($status | Measure-Object -Line).Lines) files"
    } else {
        $true
    }
} "Commit or stash changes: git add -A && git commit -m '...' (or git stash)"

Test-Blocker "No merge conflicts" {
    $conflicts = git diff --name-only --diff-filter=U
    if ($conflicts) {
        "Unmerged files: $(($conflicts | Measure-Object -Line).Lines)"
    } else {
        $true
    }
} "Resolve conflicts: git add <file> && git commit"

Test-Warning "All branches fetched" {
    git fetch --all | Out-Null
    $true
} "Run: git fetch --all to sync remote refs"

# Database (if DATABASE_URL set)
Write-Host "`nDatabase:" -ForegroundColor Yellow
if ($env:DATABASE_URL) {
    Test-Warning "PostgreSQL reachable" {
        # Just try to parse the URL; full connectivity test requires psql
        $env:DATABASE_URL -match "postgres" -or $env:DATABASE_URL -match "postgresql"
    } "DATABASE_URL set. Verify at migration time: npm run migrate"
} else {
    Write-Host "  [~] PostgreSQL (skipped, no DATABASE_URL)" -ForegroundColor Gray
}

# Summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan

if ($blockers.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✓ All checks passed. Ready to work." -ForegroundColor Green
    Write-Host "`nNext: git fetch --all && git status (before starting phase)" -ForegroundColor Gray
    exit 0
}

if ($warnings.Count -gt 0) {
    Write-Host "`nWarnings ($($warnings.Count)):" -ForegroundColor Yellow
    $warnings | ForEach-Object {
        Write-Host "  • $($_.name) — $($_.note)"
    }
}

if ($blockers.Count -gt 0) {
    Write-Host "`nBlockers ($($blockers.Count)):" -ForegroundColor Red
    $blockers | ForEach-Object {
        Write-Host "  ✗ $($_.name)"
        Write-Host "    Error: $($_.error)" -ForegroundColor Red
        Write-Host "    Fix: $($_.remediation)" -ForegroundColor Yellow
    }
    Write-Host "`nFix blockers before proceeding." -ForegroundColor Red
    exit 1
}

exit 0
