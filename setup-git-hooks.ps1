#!/usr/bin/env pwsh
<#
.SYNOPSIS
Install/manage git hooks for CI pipeline gating.

.DESCRIPTION
Installs pre-commit and post-merge hooks that run validation.
- Pre-commit: validator only (fast gate)
- Post-merge: full pipeline (integration check)

Hook lifecycle: Install, Uninstall, Test, Status

.PARAMETER Action
Install, Uninstall, Test, Status (default: Install)

.PARAMETER Repo
Target repo path (default: C:\dev)

.EXAMPLE
./setup-git-hooks.ps1 -Action Install
./setup-git-hooks.ps1 -Action Test -Repo "C:\dev\cic"
#>

param(
    [ValidateSet('Install', 'Uninstall', 'Test', 'Status')]
    [string]$Action = 'Install',
    [string]$Repo = 'C:\dev'
)

$ErrorActionPreference = 'Stop'
$hooksDir = "$Repo\.git\hooks"
$logDir = "C:\dev\logs\hooks"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Write-HookLog {
    param([string]$Message, [string]$Level = 'INFO')
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "$timestamp [$Level] $Message" | Tee-Object -FilePath "$logDir\hooks.log" -Append
}

function Install-Hooks {
    if (-not (Test-Path "$Repo\.git")) {
        Write-HookLog "Not a git repo: $Repo" ERROR
        exit 1
    }

    New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null

    # Pre-commit: validator only (fast)
    # pwsh refuses to run extensionless script files even via -File, so the
    # git hook itself is a POSIX shim that execs a real .ps1 sidecar.
    $preCommitHook = @"
# Auto-generated pre-commit hook. Do not edit.
# Fast validation gate: validator only

`$ciScript = 'C:\dev\ci-pipeline.ps1'
if (-not (Test-Path `$ciScript)) {
    Write-Error "CI pipeline not found at `$ciScript"
    exit 1
}

& `$ciScript -Stage validator -Verbose
`$exitCode = `$LASTEXITCODE

if (`$exitCode -eq 1) {
    Write-Error "Pre-commit validation failed"
    exit 1
}

exit 0
"@

    $preCommitShim = @"
#!/bin/sh
exec pwsh -NoProfile -File "`$(dirname "`$0")/pre-commit.ps1" "`$@"
"@

    $preCommitHook | Out-File -FilePath "$hooksDir\pre-commit.ps1" -Encoding utf8NoBOM -Force
    $preCommitShim | Out-File -FilePath "$hooksDir\pre-commit" -Encoding utf8NoBOM -Force
    chmod +x "$hooksDir\pre-commit" 2>$null
    Write-HookLog "+ Pre-commit hook installed (validator only)" INFO

    # Post-merge: full pipeline (integration)
    $postMergeHook = @"
# Auto-generated post-merge hook. Do not edit.
# Integration check: full pipeline

`$ciScript = 'C:\dev\ci-pipeline.ps1'
if (-not (Test-Path `$ciScript)) {
    Write-Error "CI pipeline not found at `$ciScript"
    exit 0
}

& `$ciScript -Verbose -SkipCowork
`$exitCode = `$LASTEXITCODE

if (`$exitCode -ge 1) {
    Write-Error "Post-merge integration check warnings (exit: `$exitCode)"
}

exit 0
"@

    $postMergeShim = @"
#!/bin/sh
exec pwsh -NoProfile -File "`$(dirname "`$0")/post-merge.ps1" "`$@"
"@

    $postMergeHook | Out-File -FilePath "$hooksDir\post-merge.ps1" -Encoding utf8NoBOM -Force
    $postMergeShim | Out-File -FilePath "$hooksDir\post-merge" -Encoding utf8NoBOM -Force
    chmod +x "$hooksDir\post-merge" 2>$null
    Write-HookLog "+ Post-merge hook installed (full pipeline)" INFO

    # Pre-push: security auditor
    # Scoped to skills/ (per-skill, matching the auditor's documented
    # "audit one skill directory before install" purpose) and utilities/ --
    # NOT the whole repo toplevel, which pulls in every sibling project
    # (vendored binaries, unrelated .env files) the auditor was never meant
    # to gate.
    $prePushHook = @"
#!/bin/bash

# Prevent pushes if security audit fails
echo -e "\033[36m[Hook]\033[0m Executing pre-push static analysis audit..."

REPO_ROOT="`$(git rev-parse --show-toplevel)"
AUDITOR="`$REPO_ROOT/skills/skill-security-auditor/src/skill_security_auditor.py"
FAIL=0

for d in "`$REPO_ROOT"/skills/*/; do
  [ -d "`$d" ] || continue
  python "`$AUDITOR" "`$d" || FAIL=1
done

if [ -d "`$REPO_ROOT/utilities" ]; then
  python "`$AUDITOR" "`$REPO_ROOT/utilities" || FAIL=1
fi

if [ `$FAIL -ne 0 ]; then
  echo -e "\033[31m[Hook Fail]\033[0m Security vulnerabilities detected. Push blocked."
  exit 1
fi

echo -e "\033[32m[Hook Pass]\033[0m No critical security issues found. Proceeding with push."
exit 0
"@

    $prePushHook | Out-File -FilePath "$hooksDir\pre-push" -Encoding utf8NoBOM -Force
    chmod +x "$hooksDir\pre-push" 2>$null
    Write-HookLog "+ Pre-push hook installed (security auditor)" INFO

    Write-Host "+ Git hooks installed in $Repo"
}

function Uninstall-Hooks {
    $preCommitPath = "$hooksDir\pre-commit"
    $postMergePath = "$hooksDir\post-merge"
    $prePushPath = "$hooksDir\pre-push"

    Remove-Item -Path $preCommitPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$preCommitPath.ps1" -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $postMergePath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$postMergePath.ps1" -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $prePushPath -Force -ErrorAction SilentlyContinue

    Write-HookLog "+ Git hooks removed from $Repo" INFO
    Write-Host "+ Git hooks removed"
}

function Test-Hooks {
    Write-Host "Testing git hooks..."
    Write-HookLog "=== TESTING GIT HOOKS ===" INFO

    if (-not (Test-Path "$Repo\.git")) {
        Write-HookLog "Not a git repo: $Repo" ERROR
        exit 1
    }

    $preCommitPath = "$hooksDir\pre-commit"
    $postMergePath = "$hooksDir\post-merge"
    $prePushPath = "$hooksDir\pre-push"

    # Test pre-commit
    Write-Host "Testing pre-commit hook..."
    if (Test-Path $preCommitPath) {
        Write-HookLog "Pre-commit hook exists: $preCommitPath" INFO
        & $preCommitPath
        $exitCode = $LASTEXITCODE
        Write-HookLog "Pre-commit test exit code: $exitCode" INFO
    }
    else {
        Write-HookLog "Pre-commit hook NOT found" WARN
    }

    # Test post-merge
    Write-Host "Testing post-merge hook..."
    if (Test-Path $postMergePath) {
        Write-HookLog "Post-merge hook exists: $postMergePath" INFO
        & $postMergePath
        $exitCode = $LASTEXITCODE
        Write-HookLog "Post-merge test exit code: $exitCode" INFO
    }
    else {
        Write-HookLog "Post-merge hook NOT found" WARN
    }

    # Test pre-push
    Write-Host "Testing pre-push hook..."
    if (Test-Path $prePushPath) {
        Write-HookLog "Pre-push hook exists: $prePushPath" INFO
        & $prePushPath
        $exitCode = $LASTEXITCODE
        Write-HookLog "Pre-push test exit code: $exitCode" INFO
    }
    else {
        Write-HookLog "Pre-push hook NOT found" WARN
    }

    Write-Host "+ Hook tests complete"
}

function Get-HookStatus {
    Write-Host "Git hook status for $Repo"
    Write-Host ""

    $preCommitPath = "$hooksDir\pre-commit"
    $postMergePath = "$hooksDir\post-merge"
    $prePushPath = "$hooksDir\pre-push"

    if (Test-Path $preCommitPath) {
        Write-Host "+ Pre-commit hook installed"
    }
    else {
        Write-Host "✗ Pre-commit hook missing"
    }

    if (Test-Path $postMergePath) {
        Write-Host "+ Post-merge hook installed"
    }
    else {
        Write-Host "✗ Post-merge hook missing"
    }

    if (Test-Path $prePushPath) {
        Write-Host "+ Pre-push hook installed"
    }
    else {
        Write-Host "✗ Pre-push hook missing"
    }

    if ((Test-Path $preCommitPath) -and (Test-Path $postMergePath) -and (Test-Path $prePushPath)) {
        Write-Host ""
        Write-Host "Log file: $logDir\hooks.log"
    }
}

switch ($Action) {
    'Install' { Install-Hooks }
    'Uninstall' { Uninstall-Hooks }
    'Test' { Test-Hooks }
    'Status' { Get-HookStatus }
}
