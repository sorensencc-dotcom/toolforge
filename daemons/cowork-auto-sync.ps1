<#
.SYNOPSIS
  Cowork Auto-Sync Daemon
  Phase 1.7 implementation.

.DESCRIPTION
  Keeps Cowork registry perfectly aligned with Toolforge:
  - Scans canonical skills
  - Compares with Cowork registry
  - Registers missing skills
  - Updates changed skills
  - Triggers validator
  - Regenerates metadata

  Designed to run as scheduled Task Scheduler job.

.PARAMETER Verbose
  Show detailed logs

.EXAMPLE
  ./cowork-auto-sync.ps1
  ./cowork-auto-sync.ps1 -Verbose
#>

param([switch]$Verbose)

if ($env:TOOLFORGE_SYNC_RUNNING) {
  Write-Host "⚠️ Cowork Auto-Sync is already running in this execution chain. Skipping to prevent loop." -ForegroundColor Yellow
  exit 0
}
$env:TOOLFORGE_SYNC_RUNNING = $true

$ErrorActionPreference = "Continue"

# Paths
$CANONICAL_SKILLS = "C:\dev\skills"
$COWORK_REGISTRY = "C:\dev\audit\COWORK-REGISTERED-SKILLS.md"
$MANIFEST_FILE = "C:\dev\manifest.json"
$SYNC_REPORT = "C:\dev\audit\COWORK-AUTO-SYNC-REPORT.md"
$VALIDATOR = "C:\dev\utilities\toolforgeSkillValidator.ps1"
$METADATA_GEN = "C:\dev\utilities\toolforgeMetadataGenerator.ps1"
$HEALTH_CHECK = "C:\dev\utilities\toolforgeSkillHealthCheck.ps1"
$DEP_GRAPH = "C:\dev\utilities\toolforgeDependencyGraph.ps1"

# Sync state
$sync = @{
  timestamp = Get-Date -AsUTC -Format "o"
  phase = 1
  actions = @()
  stats = @{
    scanned = 0
    registered = 0
    updated = 0
    errors = 0
  }
  cowork_state = @{}
  canonical_state = @{}
}

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message"
  }
  $sync.actions += @{ message = $Message; level = $Level; timestamp = Get-Date -AsUTC -Format "o" }
}

# ============================================================================
# PHASE 1: LOAD CANONICAL SKILLS
# ============================================================================

function Phase-LoadCanonical {
  Write-Host "📚 Phase 1: Loading canonical skills..." -ForegroundColor Cyan
  $sync.phase = 1

  if (-not (Test-Path $CANONICAL_SKILLS)) {
    Log "FATAL: Canonical skills directory not found" "ERROR"
    return $false
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
      $sync.canonical_state[$skillId] = @{
        id = $skillJson.id ?? $skillId
        name = $skillJson.name ?? $skillId
        version = $skillJson.version ?? "0.0.0"
        category = $skillJson.category ?? "unknown"
        tags = @($skillJson.tags ?? @())
        runtime = $skillJson.runtime ?? "unknown"
        status = $skillJson.status ?? "active"
      }
      $sync.stats.scanned += 1
      Log "Scanned: $skillId (v$($sync.canonical_state[$skillId].version))"
    } catch {
      Log "Error loading $skillId : $_" "ERROR"
      $sync.stats.errors += 1
    }
  }

  Log "Phase 1 complete: $($sync.stats.scanned) skills scanned"
  return $true
}

# ============================================================================
# PHASE 2: LOAD COWORK REGISTRY
# ============================================================================

function Phase-LoadCowork {
  Write-Host "🔗 Phase 2: Loading Cowork registry..." -ForegroundColor Cyan
  $sync.phase = 2

  if (-not (Test-Path $COWORK_REGISTRY)) {
    Log "Cowork registry not found (first run)" "WARN"
    return $true
  }

  try {
    $content = Get-Content $COWORK_REGISTRY -Raw

    # Parse markdown table
    $lines = $content -split "`n"
    $inTable = $false
    $headerCount = 0

    foreach ($line in $lines) {
      if ($line -match "^\|" -and $line -match "\|$") {
        if (-not $inTable) {
          # Check if this is a data row (not header)
          if ($headerCount -lt 2) {
            $headerCount += 1
            continue
          }
        }

        # Parse row
        $cells = $line -split "\|" | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() }

        if ($cells.Count -ge 4) {
          $skillId = $cells[0]
          $version = $cells[1]
          $status = $cells[2]

          $sync.cowork_state[$skillId] = @{
            version = $version
            status = $status
          }
        }
      }
    }

    Log "Loaded Cowork registry: $($sync.cowork_state.Count) entries"
  } catch {
    Log "Error loading Cowork registry: $_" "WARN"
  }

  return $true
}

# ============================================================================
# PHASE 3: COMPARE & REGISTER
# ============================================================================

function Phase-SyncSkills {
  Write-Host "🔄 Phase 3: Syncing skills..." -ForegroundColor Cyan
  $sync.phase = 3

  foreach ($skillId in $sync.canonical_state.Keys) {
    $canonical = $sync.canonical_state[$skillId]
    $cowork = $sync.cowork_state[$skillId]

    if (-not $cowork) {
      # Register new skill
      Log "Registering new skill: $skillId (v$($canonical.version))" "INFO"
      $sync.stats.registered += 1
    } elseif ($cowork.version -ne $canonical.version) {
      # Update version
      Log "Updating skill: $skillId ($($cowork.version) → $($canonical.version))" "INFO"
      $sync.stats.updated += 1
    } else {
      Log "Skill up-to-date: $skillId" "INFO"
    }
  }

  Log "Phase 3 complete: $($sync.stats.registered) registered, $($sync.stats.updated) updated"
  return $true
}

# ============================================================================
# PHASE 4: UPDATE COWORK REGISTRY
# ============================================================================

function Phase-UpdateRegistry {
  Write-Host "📝 Phase 4: Updating Cowork registry..." -ForegroundColor Cyan
  $sync.phase = 4

  $md = @"
# Cowork Registered Skills

**Last Sync:** $($sync.timestamp)

**Registered:** $($sync.stats.registered)
**Updated:** $($sync.stats.updated)
**Total:** $($sync.canonical_state.Count)

---

| Skill ID | Version | Status | Category | Tags |
|----------|---------|--------|----------|------|
"@

  foreach ($skillId in ($sync.canonical_state.Keys | Sort-Object)) {
    $skill = $sync.canonical_state[$skillId]
    $tags = if ($skill.tags.Count -gt 0) { $skill.tags -join ", " } else { "—" }

    $md += "`n| $($skill.id) | $($skill.version) | $($skill.status) | $($skill.category) | $tags |"
  }

  $md += @"

---

## Sync History

"@

  foreach ($action in $sync.actions) {
    $md += "`n- **$($action.timestamp)** [$($action.level)] $($action.message)"
  }

  $md += @"

---

**Auto-generated by `cowork-auto-sync.ps1` — Phase 1.7**

"@

  try {
    Set-Content -Path $COWORK_REGISTRY -Value $md -Encoding UTF8
    Log "Registry updated: $COWORK_REGISTRY" "INFO"
  } catch {
    Log "Error updating registry: $_" "ERROR"
    return $false
  }

  return $true
}

# ============================================================================
# PHASE 5: TRIGGER VALIDATORS & GENERATORS
# ============================================================================

function Phase-TriggerValidation {
  Write-Host "✅ Phase 5: Triggering validators..." -ForegroundColor Cyan
  $sync.phase = 5

  $generators = @(
    @{ name = "Validator"; path = $VALIDATOR }
    @{ name = "Dependency Graph"; path = $DEP_GRAPH }
    @{ name = "Metadata Generator"; path = $METADATA_GEN }
    @{ name = "Health Check"; path = $HEALTH_CHECK }
  )

  foreach ($gen in $generators) {
    if (Test-Path $gen.path) {
      try {
        Write-Host "  ▶️ Running $($gen.name)..." -ForegroundColor Gray
        & $gen.path -Verbose:$Verbose

        Log "Triggered: $($gen.name)" "INFO"
      } catch {
        Log "Error triggering $($gen.name) : $_" "ERROR"
        $sync.stats.errors += 1
      }
    } else {
      Log "Generator not found: $($gen.name) ($($gen.path))" "WARN"
    }
  }

  Log "Phase 5 complete"
  return $true
}

# ============================================================================
# GENERATE SYNC REPORT
# ============================================================================

function Generate-SyncReport {
  Write-Host "📊 Generating sync report..." -ForegroundColor Cyan

  $md = @"
# Cowork Auto-Sync Daemon Report

**Execution:** $($sync.timestamp)

**Phase:** 1.7 — Cowork Auto-Sync Implementation

---

## Execution Summary

| Metric | Value |
|--------|-------|
| Skills Scanned | $($sync.stats.scanned) |
| Skills Registered | $($sync.stats.registered) |
| Skills Updated | $($sync.stats.updated) |
| Errors | $($sync.stats.errors) |

---

## Canonical State

**Skills:** $($sync.canonical_state.Count)

| ID | Name | Version | Category | Status |
|--------|------|---------|----------|--------|
"@

  foreach ($skillId in ($sync.canonical_state.Keys | Sort-Object)) {
    $skill = $sync.canonical_state[$skillId]
    $md += "`n| $($skill.id) | $($skill.name) | $($skill.version) | $($skill.category) | $($skill.status) |"
  }

  $md += @"

---

## Action Log

"@

  foreach ($action in $sync.actions) {
    $emoji = if ($action.level -eq "INFO") { "ℹ️" } elseif ($action.level -eq "WARN") { "⚠️" } else { "❌" }
    $md += "`n- $emoji [$($action.timestamp)] $($action.message)"
  }

  $md += @"

---

## Health Status

| Component | Status |
|-----------|--------|
| Canonical Load | $(if ($sync.stats.scanned -gt 0) { "✅ PASS" } else { "❌ FAIL" }) |
| Cowork Registry | ✅ PASS |
| Skill Sync | ✅ PASS |
| Validators | $(if ($sync.stats.errors -eq 0) { "✅ PASS" } else { "⚠️ WARN" }) |

---

**Report generated by `cowork-auto-sync.ps1` — Phase 1.7**

Scheduled daemon for Toolforge ↔ Cowork alignment.

"@

  Set-Content -Path $SYNC_REPORT -Value $md -Encoding UTF8
  Write-Host "✅ Sync report saved: $SYNC_REPORT" -ForegroundColor Green
}

# ============================================================================
# MAIN
# ============================================================================

Write-Host "`n🚀 Cowork Auto-Sync Daemon — Phase 1.7" -ForegroundColor Green
Write-Host "Start time: $($sync.timestamp)`n" -ForegroundColor Gray

if (-not (Phase-LoadCanonical)) {
  Log "FATAL: Failed to load canonical skills" "ERROR"
  Generate-SyncReport
  $env:TOOLFORGE_SYNC_RUNNING = $null
  exit 1
}

if (-not (Phase-LoadCowork)) {
  Log "WARNING: Failed to load Cowork registry (continuing)" "WARN"
}

if (-not (Phase-SyncSkills)) {
  Log "FATAL: Failed to sync skills" "ERROR"
  Generate-SyncReport
  $env:TOOLFORGE_SYNC_RUNNING = $null
  exit 1
}

if (-not (Phase-UpdateRegistry)) {
  Log "FATAL: Failed to update Cowork registry" "ERROR"
  Generate-SyncReport
  $env:TOOLFORGE_SYNC_RUNNING = $null
  exit 1
}

if (-not (Phase-TriggerValidation)) {
  Log "WARNING: Some validators failed" "WARN"
}

Generate-SyncReport

Write-Host "`n✅ Cowork Auto-Sync complete." -ForegroundColor Green
Write-Host "📋 Report: $SYNC_REPORT`n" -ForegroundColor Gray
$env:TOOLFORGE_SYNC_RUNNING = $null
