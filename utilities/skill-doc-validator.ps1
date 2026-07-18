<#
.SYNOPSIS
  Validates skill documentation compliance against Skill Operator Guide.

.DESCRIPTION
  Checks:
  - README.md < 100 lines
  - SKILL.md < 150 lines
  - No duplicate standard sections (Setup, Requirements, Configuration, Error Handling, Testing)
  - Both files reference Skill Operator Guide or link to specific sections
  - Input/Output schemas are types-only (no narrative prose)

.PARAMETER Path
  Skill directory to validate (e.g., skills/kb-sync-artifact-generator)

.PARAMETER Fix
  Auto-fix common issues (remove duplicate sections, add links)

.EXAMPLE
  .\skill-doc-validator.ps1 -Path skills/kb-sync-artifact-generator
  .\skill-doc-validator.ps1 -Path skills -Recursive
#>

param(
  [string]$Path = 'skills',
  [switch]$Recursive,
  [switch]$Fix,
  [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$WarningPreference = if ($Verbose) { 'Continue' } else { 'SilentlyContinue' }

$errors = @()
$warnings = @()

function Test-SkillDocumentation {
  param([string]$skillPath)

  $readmePath = Join-Path $skillPath 'README.md'
  $skillMdPath = Join-Path $skillPath 'SKILL.md'

  if (-not (Test-Path $readmePath) -or -not (Test-Path $skillMdPath)) {
    return $null
  }

  $readme = Get-Content $readmePath -Raw
  $skillMd = Get-Content $skillMdPath -Raw
  $readmeLines = @($readme -split '\n').Count
  $skillMdLines = @($skillMd -split '\n').Count

  $issues = @()

  # Check line limits
  if ($readmeLines -gt 100) {
    $issues += "README.md has $readmeLines lines (max 100)"
  }
  if ($skillMdLines -gt 150) {
    $issues += "SKILL.md has $skillMdLines lines (max 150)"
  }

  # Check for duplicate sections
  $duplicateSections = @(
    'Setup',
    'Installation',
    'Requirements',
    'Configuration',
    'Error Handling',
    'Troubleshooting',
    'Testing'
  )

  foreach ($section in $duplicateSections) {
    $readmeHas = $readme -match "##\s+$section"
    $skillMdHas = $skillMd -match "##\s+$section"
    if ($readmeHas -and $skillMdHas) {
      $issues += "Duplicate section in both files: $section (move to USAGE.md or Skill Operator Guide)"
    }
  }

  # Check for Skill Operator Guide link
  $hasGuideLink = ($readme -match 'skill-operator-guide') -or ($skillMd -match 'skill-operator-guide')
  if (-not $hasGuideLink) {
    $issues += "Neither README.md nor SKILL.md reference Skill Operator Guide"
  }

  # Check Input/Output schemas for narrative prose
  if ($skillMd -match '## Input Schema[\s\S]*?```[\s\S]*?```' -and $skillMd -match 'This\s+(input|parameter).*?(allows|enables|provides)') {
    $issues += 'Input schema contains narrative prose (should be types only)'
  }

  return @{
    Path     = $skillPath
    Lines    = @{ README = $readmeLines; SKILL = $skillMdLines }
    Issues   = $issues
  }
}

# Find skills
if ($Recursive) {
  $skillDirs = Get-ChildItem -Path $Path -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'README.md') }
} else {
  $skillDirs = @(Get-Item -Path $Path -ErrorAction SilentlyContinue)
}

foreach ($skillDir in $skillDirs) {
  $result = Test-SkillDocumentation $skillDir.FullName
  if ($result -and $result.Issues.Count -gt 0) {
    $errors += $result
  }
}

# Report
if ($errors.Count -eq 0) {
  Write-Host "✅ All skills pass documentation compliance" -ForegroundColor Green
  exit 0
}

Write-Host "❌ Documentation compliance failures:" -ForegroundColor Red
foreach ($error in $errors) {
  Write-Host "  $($error.Path):"
  foreach ($issue in $error.Issues) {
    Write-Host "    - $issue" -ForegroundColor Yellow
  }
}

exit 1
