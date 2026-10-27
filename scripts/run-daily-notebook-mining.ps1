[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SimulatePackError,
    [string]$DataRoot = $env:MINING_DATA_ROOT
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DataRoot) -or -not (Test-Path -LiteralPath $DataRoot -PathType Container)) {
    Write-Error "MINING_DATA_ROOT_UNSET: set -DataRoot or `$env:MINING_DATA_ROOT to an existing directory (got '$DataRoot')."
    exit 1
}
$DataRoot = (Resolve-Path -LiteralPath $DataRoot).Path
$env:MINING_DATA_ROOT = $DataRoot

Write-Host "`n=== [CIC NIGHTLY MINING PREFLIGHT] ===" -ForegroundColor Cyan
Write-Host "Data root: $DataRoot"
& pwsh -NoProfile -File (Join-Path $PSScriptRoot 'verify-repo-context.ps1') -Path $DataRoot
if ($LASTEXITCODE -ne 0) {
    Write-Error "Repository context preflight failed."
    exit 1
}

$argsList = @((Join-Path $PSScriptRoot 'run-daily-notebook-mining.mjs'))
if ($DryRun) { $argsList += "--dry-run" }
if ($SimulatePackError) { $argsList += "--simulate-pack-error" }

& node $argsList
exit $LASTEXITCODE
