<#
.SYNOPSIS
  Toolforge Skill Dependency Graph Generator
  Phase 1.4 implementation.

.DESCRIPTION
  Generates dependency graph for all skills:
  - Adjacency list (internal + external deps)
  - Dependency depth (leaf → root)
  - Cycle detection (circular deps)
  - Missing dependencies (not found)
  - Orphan dependencies (unreferenced)
  - Health summary per skill

  Output: C:\dev\toolforge\skills\SKILLPACK-DEPENDENCY-GRAPH.md

.PARAMETER OutputPath
  Where to save graph report (default: SKILLPACK-DEPENDENCY-GRAPH.md)

.PARAMETER Verbose
  Show detailed logs

.EXAMPLE
  ./toolforgeDependencyGraph.ps1
  ./toolforgeDependencyGraph.ps1 -Verbose
#>

param(
  [string]$OutputPath = "C:\dev\toolforge\skills\SKILLPACK-DEPENDENCY-GRAPH.md",
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Paths
$CANONICAL_SKILLS = "C:\dev\toolforge\skills"
$MANIFEST_FILE = "C:\dev\toolforge\manifest.json"

# State
$graph = @{
  timestamp = Get-Date -AsUTC -Format "o"
  skills = @{}
  adjacency = @{}
  depths = @{}
  cycles = @()
  missing = @()
  orphans = @()
  stats = @{
    total_skills = 0
    total_dependencies = 0
    cyclic_skills = 0
    missing_internal_deps = 0
    orphan_dependencies = 0
    depth_max = 0
  }
}

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message"
  }
}

# ============================================================================
# A. LOAD ALL SKILLS
# ============================================================================

function Load-Skills {
  Write-Host "📚 Loading all skills..." -ForegroundColor Cyan

  if (-not (Test-Path $CANONICAL_SKILLS)) {
    throw "Canonical skills directory not found"
  }

  $skillDirs = Get-ChildItem -Path $CANONICAL_SKILLS -Directory -Exclude "_TEMPLATE"

  foreach ($dir in $skillDirs) {
    $skillId = $dir.Name
    $skillJsonPath = Join-Path $dir.FullName "SKILL.json"

    if (-not (Test-Path $skillJsonPath)) {
      Log "Skipping $skillId (no SKILL.json)" "WARN"
      continue
    }

    try {
      $skillJson = Get-Content $skillJsonPath | ConvertFrom-Json
      $graph.skills[$skillId] = @{
        id = $skillJson.id ?? $skillId
        name = $skillJson.name ?? $skillId
        version = $skillJson.version ?? "0.0.0"
        category = $skillJson.category ?? "unknown"
        runtime = $skillJson.runtime ?? "unknown"
        entrypoint = $skillJson.entrypoint ?? ""
        internal_deps = @($skillJson.dependencies.internal ?? @())
        external_deps = @($skillJson.dependencies.external ?? @())
      }
      $graph.stats.total_skills += 1
      Log "Loaded skill: $skillId (deps: internal=$($graph.skills[$skillId].internal_deps.Count), external=$($graph.skills[$skillId].external_deps.Count))"
    } catch {
      Log "Failed to load $skillId : $_" "ERROR"
    }
  }
}

# ============================================================================
# B. BUILD ADJACENCY LIST
# ============================================================================

function Build-Adjacency {
  Write-Host "🔗 Building adjacency list..." -ForegroundColor Cyan

  foreach ($skillId in $graph.skills.Keys) {
    $skill = $graph.skills[$skillId]

    # Initialize adjacency for this skill
    if (-not $graph.adjacency[$skillId]) {
      $graph.adjacency[$skillId] = @{ inbound = @(); outbound = @() }
    }

    # Outbound dependencies (what this skill depends on)
    foreach ($dep in $skill.internal_deps) {
      $graph.adjacency[$skillId].outbound += @{ skill = $dep; type = "internal" }
      $graph.stats.total_dependencies += 1

      # Inbound for dependency
      if (-not $graph.adjacency[$dep]) {
        $graph.adjacency[$dep] = @{ inbound = @(); outbound = @() }
      }
      $graph.adjacency[$dep].inbound += @{ skill = $skillId; type = "internal" }

      # Check if dependency exists
      if (-not $graph.skills[$dep]) {
        $graph.missing += @{ dependent = $skillId; missing = $dep; type = "internal" }
        $graph.stats.missing_internal_deps += 1
        Log "Missing internal dep: $skillId → $dep" "WARN"
      }
    }

    foreach ($dep in $skill.external_deps) {
      $graph.adjacency[$skillId].outbound += @{ skill = $dep; type = "external" }
    }
  }

  Log "Adjacency complete: $($graph.stats.total_dependencies) total deps"
}

# ============================================================================
# C. DETECT CYCLES (DFS)
# ============================================================================

function Detect-Cycles {
  Write-Host "🔄 Detecting cycles..." -ForegroundColor Cyan

  $visited = @{}
  $rec_stack = @{}

  function Visit-Skill {
    param([string]$skillId, [array]$path = @())

    if ($rec_stack[$skillId]) {
      # Cycle detected
      $cycle_start = $path.IndexOf($skillId)
      if ($cycle_start -ge 0) {
        $cycle = $path[$cycle_start..($path.Count - 1)] + $skillId
        $graph.cycles += @{ nodes = $cycle }
        $graph.stats.cyclic_skills += $cycle.Count
        Log "Cycle detected: $($cycle -join ' → ')" "WARN"
      }
      return
    }

    if ($visited[$skillId]) {
      return
    }

    $visited[$skillId] = $true
    $rec_stack[$skillId] = $true
    $newPath = $path + $skillId

    if ($graph.adjacency[$skillId]) {
      foreach ($dep in $graph.adjacency[$skillId].outbound) {
        Visit-Skill $dep.skill $newPath
      }
    }

    $rec_stack[$skillId] = $false
  }

  foreach ($skillId in $graph.skills.Keys) {
    if (-not $visited[$skillId]) {
      Visit-Skill $skillId
    }
  }

  Log "Cycle detection complete: $($graph.cycles.Count) cycles found"
}

# ============================================================================
# D. CALCULATE DEPENDENCY DEPTH
# ============================================================================

function Calculate-Depth {
  Write-Host "📊 Calculating dependency depth..." -ForegroundColor Cyan

  function Get-Depth {
    param([string]$skillId, [hashtable]$memo = @{})

    if ($memo[$skillId]) {
      return $memo[$skillId]
    }

    # Leaf node
    if (-not $graph.adjacency[$skillId] -or $graph.adjacency[$skillId].outbound.Count -eq 0) {
      $memo[$skillId] = 0
      return 0
    }

    # Get max depth of dependencies
    $max_depth = 0
    foreach ($dep in $graph.adjacency[$skillId].outbound) {
      $dep_depth = Get-Depth $dep.skill $memo
      if ($dep_depth -gt $max_depth) {
        $max_depth = $dep_depth
      }
    }

    $depth = $max_depth + 1
    $memo[$skillId] = $depth
    return $depth
  }

  $memo = @{}
  foreach ($skillId in $graph.skills.Keys) {
    $graph.depths[$skillId] = Get-Depth $skillId $memo
    if ($graph.depths[$skillId] -gt $graph.stats.depth_max) {
      $graph.stats.depth_max = $graph.depths[$skillId]
    }
  }

  Log "Depth calculation complete: max depth = $($graph.stats.depth_max)"
}

# ============================================================================
# E. FIND ORPHAN DEPENDENCIES
# ============================================================================

function Find-Orphans {
  Write-Host "🏜️  Finding orphan dependencies..." -ForegroundColor Cyan

  $referenced = @{}

  # Mark all referenced dependencies
  foreach ($skillId in $graph.skills.Keys) {
    $skill = $graph.skills[$skillId]
    foreach ($dep in $skill.internal_deps + $skill.external_deps) {
      $referenced[$dep] = $true
    }
  }

  # Find skills never referenced (orphans)
  foreach ($skillId in $graph.skills.Keys) {
    if (-not $referenced[$skillId] -and $graph.adjacency[$skillId].inbound.Count -eq 0) {
      $graph.orphans += $skillId
      Log "Orphan skill (never referenced): $skillId" "WARN"
    }
  }

  Log "Orphan detection complete: $($graph.orphans.Count) orphans found"
}

# ============================================================================
# F. GENERATE MARKDOWN REPORT
# ============================================================================

function Generate-Report {
  Write-Host "📝 Generating report..." -ForegroundColor Cyan

  $md = @"
# Toolforge Skill Dependency Graph

**Generated:** $($graph.timestamp)

**Phase:** 1.4 — Dependency Graph Implementation

---

## Summary

| Metric | Value |
|--------|-------|
| Total Skills | $($graph.stats.total_skills) |
| Total Dependencies | $($graph.stats.total_dependencies) |
| Max Depth | $($graph.stats.depth_max) |
| Cyclic Skills | $($graph.stats.cyclic_skills) |
| Missing Internal Deps | $($graph.stats.missing_internal_deps) |
| Orphan Skills | $($graph.orphans.Count) |

---

## Adjacency List

### Outbound Dependencies (Skill → Dependencies)

"@

  foreach ($skillId in ($graph.skills.Keys | Sort-Object)) {
    $skill = $graph.skills[$skillId]
    $outbound = $graph.adjacency[$skillId].outbound

    $md += "`n### $skillId`n`n"
    $md += "| Dependency | Type | Status |`n"
    $md += "|------------|------|--------|`n"

    if ($outbound.Count -eq 0) {
      $md += "| *(none)* | — | Leaf node |`n"
    } else {
      foreach ($dep in $outbound | Sort-Object -Property skill) {
        $status = if ($graph.skills[$dep.skill]) { "✅ Found" } else { "❌ Missing" }
        $md += "| $($dep.skill) | $($dep.type) | $status |`n"
      }
    }
  }

  $md += @"

### Inbound Dependencies (What Depends on Each Skill)

"@

  foreach ($skillId in ($graph.skills.Keys | Sort-Object)) {
    $inbound = $graph.adjacency[$skillId].inbound

    $md += "`n### $skillId`n`n"

    if ($inbound.Count -eq 0) {
      $md += "No inbound dependencies (root skill)\n"
    } else {
      $md += "| Dependent | Type |`n"
      $md += "|-----------|------|`n"
      foreach ($dep in $inbound | Sort-Object -Property skill) {
        $md += "| $($dep.skill) | $($dep.type) |`n"
      }
    }
  }

  $md += @"

---

## Dependency Depth (Leaf → Root)

Depth 0 = Leaf node (no dependencies)
Depth N = Depends on at least one skill at depth N-1

| Skill | Depth |
|-------|-------|
"@

  foreach ($skillId in ($graph.depths.Keys | Sort-Object { $graph.depths[$_] } -Descending)) {
    $md += "| $skillId | $($graph.depths[$skillId]) |`n"
  }

  $md += @"

---

## Cycles (Circular Dependencies)

"@

  if ($graph.cycles.Count -eq 0) {
    $md += "✅ No cycles detected.\n"
  } else {
    $md += "⚠️ **CRITICAL:** Circular dependencies detected!\n`n"
    foreach ($cycle in $graph.cycles) {
      $md += "- **Cycle:** $($cycle.nodes -join ' → ')`n"
    }
  }

  $md += @"

---

## Missing Internal Dependencies

Dependencies referenced but not found in canonical skills.

"@

  if ($graph.missing.Count -eq 0) {
    $md += "✅ All internal dependencies resolved.\n"
  } else {
    $md += "| Dependent | Missing Dependency |`n"
    $md += "|-----------|-------------------|`n"
    foreach ($miss in $graph.missing) {
      $md += "| $($miss.dependent) | $($miss.missing) |`n"
    }
  }

  $md += @"

---

## Orphan Skills

Skills that have no inbound dependencies (nothing depends on them).

"@

  if ($graph.orphans.Count -eq 0) {
    $md += "✅ No orphans detected.\n"
  } else {
    $md += "| Skill |`n"
    $md += "|-------|`n"
    foreach ($orphan in $graph.orphans | Sort-Object) {
      $md += "| $orphan |`n"
    }
  }

  $md += @"

---

## Health Summary

| Category | Status | Details |
|----------|--------|---------|
| Cycles | $(if ($graph.cycles.Count -eq 0) { "✅ PASS" } else { "❌ FAIL" }) | $($graph.cycles.Count) cycle(s) detected |
| Missing Deps | $(if ($graph.missing.Count -eq 0) { "✅ PASS" } else { "⚠️ WARN" }) | $($graph.missing.Count) missing dep(s) |
| Orphans | $(if ($graph.orphans.Count -eq 0) { "✅ PASS" } else { "⚠️ WARN" }) | $($graph.orphans.Count) orphan skill(s) |

---

**Report generated by `toolforgeDependencyGraph.ps1` — Phase 1.4**

"@

  Set-Content -Path $OutputPath -Value $md -Encoding UTF8
  Write-Host "✅ Report saved: $OutputPath" -ForegroundColor Green
}

# ============================================================================
# MAIN
# ============================================================================

Load-Skills
Build-Adjacency
Detect-Cycles
Calculate-Depth
Find-Orphans
Generate-Report

Write-Host "`n✅ Dependency graph complete." -ForegroundColor Green
