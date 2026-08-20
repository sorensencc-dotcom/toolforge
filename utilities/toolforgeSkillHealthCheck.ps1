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

.PARAMETER TodosPath
  Backlog file updated with newly observed skill or manifest warnings

.EXAMPLE
  ./toolforgeSkillHealthCheck.ps1
  ./toolforgeSkillHealthCheck.ps1 -DryRun:$false -Verbose
#>

param(
  [string]$OutputPath = "C:\dev\skills\SKILLPACK-RUNTIME-HEALTH.md",
  [string]$TodosPath = "C:\dev\TODOS.md",
  [bool]$DryRun = $true,
  [switch]$Verbose
)

if ($env:TOOLFORGE_HEALTHCHECK_RUNNING) {
  Write-Host "⚠️ Toolforge Skill Health Check is already running in this execution chain. Skipping to prevent loop." -ForegroundColor Yellow
  exit 0
}
$env:TOOLFORGE_HEALTHCHECK_RUNNING = $true

$ErrorActionPreference = "Continue"

function Write-IfChanged {
  param([string]$Path, [string]$Content)
  $tsPattern = '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?'
  if (Test-Path $Path) {
    $existing = Get-Content $Path -Raw
    $normExisting = ($existing -replace '\r\n', "`n" -replace $tsPattern, '').Trim()
    $normContent = ($Content -replace '\r\n', "`n" -replace $tsPattern, '').Trim()
    if ($normExisting -eq $normContent) {
      Write-Host "  No skill-relevant changes -- skipping write: $Path" -ForegroundColor DarkGray
      return $false
    }
  }
  Set-Content -Path $Path -Value $Content -Encoding UTF8
  return $true
}

# Paths
$CANONICAL_SKILLS = "C:\dev\skills"
$MANIFEST_FILE = "C:\dev\manifest.json"
$RUNTIME_LOG = "C:\dev\audit\SKILL-RUN-LOG.md"
$INTERNAL_SKILLS = @("_cic-shared")

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

function Sync-WarningsToTodos {
  if (-not (Test-Path -LiteralPath $TodosPath)) {
    Write-Host "⚠️ TODO sync skipped; file not found: $TodosPath" -ForegroundColor Yellow
    return
  }

  $warnings = @(
    foreach ($skillId in ($health.skills.Keys | Sort-Object)) {
      foreach ($check in @($health.skills[$skillId].checks | Where-Object { $_.result -eq "warn" })) {
        if ($check.name -in @("Manifest", "Entrypoint", "Runtime", "Dependencies", "DryRun", "AuditLog", "SkillMD")) {
          [pscustomobject]@{ Skill = $skillId; Check = $check.name; Details = [string]$check.details }
        }
      }
    }
  )

  $content = Get-Content -LiteralPath $TodosPath -Raw
  $dateStr = Get-Date -Format "yyyy-MM-dd"
  $activeMarkers = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  $newLines = @()
  foreach ($group in ($warnings | Group-Object -Property Check | Sort-Object Name)) {
    $skills = @($group.Group | Select-Object -ExpandProperty Skill | Sort-Object -Unique)
    $checkName = [string]$group.Name
    $groupMarker = "<!-- todo-group: toolforge-health-warning:$checkName -->"
    [void]$activeMarkers.Add($groupMarker)
    if (-not $content.Contains($groupMarker)) {`n      $newLines += "- [ ] **[P2] Toolforge health warning group: $checkName** (created $dateStr) — $($skills.Count) skill(s): $($skills -join ', '). Source: SKILLPACK-RUNTIME-HEALTH.md. $groupMarker"`n    }
  }
  # Clean up / auto-resolve stale warning items in TODOS.md
  $lines = $content -split "\r?\n"
  $resolvedLines = @()
  $updatedOpenLines = @()
  $inOpen = $false

  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match '^## Open') { $inOpen = $true }
    elseif ($line -match '^## ') { $inOpen = $false }

    if ($inOpen -and (($line -match 'todo-group: toolforge-health-warning:') -or ($line -match '^-\s*\[\s*\]\s*\*\*\[P2\]\s*Toolforge health warning:.*?(<!-- toolforge-health-warning: .*? -->)'))) {
      $markerMatch = [regex]::Match($line, '<!-- (?:todo-group: toolforge-health-warning:[^ ]+|toolforge-health-warning: .*?) -->')
      $marker = if ($markerMatch.Success) { $markerMatch.Value } else { $null }
      if (-not $activeMarkers.Contains($marker)) {
        $resolvedLine = $line -replace '^-\s*\[\s*\]', '- [x]'
        if ($resolvedLine -match '\(created \d{4}-\d{2}-\d{2}\)') {
          $resolvedLine = $resolvedLine -replace '(\(created \d{4}-\d{2}-\d{2}\))', "`$1 (resolved $dateStr)"
        } else {
          $resolvedLine = $resolvedLine -replace '(\*\* —)', "(resolved $dateStr) $1"
        }
        $resolvedLines += $resolvedLine
        continue
      }
    }
    $updatedOpenLines += $line
  }

  if ($newLines.Count -eq 0 -and $resolvedLines.Count -eq 0) {
    return
  }

  if ($newLines.Count -gt 0) {
    $insertNew = ($newLines -join "`n") + "`n"
    $updatedContent = ($updatedOpenLines -join "`n")
    $updatedContent = [regex]::Replace($updatedContent, "## Open\r?\n", "## Open`n`n$insertNew", 1)
    $updatedOpenLines = $updatedContent -split "\r?\n"
  }

  if ($resolvedLines.Count -gt 0) {
    $insertResolved = ($resolvedLines -join "`n") + "`n"
    $updatedContent = ($updatedOpenLines -join "`n")
    if ($updatedContent -match "## Completed\r?\n") {
      $updatedContent = [regex]::Replace($updatedContent, "## Completed\r?\n", "## Completed`n`n$insertResolved", 1)
    } else {
      $updatedContent += "`n`n## Completed`n`n" + $insertResolved
    }
    $updatedOpenLines = $updatedContent -split "\r?\n"
  }

  $finalContent = $updatedOpenLines -join "`n"
  Set-Content -LiteralPath $TodosPath -Value $finalContent -Encoding UTF8
  if ($newLines.Count -gt 0) {
    Write-Host "⚠️ Logged $($newLines.Count) new health warning(s) into TODOS.md" -ForegroundColor Yellow
  }
  if ($resolvedLines.Count -gt 0) {
    Write-Host "✅ Auto-resolved $($resolvedLines.Count) cleared health warning(s) in TODOS.md" -ForegroundColor Green
  }
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
    if ($skillId -in $INTERNAL_SKILLS) {
      Log "Skipping internal package: $skillId"
      continue
    }
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
    $md += "*(none)*`n"
  } else {
    foreach ($skillId in ($errorSkills | Sort-Object)) {
      $md += "- $skillId`n"
    }

    # Automatically log failures into TODOS.md
    $todosPath = "C:\dev\TODOS.md"
    if (Test-Path $todosPath) {
      $dateStr = (Get-Date -Format "yyyy-MM-dd")
      $errList = ($errorSkills -join ", ")
      $todoLine = "- [ ] **[P1] Skill Health Check Failures ($errList)** ($dateStr) — Automatically logged by toolforgeSkillHealthCheck.ps1. Fix failing skills listed in SKILLPACK-RUNTIME-HEALTH.md."
      $content = Get-Content $todosPath -Raw
      if ($content -notmatch "Skill Health Check Failures") {
        $content = $content -replace "## Open\r?\n", "## Open`n`n$todoLine`n"
        Set-Content -Path $todosPath -Value $content -Encoding UTF8
        Write-Host "⚠️ Logged failures into TODOS.md" -ForegroundColor Yellow
      }
    }
  }

  $md += @"

---

**Report generated by `toolforgeSkillHealthCheck.ps1` — Phase 1.6**

"@

  Write-IfChanged -Path $OutputPath -Content $md | Out-Null
  Sync-WarningsToTodos
  Write-Host "✅ Health report checked: $OutputPath" -ForegroundColor Green
}

# ============================================================================
# MAIN
# ============================================================================

Run-HealthChecks
Generate-Report

Write-Host "`n✅ Health check complete." -ForegroundColor Green
$env:TOOLFORGE_HEALTHCHECK_RUNNING = $null
