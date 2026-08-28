#!/usr/bin/env pwsh
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Path,
  [string]$ExpectedRepository,
  [string]$ExpectedBranch
)

$ErrorActionPreference = 'Stop'

if (-not [IO.Path]::IsPathRooted($Path)) {
  throw "Repository path must be absolute: '$Path'"
}

$resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
$root = [IO.Path]::GetFullPath($resolved).TrimEnd('\')
$gitRootRaw = (& git -C $root rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitRootRaw)) {
  throw "Not a Git repository: '$root'"
}

$gitRoot = [IO.Path]::GetFullPath($gitRootRaw.Trim()).TrimEnd('\')
if (-not $gitRoot.Equals($root, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Path is not the repository root. Provided '$root'; Git root is '$gitRoot'."
}

$branch = (& git -C $root branch --show-current 2>$null).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) {
  throw "Repository is detached or branch could not be determined: '$root'"
}
if ($ExpectedRepository -and -not $gitRoot.Equals(([IO.Path]::GetFullPath($ExpectedRepository)).TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
  throw "Repository identity mismatch. Expected '$ExpectedRepository'; got '$gitRoot'."
}
if ($ExpectedBranch -and $branch -cne $ExpectedBranch) {
  throw "Branch mismatch for '$gitRoot'. Expected '$ExpectedBranch'; got '$branch'."
}

$manifest = Join-Path $root 'package.json'
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
  throw "Root package manifest is missing: '$manifest'"
}

[pscustomobject]@{
  RepositoryRoot = $gitRoot
  Branch = $branch
  Manifest = $manifest
  Status = 'PREFLIGHT_PASS'
}
