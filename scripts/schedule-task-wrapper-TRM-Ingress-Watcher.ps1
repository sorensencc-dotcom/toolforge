# schedule-task-wrapper-TRM-Ingress-Watcher.ps1
# Runs a single sweep or continuous watch of the TRM Ingress staging inbox.

param(
    [switch]$Continuous
)

$RepoRoot = "c:\dev"
$Script = Join-Path $RepoRoot "scripts\trm-ingress-watcher.mjs"

if ($Continuous) {
    Write-Host "[TRM-INGRESS-WATCHER] Starting continuous watcher..." -ForegroundColor Cyan
    node $Script
} else {
    Write-Host "[TRM-INGRESS-WATCHER] Running single-pass sweep..." -ForegroundColor Cyan
    node $Script --once
}
