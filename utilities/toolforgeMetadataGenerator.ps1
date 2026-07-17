<#
.SYNOPSIS
  Toolforge Skillpack Metadata Generator
  Phase 1.5 implementation.

.DESCRIPTION
  Generates canonical metadata registry:
  - Unified schema for all skills
  - Health state (canonical, distributed, runtime)
  - Last run timestamps
  - Last validation timestamps
  - Dependencies summary
  - Owner and category info

  Output: C:\dev\skills\SKILLPACK-METADATA.json

.PARAMETER OutputPath
  Where to save metadata (default: SKILLPACK-METADATA.json)

.PARAMETER Verbose
  Show detailed logs

.EXAMPLE
  ./toolforgeMetadataGenerator.ps1
  ./toolforgeMetadataGenerator.ps1 -Verbose
#>

param(
  [string]$OutputPath = "C:\dev\skills\SKILLPACK-METADATA.json",
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Paths
$CANONICAL_SKILLS = "C:\dev\skills"
$DISTRIBUTED_SKILLS = "C:\dev\rewrite-mcp\toolforge\skills"
$MANIFEST_FILE = "C:\dev\manifest.json"
$RUNTIME_LOG = "C:\dev\audit\SKILL-RUN-LOG.md"
$VALIDATION_LOG = "C:\dev\skills\SKILLPACK-VALIDATION.md"

# Metadata state
$metadata = @{
  timestamp = Get-Date -AsUTC -Format "o"
  version = "1.0.0"
  skills = @()
  summary = @{
    total = 0
    active = 0
    deprecated = 0
    health_good = 0
    health_warn = 0
    health_error = 0
  }
}

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message"
  }
}

# ============================================================================
# A. LOAD ALL SKILLS + METADATA
# ============================================================================

function Load-AllSkills {
  Write-Host "📚 Loading skills metadata..." -ForegroundColor Cyan

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

      # Check if distributed
      $distPath = Join-Path $DISTRIBUTED_SKILLS $skillId
      $isDistributed = Test-Path $distPath

      # Get last run time
      $lastRun = $null
      if (Test-Path $RUNTIME_LOG) {
        $runLog = Get-Content $RUNTIME_LOG -Raw
        if ($runLog -match "skill_id:\s*$skillId[^\n]*\n.*?timestamp:\s*([^\n]+)") {
          $lastRun = $matches[1]
        }
      }

      # Get last validation time
      $lastValidation = (Get-Item $skillJsonPath).LastWriteTime.ToUniversalTime().ToString("o")

      # Determine health
      $health = "good"
      if (-not $isDistributed) {
        $health = "warn"
      }

      $skillMetadata = @{
        id = $skillJson.id ?? $skillId
        name = $skillJson.name ?? $skillId
        category = $skillJson.category ?? "unknown"
        tags = @($skillJson.tags ?? @())
        version = $skillJson.version ?? "0.0.0"
        owner = $skillJson.owner ?? "unknown"
        runtime = $skillJson.runtime ?? "unknown"
        entrypoint = $skillJson.entrypoint ?? ""
        description = $skillJson.description ?? ""
        status = $skillJson.status ?? "active"
        dependencies = @{
          internal = @($skillJson.dependencies.internal ?? @())
          external = @($skillJson.dependencies.external ?? @())
        }
        health = @{
          canonical = $true
          distributed = $isDistributed
          runtime = if ($lastRun) { "functional" } else { "untested" }
          overall = $health
        }
        timestamps = @{
          created = $skillJson.created ?? $lastValidation
          lastValidation = $lastValidation
          lastRun = $lastRun
        }
      }

      $metadata.skills += $skillMetadata
      $metadata.summary.total += 1

      if ($skillJson.status -eq "deprecated") {
        $metadata.summary.deprecated += 1
      } else {
        $metadata.summary.active += 1
      }

      if ($health -eq "good") {
        $metadata.summary.health_good += 1
      } elseif ($health -eq "warn") {
        $metadata.summary.health_warn += 1
      } else {
        $metadata.summary.health_error += 1
      }

      Log "Loaded: $skillId (health: $health)"
    } catch {
      Log "Failed to load $skillId : $_" "ERROR"
    }
  }

  $metadata.skills = $metadata.skills | Sort-Object -Property id
}

# ============================================================================
# B. GENERATE JSON
# ============================================================================

function Generate-Json {
  Write-Host "📝 Generating metadata JSON..." -ForegroundColor Cyan

  $json = $metadata | ConvertTo-Json -Depth 10

  Set-Content -Path $OutputPath -Value $json -Encoding UTF8
  Write-Host "✅ Metadata saved: $OutputPath" -ForegroundColor Green

  # Update dashboard.html if it exists to prevent metadata drift
  $dashboardPath = Join-Path $PSScriptRoot "..\dashboard.html"
  if (Test-Path $dashboardPath) {
      Log "Updating dashboard.html embedded manifest-data to prevent drift..."
      $html = Get-Content $dashboardPath -Raw
      $pattern = '(?s)(<script type="application/json" id="manifest-data">).*?(</script>)'
      $safeJson = $json.Replace("$", "$$")
      $replacement = "`$1`n" + $safeJson + "`n`$2"
      $newHtml = [regex]::Replace($html, $pattern, $replacement)
      Set-Content -Path $dashboardPath -Value $newHtml -Encoding UTF8
      Write-Host "✅ Dashboard metadata updated: $dashboardPath" -ForegroundColor Green
  }
}

# ============================================================================
# C. GENERATE MARKDOWN SUMMARY
# ============================================================================

function Generate-Summary {
  Write-Host "📊 Generating summary report..." -ForegroundColor Cyan

  $summaryPath = $OutputPath -replace "\.json$", "-SUMMARY.md"

  $md = @"
# Skillpack Metadata Summary

**Generated:** $($metadata.timestamp)

**Phase:** 1.5 — Metadata Schema Implementation

---

## Health Overview

| Category | Count | % |
|----------|-------|---|
| **Total Skills** | $($metadata.summary.total) | 100% |
| Active | $($metadata.summary.active) | $(if ($metadata.summary.total -gt 0) { [math]::Round($metadata.summary.active * 100 / $metadata.summary.total, 1) } else { "0" })% |
| Deprecated | $($metadata.summary.deprecated) | $(if ($metadata.summary.total -gt 0) { [math]::Round($metadata.summary.deprecated * 100 / $metadata.summary.total, 1) } else { "0" })% |

### Overall Health

| Status | Count | % |
|--------|-------|---|
| ✅ Good | $($metadata.summary.health_good) | $(if ($metadata.summary.total -gt 0) { [math]::Round($metadata.summary.health_good * 100 / $metadata.summary.total, 1) } else { "0" })% |
| ⚠️ Warning | $($metadata.summary.health_warn) | $(if ($metadata.summary.total -gt 0) { [math]::Round($metadata.summary.health_warn * 100 / $metadata.summary.total, 1) } else { "0" })% |
| ❌ Error | $($metadata.summary.health_error) | $(if ($metadata.summary.total -gt 0) { [math]::Round($metadata.summary.health_error * 100 / $metadata.summary.total, 1) } else { "0" })% |

---

## Skills Inventory

"@

  foreach ($skill in $metadata.skills) {
    $lastRun = if ($skill.timestamps.lastRun) { $skill.timestamps.lastRun } else { "Never" }
    $health = $skill.health.overall.ToUpper()
    $healthEmoji = if ($health -eq "GOOD") { "✅" } elseif ($health -eq "WARN") { "⚠️" } else { "❌" }

    $md += @"
### $($skill.id)

| Field | Value |
|-------|-------|
| Name | $($skill.name) |
| Category | $($skill.category) |
| Version | $($skill.version) |
| Owner | $($skill.owner) |
| Runtime | $($skill.runtime) |
| Status | $($skill.status) |
| Health | $healthEmoji $health |
| Last Run | $lastRun |
| Dependencies | $($skill.dependencies.internal.Count) internal, $($skill.dependencies.external.Count) external |

"@
  }

  $md += @"

---

**Generated by `toolforgeMetadataGenerator.ps1` — Phase 1.5**

"@

  Set-Content -Path $summaryPath -Value $md -Encoding UTF8
  Log "Summary saved: $summaryPath"
}

# ============================================================================
# MAIN
# ============================================================================

Load-AllSkills
Generate-Json
Generate-Summary

Write-Host "`n✅ Metadata generation complete." -ForegroundColor Green
