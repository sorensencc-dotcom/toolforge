<#
.SYNOPSIS
  Orchestrates deterministic diagram generation and documentation synthesis across the repository.
.DESCRIPTION
  Runs workflow-recon to discover undocumented workflows and generate draft specs and diagrams.
  Runs diagram-sync to convert Mermaid blocks to Cathryn Lavery HTML+SVG and render matching PNG assets.
  Runs docs-synthesizer to audit writing heuristics and synchronize local wiki pages.
.PARAMETER Path
  Target path or directory to scan. Defaults to repository root.
.PARAMETER DryRun
  Runs in validation mode without mutating files or generating images.
.PARAMETER Fix
  Automatically writes updated HTML files, renders PNGs, and fixes markdown embeds.
.PARAMETER GenerateWorkflows
  Automatically authors documentation and Cathryn Lavery diagrams for undocumented workflows.
.PARAMETER Push
  Pushes staged wiki updates to remote repository.
#>
param(
  [string]$Path = "",
  [switch]$DryRun,
  [switch]$Fix,
  [switch]$GenerateWorkflows,
  [switch]$Push
)

if ($Path -match '^--?path=(.*)$') { $Path = $Matches[1] }
for ($i = 0; $i -lt $args.Length; $i++) {
  $a = $args[$i]
  if ($a -match '^--?path=(.+)$') {
    $val = $Matches[1]
    if ($val -match '^[a-zA-Z]$' -and ($i + 1 -lt $args.Length) -and $args[$i + 1] -match '^[\\/]') {
      $val = "$val`:" + $args[$i + 1]
      $i++
    }
    $Path = $val
  }
  elseif ($a -match '^--?path$') {
    if ($i + 1 -lt $args.Length) {
      $Path = $args[$i + 1]
      $i++
    }
  }
  if ($a -match '^--?dry-run') { $DryRun = $true }
  if ($a -match '^--?fix') { $Fix = $true }
  if ($a -match '^--?generate') { $GenerateWorkflows = $true }
}

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Toolforge Documentation and Diagram Sync Pipeline" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Workflow Reconnaissance
$reconArgs = @()
if ($Path) { $reconArgs += "--path=$Path" }
if ($DryRun) { $reconArgs += "--dry-run" }
if ($Fix -or $GenerateWorkflows) { $reconArgs += "--generate" }

Write-Host "[1/3] Executing workflow reconnaissance..." -ForegroundColor Yellow
$reconScript = Join-Path $repoRoot "scripts\workflow-recon.mjs"
node $reconScript @reconArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "Workflow reconnaissance failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

# 2. Diagram Engine
$diagramArgs = @()
if ($DryRun) { $diagramArgs += "--dry-run" }
if ($Fix) { $diagramArgs += "--fix" }
if ($Path) { $diagramArgs += "--path=$Path" }

Write-Host "[2/3] Executing diagram sync engine..." -ForegroundColor Yellow
$diagramScript = Join-Path $repoRoot "scripts\diagram-sync.mjs"
node $diagramScript @diagramArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "Diagram synchronization failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

# 3. Documentation Synthesizer & Wiki Sync
$docsArgs = @("--audit", "--sync-wiki")
if ($DryRun) { $docsArgs += "--dry-run" }
if ($Push) { $docsArgs += "--push" }
if ($Path) { $docsArgs += "--path=$Path" }

Write-Host "[3/3] Executing documentation synthesizer and wiki sync..." -ForegroundColor Yellow
$docsScript = Join-Path $repoRoot "scripts\docs-synthesizer.mjs"
node $docsScript @docsArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "Documentation synthesis failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "Documentation and diagram synchronization complete." -ForegroundColor Green
exit 0
