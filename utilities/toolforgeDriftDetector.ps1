<#
.SYNOPSIS
  Toolforge Drift Detection Daemon
  Compares canonical and distributed Toolforge directories.

.DESCRIPTION
  Detects divergence between:
  - C:\dev\toolforge\ (canonical)
  - C:\dev\rewrite-mcp\toolforge\ (distributed)

  Checks:
  - Directory structure
  - Tools (sync-tools, adapters, etc.)
  - Skills (skills/)
  - Documentation (docs/)
  - manifest.json versions

  Generates: C:\dev\toolforge\drift\DRIFT-REPORT.md

.PARAMETER OutputPath
  Where to save drift report (default: DRIFT-REPORT.md)

.PARAMETER Verbose
  Show detailed drift logs

.EXAMPLE
  ./toolforgeDriftDetector.ps1
  ./toolforgeDriftDetector.ps1 -Verbose
#>

param(
  [string]$OutputPath = "C:\dev\toolforge\drift\DRIFT-REPORT.md",
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

$CANONICAL = "C:\dev\toolforge"
$DISTRIBUTED = "C:\dev\rewrite-mcp\toolforge"

$drift = @{
  structure = @()
  tools = @()
  skills = @()
  docs = @()
  manifest = @()
  timestamp = (Get-Date -AsUTC -Format "o")
  totalDrifts = 0
}

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message"
  }
}

function Compare-Directories {
  param([string]$Path1, [string]$Path2, [string]$Name)

  $items1 = @()
  $items2 = @()

  if (Test-Path $Path1) {
    $items1 = @(Get-ChildItem -Path $Path1 -Directory -Exclude "_TEMPLATE" | ForEach-Object { $_.Name })
  }

  if (Test-Path $Path2) {
    $items2 = @(Get-ChildItem -Path $Path2 -Directory -Exclude "_TEMPLATE" | ForEach-Object { $_.Name })
  }

  $findings = @()

  # Missing in distributed
  foreach ($item in $items1) {
    if ($item -notin $items2) {
      $findings += @{
        type = "missing"
        item = $item
        location = "distributed"
        severity = "warning"
      }
    }
  }

  # Extra in distributed (unexpected)
  foreach ($item in $items2) {
    if ($item -notin $items1) {
      $findings += @{
        type = "extra"
        item = $item
        location = "distributed"
        severity = "info"
      }
    }
  }

  return $findings
}

function Check-Tools {
  $findings = @()

  $toolDirs = @("sync-tools", "adapters", "daemons", "utilities", "mcp-servers")

  foreach ($dir in $toolDirs) {
    $path1 = Join-Path $CANONICAL $dir
    $path2 = Join-Path $DISTRIBUTED $dir

    if (Test-Path $path1) {
      $files1 = @(Get-ChildItem -Path $path1 -File -Include "*.cjs", "*.ts", "*.ps1", "*.sh" | ForEach-Object { $_.Name })
      $files2 = @()

      if (Test-Path $path2) {
        $files2 = @(Get-ChildItem -Path $path2 -File -Include "*.cjs", "*.ts", "*.ps1", "*.sh" | ForEach-Object { $_.Name })
      }

      # Missing tools
      foreach ($file in $files1) {
        if ($file -notin $files2) {
          $findings += @{
            category = $dir
            tool = $file
            type = "missing"
            severity = "warning"
          }
        }
      }

      # Extra tools
      foreach ($file in $files2) {
        if ($file -notin $files1) {
          $findings += @{
            category = $dir
            tool = $file
            type = "extra"
            severity = "info"
          }
        }
      }
    }
  }

  return $findings
}

function Check-Skills {
  $findings = @()

  $skillPath1 = Join-Path $CANONICAL "skills"
  $skillPath2 = Join-Path $DISTRIBUTED "skills"

  if (Test-Path $skillPath1) {
    $skills1 = @(Get-ChildItem -Path $skillPath1 -Directory -Exclude "_TEMPLATE" | ForEach-Object { $_.Name })
    $skills2 = @()

    if (Test-Path $skillPath2) {
      $skills2 = @(Get-ChildItem -Path $skillPath2 -Directory -Exclude "_TEMPLATE" | ForEach-Object { $_.Name })
    } else {
      # entire skills/ missing in distributed
      $findings += @{
        type = "missing_directory"
        item = "skills/"
        severity = "warning"
      }
    }

    # Check individual skills
    foreach ($skill in $skills1) {
      if ($skill -notin $skills2) {
        $findings += @{
          type = "missing_skill"
          skill = $skill
          severity = "warning"
        }
      } else {
        # Check versions
        $json1Path = Join-Path $skillPath1 $skill "skill.json"
        $json2Path = Join-Path $skillPath2 $skill "skill.json"

        if ((Test-Path $json1Path) -and (Test-Path $json2Path)) {
          $v1 = (Get-Content $json1Path | ConvertFrom-Json).version
          $v2 = (Get-Content $json2Path | ConvertFrom-Json).version

          if ($v1 -ne $v2) {
            $findings += @{
              type = "version_mismatch"
              skill = $skill
              canonical = $v1
              distributed = $v2
              severity = "warning"
            }
          }
        }
      }
    }
  }

  return $findings
}

function Check-Docs {
  $findings = @()

  $docsPath1 = Join-Path $CANONICAL "docs"
  $docsPath2 = Join-Path $DISTRIBUTED "docs"

  if (Test-Path $docsPath1) {
    $files1 = @(Get-ChildItem -Path $docsPath1 -File | ForEach-Object { $_.Name })
    $files2 = @()

    if (Test-Path $docsPath2) {
      $files2 = @(Get-ChildItem -Path $docsPath2 -File | ForEach-Object { $_.Name })
    }

    foreach ($file in $files1) {
      if ($file -notin $files2) {
        $findings += @{
          type = "missing_doc"
          file = $file
          severity = "info"
        }
      }
    }
  }

  return $findings
}

function Check-Manifest {
  $findings = @()

  $manifest1Path = Join-Path $CANONICAL "manifest.json"
  $manifest2Path = Join-Path $DISTRIBUTED "manifest.json"

  if (Test-Path $manifest1Path) {
    $m1 = Get-Content $manifest1Path | ConvertFrom-Json
    $m1Version = $m1.version ?? "unknown"

    if (Test-Path $manifest2Path) {
      $m2 = Get-Content $manifest2Path | ConvertFrom-Json
      $m2Version = $m2.version ?? "unknown"

      if ($m1Version -ne $m2Version) {
        $findings += @{
          type = "version_mismatch"
          item = "manifest.json"
          canonical = $m1Version
          distributed = $m2Version
          severity = "warning"
        }
      }

      # Check skill counts
      $s1Count = ($m1.skills ?? @()).Count
      $s2Count = ($m2.skills ?? @()).Count

      if ($s1Count -ne $s2Count) {
        $findings += @{
          type = "count_mismatch"
          item = "manifest.skills"
          canonical = $s1Count
          distributed = $s2Count
          severity = "warning"
        }
      }
    } else {
      $findings += @{
        type = "missing_file"
        file = "manifest.json"
        location = "distributed"
        severity = "warning"
      }
    }
  }

  return $findings
}

# Run detections
Write-Host "🔍 Toolforge Drift Detector" -ForegroundColor Cyan
Write-Host ""

# Structure
Log "Checking directory structure..."
$structureDrift = Compare-Directories -Path1 (Join-Path $CANONICAL "*") -Path2 (Join-Path $DISTRIBUTED "*") -Name "Toolforge"
$drift.structure = $structureDrift
$drift.totalDrifts += $structureDrift.Count

# Tools
Log "Checking tools..."
$toolDrift = Check-Tools
$drift.tools = $toolDrift
$drift.totalDrifts += $toolDrift.Count

# Skills
Log "Checking skills..."
$skillDrift = Check-Skills
$drift.skills = $skillDrift
$drift.totalDrifts += $skillDrift.Count

# Docs
Log "Checking documentation..."
$docDrift = Check-Docs
$drift.docs = $docDrift
$drift.totalDrifts += $docDrift.Count

# Manifest
Log "Checking manifest.json..."
$manifestDrift = Check-Manifest
$drift.manifest = $manifestDrift
$drift.totalDrifts += $manifestDrift.Count

# Generate report
$report = @"
# Toolforge Drift Detection Report

**Generated**: $($drift.timestamp)

**Canonical**: $CANONICAL
**Distributed**: $DISTRIBUTED

---

## Executive Summary

| Category | Drifts | Severity |
|----------|--------|----------|
| Structure | $($drift.structure.Count) | $(if ($drift.structure.Count -gt 0) { "⚠️" } else { "✓" }) |
| Tools | $($drift.tools.Count) | $(if ($drift.tools.Count -gt 0) { "⚠️" } else { "✓" }) |
| Skills | $($drift.skills.Count) | $(if ($drift.skills.Count -gt 0) { "⚠️" } else { "✓" }) |
| Docs | $($drift.docs.Count) | $(if ($drift.docs.Count -gt 0) { "ℹ️" } else { "✓" }) |
| Manifest | $($drift.manifest.Count) | $(if ($drift.manifest.Count -gt 0) { "⚠️" } else { "✓" }) |

**Total Drifts**: $($drift.totalDrifts)
**Status**: $(if ($drift.totalDrifts -eq 0) { "✅ IN SYNC" } else { "⚠️ DRIFTED" })

---

## Findings

"@

if ($drift.structure.Count -gt 0) {
  $report += "### Structure Drifts`n`n"
  foreach ($item in $drift.structure) {
    $report += "- **$($item.type)** $($item.item) (in $($item.location))`n"
  }
  $report += "`n"
}

if ($drift.tools.Count -gt 0) {
  $report += "### Tools Drifts`n`n"
  foreach ($item in $drift.tools) {
    $report += "- **$($item.category)**: $($item.type) $($item.tool)`n"
  }
  $report += "`n"
}

if ($drift.skills.Count -gt 0) {
  $report += "### Skills Drifts`n`n"
  foreach ($item in $drift.skills) {
    if ($item.type -eq "version_mismatch") {
      $report += "- **$($item.skill)**: version mismatch (canonical: $($item.canonical), distributed: $($item.distributed))`n"
    } elseif ($item.type -eq "missing_directory") {
      $report += "- **$($item.item)**: missing in distributed`n"
    } else {
      $report += "- **$($item.skill)**: $($item.type)`n"
    }
  }
  $report += "`n"
}

if ($drift.docs.Count -gt 0) {
  $report += "### Documentation Drifts`n`n"
  foreach ($item in $drift.docs) {
    $report += "- **$($item.file)**: missing in distributed (info only)`n"
  }
  $report += "`n"
}

if ($drift.manifest.Count -gt 0) {
  $report += "### Manifest Drifts`n`n"
  foreach ($item in $drift.manifest) {
    if ($item.type -eq "version_mismatch") {
      $report += "- **$($item.item)**: version mismatch (canonical: $($item.canonical), distributed: $($item.distributed))`n"
    } elseif ($item.type -eq "count_mismatch") {
      $report += "- **$($item.item)**: count mismatch (canonical: $($item.canonical), distributed: $($item.distributed))`n"
    } else {
      $report += "- **$($item.item)**: $($item.type) in distributed`n"
    }
  }
  $report += "`n"
}

if ($drift.totalDrifts -eq 0) {
  $report += "### ✅ No Drifts Detected

Canonical and distributed Toolforge directories are in sync.
`n`n"
}

$report += @"
---

## Remediation

### For Missing Items in Distributed

1. Run sync tool: \`./toolforgeSkillSync.ps1\`
2. Verify distributed has all items from canonical
3. Test tools/skills in distributed location

### For Version Mismatches

1. Update distributed manifest.json version to match canonical
2. Run \`./run-tool.ps1 -Refresh\` in distributed
3. Verify version consistency

### For Extra Items in Distributed

If unexpected items exist in distributed:
1. Verify they are intentional (development branches, local experiments)
2. Document in DRIFT-NOTES.md
3. No action required if temporary

---

## Detection Rules

- **Structure**: Canonical directory structure should exist in distributed
- **Tools**: All tools in canonical sync-tools/ should exist in distributed
- **Skills**: All skills in canonical skills/ should exist in distributed
- **Versions**: skill.json versions must match between canonical and distributed
- **Manifest**: manifest.json versions and skill counts should match

---

## Schedule

This detector runs daily at **09:00 UTC** via Task Scheduler.

Reports are appended to this file with dated entries.

---

**Drift Detection v1.0.0** | Toolforge Team
"@

# Ensure drift directory exists
$driftDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $driftDir)) {
  New-Item -ItemType Directory -Path $driftDir -Force | Out-Null
}

$report | Set-Content -Path $OutputPath -Encoding UTF8
Write-Host "✓ Report generated: $OutputPath" -ForegroundColor Green

# Console summary
Write-Host ""
Write-Host "📊 Drift Summary" -ForegroundColor Cyan
Write-Host "  Structure: $($drift.structure.Count) drift(s)"
Write-Host "  Tools: $($drift.tools.Count) drift(s)"
Write-Host "  Skills: $($drift.skills.Count) drift(s)"
Write-Host "  Docs: $($drift.docs.Count) drift(s)"
Write-Host "  Manifest: $($drift.manifest.Count) drift(s)"
Write-Host ""
Write-Host "  Total: $($drift.totalDrifts) drift(s)"
Write-Host ""

if ($drift.totalDrifts -eq 0) {
  Write-Host "✅ Status: IN SYNC" -ForegroundColor Green
  exit 0
} else {
  Write-Host "⚠️ Status: DRIFTED" -ForegroundColor Yellow
  exit 1
}
