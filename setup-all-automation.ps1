#!/usr/bin/env pwsh
<#
.SYNOPSIS
Unified setup for all Toolforge automation infrastructure.

.DESCRIPTION
Orchestrates installation of:
1. CI pipeline (orchestrator)
2. Task Scheduler registration (nightly runs)
3. Git hooks (pre-commit, post-merge)
4. Multi-repo orchestrator
5. Logging infrastructure

.PARAMETER Action
Setup, Test, Status, Cleanup (default: Setup)

.PARAMETER SkipGitHooks
Skip git hook installation

.PARAMETER SkipScheduler
Skip Task Scheduler registration

.PARAMETER Verbose
Enable verbose output

.EXAMPLE
./setup-all-automation.ps1
./setup-all-automation.ps1 -Action Test
./setup-all-automation.ps1 -Action Status
#>

param(
    [ValidateSet('Setup', 'Test', 'Status', 'Cleanup')]
    [string]$Action = 'Setup',
    [switch]$SkipGitHooks,
    [switch]$SkipScheduler,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$toolforgeRoot = 'C:\dev\toolforge'
$logDir = "$toolforgeRoot\logs"
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'

function Write-Status {
    param([string]$Message, [string]$Status = 'INFO')
    Write-Host "[$Status] $Message" -ForegroundColor $(
        switch ($Status) {
            'PASS' { 'Green' }
            'FAIL' { 'Red' }
            'WARN' { 'Yellow' }
            default { 'White' }
        }
    )
}

function Setup-Automation {
    Write-Host ""
    Write-Status "=== TOOLFORGE AUTOMATION SETUP ===" INFO
    Write-Host ""

    # Ensure directories exist
    New-Item -ItemType Directory -Path "$logDir\ci" -Force | Out-Null
    New-Item -ItemType Directory -Path "$logDir\hooks" -Force | Out-Null
    New-Item -ItemType Directory -Path "$logDir\orchestrator" -Force | Out-Null
    Write-Status "✓ Log directories created" PASS

    # CI Pipeline (already exists, just verify)
    if (Test-Path "$toolforgeRoot\ci-pipeline.ps1") {
        Write-Status "✓ CI pipeline exists" PASS
    }
    else {
        Write-Status "✗ CI pipeline not found" FAIL
        exit 1
    }

    # Multi-repo orchestrator
    if (Test-Path "$toolforgeRoot\multi-repo-orchestrator.ps1") {
        Write-Status "✓ Multi-repo orchestrator exists" PASS
    }
    else {
        Write-Status "✗ Multi-repo orchestrator not found" FAIL
        exit 1
    }

    # Repo registry
    if (Test-Path 'C:\dev\repo-registry.json') {
        Write-Status "✓ Repo registry exists" PASS
    }
    else {
        Write-Status "✗ Repo registry not found" FAIL
        exit 1
    }

    # Git hooks
    if (-not $SkipGitHooks) {
        Write-Host ""
        Write-Status "Installing git hooks..." INFO
        & "$toolforgeRoot\setup-git-hooks.ps1" -Action Install -Repo 'C:\dev' -Verbose:$Verbose
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✓ Git hooks installed" PASS
        }
        else {
            Write-Status "⚠ Git hooks failed (continuing)" WARN
        }
    }
    else {
        Write-Status "⊘ Git hooks skipped" WARN
    }

    # Task Scheduler
    if (-not $SkipScheduler) {
        Write-Host ""
        Write-Status "Registering Task Scheduler jobs..." INFO
        & "$toolforgeRoot\setup-ci-scheduler.ps1" -Action Register -Verbose:$Verbose
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✓ Task Scheduler jobs registered" PASS
        }
        else {
            Write-Status "⚠ Task Scheduler registration warnings" WARN
        }
    }
    else {
        Write-Status "⊘ Task Scheduler skipped" WARN
    }

    Write-Host ""
    Write-Status "=== SETUP COMPLETE ===" PASS
    Write-Host ""
    Write-Status "Next steps:" INFO
    Write-Status "  1. Run tests: ./setup-all-automation.ps1 -Action Test" INFO
    Write-Status "  2. Check status: ./setup-all-automation.ps1 -Action Status" INFO
    Write-Status "  3. View logs: Get-ChildItem $logDir -Recurse" INFO
    Write-Host ""
}

function Test-Automation {
    Write-Host ""
    Write-Status "=== TESTING AUTOMATION INFRASTRUCTURE ===" INFO
    Write-Host ""

    # Test CI pipeline
    Write-Status "Testing CI pipeline (validator stage only)..." INFO
    & "$toolforgeRoot\ci-pipeline.ps1" -Stage validator -Verbose
    $ciExitCode = $LASTEXITCODE
    if ($ciExitCode -le 1) {
        Write-Status "✓ CI pipeline test passed (exit: $ciExitCode)" PASS
    }
    else {
        Write-Status "✗ CI pipeline test failed (exit: $ciExitCode)" FAIL
    }

    Write-Host ""

    # Test multi-repo orchestrator
    Write-Status "Testing multi-repo orchestrator (validator stage)..." INFO
    & "$toolforgeRoot\multi-repo-orchestrator.ps1" -Stage validator -Verbose
    $orchestratorExitCode = $LASTEXITCODE
    if ($orchestratorExitCode -le 1) {
        Write-Status "✓ Multi-repo orchestrator test passed (exit: $orchestratorExitCode)" PASS
    }
    else {
        Write-Status "✗ Multi-repo orchestrator test failed (exit: $orchestratorExitCode)" FAIL
    }

    Write-Host ""

    # Test git hooks
    if (Test-Path 'C:\dev\.git\hooks\pre-commit') {
        Write-Status "Testing git hooks..." INFO
        & "$toolforgeRoot\setup-git-hooks.ps1" -Action Test -Repo 'C:\dev' -Verbose:$Verbose
        $hooksExitCode = $LASTEXITCODE
        if ($hooksExitCode -eq 0) {
            Write-Status "✓ Git hooks test passed" PASS
        }
        else {
            Write-Status "✗ Git hooks test failed (exit: $hooksExitCode)" FAIL
        }
    }
    else {
        Write-Status "⊘ Git hooks not installed (skipped)" WARN
    }

    Write-Host ""
    Write-Status "=== TESTING COMPLETE ===" PASS
    Write-Host ""
}

function Show-Status {
    Write-Host ""
    Write-Status "=== AUTOMATION STATUS ===" INFO
    Write-Host ""

    # CI Pipeline status
    if (Test-Path "$toolforgeRoot\ci-pipeline.ps1") {
        Write-Status "✓ CI pipeline installed" PASS
    }
    else {
        Write-Status "✗ CI pipeline missing" FAIL
    }

    # Multi-repo orchestrator status
    if (Test-Path "$toolforgeRoot\multi-repo-orchestrator.ps1") {
        Write-Status "✓ Multi-repo orchestrator installed" PASS
    }
    else {
        Write-Status "✗ Multi-repo orchestrator missing" FAIL
    }

    # Repo registry status
    if (Test-Path 'C:\dev\repo-registry.json') {
        $registry = Get-Content 'C:\dev\repo-registry.json' | ConvertFrom-Json
        Write-Status "✓ Repo registry: $($registry.metadata.totalRepos) repos" PASS
    }
    else {
        Write-Status "✗ Repo registry missing" FAIL
    }

    # Git hooks status
    & "$toolforgeRoot\setup-git-hooks.ps1" -Action Status -Repo 'C:\dev'

    # Task Scheduler status
    Write-Host ""
    Write-Status "Task Scheduler jobs:" INFO
    & "$toolforgeRoot\setup-ci-scheduler.ps1" -Action List

    # Logs status
    Write-Host ""
    Write-Status "Log directories:" INFO
    Get-ChildItem -Path $logDir -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Host "  ✓ $($_.Name)" }

    Write-Host ""
}

function Cleanup-Automation {
    Write-Host ""
    Write-Status "=== CLEANUP ===" WARN
    Write-Host ""

    # Remove git hooks
    Write-Status "Removing git hooks..." INFO
    & "$toolforgeRoot\setup-git-hooks.ps1" -Action Uninstall -Repo 'C:\dev'

    # Remove Task Scheduler jobs
    Write-Status "Removing Task Scheduler jobs..." INFO
    & "$toolforgeRoot\setup-ci-scheduler.ps1" -Action Unregister

    Write-Status "✓ Cleanup complete" PASS
    Write-Host ""
}

switch ($Action) {
    'Setup' { Setup-Automation }
    'Test' { Test-Automation }
    'Status' { Show-Status }
    'Cleanup' { Cleanup-Automation }
}
