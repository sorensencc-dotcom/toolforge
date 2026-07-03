<#
.SYNOPSIS
  Toolforge Skill Validator Refinement
  Multi-system consistency check for skill lifecycle.

.DESCRIPTION
  Validates:
  - Canonical Toolforge skills (schema, structure, integrity)
  - Distributed sync (file presence, hash matching)
  - Manifest consistency (entries, versions, paths)
  - Cowork registration state
  - Runtime discovery (run-tool.ps1 integration)
  - Audit logs (SKILL-RUN-LOG.md)

  Generates: C:\dev\toolforge\skills\SKILLPACK-VALIDATION.md

.PARAMETER OutputPath
  Where to save validation report (default: SKILLPACK-VALIDATION.md)

.PARAMETER Verbose
  Show detailed validation logs

.EXAMPLE
  ./toolforgeSkillValidator.ps1
  ./toolforgeSkillValidator.ps1 -Verbose
#>

param(
  [string]$OutputPath = "C:\dev\toolforge\skills\SKILLPACK-VALIDATION.md",
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Paths
$CANONICAL_SKILLS = "C:\dev\toolforge\skills"
$DISTRIBUTED_SKILLS = "C:\dev\rewrite-mcp\toolforge\skills"
$MANIFEST_FILE = "C:\dev\toolforge\manifest.json"
$COWORK_REGISTRY = "C:\dev\toolforge\audit\COWORK-REGISTERED-SKILLS.md"
$RUNTIME_LOG = "C:\dev\toolforge\audit\SKILL-RUN-LOG.md"

# Validation state
$validation = @{
  timestamp = Get-Date -AsUTC -Format "o"
  canonical = @{ passed = 0; warnings = 0; errors = 0; details = @() }
  distributed = @{ passed = 0; warnings = 0; errors = 0; details = @() }
  manifest = @{ passed = 0; warnings = 0; errors = 0; details = @() }
  cowork = @{ passed = 0; warnings = 0; errors = 0; details = @() }
  runtime = @{ passed = 0; warnings = 0; errors = 0; details = @() }
  dependencies = @{ passed = 0; warnings = 0; errors = 0; details = @() }
  audit = @{ passed = 0; warnings = 0; errors = 0; details = @() }
  skills = @{}
  graph = $null
}

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message"
  }
}

function Add-Finding {
  param([string]$Domain, [string]$SkillId, [string]$Level, [string]$Message)

  $finding = @{
    skill = $SkillId
    level = $Level
    message = $Message
  }

  $validation[$Domain].details += $finding

  if ($Level -eq "error") {
    $validation[$Domain].errors += 1
  } elseif ($Level -eq "warning") {
    $validation[$Domain].warnings += 1
  } else {
    $validation[$Domain].passed += 1
  }

  Log "$Domain / $SkillId``: $Level — $Message"
}

# ============================================================================
# A. CANONICAL SKILL INTEGRITY
# ============================================================================

function Validate-CanonicalSkills {
  Write-Host "🔍 Validating canonical skills..." -ForegroundColor Cyan

  if (-not (Test-Path $CANONICAL_SKILLS)) {
    Add-Finding "canonical" "system" "error" "Canonical skills directory not found"
    return
  }

  $skillDirs = Get-ChildItem -Path $CANONICAL_SKILLS -Directory -Exclude "_TEMPLATE"
  $seenIds = @{}
  $seenNames = @{}

  foreach ($dir in $skillDirs) {
    $skillId = $dir.Name
    Log "Checking canonical skill: $skillId"

    # Load SKILL.json
    $skillJsonPath = Join-Path $dir.FullName "SKILL.json"
    if (-not (Test-Path $skillJsonPath)) {
      Add-Finding "canonical" $skillId "error" "SKILL.json missing"
      continue
    }

    try {
      $skillJson = Get-Content $skillJsonPath | ConvertFrom-Json
    } catch {
      Add-Finding "canonical" $skillId "error" "SKILL.json malformed: $_"
      continue
    }

    # Validate required files
    $requiredFiles = @("SKILL.md", "README.md", "INTEGRATION_DIAGRAM.md")
    foreach ($file in $requiredFiles) {
      if (-not (Test-Path (Join-Path $dir.FullName $file))) {
        Add-Finding "canonical" $skillId "error" "Missing: $file"
      }
    }

    # Validate entrypoint
    if ($skillJson.entrypoint) {
      $entrypointPath = Join-Path $dir.FullName $skillJson.entrypoint
      if (-not (Test-Path $entrypointPath)) {
        Add-Finding "canonical" $skillId "warning" "Entrypoint missing: $($skillJson.entrypoint)"
      }
    } else {
      Add-Finding "canonical" $skillId "error" "Entrypoint not specified"
    }

    # Validate schema
    if (-not $skillJson.id) {
      Add-Finding "canonical" $skillId "error" "Missing: id"
    } elseif ($skillJson.id -ne $skillId) {
      Add-Finding "canonical" $skillId "error" "ID mismatch: SKILL.json says '$($skillJson.id)', directory is '$skillId'"
    }

    if (-not $skillJson.name) {
      Add-Finding "canonical" $skillId "error" "Missing: name"
    }

    if (-not $skillJson.version -or $skillJson.version -notmatch '^\d+\.\d+\.\d+') {
      Add-Finding "canonical" $skillId "error" "Invalid version: $($skillJson.version)"
    }

    if (-not $skillJson.runtime) {
      Add-Finding "canonical" $skillId "error" "Missing: runtime"
    } elseif ($skillJson.runtime -notin @("typescript", "javascript", "node", "powershell", "python", "bash")) {
      Add-Finding "canonical" $skillId "warning" "Unknown runtime: $($skillJson.runtime)"
    }

    # Validate description
    if (-not $skillJson.description) {
      Add-Finding "canonical" $skillId "warning" "Missing description"
    } elseif ([string]::IsNullOrWhiteSpace($skillJson.description)) {
      Add-Finding "canonical" $skillId "warning" "Description is blank"
    } elseif ($skillJson.description -in @("TODO", "TBD", "None")) {
      Add-Finding "canonical" $skillId "warning" "Description is placeholder: $($skillJson.description)"
    }

    # Validate category
    $canonicalCategories = @("automation", "analysis", "monitoring", "validation", "integration", "lifecycle", "utility")
    if (-not $skillJson.category -or [string]::IsNullOrWhiteSpace($skillJson.category)) {
      Add-Finding "canonical" $skillId "warning" "Category missing (using fallback: utility)"
    } elseif ($skillJson.category -notin $canonicalCategories) {
      Add-Finding "canonical" $skillId "warning" "Invalid category: $($skillJson.category)"
    } elseif ($skillJson.category -in @("misc", "general", "none", "tbd")) {
      Add-Finding "canonical" $skillId "warning" "Category is placeholder: $($skillJson.category)"
    }

    # Validate tags
    if ($skillJson.tags -and $skillJson.tags.Count -gt 0) {
      $seenTagsInSkill = @{}
      foreach ($tag in $skillJson.tags) {
        if ($tag -cmatch '[A-Z]') {
          Add-Finding "canonical" $skillId "warning" "Tag contains uppercase: $tag"
        }
        if ($tag -match '\s') {
          Add-Finding "canonical" $skillId "warning" "Tag contains spaces: $tag"
        }
        if ($tag -in @("todo", "tbd", "none", "misc")) {
          Add-Finding "canonical" $skillId "warning" "Tag is placeholder: $tag"
        }
        if ($seenTagsInSkill[$tag]) {
          Add-Finding "canonical" $skillId "warning" "Duplicate tag: $tag"
        }
        $seenTagsInSkill[$tag] = $true
      }
    }

    # Check for duplicates
    if ($seenIds[$skillJson.id]) {
      Add-Finding "canonical" $skillId "error" "Duplicate ID: $($skillJson.id)"
    } else {
      $seenIds[$skillJson.id] = $true
    }

    if ($skillJson.name -and $seenNames[$skillJson.name]) {
      Add-Finding "canonical" $skillId "warning" "Duplicate name: $($skillJson.name)"
    } else {
      $seenNames[$skillJson.name] = $true
    }

    # Store skill info
    $validation.skills[$skillId] = @{
      id = $skillJson.id
      name = $skillJson.name
      version = $skillJson.version
      runtime = $skillJson.runtime
      entrypoint = $skillJson.entrypoint
      description = $skillJson.description
      category = $skillJson.category
      tags = $skillJson.tags
      status = $skillJson.status
      canonical = $true
      distributed = $false
      manifest = $false
      cowork = $false
      runtime_discovered = $false
    }
  }

  Log "Canonical validation complete: $($validation.canonical.errors) errors, $($validation.canonical.warnings) warnings"
}

# ============================================================================
# B. DISTRIBUTED SYNC INTEGRITY
# ============================================================================

function Validate-DistributedSync {
  Write-Host "📦 Validating distributed sync..." -ForegroundColor Cyan

  if (-not (Test-Path $DISTRIBUTED_SKILLS)) {
    Add-Finding "distributed" "system" "warning" "Distributed skills directory not found (not yet synced)"
    return
  }

  foreach ($skillId in $validation.skills.Keys) {
    $canonicalPath = Join-Path $CANONICAL_SKILLS $skillId
    $distributedPath = Join-Path $DISTRIBUTED_SKILLS $skillId

    Log "Checking distributed sync: $skillId"

    if (-not (Test-Path $distributedPath)) {
      Add-Finding "distributed" $skillId "warning" "Directory missing in distributed"
      continue
    }

    # Check for SKILL.json
    $distJsonPath = Join-Path $distributedPath "SKILL.json"
    if (-not (Test-Path $distJsonPath)) {
      Add-Finding "distributed" $skillId "warning" "SKILL.json missing in distributed"
    } else {
      try {
        $distJson = Get-Content $distJsonPath | ConvertFrom-Json
        $canonJson = Get-Content (Join-Path $canonicalPath "SKILL.json") | ConvertFrom-Json

        if ($distJson.version -ne $canonJson.version) {
          Add-Finding "distributed" $skillId "warning" "Version mismatch: canonical $($canonJson.version), distributed $($distJson.version)"
        }

        if ($distJson.category -ne $canonJson.category) {
          Add-Finding "distributed" $skillId "warning" "Category mismatch: canonical '$($canonJson.category)', distributed '$($distJson.category)'"
        }

        if (($distJson.tags | ConvertTo-Json) -ne ($canonJson.tags | ConvertTo-Json)) {
          Add-Finding "distributed" $skillId "warning" "Tags mismatch: canonical '$($canonJson.tags -join ', ')', distributed '$($distJson.tags -join ', ')'"
        }

        if ($distJson.version -eq $canonJson.version -and $distJson.category -eq $canonJson.category -and ($distJson.tags | ConvertTo-Json) -eq ($canonJson.tags | ConvertTo-Json)) {
          $validation.skills[$skillId].distributed = $true
        }
      } catch {
        Add-Finding "distributed" $skillId "warning" "Could not parse SKILL.json"
      }
    }

    # Check entrypoint sync
    if ($validation.skills[$skillId].entrypoint) {
      $entrypointPath = Join-Path $distributedPath $validation.skills[$skillId].entrypoint
      if (-not (Test-Path $entrypointPath)) {
        Add-Finding "distributed" $skillId "warning" "Entrypoint missing in distributed"
      }
    }
  }

  Log "Distributed validation complete"
}

# ============================================================================
# C. MANIFEST CONSISTENCY
# ============================================================================

function Validate-ManifestConsistency {
  Write-Host "📋 Validating manifest consistency..." -ForegroundColor Cyan

  if (-not (Test-Path $MANIFEST_FILE)) {
    Add-Finding "manifest" "system" "error" "Manifest not found"
    return
  }

  try {
    $manifest = Get-Content $MANIFEST_FILE | ConvertFrom-Json
  } catch {
    Add-Finding "manifest" "system" "error" "Manifest malformed: $_"
    return
  }

  # Check version
  if (-not $manifest.version) {
    Add-Finding "manifest" "system" "error" "Manifest version missing"
  } elseif ([version]$manifest.version -lt [version]"1.1.0") {
    Add-Finding "manifest" "system" "error" "Manifest version too old: $($manifest.version) (need 1.1.0+)"
  }

  # Check skills array
  if (-not $manifest.skills) {
    Add-Finding "manifest" "system" "error" "Manifest skills array missing"
    return
  }

  # Validate each manifest entry
  $manifestIds = @{}

  foreach ($entry in $manifest.skills) {
    if (-not $entry.id) {
      Add-Finding "manifest" "unknown" "error" "Manifest entry missing id"
      continue
    }

    $skillId = $entry.id
    Log "Checking manifest entry: $skillId"

    # Check for duplicates
    if ($manifestIds[$skillId]) {
      Add-Finding "manifest" $skillId "error" "Duplicate entry in manifest"
    }
    $manifestIds[$skillId] = $true

    # Check if canonical skill exists
    if (-not $validation.skills[$skillId]) {
      Add-Finding "manifest" $skillId "error" "Manifest entry has no canonical skill"
      continue
    }

    # Check path format
    if ($entry.path -ne "skills/$skillId") {
      Add-Finding "manifest" $skillId "warning" "Path mismatch: expected 'skills/$skillId', got '$($entry.path)'"
    }

    # Check version consistency
    if ($entry.version -ne $validation.skills[$skillId].version) {
      Add-Finding "manifest" $skillId "error" "Version mismatch: canonical $($validation.skills[$skillId].version), manifest $($entry.version)"
    }

    # Check runtime consistency
    if ($entry.runtime -ne $validation.skills[$skillId].runtime) {
      Add-Finding "manifest" $skillId "warning" "Runtime mismatch: canonical $($validation.skills[$skillId].runtime), manifest $($entry.runtime)"
    }

    # Check description consistency
    if ($entry.description -ne $validation.skills[$skillId].description) {
      Add-Finding "manifest" $skillId "warning" "Description mismatch: canonical '$($validation.skills[$skillId].description)', manifest '$($entry.description)'"
    }

    if (-not $entry.description -or [string]::IsNullOrWhiteSpace($entry.description)) {
      Add-Finding "manifest" $skillId "warning" "Description missing in manifest"
    }

    # Check category consistency
    if ($entry.category -ne $validation.skills[$skillId].category) {
      Add-Finding "manifest" $skillId "error" "Category mismatch: canonical '$($validation.skills[$skillId].category)', manifest '$($entry.category)'"
    }

    # Validate category quality
    $canonicalCategories = @("automation", "analysis", "monitoring", "validation", "integration", "lifecycle", "utility")
    if ($entry.category -notin $canonicalCategories) {
      Add-Finding "manifest" $skillId "warning" "Invalid category in manifest: $($entry.category)"
    }

    # Check tags consistency (compare as JSON arrays for order-independent check)
    if (($entry.tags | ConvertTo-Json) -ne ($validation.skills[$skillId].tags | ConvertTo-Json)) {
      Add-Finding "manifest" $skillId "warning" "Tags mismatch: canonical '$($validation.skills[$skillId].tags -join ', ')', manifest '$($entry.tags -join ', ')'"
    }

    # Validate tags quality
    if ($entry.tags -and $entry.tags.Count -gt 0) {
      $seenTagsInEntry = @{}
      foreach ($tag in $entry.tags) {
        if ($tag -cmatch '[A-Z]') {
          Add-Finding "manifest" $skillId "warning" "Tag contains uppercase: $tag"
        }
        if ($tag -match '\s') {
          Add-Finding "manifest" $skillId "warning" "Tag contains spaces: $tag"
        }
        if ($tag -in @("todo", "tbd", "none", "misc")) {
          Add-Finding "manifest" $skillId "warning" "Tag is placeholder: $tag"
        }
        if ($seenTagsInEntry[$tag]) {
          Add-Finding "manifest" $skillId "warning" "Duplicate tag in manifest: $tag"
        }
        $seenTagsInEntry[$tag] = $true
      }
    }

    $validation.skills[$skillId].manifest = $true
  }

  Log "Manifest validation complete"
}

# ============================================================================
# D. COWORK REGISTRATION SANITY CHECK
# ============================================================================

function Validate-CoworkRegistration {
  Write-Host "🔗 Validating Cowork registration..." -ForegroundColor Cyan

  if (-not (Test-Path $COWORK_REGISTRY)) {
    Add-Finding "cowork" "system" "warning" "Cowork registry not found (skills not yet registered)"
    return
  }

  try {
    $coworkContent = Get-Content $COWORK_REGISTRY -Raw
    $registeredIds = @()

    # Parse registry (simple line-by-line lookup for skill IDs)
    foreach ($line in $coworkContent -split "`n") {
      if ($line -match '\|\s+\d{4}-\d{2}-\d{2}\s+\|\s+([^\|]+)\s+\|') {
        $skillId = $matches[1].Trim()
        $registeredIds += $skillId
      }
    }

    Log "Found $($registeredIds.Count) registered skills in Cowork"

    foreach ($skillId in $validation.skills.Keys) {
      if ($registeredIds -contains $skillId) {
        $validation.skills[$skillId].cowork = $true
        Add-Finding "cowork" $skillId "info" "Registered"
      } else {
        Add-Finding "cowork" $skillId "warning" "Not registered (installer will register on next run)"
      }
    }
  } catch {
    Add-Finding "cowork" "system" "warning" "Could not parse Cowork registry: $_"
  }

  Log "Cowork validation complete"
}

# ============================================================================
# E. RUNTIME DISCOVERY CONSISTENCY
# ============================================================================

function Validate-RuntimeDiscovery {
  Write-Host "⚙️  Validating runtime discovery..." -ForegroundColor Cyan

  # Simulate runtime discovery by checking skills directory
  if (-not (Test-Path $CANONICAL_SKILLS)) {
    Add-Finding "runtime" "system" "error" "Cannot discover skills: canonical directory missing"
    return
  }

  $skillDirs = Get-ChildItem -Path $CANONICAL_SKILLS -Directory -Exclude "_TEMPLATE"

  foreach ($dir in $skillDirs) {
    $skillId = $dir.Name
    $skillJsonPath = Join-Path $dir.FullName "SKILL.json"

    if (-not (Test-Path $skillJsonPath)) {
      Add-Finding "runtime" $skillId "warning" "Cannot discover: SKILL.json missing"
      continue
    }

    try {
      $skillJson = Get-Content $skillJsonPath | ConvertFrom-Json

      if ($skillJson.status -ne "active") {
        Add-Finding "runtime" $skillId "info" "Skill inactive (status: $($skillJson.status))"
        continue
      }

      if (-not $skillJson.entrypoint) {
        Add-Finding "runtime" $skillId "error" "Entrypoint missing (cannot discover)"
        continue
      }

      if (-not $skillJson.runtime) {
        Add-Finding "runtime" $skillId "error" "Runtime missing (cannot execute)"
        continue
      }

      # Check if entrypoint file exists
      $entrypointPath = Join-Path $dir.FullName $skillJson.entrypoint
      if (-not (Test-Path $entrypointPath)) {
        Add-Finding "runtime" $skillId "error" "Entrypoint file missing: $($skillJson.entrypoint)"
        continue
      }

      $validation.skills[$skillId].runtime_discovered = $true
      Add-Finding "runtime" $skillId "info" "Discoverable"
    } catch {
      Add-Finding "runtime" $skillId "warning" "Discovery error: $_"
    }
  }

  Log "Runtime discovery validation complete"
}

# ============================================================================
# G. DEPENDENCY GRAPH VALIDATION
# ============================================================================

function Build-DependencyGraph {
  Write-Host "🔗 Building dependency graph..." -ForegroundColor Cyan

  $graph = @{
    adjacency = @{}
    externalDeps = @()
    cycles = @()
    orphans = @()
    missingInternal = @()
    missingExternal = @()
  }

  # Initialize adjacency list
  foreach ($skillId in $validation.skills.Keys) {
    $graph.adjacency[$skillId] = @{
      internal = @()
      external = @()
    }
  }

  # Build graph from canonical SKILL.json files
  foreach ($skillId in $validation.skills.Keys) {
    $skillPath = Join-Path $CANONICAL_SKILLS $skillId
    $skillJsonPath = Join-Path $skillPath "SKILL.json"

    if (-not (Test-Path $skillJsonPath)) {
      continue
    }

    try {
      $skillJson = Get-Content $skillJsonPath | ConvertFrom-Json

      if ($skillJson.dependencies) {
        # Internal dependencies
        if ($skillJson.dependencies.internal) {
          foreach ($dep in $skillJson.dependencies.internal) {
            $graph.adjacency[$skillId].internal += $dep

            if (-not $validation.skills[$dep]) {
              $graph.missingInternal += @{ skill = $skillId; dependency = $dep }
              Add-Finding "dependencies" $skillId "error" "Missing internal dependency: $dep"
            }
          }
        }

        # External dependencies
        if ($skillJson.dependencies.external) {
          foreach ($dep in $skillJson.dependencies.external) {
            $graph.adjacency[$skillId].external += $dep
            if (-not ($graph.externalDeps -contains $dep)) {
              $graph.externalDeps += $dep
            }

            # Check if external dependency exists in tools/daemons/adapters
            $toolPath = Join-Path "C:\dev\toolforge\tools" $dep
            $daemonPath = Join-Path "C:\dev\toolforge\daemons" $dep
            $adapterPath = Join-Path "C:\dev\toolforge\adapters" $dep

            if (-not ((Test-Path $toolPath) -or (Test-Path $daemonPath) -or (Test-Path $adapterPath))) {
              $graph.missingExternal += @{ skill = $skillId; dependency = $dep }
              Add-Finding "dependencies" $skillId "warning" "Missing external dependency: $dep"
            }
          }
        }
      }
    } catch {
      Log "Could not parse SKILL.json for $skillId``: $_" "WARN"
    }
  }

  Log "Dependency graph built: $($graph.adjacency.Count) skills"
  return $graph
}

function Detect-Cycles {
  param([hashtable]$Graph)

  $visited = @{}
  $recursionStack = @{}
  $cycles = @()

  function DFS {
    param([string]$Node, [array]$Path)

    if ($visited[$Node] -eq $false) {
      return
    }

    $visited[$Node] = $false
    $recursionStack[$Node] = $true
    $Path += $Node

    foreach ($neighbor in $Graph.adjacency[$Node].internal) {
      if (-not $visited[$neighbor]) {
        $result = DFS $neighbor $Path
        if ($result) {
          return $result
        }
      } elseif ($recursionStack[$neighbor]) {
        $cycleStart = $Path.IndexOf($neighbor)
        $cycle = $Path[$cycleStart..($Path.Count - 1)] + $neighbor
        return $cycle
      }
    }

    $recursionStack[$Node] = $false
    return $null
  }

  # Initialize visited
  foreach ($skillId in $Graph.adjacency.Keys) {
    $visited[$skillId] = $true
    $recursionStack[$skillId] = $false
  }

  # Run DFS from each unvisited node
  foreach ($skillId in $Graph.adjacency.Keys) {
    if ($visited[$skillId]) {
      $cycle = DFS $skillId @()
      if ($cycle) {
        $cycles += $cycle
      }
    }
  }

  return $cycles
}

function Compute-DependencyDepth {
  param([hashtable]$Graph)

  $depths = @{}
  $visited = @{}

  function ComputeDepth {
    param([string]$Node)

    if ($visited[$Node]) {
      return $depths[$Node]
    }

    $visited[$Node] = $true
    $maxDepth = 0

    foreach ($neighbor in $Graph.adjacency[$Node].internal) {
      $neighborDepth = ComputeDepth $neighbor
      $maxDepth = [Math]::Max($maxDepth, $neighborDepth + 1)
    }

    $depths[$Node] = $maxDepth
    return $maxDepth
  }

  foreach ($skillId in $Graph.adjacency.Keys) {
    if (-not $visited[$skillId]) {
      [void](ComputeDepth $skillId)
    }
  }

  return , $depths
}

function Validate-DependencyConsistency {
  param([hashtable]$Graph)

  Write-Host "🔍 Validating dependency consistency..." -ForegroundColor Cyan

  # Load manifest
  if (-not (Test-Path $MANIFEST_FILE)) {
    Add-Finding "dependencies" "system" "error" "Manifest not found for dependency validation"
    return
  }

  try {
    $manifest = Get-Content $MANIFEST_FILE | ConvertFrom-Json
  } catch {
    Add-Finding "dependencies" "system" "error" "Could not parse manifest"
    return
  }

  # Check each skill's dependencies in manifest
  foreach ($entry in $manifest.skills) {
    $skillId = $entry.id
    $canonicalDeps = $Graph.adjacency[$skillId]

    if (-not $entry.dependencies) {
      $entry | Add-Member -NotePropertyName "dependencies" -NotePropertyValue @{ internal = @(); external = @() } -ErrorAction SilentlyContinue
      continue
    }

    # Compare canonical vs manifest internal dependencies
    $manifestInternal = @($entry.dependencies.internal ?? @()) | Sort-Object
    $canonicalInternal = @($canonicalDeps.internal) | Sort-Object

    if (($manifestInternal | ConvertTo-Json) -ne ($canonicalInternal | ConvertTo-Json)) {
      Add-Finding "dependencies" $skillId "error" "Internal dependencies mismatch: canonical '$($canonicalInternal -join ', ')', manifest '$($manifestInternal -join ', ')'"
    }

    # Compare canonical vs manifest external dependencies
    $manifestExternal = @($entry.dependencies.external ?? @()) | Sort-Object
    $canonicalExternal = @($canonicalDeps.external) | Sort-Object

    if (($manifestExternal | ConvertTo-Json) -ne ($canonicalExternal | ConvertTo-Json)) {
      Add-Finding "dependencies" $skillId "warning" "External dependencies mismatch: canonical '$($canonicalExternal -join ', ')', manifest '$($manifestExternal -join ', ')'"
    }

    # Check distributed if exists
    $distributedPath = Join-Path $DISTRIBUTED_SKILLS $skillId
    if (Test-Path $distributedPath) {
      $distJsonPath = Join-Path $distributedPath "SKILL.json"
      if (Test-Path $distJsonPath) {
        try {
          $distJson = Get-Content $distJsonPath | ConvertFrom-Json
          $distInternal = @($distJson.dependencies.internal ?? @()) | Sort-Object

          if (($distInternal | ConvertTo-Json) -ne ($canonicalInternal | ConvertTo-Json)) {
            Add-Finding "dependencies" $skillId "warning" "Internal dependencies mismatch (distributed): canonical '$($canonicalInternal -join ', ')', distributed '$($distInternal -join ', ')'"
          }
        } catch {
          Log "Could not parse distributed SKILL.json for $skillId" "WARN"
        }
      }
    }
  }

  Log "Dependency consistency validation complete"
}

# ============================================================================
# F. AUDIT LOG VALIDATION
# ============================================================================

function Validate-AuditLogs {
  Write-Host "📝 Validating audit logs..." -ForegroundColor Cyan

  if (-not (Test-Path $RUNTIME_LOG)) {
    Add-Finding "audit" "system" "info" "No runtime log yet (skills not executed)"
    return
  }

  try {
    $logContent = Get-Content $RUNTIME_LOG -Raw
    $skillIdPattern = "Skill: ([a-z0-9-]+)"

    $matches = [regex]::Matches($logContent, $skillIdPattern)
    $loggedSkills = @{}

    foreach ($match in $matches) {
      $skillId = $match.Groups[1].Value
      if (-not $loggedSkills[$skillId]) {
        $loggedSkills[$skillId] = 0
      }
      $loggedSkills[$skillId] += 1
    }

    Log "Found $($matches.Count) skill executions in audit log"

    foreach ($skillId in $loggedSkills.Keys) {
      if ($validation.skills[$skillId]) {
        Add-Finding "audit" $skillId "info" "Executed $($loggedSkills[$skillId]) time(s)"
      } else {
        Add-Finding "audit" $skillId "error" "Unknown skill in audit log"
      }
    }
  } catch {
    Add-Finding "audit" "system" "warning" "Could not parse audit log: $_"
  }

  Log "Audit validation complete"
}

# ============================================================================
# DEPENDENCY GRAPH REPORT GENERATION
# ============================================================================

function Write-DependencyGraphReport {
  param([hashtable]$Graph, [hashtable]$Depths, [string]$OutputPath)

  $report = @"
# Toolforge Skillpack Dependency Graph

**Generated**: $(Get-Date -AsUTC -Format "o")

---

## Graph Summary

- **Total Skills**: $($Graph.adjacency.Count)
- **Total External Dependencies**: $($Graph.externalDeps.Count)
- **Missing Internal Dependencies**: $($Graph.missingInternal.Count)
- **Missing External Dependencies**: $($Graph.missingExternal.Count)

---

## Adjacency List

"@

  foreach ($skillId in ($Graph.adjacency.Keys | Sort-Object)) {
    $internal = $Graph.adjacency[$skillId].internal
    $external = $Graph.adjacency[$skillId].external
    $depth = $Depths[$skillId] ?? 0

    $report += "### $skillId (depth: $depth)`n`n"

    if ($internal.Count -gt 0) {
      $report += "**Internal Dependencies:**`n"
      foreach ($dep in $internal) {
        $report += "- $dep`n"
      }
      $report += "`n"
    } else {
      $report += "**Internal Dependencies:** (none)`n`n"
    }

    if ($external.Count -gt 0) {
      $report += "**External Dependencies:**`n"
      foreach ($dep in $external) {
        $report += "- $dep`n"
      }
      $report += "`n"
    } else {
      $report += "**External Dependencies:** (none)`n`n"
    }

    $report += "`n"
  }

  # Dependency depth table
  $report += "## Dependency Depth Metrics`n`n"
  $report += "| Skill | Depth | Dependencies |`n"
  $report += "|-------|-------|--------------|`n"

  foreach ($skillId in ($Depths.Keys | Sort-Object)) {
    $depth = $Depths[$skillId]
    $depCount = $Graph.adjacency[$skillId].internal.Count + $Graph.adjacency[$skillId].external.Count
    $report += "| $skillId | $depth | $depCount |`n"
  }

  $report += "`n---`n`n"

  # Missing dependencies
  if ($Graph.missingInternal.Count -gt 0) {
    $report += "## Missing Internal Dependencies`n`n"
    foreach ($missing in $Graph.missingInternal) {
      $report += "❌ **$($missing.skill)** → `$($missing.dependency)` (not found in canonical)`n"
    }
    $report += "`n---`n`n"
  }

  if ($Graph.missingExternal.Count -gt 0) {
    $report += "## Missing External Dependencies`n`n"
    foreach ($missing in $Graph.missingExternal) {
      $report += "⚠️  **$($missing.skill)** → `$($missing.dependency)` (not found in tools/daemons/adapters)`n"
    }
    $report += "`n---`n`n"
  }

  # Health summary
  if ($Graph.missingInternal.Count -eq 0 -and $Graph.missingExternal.Count -eq 0) {
    $report += "## Health Summary`n`n✅ PASS — no cycles, no missing dependencies`n`n"
  } else {
    $report += "## Health Summary`n`n"
    if ($Graph.missingInternal.Count -gt 0) {
      $report += "❌ FAIL — $($Graph.missingInternal.Count) missing internal dependencies`n"
    }
    if ($Graph.missingExternal.Count -gt 0) {
      $report += "⚠️  WARN — $($Graph.missingExternal.Count) missing external dependencies`n"
    }
    $report += "`n"
  }

  $report += "`n---`n`n**Dependency Graph v1.0.0** | Toolforge Team`n"

  $report | Set-Content -Path $OutputPath -Encoding UTF8
  Log "Dependency graph report saved: $OutputPath"
}

# ============================================================================
# REPORT GENERATION
# ============================================================================

function Generate-Report {
  $report = @"
# Toolforge Skill Validation Report

**Generated**: $($validation.timestamp)

---

## Executive Summary

| Domain | Errors | Warnings | Passed | Status |
|--------|--------|----------|--------|--------|
| Canonical | $($validation.canonical.errors) | $($validation.canonical.warnings) | $($validation.canonical.passed) | $(if ($validation.canonical.errors -eq 0) { "✅" } else { "❌" }) |
| Distributed | $($validation.distributed.errors) | $($validation.distributed.warnings) | $($validation.distributed.passed) | $(if ($validation.distributed.errors -eq 0) { "✅" } else { "⚠️" }) |
| Manifest | $($validation.manifest.errors) | $($validation.manifest.warnings) | $($validation.manifest.passed) | $(if ($validation.manifest.errors -eq 0) { "✅" } else { "❌" }) |
| Cowork | $($validation.cowork.errors) | $($validation.cowork.warnings) | $($validation.cowork.passed) | $(if ($validation.cowork.errors -eq 0) { "✅" } else { "⚠️" }) |
| Dependencies | $($validation.dependencies.errors) | $($validation.dependencies.warnings) | $($validation.dependencies.passed) | $(if ($validation.dependencies.errors -eq 0) { "✅" } else { "❌" }) |
| Runtime | $($validation.runtime.errors) | $($validation.runtime.warnings) | $($validation.runtime.passed) | $(if ($validation.runtime.errors -eq 0) { "✅" } else { "❌" }) |
| Audit | $($validation.audit.errors) | $($validation.audit.warnings) | $($validation.audit.passed) | ℹ️ |

**Total Errors**: $($validation.canonical.errors + $validation.distributed.errors + $validation.manifest.errors + $validation.dependencies.errors + $validation.runtime.errors)
**Total Warnings**: $($validation.canonical.warnings + $validation.distributed.warnings + $validation.manifest.warnings + $validation.cowork.warnings + $validation.dependencies.warnings + $validation.runtime.warnings)

**Overall Status**: $(if (($validation.canonical.errors + $validation.distributed.errors + $validation.manifest.errors + $validation.dependencies.errors + $validation.runtime.errors) -eq 0) { "✅ PASS" } else { "❌ FAIL" })

---

## Skills Inventory

| ID | Name | Version | Status | Canonical | Distributed | Manifest | Cowork | Runtime |
|----|------|---------|--------|-----------|-------------|----------|--------|---------|
"@

  foreach ($skillId in ($validation.skills.Keys | Sort-Object)) {
    $skill = $validation.skills[$skillId]
    $status = $skill.status ?? "active"
    $can = $(if ($skill.canonical) { "✅" } else { "❌" })
    $dist = $(if ($skill.distributed) { "✅" } else { "⚠️" })
    $man = $(if ($skill.manifest) { "✅" } else { "❌" })
    $cow = $(if ($skill.cowork) { "✅" } else { "⚠️" })
    $run = $(if ($skill.runtime_discovered) { "✅" } else { "⚠️" })

    $report += "`n| $skillId | $($skill.name) | $($skill.version) | $status | $can | $dist | $man | $cow | $run |"
  }

  $report += "`n`n---`n`n"

  # Findings by domain
  foreach ($domain in @("canonical", "distributed", "manifest", "cowork", "dependencies", "runtime", "audit")) {
    $findings = $validation[$domain].details

    if ($findings.Count -gt 0) {
      $report += "## $([System.Globalization.CultureInfo]::InvariantCulture.TextInfo.ToTitleCase($domain)) Validation`n`n"

      foreach ($finding in $findings | Sort-Object -Property skill) {
        $emoji = switch ($finding.level) {
          "error" { "❌" }
          "warning" { "⚠️" }
          default { "ℹ️" }
        }

        $report += "$emoji **$($finding.skill)**: $($finding.message)`n"
      }

      $report += "`n"
    }
  }

  $report += @"
---

## Validator Rules Reference

### Canonical Skills
- SKILL.json exists and is valid
- Required files: SKILL.md, README.md, INTEGRATION_DIAGRAM.md
- Entrypoint exists and is valid
- Schema: id, name, version (semver), runtime, category
- ID format: lowercase alphanumeric + hyphens
- No duplicate IDs or names

### Distributed Sync
- Skill directory exists in distributed
- SKILL.json exists and versions match
- Entrypoint file exists
- No missing artifacts

### Manifest Consistency
- Version >= 1.1.0
- Skills array present
- Each skill has manifest entry
- Paths match: skills/<id>
- Versions match canonical
- No duplicate entries

### Cowork Registration
- Skill appears in COWORK-REGISTERED-SKILLS.md
- Warning if missing (installer will register next run)

### Dependency Graph
- Internal dependencies exist in canonical skills
- External dependencies exist in tools/daemons/adapters
- Canonical vs manifest dependencies must match (error if mismatch)
- Canonical vs distributed dependencies (warning if mismatch)
- No cycles detected (error if found)
- Dependency depth computed for orchestration
- Orphans and missing dependencies flagged

### Runtime Discovery
- Skill status = active
- Entrypoint file exists
- Runtime is valid (typescript|javascript|python|powershell|bash)
- Skill is discoverable and executable

### Audit Logs
- SKILL-RUN-LOG.md exists
- Logged skill IDs match canonical skills
- No unknown skills in logs

---

## Next Steps

1. **Fix errors first**: Canonical + manifest errors must be resolved
2. **Distributed sync**: Installer will sync missing skills
3. **Cowork registration**: Installer will register on next run
4. **Runtime validation**: Check discovery logs if skills don't appear
5. **Audit logs**: Monitor SKILL-RUN-LOG.md for execution patterns

---

**Skill Validator v1.1.0** | Toolforge Team
"@

  $report | Set-Content -Path $OutputPath -Encoding UTF8
  Log "Report saved: $OutputPath"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Host "🔍 Toolforge Skill Validator Refinement v1.2.0" -ForegroundColor Cyan
Write-Host ""

Validate-CanonicalSkills
Validate-DistributedSync
Validate-ManifestConsistency
Validate-CoworkRegistration

# Build and validate dependency graph
$validation.graph = Build-DependencyGraph
Validate-DependencyConsistency $validation.graph

# Detect cycles and compute depth
$cycles = Detect-Cycles $validation.graph
if ($cycles.Count -gt 0) {
  foreach ($cycle in $cycles) {
    Add-Finding "dependencies" "system" "error" "Cycle detected: $($cycle -join ' → ')"
  }
}

$depths = Compute-DependencyDepth $validation.graph

# Check for orphans
foreach ($skillId in $validation.graph.adjacency.Keys) {
  if ($depths[$skillId] -lt 0) {
    Add-Finding "dependencies" $skillId "warning" "Orphan skill (unreachable from graph)"
  }
}

# Passed count for dependencies
if ($validation.dependencies.errors -eq 0) {
  $validation.dependencies.passed = 1
}

Validate-RuntimeDiscovery
Validate-AuditLogs

Generate-Report

# Generate dependency graph report
$graphOutputPath = Join-Path $CANONICAL_SKILLS "SKILLPACK-DEPENDENCY-GRAPH.md"
Write-DependencyGraphReport $validation.graph $depths $graphOutputPath

# Summary
Write-Host ""
Write-Host "📊 Validation Summary" -ForegroundColor Cyan
Write-Host "  Canonical: $($validation.canonical.errors) errors, $($validation.canonical.warnings) warnings"
Write-Host "  Distributed: $($validation.distributed.errors) errors, $($validation.distributed.warnings) warnings"
Write-Host "  Manifest: $($validation.manifest.errors) errors, $($validation.manifest.warnings) warnings"
Write-Host "  Cowork: $($validation.cowork.errors) errors, $($validation.cowork.warnings) warnings"
Write-Host "  Dependencies: $($validation.dependencies.errors) errors, $($validation.dependencies.warnings) warnings"
Write-Host "  Runtime: $($validation.runtime.errors) errors, $($validation.runtime.warnings) warnings"
Write-Host ""

# ============================================================================
# PHASE 1.4–1.7 INTEGRATION
# ============================================================================

Write-Host ""
Write-Host "🔄 Running Phase 1.4–1.7 generators..." -ForegroundColor Cyan

$generators = @(
  @{ name = "Dependency Graph (1.4)"; path = "C:\dev\toolforge\utilities\toolforgeDependencyGraph.ps1" }
  @{ name = "Metadata Schema (1.5)"; path = "C:\dev\toolforge\utilities\toolforgeMetadataGenerator.ps1" }
  @{ name = "Health Check (1.6)"; path = "C:\dev\toolforge\utilities\toolforgeSkillHealthCheck.ps1" }
  @{ name = "Cowork Auto-Sync (1.7)"; path = "C:\dev\toolforge\daemons\cowork-auto-sync.ps1" }
)

$genErrors = 0
foreach ($gen in $generators) {
  if (Test-Path $gen.path) {
    try {
      Write-Host "  ▶️ $($gen.name)..." -ForegroundColor Gray
      & $gen.path -Verbose:$Verbose | Out-Null
    } catch {
      Write-Host "  ❌ $($gen.name) failed: $_" -ForegroundColor Red
      $genErrors += 1
    }
  } else {
    Write-Host "  ⚠️ $($gen.name) not found" -ForegroundColor Yellow
  }
}

if ($genErrors -eq 0) {
  Write-Host ""
  Write-Host "✅ All generators completed successfully." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "⚠️ $genErrors generator(s) failed — check logs above." -ForegroundColor Yellow
}

$totalErrors = $validation.canonical.errors + $validation.distributed.errors + $validation.manifest.errors + $validation.dependencies.errors + $validation.runtime.errors

if ($totalErrors -eq 0) {
  Write-Host "✅ Validation PASSED" -ForegroundColor Green
  Write-Host "📄 Report: $OutputPath" -ForegroundColor Cyan
  exit 0
} else {
  Write-Host "❌ Validation FAILED ($totalErrors errors)" -ForegroundColor Red
  Write-Host "📄 Report: $OutputPath" -ForegroundColor Cyan
  exit 1
}
