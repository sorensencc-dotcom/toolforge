<#
.SYNOPSIS
  Semver bump for Toolforge VERSION.md (Phase 2b Step 3.1).

.DESCRIPTION
  Reads the `version: X.Y.Z` line from VersionFile, bumps it per -BumpType,
  and rewrites both the version line and the date line in place. Idempotent
  in the sense that re-running with the same BumpType always produces a
  strictly-greater version — never silently no-ops.

  Emits the resulting version two ways:
    - Write-Host, for interactive/log use.
    - $env:GITHUB_OUTPUT (if set), as `version=X.Y.Z`, for GitHub Actions.
      [Rule 1 auto-fix] The plan's original snippet used the deprecated
      `::set-output name=version::` workflow command, which GitHub Actions
      has stopped honoring (removed 2023-06) — using it would silently fail
      to pass the version to downstream steps. GITHUB_OUTPUT is the current
      mechanism.

.PARAMETER BumpType
  'patch' | 'minor' | 'major'. Default: 'patch'.

.PARAMETER VersionFile
  Path to VERSION.md. Default: C:\dev\toolforge\VERSION.md

.OUTPUTS
  Writes the new semver string to the pipeline (e.g. "1.2.0") so callers can
  capture it: $new = ./bump-version.ps1 -BumpType minor

.EXAMPLE
  ./bump-version.ps1 -BumpType patch
  ./bump-version.ps1 -BumpType minor -VersionFile C:\dev\toolforge\VERSION.md
#>

param(
  [ValidateSet('patch', 'minor', 'major')]
  [string]$BumpType = 'patch',

  [string]$VersionFile = "C:\dev\toolforge\VERSION.md"
)

$ErrorActionPreference = "Stop"

# [Rule 2 auto-add] Spec had no existence/format guard — a missing or malformed
# VERSION.md would previously fail deep inside regex indexing with a confusing
# error. Fail fast with an actionable message instead.
if (-not (Test-Path $VersionFile)) {
  Write-Host "Version file not found: $VersionFile" -ForegroundColor Red
  exit 1
}

$content = Get-Content $VersionFile -Raw

$match = [regex]::Match($content, '(?m)^version:\s*(\d+)\.(\d+)\.(\d+)\s*$')
if (-not $match.Success) {
  Write-Host "Could not find a 'version: X.Y.Z' line in $VersionFile" -ForegroundColor Red
  exit 1
}

$currentVersion = "$($match.Groups[1].Value).$($match.Groups[2].Value).$($match.Groups[3].Value)"
$major = [int]$match.Groups[1].Value
$minor = [int]$match.Groups[2].Value
$patch = [int]$match.Groups[3].Value

switch ($BumpType) {
  'major' { $major++; $minor = 0; $patch = 0 }
  'minor' { $minor++; $patch = 0 }
  'patch' { $patch++ }
}

$newVersion = "$major.$minor.$patch"

# Line-anchored replacement — replaces only the version/date lines, not any
# incidental "version: x.y.z" substring elsewhere in the file body.
$newContent = [regex]::Replace($content, '(?m)^version:\s*\d+\.\d+\.\d+\s*$', "version: $newVersion")
$newContent = [regex]::Replace($newContent, '(?m)^date:\s*.*$', "date: $(Get-Date -Format 'yyyy-MM-dd')")

Set-Content -Path $VersionFile -Value $newContent -NoNewline -Encoding utf8

Write-Host "Version bumped: $currentVersion -> $newVersion ($BumpType)" -ForegroundColor Green

# GitHub Actions output (modern GITHUB_OUTPUT file mechanism).
if ($env:GITHUB_OUTPUT) {
  "version=$newVersion" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
  "previous_version=$currentVersion" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
}

# Pipeline-usable return value.
Write-Output $newVersion
