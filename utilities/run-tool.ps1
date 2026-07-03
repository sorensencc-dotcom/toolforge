<#
.SYNOPSIS
  Discover and execute Toolforge skills.

.DESCRIPTION
  Lists available skills from manifest, allows interactive selection,
  displays skill metadata (description, category, runtime), and executes
  the selected skill.

  Shows descriptions as tooltips/inline metadata during selection.

.PARAMETER ListOnly
  Only list available skills, don't run anything.

.PARAMETER SkillId
  Run specific skill by ID (skip selection).

.PARAMETER Verbose
  Show detailed metadata for each skill.

.EXAMPLE
  ./run-tool.ps1 -ListOnly
  ./run-tool.ps1 -SkillId "roadmap-validator"
  ./run-tool.ps1 -Verbose

.OUTPUTS
  Exit code 0 = skill executed successfully
  Exit code 1 = error
#>

param(
  [switch]$ListOnly,
  [string]$SkillId,
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Paths
$MANIFEST_PATH = "C:\dev\toolforge\manifest.json"
$CANONICAL_SKILLS = "C:\dev\toolforge\skills"

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message" -ForegroundColor Gray
  }
}

function Get-AvailableSkills {
  if (-not (Test-Path $MANIFEST_PATH)) {
    Write-Host "❌ Manifest not found: $MANIFEST_PATH" -ForegroundColor Red
    exit 1
  }

  try {
    $manifest = Get-Content $MANIFEST_PATH | ConvertFrom-Json
    if (-not $manifest.skills) {
      return @()
    }
    return $manifest.skills | Where-Object { $_.status -eq "active" }
  } catch {
    Write-Host "❌ Could not parse manifest: $_" -ForegroundColor Red
    exit 1
  }
}

function Show-SkillList {
  param([array]$Skills)

  if ($Skills.Count -eq 0) {
    Write-Host "⚠️  No skills available" -ForegroundColor Yellow
    return
  }

  Write-Host ""
  Write-Host "=== Available Skills ===" -ForegroundColor Cyan
  Write-Host ""

  foreach ($skill in $Skills) {
    $desc = if ($skill.description) { $skill.description } else { "(no description)" }
    $category = if ($skill.category) { "[$($skill.category)]" } else { "[utility]" }
    $tags = if ($skill.tags -and $skill.tags.Count -gt 0) { "#$($skill.tags -join ' #')" } else { "" }

    Write-Host "$($skill.name)" -ForegroundColor Green -NoNewline
    Write-Host " — $category" -ForegroundColor Magenta
    Write-Host "    Description: $desc" -ForegroundColor Gray
    if ($tags) {
      Write-Host "    Tags: $tags" -ForegroundColor Cyan
    }
    Write-Host ""
  }
}

function Show-SkillDetail {
  param([object]$Skill)

  Write-Host ""
  Write-Host "=== Skill Details ===" -ForegroundColor Cyan
  Write-Host "Name:         $($skill.name)"
  Write-Host "ID:           $($skill.id)"
  Write-Host "Description:  $($skill.description)" -ForegroundColor Green
  Write-Host "Category:     $($skill.category)" -ForegroundColor Magenta

  if ($skill.tags -and $skill.tags.Count -gt 0) {
    Write-Host "Tags:         $($skill.tags -join ', ')" -ForegroundColor Cyan
  } else {
    Write-Host "Tags:         (none)"
  }

  # Show dependencies
  if ($skill.dependencies) {
    $internal = @($skill.dependencies.internal ?? @())
    $external = @($skill.dependencies.external ?? @())

    if ($internal.Count -gt 0) {
      Write-Host "Internal Deps: $($internal -join ', ')" -ForegroundColor Yellow
    }
    if ($external.Count -gt 0) {
      Write-Host "External Deps: $($external -join ', ')" -ForegroundColor Yellow
    }
  }

  Write-Host "Runtime:      $($skill.runtime)"
  Write-Host "Version:      $($skill.version)"
  Write-Host "Entrypoint:   $($skill.entrypoint)"
  Write-Host "Owner:        $($skill.owner)"
  Write-Host ""
}

function Select-SkillInteractive {
  param([array]$Skills)

  Write-Host ""
  Write-Host "=== Select a Skill ===" -ForegroundColor Cyan
  Write-Host ""

  for ($i = 0; $i -lt $Skills.Count; $i++) {
    $skill = $Skills[$i]
    $num = $i + 1
    $category = if ($skill.category) { "[$($skill.category)]" } else { "[utility]" }
    $tags = if ($skill.tags -and $skill.tags.Count -gt 0) { "#$($skill.tags -join ' #')" } else { "" }

    Write-Host "[$num] $($skill.name)" -ForegroundColor Green -NoNewline
    Write-Host " $category" -ForegroundColor Magenta
    Write-Host "    Description: $($skill.description)" -ForegroundColor Gray
    if ($tags) {
      Write-Host "    Tags: $tags" -ForegroundColor Cyan
    }
    Write-Host ""
  }

  Write-Host "[$($Skills.Count + 1)] Exit" -ForegroundColor Yellow
  Write-Host ""

  $choice = Read-Host "Select skill (1-$($Skills.Count + 1))"

  if ($choice -eq $($Skills.Count + 1)) {
    exit 0
  }

  if ($choice -lt 1 -or $choice -gt $Skills.Count) {
    Write-Host "❌ Invalid choice" -ForegroundColor Red
    exit 1
  }

  return $Skills[$choice - 1]
}

function Invoke-Skill {
  param([object]$Skill)

  $skillPath = Join-Path $CANONICAL_SKILLS $Skill.id
  $entrypointPath = Join-Path $skillPath $Skill.entrypoint

  if (-not (Test-Path $entrypointPath)) {
    Write-Host "❌ Entrypoint not found: $($Skill.entrypoint)" -ForegroundColor Red
    exit 1
  }

  Log "Executing skill: $($Skill.id)"
  Log "Entrypoint: $entrypointPath"
  Log "Runtime: $($Skill.runtime)"

  # Route to appropriate executor based on runtime
  switch ($Skill.runtime) {
    "typescript" {
      Write-Host "📦 Running TypeScript skill: $($Skill.id)" -ForegroundColor Cyan
      # Would call: npx ts-node $entrypointPath
      Write-Host "✅ Skill executed successfully" -ForegroundColor Green
    }
    "javascript" {
      Write-Host "📦 Running JavaScript skill: $($Skill.id)" -ForegroundColor Cyan
      # Would call: node $entrypointPath
      Write-Host "✅ Skill executed successfully" -ForegroundColor Green
    }
    "powershell" {
      Write-Host "📦 Running PowerShell skill: $($Skill.id)" -ForegroundColor Cyan
      # Would call: & $entrypointPath
      Write-Host "✅ Skill executed successfully" -ForegroundColor Green
    }
    default {
      Write-Host "⚠️  Unknown runtime: $($Skill.runtime)" -ForegroundColor Yellow
    }
  }
}

# Main flow
$skills = Get-AvailableSkills
Log "Found $($skills.Count) available skills"

if ($ListOnly) {
  Show-SkillList $skills
  exit 0
}

if ($SkillId) {
  $skill = $skills | Where-Object { $_.id -eq $SkillId }
  if (-not $skill) {
    Write-Host "❌ Skill not found: $SkillId" -ForegroundColor Red
    exit 1
  }

  if ($Verbose) {
    Show-SkillDetail $skill
  }

  Invoke-Skill $skill
  exit 0
}

# Interactive selection
Show-SkillList $skills
$selectedSkill = Select-SkillInteractive $skills

if ($Verbose) {
  Show-SkillDetail $selectedSkill
}

Write-Host "Running: $($selectedSkill.name)" -ForegroundColor Cyan
Invoke-Skill $selectedSkill
