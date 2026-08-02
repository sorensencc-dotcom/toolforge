#!/usr/bin/env pwsh
[CmdletBinding()]
param([string]$Path = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Path).Path
function Write-Check([string]$Label, [bool]$Pass, [string]$Detail) {
  $status = if ($Pass) { 'PASS' } else { 'WARN' }
  $color = if ($Pass) { 'Green' } else { 'Yellow' }
  Write-Host ("[{0}] {1}: {2}" -f $status, $Label, $Detail) -ForegroundColor $color
}
Write-Host 'Workspace preflight (read-only)' -ForegroundColor Cyan
Write-Host "Root: $root"
$gitRoot = (& git -C $root rev-parse --show-toplevel 2>$null)
$normalizedGitRoot = if ($gitRoot) { [IO.Path]::GetFullPath($gitRoot.Trim()).TrimEnd('\') } else { '' }
$normalizedRoot = [IO.Path]::GetFullPath($root).TrimEnd('\')
$isRepo = $LASTEXITCODE -eq 0 -and $normalizedGitRoot -ieq $normalizedRoot
Write-Check 'repository root' $isRepo ($(if ($isRepo) { $gitRoot.Trim() } else { 'path is not the repository root' }))
$branch = (& git -C $root branch --show-current 2>$null).Trim()
Write-Check 'branch' (-not [string]::IsNullOrWhiteSpace($branch)) ($(if ($branch) { $branch } else { 'detached or unavailable' }))
$paths = @(
  @{ Label = 'governance rules'; Path = 'docs/meta/governance/global-operating-rules-cic-rewrite-labs.md'; Alternate = 'docs/meta/global-operating-rules-cic-rewrite-labs.md' },
  @{ Label = 'agent instructions'; Path = 'AGENTS.md' },
  @{ Label = 'workspace instructions'; Path = 'CLAUDE.md' },
  @{ Label = 'index validator'; Path = 'scripts/validate-codebase-index.ps1' },
  @{ Label = 'skill validator'; Path = 'utilities/skill-doc-validator.ps1' }
)
foreach ($item in $paths) {
  $primary = Join-Path $root $item.Path
  $alternate = if ($item.Alternate) { Join-Path $root $item.Alternate } else { $null }
  $found = if (Test-Path -LiteralPath $primary) { $item.Path } elseif ($alternate -and (Test-Path -LiteralPath $alternate)) { $item.Alternate } else { $null }
  Write-Check $item.Label ($null -ne $found) ($(if ($found) { $found } else { "ready to add: $($item.Path)" }))
}
$validators = @(
  @{ Label = 'index validator'; Available = (Test-Path (Join-Path $root 'scripts/validate-codebase-index.ps1')); Command = 'npm run index:validate' },
  @{ Label = 'full pre-flight'; Available = (Test-Path (Join-Path $root 'package.json')); Command = 'npm run pre-flight' },
  @{ Label = 'skill validator'; Available = (Test-Path (Join-Path $root 'utilities/skill-doc-validator.ps1')); Command = 'pwsh -NoProfile -File utilities/skill-doc-validator.ps1 -Path ./skills -Recursive' }
)
foreach ($validator in $validators) { Write-Check "validator: $($validator.Label)" $validator.Available ($(if ($validator.Available) { $validator.Command } else { 'unavailable in this checkout' })) }
Write-Host ''
Write-Host 'Proof layers (report separately):' -ForegroundColor Cyan
Write-Host '  L1 local typecheck/build   compiler or build command passed'
Write-Host '  L2 focused tests           targeted suite passed'
Write-Host '  L3 full suite              complete local test command passed'
Write-Host '  L4 hosted CI               remote workflow completed successfully'
Write-Host '  L5 production/runtime      deployed or live runtime evidence collected'
Write-Host 'Result: PREFLIGHT_COMPLETE (warnings are informational; no writes performed)'
