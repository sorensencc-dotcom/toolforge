<#
.SYNOPSIS
Global distribution synchronizer for writing-heuristics skill.

.DESCRIPTION
Manages NTFS junction distribution to global LLM surfaces:
- ~/.gemini/config/skills/writing-heuristics
- ~/.agents/skills/writing-heuristics
- ~/.claude/skills/writing-heuristics
#>

param (
    [switch]$Uninstall,
    [switch]$Verify,
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'

# Resolve source dynamically relative to script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path (Join-Path $scriptDir '..')).Path

if (-not (Test-Path (Join-Path $source 'skill.json'))) {
    Write-Error "CRITICAL: Valid skill source not found at $source"
    exit 1
}

$targets = @(
    "$HOME\.gemini\config\skills\writing-heuristics",
    "$HOME\.agents\skills\writing-heuristics",
    "$HOME\.claude\skills\writing-heuristics"
)

function Test-IsManagedJunction($path) {
    if (-not (Test-Path $path)) { return $false }
    $item = Get-Item $path -Force
    if ($item.LinkType -ne 'Junction') { return $false }
    $targetVal = (Get-Item $path).Target
    if ($targetVal -is [array]) { $targetVal = $targetVal[0] }
    if (-not $targetVal) { return $false }
    return ($targetVal.TrimEnd('\/')) -ieq ($source.TrimEnd('\/'))
}

if ($Verify) {
    $allValid = $true
    foreach ($t in $targets) {
        $valid = Test-IsManagedJunction $t
        if (-not $valid) { $allValid = $false }
        if (-not $Silent) {
            Write-Host "Target $t : $(if ($valid) {'VALID JUNCTION'} else {'NOT MANAGED / MISSING'})"
        }
    }
    if ($allValid) {
        exit 0
    } else {
        exit 1
    }
}

# Pre-flight check: ensure no targets are unmanaged real files/directories or broken junctions
foreach ($target in $targets) {
    if ((Test-Path $target) -and (-not (Test-IsManagedJunction $target))) {
        Write-Error "PRE-FLIGHT ABORT: Target path exists and is NOT a managed junction: $target. Manual inspection required."
        exit 1
    }
}

# Execution loop
foreach ($target in $targets) {
    if (Test-Path $target) {
        if (Test-IsManagedJunction $target) {
            if (-not $Silent) { Write-Host "Removing existing managed junction: $target" }
            [System.IO.Directory]::Delete($target)
        }
    }

    if (-not $Uninstall) {
        $parent = Split-Path $target -Parent
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        New-Item -ItemType Junction -Path $target -Value $source | Out-Null
        if (-not $Silent) { Write-Host "Created managed junction: $target -> $source" }
    }
}

# Post-execution verification
if (-not $Uninstall) {
    foreach ($t in $targets) {
        if (-not (Test-IsManagedJunction $t)) {
            Write-Error "POST-SYNC FAILURE: Target junction was not verified as healthy: $t"
            exit 1
        }
    }
    if (-not $Silent) { Write-Host "All global sync targets successfully provisioned and verified!" }
}
