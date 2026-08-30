[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SimulatePackError
)

$ErrorActionPreference = "Stop"
$root = "C:\dev"

Write-Host "`n=== [CIC NIGHTLY MINING PREFLIGHT] ===" -ForegroundColor Cyan
& pwsh -NoProfile -File "$root\scripts\verify-repo-context.ps1" -Path $root
if ($LASTEXITCODE -ne 0) {
    Write-Error "Repository context preflight failed."
    exit 1
}

$argsList = @("$root\scripts\run-daily-notebook-mining.mjs")
if ($DryRun) { $argsList += "--dry-run" }
if ($SimulatePackError) { $argsList += "--simulate-pack-error" }

& node $argsList
exit $LASTEXITCODE
