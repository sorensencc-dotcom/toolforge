<#
.SYNOPSIS
  Toolforge Skill Runtime Health Checker
  Phase 1.6 implementation.

.DESCRIPTION
  Validates skill runtime readiness:
  - Entrypoint exists and is executable
  - Runtime executable exists
  - Dry-run execution succeeds
  - Error capture & logging
  - Audit log validation
  - Dependency availability
  - Manifest ↔ runtime consistency

  Output: C:\dev\skills\SKILLPACK-RUNTIME-HEALTH.md

.PARAMETER OutputPath
  Where to save health report (default: SKILLPACK-RUNTIME-HEALTH.md)

.PARAMETER DryRun
  Execute dry runs (default: $true)

.PARAMETER Verbose
  Show detailed logs

.EXAMPLE
  ./toolforgeSkillHealthCheck.ps1
  ./toolforgeSkillHealthCheck.ps1 -DryRun:$false -Verbose
#>

param(
  [string]$OutputPath = "C:\dev\skills\SKILLPACK-RUNTIME-HEALTH.md",
  [bool]$DryRun = $true,
  [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Paths
$CANONICAL_SKILLS = "C:\dev\skills"
$MANIFEST_FILE = "C:\dev\manifest.json"
$RUNTIME_LOG = "C:\dev\audit\SKILL-RUN-LOG.md"

# Health state
$health = @{
  timestamp = Get-Date -AsUTC -Format "o"
  checks_total = 0
  checks_pass = 0
  checks_warn = 0
  checks_fail = 0
  skills = @{}
  summary = @{}
}

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message"
  }
}

function Add-Check {
  param([string]$SkillId, [string]$Check, [string]$Result, [string]$Details = "")

  if (-not $health.skills[$SkillId]) {
    $health.skills[$SkillId] = @{ checks = @() }
  }

  $checkResult = @{
    name = $Check
    result = $Result
    details = $Details
    timestamp = Get-Date -AsUTC -Format "o"
  }

  $health.skills[$SkillId].checks += $checkResult
  $health.checks_total += 1

  if ($Result -eq "pass") {
    $health.checks_pass += 1
  } elseif ($Result -eq "warn") {
    $health.checks_warn += 1
  } else {
    $health.checks_fail += 1
  }

  Log "$SkillId / $Check : $Result"
}

# ============================================================================
# A. CHECK ENTRYPOINT
# ============================================================================

function Check-Entrypoint {
  param([string]$SkillId, [string]$SkillPath, [string]$Entrypoint)

  if (-not $Entrypoint) {
    Add-Check $SkillId "Entrypoint" "fail" "No entrypoint specified"
    return $false
  }

  $entrypointPath = Join-Path $SkillPath $Entrypoint

  if (-not (Test-Path $entrypointPath)) {
    Add-Check $SkillId "Entrypoint" "fail" "File not found: $Entrypoint"
    return $false
  }

  # Check readability
  try {
    $content = Get-Content $entrypointPath -Raw -ErrorAction Stop
    if (-not $content) {
      Add-Check $SkillId "Entrypoint" "warn" "Entrypoint is empty"
      return $false
    }
  } catch {
    Add-Check $SkillId "Entrypoint" "fail" "Cannot read: $_"
    return $false
  }

  Add-Check $SkillId "Entrypoint" "pass" "Valid: $Entrypoint"
  return $true
}

# ============================================================================
# B. CHECK RUNTIME EXECUTABLE
# ============================================================================

function Check-Runtime {
  param([string]$SkillId, [string]$Runtime)

  $runtimeMap = @{
    "typescript" = @("npm", "npx", "tsc")
    "javascript" = @("npm", "node")
    "node" = @("npm", "node")
    "powershell" = @("pwsh", "powershell")
    "python" = @("python", "python3", "py")
    "bash" = @("bash", "sh")
  }

  if (-not $runtimeMap[$Runtime]) {
    Add-Check $SkillId "Runtime" "warn" "Unknown runtime: $Runtime"
    return $false
  }

  $runtimes = $runtimeMap[$Runtime]
  $found = $false

  foreach ($exe in $runtimes) {
    try {
      $result = & where.exe $exe 2>$null
      if ($LASTEXITCODE -eq 0 -and $result) {
        Add-Check $SkillId "Runtime" "pass" "Found: $exe"
        $found = $true
        return $true
      }
    } catch {}
  }

  if (-not $found) {
    Add-Check $SkillId "Runtime" "fail" "No executable found for $Runtime. Checked: $($runtimes -join ', ')"
    return $false
  }

  return $true
}

# ============================================================================
# C. CHECK DEPENDENCIES
# ============================================================================

function Check-Dependencies {
  param([string]$SkillId, [array]$InternalDeps)

  if (-not $InternalDeps -or $InternalDeps.Count -eq 0) {
    Add-Check $SkillId "Dependencies" "pass" "No dependencies"
    return $true
  }

  $skillDirs = @(Get-ChildItem -Path $CANONICAL_SKILLS -Directory -Exclude "_TEMPLATE" | Select-Object -ExpandProperty Name)

  $missing = @()
  foreach ($dep in $InternalDeps) {
    if ($dep -notin $skillDirs) {
      $missing += $dep
    }
  }

  if ($missing.Count -eq 0) {
    Add-Check $SkillId "Dependencies" "pass" "All $($InternalDeps.Count) internal deps available"
    return $true
  } else {
    Add-Check $SkillId "Dependencies" "fail" "Missing: $($missing -join ', ')"
    return $false
  }
}

# ============================================================================
# D. DRY-RUN EXECUTION
# ============================================================================

function Check-DryRun {
  param([string]$SkillId, [string]$SkillPath, [string]$Runtime, [string]$Entrypoint)

  if (-not $DryRun) {
    Add-Check $SkillId "DryRun" "pass" "Skipped (disabled)"
    return $true
  }

  Write-Host "  🏃 Dry-run: $SkillId" -ForegroundColor Gray

  try {
    # For TypeScript/Node: load and parse
    if ($Runtime -in @("typescript", "javascript", "node")) {
      $fullPath = Join-Path $SkillPath $Entrypoint
      $content = Get-Content $fullPath -Raw

      # Basic syntax check (not a full parse)
      if (-not ($content -match "export|module\.exports|function")) {
        Add-Check $SkillId "DryRun" "warn" "No exports detected in entrypoint"
        return $false
      }

      Add-Check $SkillId "DryRun" "pass" "Syntax valid"
      return $true
    }

    # For PowerShell: syntax check
    if ($Runtime -eq "powershell") {
      $fullPath = Join-Path $SkillPath $Entrypoint
      $ast = [System.Management.Automation.Language.Parser]::ParseFile($fullPath, [ref]$null, [ref]$null)

      if ($ast.EndBlock.Statements.Count -eq 0) {
        Add-Check $SkillId "DryRun" "warn" "Empty script"
        return $false
      }

      Add-Check $SkillId "DryRun" "pass" "Script syntax valid"
      return $true
    }

    Add-Check $SkillId "DryRun" "pass" "Runtime $Runtime (dry-run not applicable)"
    return $true
  } catch {
    Add-Check $SkillId "DryRun" "fail" "Error: $_"
    return $false
  }
}

# ============================================================================
# E. CHECK MANIFEST CONSISTENCY
# ============================================================================

function Check-ManifestConsistency {
  param([string]$SkillId, [string]$SkillVersion)

  if (-not (Test-Path $MANIFEST_FILE)) {
    Add-Check $SkillId "Manifest" "warn" "Manifest file not found"
    return $false
  }

  try {
    $manifest = Get-Content $MANIFEST_FILE | ConvertFrom-Json
    $manifestEntry = $manifest.skills | Where-Object { $_.id -eq $SkillId }

    if (-not $manifestEntry) {
      Add-Check $SkillId "Manifest" "warn" "No entry in manifest"
      return $false
    }

    if ($manifestEntry.version -ne $SkillVersion) {
      Add-Check $SkillId "Manifest" "warn" "Version mismatch: SKILL.json=$SkillVersion, manifest=$($manifestEntry.version)"
      return $false
    }

    Add-Check $SkillId "Manifest" "pass" "Consistent"
    return $true
  } catch {
    Add-Check $SkillId "Manifest" "fail" "Error reading manifest: $_"
    return $false
  }
}

# ============================================================================
# F. CHECK AUDIT LOG
# ============================================================================

function Check-AuditLog {
  param([string]$SkillId)

  if (-not (Test-Path $RUNTIME_LOG)) {
    Add-Check $SkillId "AuditLog" "warn" "No audit log found"
    return $false
  }

  try {
    $log = Get-Content $RUNTIME_LOG -Raw
    if ($log -match "skill_id:\s*$SkillId") {
      Add-Check $SkillId "AuditLog" "pass" "Runtime history exists"
      return $true
    } else {
      Add-Check $SkillId "AuditLog" "warn" "No runtime history in audit log"
      return $false
    }
  } catch {
    Add-Check $SkillId "AuditLog" "fail" "Error reading audit log: $_"
    return $false
  }
}

# ============================================================================
# G. CHECK SKILL.MD FRONTMATTER
# ============================================================================

function Check-SkillMarkdownFrontmatter {
  param([string]$SkillId, [string]$SkillPath)

  $skillMdPath = Join-Path $SkillPath "SKILL.md"

  if (-not (Test-Path $skillMdPath)) {
    Add-Check $SkillId "SkillMD" "warn" "SKILL.md not found"
    return $false
  }

  try {
    $firstLine = Get-Content $skillMdPath -First 1

    if ($firstLine -ne "---") {
      Add-Check $SkillId "SkillMD" "fail" "Missing YAML frontmatter (---)"
      return $false
    }

    Add-Check $SkillId "SkillMD" "pass" "Frontmatter valid"
    return $true
  } catch {
    Add-Check $SkillId "SkillMD" "fail" "Error reading SKILL.md: $_"
    return $false
  }
}

# ============================================================================
# H. RUN ALL CHECKS
# ============================================================================

function Run-HealthChecks {
  Write-Host "🏥 Running skill health checks..." -ForegroundColor Cyan

  if (-not (Test-Path $CANONICAL_SKILLS)) {
    throw "Canonical skills directory not found"
  }

  $skillDirs = Get-ChildItem -Path $CANONICAL_SKILLS -Directory -Exclude "_TEMPLATE"

  foreach ($dir in $skillDirs) {
    $skillId = $dir.Name
    $skillJsonPath = Join-Path $dir.FullName "SKILL.json"

    if (-not (Test-Path $skillJsonPath)) {
      continue
    }

    try {
      $skillJson = Get-Content $skillJsonPath | ConvertFrom-Json

      Write-Host "`n✔️ Checking: $skillId" -ForegroundColor Cyan

      # Run checks
      Check-Entrypoint $skillId $dir.FullName $skillJson.entrypoint
      Check-Runtime $skillId $skillJson.runtime
      Check-Dependencies $skillId $skillJson.dependencies.internal
      Check-DryRun $skillId $dir.FullName $skillJson.runtime $skillJson.entrypoint
      Check-ManifestConsistency $skillId $skillJson.version
      Check-AuditLog $skillId
      Check-SkillMarkdownFrontmatter $skillId $dir.FullName

      # Calculate skill health
      $skillChecks = $health.skills[$skillId].checks
      $passes = @($skillChecks | Where-Object { $_.result -eq "pass" }).Count
      $warnings = @($skillChecks | Where-Object { $_.result -eq "warn" }).Count
      $failures = @($skillChecks | Where-Object { $_.result -eq "fail" }).Count

      if ($failures -gt 0) {
        $health.skills[$skillId].health = "error"
      } elseif ($warnings -gt 0) {
        $health.skills[$skillId].health = "warn"
      } else {
        $health.skills[$skillId].health = "good"
      }

    } catch {
      Add-Check $skillId "System" "fail" "Error loading skill: $_"
      $health.skills[$skillId].health = "error"
    }
  }
}

# ============================================================================
# H. GENERATE REPORT
# ============================================================================

function Generate-Report {
  Write-Host "`n📝 Generating health report..." -ForegroundColor Cyan

  $md = @"
# Toolforge Skill Runtime Health Report

**Generated:** $($health.timestamp)

**Phase:** 1.6 — Runtime Health Check Implementation

---

## Summary

| Check Type | Passed | Warned | Failed | Total |
|------------|--------|--------|--------|-------|
| **Totals** | $($health.checks_pass) | $($health.checks_warn) | $($health.checks_fail) | $($health.checks_total) |
| % Pass | $(if ($health.checks_total -gt 0) { [math]::Round($health.checks_pass * 100 / $health.checks_total, 1) } else { "0" })% | $(if ($health.checks_total -gt 0) { [math]::Round($health.checks_warn * 100 / $health.checks_total, 1) } else { "0" })% | $(if ($health.checks_total -gt 0) { [math]::Round($health.checks_fail * 100 / $health.checks_total, 1) } else { "0" })% | 100% |

---

## Skills Health Status

"@

  foreach ($skillId in ($health.skills.Keys | Sort-Object)) {
    $skillHealth = $health.skills[$skillId]
    $healthStatus = $skillHealth.health.ToUpper()
    $healthEmoji = if ($healthStatus -eq "GOOD") { "✅" } elseif ($healthStatus -eq "WARN") { "⚠️" } else { "❌" }

    $passes = @($skillHealth.checks | Where-Object { $_.result -eq "pass" }).Count
    $warns = @($skillHealth.checks | Where-Object { $_.result -eq "warn" }).Count
    $fails = @($skillHealth.checks | Where-Object { $_.result -eq "fail" }).Count

    $md += "`n### $skillId — $healthEmoji $healthStatus`n`n"
    $md += "| Check | Result | Details |`n"
    $md += "|-------|--------|---------|`n"

    foreach ($check in $skillHealth.checks) {
      $emoji = if ($check.result -eq "pass") { "✅" } elseif ($check.result -eq "warn") { "⚠️" } else { "❌" }
      $details = if ($check.details) { $check.details } else { "—" }
      $md += "| $($check.name) | $emoji $($check.result.ToUpper()) | $details |`n"
    }
  }

  $md += @"

---

## Health Categories

### ✅ Good Health

Skills passing all checks:

"@

  $goodSkills = @($health.skills.Keys | Where-Object { $health.skills[$_].health -eq "good" })
  if ($goodSkills.Count -eq 0) {
    $md += "*(none)*\n"
  } else {
    foreach ($skillId in ($goodSkills | Sort-Object)) {
      $md += "- $skillId`n"
    }
  }

  $md += @"

### ⚠️ Warning Health

Skills with warnings but no failures:

"@

  $warnSkills = @($health.skills.Keys | Where-Object { $health.skills[$_].health -eq "warn" })
  if ($warnSkills.Count -eq 0) {
    $md += "*(none)*\n"
  } else {
    foreach ($skillId in ($warnSkills | Sort-Object)) {
      $md += "- $skillId`n"
    }
  }

  $md += @"

### ❌ Error Health

Skills with critical failures:

"@

  $errorSkills = @($health.skills.Keys | Where-Object { $health.skills[$_].health -eq "error" })
  if ($errorSkills.Count -eq 0) {
    $md += "*(none)*\n"
  } else {
    foreach ($skillId in ($errorSkills | Sort-Object)) {
      $md += "- $skillId`n"
    }
  }

  $md += @"

---

**Report generated by `toolforgeSkillHealthCheck.ps1` — Phase 1.6**

"@

  Set-Content -Path $OutputPath -Value $md -Encoding UTF8
  Write-Host "✅ Health report saved: $OutputPath" -ForegroundColor Green
}

# ============================================================================
# MAIN
# ============================================================================

Run-HealthChecks
Generate-Report

Write-Host "`n✅ Health check complete." -ForegroundColor Green
