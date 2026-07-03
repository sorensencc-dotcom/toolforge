#!/usr/bin/env pwsh
<#
.SYNOPSIS
Unified CI/CD pipeline for Toolforge Phase-1 automation.
Chains all 5 subsystems in deterministic order.

.DESCRIPTION
Stages:
1. Toolforge Validator (gatekeeper)
2. Skillpack Metadata Generator
3. Dependency Graph Generator
4. Runtime Health Checks
5. Cowork Auto-Sync (optional)

Exit codes:
0 = all stages passed
1 = validator/runtime failed (blocking)
2 = metadata/graph/cowork warned (non-blocking)

.PARAMETER Stage
Run specific stage only. Options: validator, metadata, graph, health, cowork, all
Default: all

.PARAMETER SkipCowork
Skip cowork sync stage (default: include)

.PARAMETER Verbose
Enable verbose logging

.EXAMPLE
./ci-pipeline.ps1 -Verbose
./ci-pipeline.ps1 -Stage validator
./ci-pipeline.ps1 -SkipCowork
#>

param(
    [ValidateSet('validator', 'metadata', 'graph', 'health', 'cowork', 'all')]
    [string]$Stage = 'all',
    [switch]$SkipCowork = $true,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$toolforgeRoot = 'C:\dev\toolforge'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$logDir = "$toolforgeRoot\logs\ci"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = "$logDir\ci-pipeline-$timestamp.log"

function Write-Log {
    param([string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR', 'PASS', 'FAIL')]$Level = 'INFO')
    $prefix = "[$(Get-Date -Format 'HH:mm:ss')] [$Level]"
    "$prefix $Message" | Tee-Object -FilePath $logFile -Append
}

function Invoke-Stage {
    param([string]$Name, [scriptblock]$Script, [switch]$Blocking)
    Write-Log "=== STAGE: $Name ===" INFO
    try {
        & $Script
        Write-Log "✓ $Name passed" PASS
        return @{ Status = 'PASS'; Name = $Name; Blocking = $Blocking }
    }
    catch {
        Write-Log "✗ $Name failed: $_" FAIL
        return @{ Status = 'FAIL'; Name = $Name; Blocking = $Blocking; Error = $_ }
    }
}

# Stage 1: Validator (blocking)
$results = @()
if ($Stage -in 'validator', 'all') {
    $results += Invoke-Stage 'Toolforge Validator' {
        & "$toolforgeRoot\utilities\toolforgeSkillValidator.ps1" -Verbose:$Verbose
    } -Blocking
}

# Stage 2: Metadata Generator
if ($Stage -in 'metadata', 'all') {
    $results += Invoke-Stage 'Skillpack Metadata Generator' {
        & "$toolforgeRoot\utilities\toolforgeMetadataGenerator.ps1" -Verbose:$Verbose
    }
}

# Stage 3: Dependency Graph
if ($Stage -in 'graph', 'all') {
    $results += Invoke-Stage 'Dependency Graph Generator' {
        & "$toolforgeRoot\utilities\toolforgeDependencyGraph.ps1" -Verbose:$Verbose
    }
}

# Stage 4: Runtime Health Checks (blocking)
if ($Stage -in 'health', 'all') {
    $results += Invoke-Stage 'Runtime Health Checks' {
        & "$toolforgeRoot\utilities\toolforgeSkillHealthCheck.ps1" -Verbose:$Verbose
    } -Blocking
}

# Stage 5: Cowork Sync (optional)
if (-not $SkipCowork -and $Stage -in 'cowork', 'all') {
    $results += Invoke-Stage 'Cowork Auto-Sync' {
        & "$toolforgeRoot\daemons\cowork-auto-sync.ps1" -Verbose:$Verbose
    }
}

# Summary
Write-Log "" INFO
Write-Log "=== SUMMARY ===" INFO
$passed = ($results | Where-Object { $_.Status -eq 'PASS' }).Count
$failed = ($results | Where-Object { $_.Status -eq 'FAIL' }).Count
$blocking = ($results | Where-Object { $_.Status -eq 'FAIL' -and $_.Blocking }).Count

Write-Log "Passed: $passed | Failed: $failed | Blocking: $blocking" INFO

$results | Where-Object { $_.Status -eq 'FAIL' } | ForEach-Object {
    Write-Log "  ✗ $($_.Name): $($_.Error)" FAIL
}

Write-Log "Pipeline log: $logFile" INFO

# Exit codes
if ($blocking -gt 0) {
    Write-Log "PIPELINE FAILED (blocking errors)" FAIL
    exit 1
}
elseif ($failed -gt 0) {
    Write-Log "PIPELINE COMPLETED WITH WARNINGS" WARN
    exit 2
}
else {
    Write-Log "PIPELINE PASSED" PASS
    exit 0
}
