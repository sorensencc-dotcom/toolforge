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
$logDir = "C:\dev\toolforge\logs\hooks"
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
    $preCommitHook = @"
#!/usr/bin/env pwsh
# Auto-generated pre-commit hook. Do not edit.
# Fast validation gate: validator only

`$ciScript = 'C:\dev\toolforge\ci-pipeline.ps1'
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

    $preCommitHook | Out-File -FilePath "$hooksDir\pre-commit" -Encoding UTF8 -Force
    if ($PSVersionTable.Platform -ne 'Win32NT') {
        chmod +x "$hooksDir\pre-commit" 2>$null
    }
    Write-HookLog "✓ Pre-commit hook installed (validator only)" INFO

    # Post-merge: full pipeline (integration)
    $postMergeHook = @"
#!/usr/bin/env pwsh
# Auto-generated post-merge hook. Do not edit.
# Integration check: full pipeline

`$ciScript = 'C:\dev\toolforge\ci-pipeline.ps1'
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

    $postMergeHook | Out-File -FilePath "$hooksDir\post-merge" -Encoding UTF8 -Force
    if ($PSVersionTable.Platform -ne 'Win32NT') {
        chmod +x "$hooksDir\post-merge" 2>$null
    }
    Write-HookLog "✓ Post-merge hook installed (full pipeline)" INFO

    Write-Host "✓ Git hooks installed in $Repo"
}

function Uninstall-Hooks {
    $preCommitPath = "$hooksDir\pre-commit"
    $postMergePath = "$hooksDir\post-merge"

    Remove-Item -Path $preCommitPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $postMergePath -Force -ErrorAction SilentlyContinue

    Write-HookLog "✓ Git hooks removed from $Repo" INFO
    Write-Host "✓ Git hooks removed"
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

    Write-Host "✓ Hook tests complete"
}

function Get-HookStatus {
    Write-Host "Git hook status for $Repo"
    Write-Host ""

    $preCommitPath = "$hooksDir\pre-commit"
    $postMergePath = "$hooksDir\post-merge"

    if (Test-Path $preCommitPath) {
        Write-Host "✓ Pre-commit hook installed"
    }
    else {
        Write-Host "✗ Pre-commit hook missing"
    }

    if (Test-Path $postMergePath) {
        Write-Host "✓ Post-merge hook installed"
    }
    else {
        Write-Host "✗ Post-merge hook missing"
    }

    if ((Test-Path $preCommitPath) -and (Test-Path $postMergePath)) {
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
