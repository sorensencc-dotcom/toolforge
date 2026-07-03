<#
.SYNOPSIS
  Toolforge Skill Installer
  Install pending skills → canonical → distributed → manifest → Cowork

.DESCRIPTION
  Moves skills from audit/new-skills-pending-install/ through the complete
  lifecycle: installs into canonical Toolforge, syncs to distributed,
  registers in manifest.json, registers with Cowork, and cleans up pending.

  Generates: C:\dev\toolforge\audit\SKILL-INSTALL-REPORT.md

.PARAMETER PendingDir
  Directory containing pending skills (default: audit/new-skills-pending-install/)

.PARAMETER Verbose
  Show detailed installation logs

.EXAMPLE
  ./toolforgeSkillInstaller.ps1
  ./toolforgeSkillInstaller.ps1 -Verbose

.OUTPUTS
  Exit code 0 = all skills installed successfully
  Exit code 1 = one or more skills failed
#>

param(
  [string]$PendingDir = "C:\dev\toolforge\audit\new-skills-pending-install",
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Paths
$CANONICAL_SKILLS = "C:\dev\toolforge\skills"
$DISTRIBUTED_SKILLS = "C:\dev\rewrite-mcp\toolforge\skills"
$MANIFEST_PATH = "C:\dev\toolforge\manifest.json"
$AUDIT_DIR = "C:\dev\toolforge\audit"
$INSTALLED_DIR = Join-Path $AUDIT_DIR "installed-skills"
$REPORT_PATH = Join-Path $AUDIT_DIR "SKILL-INSTALL-REPORT.md"
$COWORK_WRAPPER = "C:\dev\toolforge\utilities\Invoke-CoworkSkillInstall.ps1"

$timestamp = Get-Date -AsUTC -Format "o"
$installResults = @{
  totalSkills = 0
  successful = @()
  failed = @()
  warnings = @()
  installed = @{}
}

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message"
  }
}

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    Log "Created directory: $Path"
  }
}

function Get-SkillMetadata {
  param([string]$SkillPath)

  $metadata = @{
    id = ""
    name = ""
    category = "uncategorized"
    description = ""
    entrypoint = "src/index.ts"
    version = "0.1.0"
    owner = "soren"
    tags = @()
    runtime = "typescript"
    timeout = 30000
    permissions = @{ required = @(); optional = @() }
    dependencies = @{ internal = @(); external = @() }
  }

  # Try to find and parse .SKILL.json
  $skillJsonPath = ""
  if ((Test-Path $SkillPath) -and (Get-Item $SkillPath).PSIsContainer) {
    # Directory mode
    $skillJsonPath = Join-Path $SkillPath "SKILL.json"
  } else {
    # Single file mode — derive JSON path from .SKILL.md
    $skillJsonPath = $SkillPath -replace "\.SKILL\.md$", ".SKILL.json"
  }

  if (Test-Path $skillJsonPath) {
    try {
      $json = Get-Content $skillJsonPath | ConvertFrom-Json
      Log "Loaded metadata from: $skillJsonPath"

      if ($json.id) { $metadata.id = $json.id }
      if ($json.name) { $metadata.name = $json.name }
      if ($json.category) { $metadata.category = $json.category }
      if ($json.description) { $metadata.description = $json.description }
      if ($json.entrypoint) { $metadata.entrypoint = $json.entrypoint }
      if ($json.version) { $metadata.version = $json.version }
      if ($json.owner) { $metadata.owner = $json.owner }
      if ($json.tags -and $json.tags.Count -gt 0) { $metadata.tags = $json.tags }
      if ($json.runtime) { $metadata.runtime = $json.runtime }
      if ($json.timeout) { $metadata.timeout = $json.timeout }
      if ($json.permissions) { $metadata.permissions = $json.permissions }
      if ($json.dependencies) { $metadata.dependencies = $json.dependencies }
    } catch {
      Log "Could not parse SKILL.json: $_" "WARN"
    }
  }

  # Derive ID from path if not set
  if (-not $metadata.id) {
    if ((Get-Item $SkillPath).PSIsContainer) {
      $metadata.id = (Get-Item $SkillPath).Name
    } else {
      $metadata.id = (Get-Item $SkillPath).BaseName -replace "\.SKILL$", ""
    }
    Log "Derived skill ID: $($metadata.id)"
  }

  # Derive name from ID if not set
  if (-not $metadata.name) {
    $metadata.name = $metadata.id -replace "-", " " | % { (Get-Culture).TextInfo.ToTitleCase($_) }
    Log "Derived skill name: $($metadata.name)"
  }

  # Description fallback if missing
  if (-not $metadata.description -or [string]::IsNullOrWhiteSpace($metadata.description)) {
    $metadata.description = "No description provided."
    Log "Using fallback description for: $($metadata.id)"
  }

  # Category fallback if missing
  $canonicalCategories = @("automation", "analysis", "monitoring", "validation", "integration", "lifecycle", "utility")
  if (-not $metadata.category -or [string]::IsNullOrWhiteSpace($metadata.category)) {
    $metadata.category = "utility"
    Log "Using fallback category 'utility' for: $($metadata.id)"
  } elseif ($metadata.category -notin $canonicalCategories) {
    Log "Invalid category '$($metadata.category)' for $($metadata.id) — valid: $($canonicalCategories -join ', ')" "WARN"
  }

  # Tags validation if present
  if ($metadata.tags -and $metadata.tags.Count -gt 0) {
    $validatedTags = @()
    $seenTags = @{}

    foreach ($tag in $metadata.tags) {
      # Check for uppercase
      if ($tag -cmatch '[A-Z]') {
        Log "Tag '$tag' contains uppercase for $($metadata.id) — convert to lowercase" "WARN"
        $tag = $tag.ToLower()
      }

      # Check for spaces
      if ($tag -match '\s') {
        Log "Tag '$tag' contains spaces for $($metadata.id) — skipping" "WARN"
        continue
      }

      # Check for placeholders
      if ($tag -in @("todo", "tbd", "none", "misc")) {
        Log "Tag '$tag' is placeholder for $($metadata.id) — skipping" "WARN"
        continue
      }

      # Check for duplicates
      if ($seenTags[$tag]) {
        Log "Duplicate tag '$tag' for $($metadata.id) — skipping" "WARN"
        continue
      }

      $validatedTags += $tag
      $seenTags[$tag] = $true
    }

    $metadata.tags = $validatedTags
  }

  return $metadata
}

function Install-SkillToCanonical {
  param([string]$SkillPath, [hashtable]$Metadata)

  $skillId = $Metadata.id
  $canonicalPath = Join-Path $CANONICAL_SKILLS $skillId

  Log "Installing to canonical: $canonicalPath"

  try {
    # Create skill directory
    Ensure-Directory $canonicalPath

    # Copy skill artifacts
    if ((Test-Path $SkillPath) -and (Get-Item $SkillPath).PSIsContainer) {
      # Directory mode — copy entire directory
      Get-ChildItem -Path $SkillPath -Recurse | ForEach-Object {
        $relativePath = $_.FullName.Substring($SkillPath.Length + 1)
        $destPath = Join-Path $canonicalPath $relativePath

        if ($_.PSIsContainer) {
          Ensure-Directory $destPath
        } else {
          Copy-Item -Path $_.FullName -Destination $destPath -Force
          Log "Copied: $relativePath"
        }
      }
    } else {
      # Single file mode — copy .SKILL.md and .SKILL.json
      $skillMdPath = $SkillPath
      $skillJsonPath = $SkillPath -replace "\.SKILL\.md$", ".SKILL.json"

      if (Test-Path $skillMdPath) {
        Copy-Item -Path $skillMdPath -Destination (Join-Path $canonicalPath "SKILL.md") -Force
        Log "Copied: SKILL.md"
      }

      if (Test-Path $skillJsonPath) {
        Copy-Item -Path $skillJsonPath -Destination (Join-Path $canonicalPath "SKILL.json") -Force
        Log "Copied: SKILL.json"
      }
    }

    # Ensure SKILL.json exists in canonical (create from metadata if missing)
    $canonicalJsonPath = Join-Path $canonicalPath "SKILL.json"
    if (-not (Test-Path $canonicalJsonPath)) {
      $skillJsonObj = @{
        id = $Metadata.id
        name = $Metadata.name
        category = $Metadata.category
        description = $Metadata.description
        entrypoint = $Metadata.entrypoint
        status = "active"
        version = $Metadata.version
        owner = $Metadata.owner
        tags = $Metadata.tags
        runtime = $Metadata.runtime
        timeout = $Metadata.timeout
        permissions = $Metadata.permissions
        dependencies = $Metadata.dependencies
      }

      $skillJsonObj | ConvertTo-Json -Depth 10 | Set-Content -Path $canonicalJsonPath -Encoding UTF8
      Log "Created SKILL.json from metadata"
    }

    # Ensure entrypoint exists or create stub
    $entrypointPath = Join-Path $canonicalPath $Metadata.entrypoint
    if (-not (Test-Path $entrypointPath)) {
      Ensure-Directory (Split-Path $entrypointPath)

      $stub = @"
// $($Metadata.name)
// Generated stub — implement skill logic

export async function execute(input: any) {
  console.log("Skill: $($Metadata.id)");
  return { status: "ok", message: "Skill stub executed" };
}
"@

      Set-Content -Path $entrypointPath -Value $stub -Encoding UTF8
      Log "Created entrypoint stub: $($Metadata.entrypoint)"
      $installResults.warnings += "Entrypoint stub created for $($Metadata.id) — implement logic"
    }

    return $true
  } catch {
    Log "Failed to install to canonical: $_" "ERROR"
    return $false
  }
}

function Sync-SkillToDistributed {
  param([string]$SkillId)

  $canonicalPath = Join-Path $CANONICAL_SKILLS $SkillId
  $distributedPath = Join-Path $DISTRIBUTED_SKILLS $SkillId

  Log "Syncing to distributed: $distributedPath"

  try {
    Ensure-Directory $distributedPath

    # Copy from canonical to distributed
    Get-ChildItem -Path $canonicalPath -Recurse | ForEach-Object {
      $relativePath = $_.FullName.Substring($canonicalPath.Length + 1)
      $destPath = Join-Path $distributedPath $relativePath

      if ($_.PSIsContainer) {
        Ensure-Directory $destPath
      } else {
        # Only copy if hash differs (avoid unnecessary writes)
        $shouldCopy = $true
        if (Test-Path $destPath) {
          $canonicalHash = (Get-FileHash $_.FullName).Hash
          $distributedHash = (Get-FileHash $destPath).Hash
          $shouldCopy = $canonicalHash -ne $distributedHash
        }

        if ($shouldCopy) {
          Copy-Item -Path $_.FullName -Destination $destPath -Force
          Log "Synced: $relativePath"
        }
      }
    }

    return $true
  } catch {
    Log "Failed to sync to distributed: $_" "ERROR"
    return $false
  }
}

function Update-Manifest {
  param([string]$SkillId, [hashtable]$Metadata)

  Log "Updating manifest for skill: $SkillId"

  try {
    $manifest = Get-Content $MANIFEST_PATH | ConvertFrom-Json

    # Validate description quality
    $desc = $Metadata.description
    if ($desc -in @("TODO", "TBD", "None", "", "No description") -or [string]::IsNullOrWhiteSpace($desc)) {
      Log "Description is placeholder: $SkillId → $desc" "WARN"
      $installResults.warnings += "Description is placeholder for $SkillId — consider providing details"
    }

    # Validate category quality
    $canonicalCategories = @("automation", "analysis", "monitoring", "validation", "integration", "lifecycle", "utility")
    if ($Metadata.category -notin $canonicalCategories) {
      Log "Invalid category: $SkillId → $($Metadata.category)" "WARN"
      $installResults.warnings += "Invalid category for $SkillId — should be one of: $($canonicalCategories -join ', ')"
    }

    # Validate tags quality
    if ($Metadata.tags -and $Metadata.tags.Count -gt 0) {
      foreach ($tag in $Metadata.tags) {
        if ($tag -match '[A-Z]' -or $tag -match '\s' -or $tag -in @("todo", "tbd", "none", "misc")) {
          Log "Invalid tag: $SkillId → $tag" "WARN"
          $installResults.warnings += "Invalid tag '$tag' for $SkillId — tags must be lowercase, no spaces, no placeholders"
        }
      }
    }

    # Validate dependencies
    if ($Metadata.dependencies) {
      # Check internal dependencies
      if ($Metadata.dependencies.internal -and $Metadata.dependencies.internal.Count -gt 0) {
        foreach ($dep in $Metadata.dependencies.internal) {
          $depPath = Join-Path $CANONICAL_SKILLS $dep
          if (-not (Test-Path $depPath)) {
            Log "Missing internal dependency: $SkillId → $dep" "WARN"
            $installResults.warnings += "Internal dependency '$dep' not found in canonical skills for $SkillId"
          }
        }
      }

      # Check external dependencies
      if ($Metadata.dependencies.external -and $Metadata.dependencies.external.Count -gt 0) {
        foreach ($dep in $Metadata.dependencies.external) {
          $toolPath = Join-Path "C:\dev\toolforge\tools" $dep
          $daemonPath = Join-Path "C:\dev\toolforge\daemons" $dep
          $adapterPath = Join-Path "C:\dev\toolforge\adapters" $dep

          if (-not ((Test-Path $toolPath) -or (Test-Path $daemonPath) -or (Test-Path $adapterPath))) {
            Log "Missing external dependency: $SkillId → $dep" "WARN"
            $installResults.warnings += "External dependency '$dep' not found in tools/daemons/adapters for $SkillId"
          }
        }
      }
    }

    # Build manifest entry
    $entry = [PSCustomObject]@{
      id = $Metadata.id
      name = $Metadata.name
      category = $Metadata.category
      path = "skills/$SkillId"
      description = $Metadata.description
      entrypoint = $Metadata.entrypoint
      status = "active"
      version = $Metadata.version
      owner = $Metadata.owner
      tags = $Metadata.tags
      runtime = $Metadata.runtime
      timeout = $Metadata.timeout
      permissions = $Metadata.permissions
      dependencies = $Metadata.dependencies
    }

    # Ensure skills array exists
    if (-not $manifest.skills) {
      $manifest | Add-Member -MemberType NoteProperty -Name "skills" -Value @()
    }

    # Check for duplicate
    $existing = $manifest.skills | Where-Object { $_.id -eq $SkillId }
    if ($existing) {
      Log "Skill already in manifest: $SkillId" "WARN"
      $installResults.warnings += "Skill $SkillId already registered in manifest — preserving existing description"
      return $true
    }

    # Append entry
    $manifest.skills += $entry
    Log "Added manifest entry for: $SkillId"

    # Update manifest version
    $currentVersion = [version]$manifest.version
    if ($currentVersion.Minor -eq 0) {
      # 1.0.x → 1.1.0
      $manifest.version = "1.1.0"
    } else {
      # 1.1.x → 1.1.(x+1)
      $newPatch = $currentVersion.Build + 1
      $manifest.version = "$($currentVersion.Major).$($currentVersion.Minor).$newPatch"
    }
    Log "Bumped manifest version to: $($manifest.version)"

    # Save manifest
    $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $MANIFEST_PATH -Encoding UTF8
    Log "Manifest saved"

    return $true
  } catch {
    Log "Failed to update manifest: $_" "ERROR"
    return $false
  }
}

function Register-InCowork {
  param([string]$SkillId, [string]$SourcePath)

  Log "Registering with Cowork: $SkillId"

  try {
    # Determine source path for Cowork
    $skillMdPath = ""
    if ((Test-Path $SourcePath) -and (Get-Item $SourcePath).PSIsContainer) {
      $skillMdPath = Join-Path $SourcePath "SKILL.md"
    } else {
      $skillMdPath = $SourcePath
    }

    if (-not (Test-Path $skillMdPath)) {
      Log "SKILL.md not found: $skillMdPath" "WARN"
      $installResults.warnings += "Cowork registration skipped for $SkillId — SKILL.md not found"
      return $true
    }

    # Call Cowork wrapper
    & $COWORK_WRAPPER -SkillId $SkillId -SourcePath $skillMdPath -Verbose:$Verbose

    if ($LASTEXITCODE -eq 0) {
      Log "Cowork registration successful: $SkillId"
      return $true
    } else {
      Log "Cowork registration failed: $SkillId (exit code: $LASTEXITCODE)" "WARN"
      $installResults.warnings += "Cowork registration failed for $SkillId — validator will catch"
      return $true  # Continue even if Cowork fails
    }
  } catch {
    Log "Exception during Cowork registration: $_" "WARN"
    $installResults.warnings += "Cowork registration exception for $SkillId``: $_"
    return $true  # Continue even if exception
  }
}

function Generate-Report {
  $reportContent = @"
# Toolforge Skill Installation Report

**Generated**: $timestamp

---

## Summary

| Metric | Count |
|--------|-------|
| Total Skills Processed | $($installResults.totalSkills) |
| Successfully Installed | $($installResults.successful.Count) |
| Failed | $($installResults.failed.Count) |
| Warnings | $($installResults.warnings.Count) |

**Overall Status**: $(if ($installResults.failed.Count -eq 0) { "✅ SUCCESS" } else { "❌ FAILED" })

---

## Installed Skills

"@

  if ($installResults.successful.Count -gt 0) {
    $reportContent += "| Skill ID | Name | Version | Status |`n"
    $reportContent += "|----------|------|---------|--------|`n"

    foreach ($skillId in $installResults.successful) {
      $skill = $installResults.installed[$skillId]
      $reportContent += "| $($skill.id) | $($skill.name) | $($skill.version) | ✅ |`n"
    }
  } else {
    $reportContent += "No skills installed.`n"
  }

  $reportContent += "`n---`n`n## Failed Skills`n`n"

  if ($installResults.failed.Count -gt 0) {
    $reportContent += "| Skill ID | Error |`n"
    $reportContent += "|----------|-------|`n"

    foreach ($skillId in $installResults.failed) {
      $skillError = $installResults.installed[$skillId].error
      $reportContent += "| $skillId | $skillError |`n"
    }
  } else {
    $reportContent += "No failed skills.`n"
  }

  $reportContent += "`n---`n`n## Warnings`n`n"

  if ($installResults.warnings.Count -gt 0) {
    foreach ($warning in $installResults.warnings) {
      $reportContent += "- ⚠️ $warning`n"
    }
  } else {
    $reportContent += "No warnings.`n"
  }

  $reportContent += @"

---

## Manifest Updates

- Version bumped to canonical schema v1.1.0+
- All installed skills registered
- Distributed sync completed

---

## Next Steps

1. Run skill validator: \`./toolforgeSkillValidator.ps1 -Verbose\`
2. Check Cowork registration: \`Get-Content C:\dev\toolforge\audit\COWORK-REGISTERED-SKILLS.md\`
3. Verify distributed sync: \`./toolforgeDriftDetector.ps1\`

---

**Skill Installer v1.0.0** | Toolforge Team
"@

  $reportContent | Set-Content -Path $REPORT_PATH -Encoding UTF8
  Log "Report generated: $REPORT_PATH"
}

# Main installation flow
Write-Host "🚀 Toolforge Skill Installer" -ForegroundColor Cyan
Write-Host ""

# Validate setup
if (-not (Test-Path $PendingDir)) {
  Write-Host "❌ Pending directory not found: $PendingDir" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $MANIFEST_PATH)) {
  Write-Host "❌ Manifest not found: $MANIFEST_PATH" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $COWORK_WRAPPER)) {
  Write-Host "⚠️  Cowork wrapper not found: $COWORK_WRAPPER" -ForegroundColor Yellow
  Write-Host "   Continuing without Cowork registration" -ForegroundColor Yellow
}

Log "Validated setup"

# Ensure audit directory
Ensure-Directory $AUDIT_DIR
Ensure-Directory $INSTALLED_DIR

# Scan pending directory
Log "Scanning pending directory: $PendingDir"
$pendingItems = @()

# Find .SKILL.md files
Get-ChildItem -Path $PendingDir -Filter "*.SKILL.md" -File | ForEach-Object {
  $pendingItems += $_.FullName
}

# Find skill directories
Get-ChildItem -Path $PendingDir -Directory | ForEach-Object {
  if (Test-Path (Join-Path $_.FullName "SKILL.md")) {
    $pendingItems += $_.FullName
  }
}

if ($pendingItems.Count -eq 0) {
  Write-Host "ℹ️  No pending skills found" -ForegroundColor Cyan
  exit 0
}

Write-Host "📦 Found $($pendingItems.Count) pending skill(s)" -ForegroundColor Cyan
Write-Host ""

# Process each pending skill
foreach ($skillPath in $pendingItems) {
  $installResults.totalSkills += 1

  Write-Host "📥 Processing: $(Split-Path $skillPath -Leaf)" -ForegroundColor Cyan

  try {
    # Extract metadata
    $metadata = Get-SkillMetadata -SkillPath $skillPath
    $skillId = $metadata.id

    Log "Skill ID: $skillId"

    # Install to canonical
    $canonicalOk = Install-SkillToCanonical -SkillPath $skillPath -Metadata $metadata
    if (-not $canonicalOk) {
      throw "Failed to install to canonical"
    }

    # Sync to distributed
    $distributedOk = Sync-SkillToDistributed -SkillId $skillId
    if (-not $distributedOk) {
      throw "Failed to sync to distributed"
    }

    # Update manifest
    $manifestOk = Update-Manifest -SkillId $skillId -Metadata $metadata
    if (-not $manifestOk) {
      throw "Failed to update manifest"
    }

    # Register in Cowork
    if (Test-Path $COWORK_WRAPPER) {
      Register-InCowork -SkillId $skillId -SourcePath $skillPath
    }

    # Record success
    $installResults.successful += $skillId
    $installResults.installed[$skillId] = @{
      id = $metadata.id
      name = $metadata.name
      version = $metadata.version
    }

    Write-Host "✅ Installed: $skillId" -ForegroundColor Green
    Log "Installation complete for: $skillId"

    # Move to installed directory
    $pendingFileName = Split-Path $skillPath -Leaf
    $installedPath = Join-Path $INSTALLED_DIR $pendingFileName
    Move-Item -Path $skillPath -Destination $installedPath -Force
    Log "Moved to installed: $installedPath"

  } catch {
    $errorMsg = $_.Exception.Message
    Write-Host "❌ Failed: $errorMsg" -ForegroundColor Red
    Log "Installation failed: $errorMsg" "ERROR"

    $installResults.failed += (Split-Path $skillPath -Leaf)
    $installResults.installed[(Split-Path $skillPath -Leaf)] = @{ error = $errorMsg }
  }

  Write-Host ""
}

# Generate report
Log "Generating report"
Generate-Report

# Summary
Write-Host "📊 Installation Summary" -ForegroundColor Cyan
Write-Host "  Processed: $($installResults.totalSkills)"
Write-Host "  Successful: $($installResults.successful.Count)"
Write-Host "  Failed: $($installResults.failed.Count)"
Write-Host "  Warnings: $($installResults.warnings.Count)"
Write-Host ""

if ($installResults.failed.Count -eq 0) {
  Write-Host "✅ All skills installed successfully" -ForegroundColor Green
  Write-Host "📄 Report: $REPORT_PATH" -ForegroundColor Cyan
  exit 0
} else {
  Write-Host "❌ Some skills failed" -ForegroundColor Red
  Write-Host "📄 Report: $REPORT_PATH" -ForegroundColor Cyan
  exit 1
}
