<#
.SYNOPSIS
  Generate a CHANGELOG.md entry from git history since the last tag
  (Phase 2b Step 3.2).

.DESCRIPTION
  Reads the current version from VersionFile, collects commits since the
  last annotated/lightweight tag in RepoRoot (or the full history if no tag
  exists yet), and prepends a new "## Version X.Y.Z" section to OutputFile
  with newest changes at the top.

  [Rule 1 auto-fix] The plan's original snippet used bash-isms
  (`git describe ... 2>$null || "initial"`) that are fragile across
  PowerShell editions/hosts. This uses explicit $LASTEXITCODE checks so
  behavior is deterministic on both Windows PowerShell 5.1 and pwsh 7+.

.PARAMETER OutputFile
  Path to CHANGELOG.md. Default: C:\dev\toolforge\CHANGELOG.md

.PARAMETER VersionFile
  Path to VERSION.md. Default: C:\dev\toolforge\VERSION.md

.PARAMETER RepoRoot
  Git repository root to read history from. Default: C:\dev\toolforge

.EXAMPLE
  ./generate-changelog.ps1
  ./generate-changelog.ps1 -OutputFile C:\dev\toolforge\CHANGELOG.md
#>

param(
  [string]$OutputFile  = "C:\dev\toolforge\CHANGELOG.md",
  [string]$VersionFile = "C:\dev\toolforge\VERSION.md",
  [string]$RepoRoot    = "C:\dev\toolforge"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $VersionFile)) {
  Write-Host "Version file not found: $VersionFile" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
  Write-Host "Not a git repository root: $RepoRoot" -ForegroundColor Red
  exit 1
}

# ---- Current version (for the section heading) ----
$versionContent = Get-Content $VersionFile -Raw
$versionMatch = [regex]::Match($versionContent, '(?m)^version:\s*(\d+\.\d+\.\d+)\s*$')
if (-not $versionMatch.Success) {
  Write-Host "Could not find a 'version: X.Y.Z' line in $VersionFile" -ForegroundColor Red
  exit 1
}
$currentVersion = $versionMatch.Groups[1].Value

# ---- Last tag (explicit exit-code check; no bash-style '||' fallback) ----
$lastTag = $null
$tagOutput = git -C $RepoRoot describe --tags --abbrev=0 2>$null
if ($LASTEXITCODE -eq 0 -and $tagOutput) {
  $lastTag = $tagOutput.Trim()
}

if ($lastTag) {
  $range = "$lastTag..HEAD"
} else {
  $range = "HEAD"
}

$rawCommits = git -C $RepoRoot log $range --pretty=format:"%h - %s (%an)" 2>$null
$commitLines = @()
if ($rawCommits) {
  $commitLines = $rawCommits -split "`n" | Where-Object { $_.Trim() -ne "" }
}

$changesBlock = if ($commitLines.Count -gt 0) {
  ($commitLines | ForEach-Object { "- $_" }) -join "`n"
} else {
  "- No changes recorded since $(if ($lastTag) { $lastTag } else { 'repository start' })."
}

$dateStr = Get-Date -Format 'yyyy-MM-dd'

$entry = @"
## Version $currentVersion
Date: $dateStr

### Changes
$changesBlock

"@

$oldContent = ""
if (Test-Path $OutputFile) {
  $oldContent = Get-Content $OutputFile -Raw -ErrorAction SilentlyContinue
  if ($null -eq $oldContent) { $oldContent = "" }
}

# [Rule 1 auto-fix] The naive prepend-in-front-of-everything approach would
# push a pre-existing "# Changelog" H1 title below the newest entry on every
# run, corrupting document structure after the first regeneration. Strip a
# leading "# Changelog" heading (if present) from the old body, then always
# re-emit exactly one H1 at the top, followed by entries newest-first.
$oldBody = [regex]::Replace($oldContent, '(?s)^\s*#\s*Changelog\s*\r?\n+', '')

Set-Content -Path $OutputFile -Value ("# Changelog`n`n" + $entry + "`n" + $oldBody) -NoNewline -Encoding utf8

Write-Host "Changelog updated: $OutputFile (version $currentVersion, $($commitLines.Count) commit(s) since $(if ($lastTag) { $lastTag } else { 'start' }))" -ForegroundColor Green
