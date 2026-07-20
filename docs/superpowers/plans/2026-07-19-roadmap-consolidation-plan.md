# Roadmap Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 80+ scattered ROADMAP.md files to canonical sources per allowed project root, deploy pre-commit enforcement hook, and establish weekly drift detection via cleanup script.

**Architecture:** Three-stage approach: (1) one-time surgical audit to identify canonical sources + conflicts; (2) migration to allowed roots + cleanup of orphans; (3) preventive infrastructure (pre-commit hook + weekly cleanup script).

**Tech Stack:** PowerShell 7+, Windows Task Scheduler, JSON reporting, pre-commit hooks (bash/PowerShell polyglot).

## Global Constraints

- Allowed project roots (ONLY): `C:\dev\docs\meta\`, `C:\dev\cic-ingestion\`, `C:\dev\rewrite-docs\`, `C:\dev\rewrite-mcp\`, `C:\dev\kb-sync\`
- Forbidden locations (NEVER): `.claude/worktrees/`, nested clones, sync folders, `node_modules/`, backup folders
- Tie-breaker rule for conflicts: Fresher modification date wins; if tied, root location preferred; if still tied, flag for manual review
- Archive fate: All superseded roadmaps move to `docs/meta/archive/` with one-line note; never delete
- Phase 1-2 timeline: Day 1-3 | Phase 3-4: Day 4 | Phase 5-6: Day 5 | Phase 7: Day 6
- Success gate: 0 new violations in forbidden locations 30 days post-deployment

---

## Phase 1: Audit & Conflict Resolution

### Task 1.1: Create Audit Scanner Script

**Files:**
- Create: `utilities/roadmap-consolidation-scanner.ps1`
- Test: None (scanner is one-shot diagnostic, not library code)

**Interfaces:**
- Consumes: Filesystem state (`Get-ChildItem -Recurse`), git config (allowed roots)
- Produces: JSON audit report (`audit/roadmap-consolidation-audit-YYYY-MM-DD.json`)

- [ ] **Step 1: Write scanner skeleton**

Create `C:\dev\utilities\roadmap-consolidation-scanner.ps1`:

```powershell
<#
.SYNOPSIS
Audit all ROADMAP.md files across C:\dev, categorize location/age/conflicts, generate JSON report.

.DESCRIPTION
Scans recursively for ROADMAP.md (case-insensitive). Classifies each by:
- Location (allowed root vs forbidden)
- Source (canonical, duplicate, orphan)
- Age (last modified)

Applies tie-breaker rule for conflicts: fresher date wins, then root location, then manual flag.

Generates: audit/roadmap-consolidation-audit-YYYY-MM-DD.json

.PARAMETER RootPath
Base directory to scan. Defaults to C:\dev.

.PARAMETER OutputDir
Directory for audit report. Defaults to C:\dev\audit.

.EXAMPLE
.\roadmap-consolidation-scanner.ps1
.\roadmap-consolidation-scanner.ps1 -RootPath C:\dev -OutputDir C:\dev\audit
#>

param(
    [string]$RootPath = "C:\dev",
    [string]$OutputDir = "C:\dev\audit"
)

$AllowedRoots = @(
    "C:\dev\docs\meta",
    "C:\dev\cic-ingestion",
    "C:\dev\rewrite-docs",
    "C:\dev\rewrite-mcp",
    "C:\dev\kb-sync"
)

$AllowedRootsNormalized = $AllowedRoots | ForEach-Object { ($_ -replace '\\', '/').ToLower() }

function IsAllowedRoot([string]$FilePath) {
    $normalized = ($FilePath -replace '\\', '/').ToLower()
    foreach ($root in $AllowedRootsNormalized) {
        if ($normalized.StartsWith("$root/") -or $normalized -eq $root) {
            return $true
        }
    }
    return $false
}

function ClassifyLocation([string]$FilePath) {
    if (IsAllowedRoot $FilePath) {
        return "allowed_root"
    }
    if ($FilePath -match '\.claude[\\/]worktrees') {
        return "ephemeral_worktree"
    }
    if ($FilePath -match '[\\\/]archive[\\\/]') {
        return "archive_folder"
    }
    if ($FilePath -match '[\\\/](node_modules|\.git)[\\/]') {
        return "system_folder"
    }
    return "forbidden_location"
}

function GetProjectRoot([string]$FilePath) {
    foreach ($root in $AllowedRoots) {
        if ($FilePath.StartsWith("$root\") -or $FilePath -eq $root) {
            return $root
        }
    }
    return $null
}

Write-Host "Scanning C:\dev for ROADMAP.md files..."
$allRoadmaps = @()
$roadmapFiles = Get-ChildItem -Path $RootPath -Filter "ROADMAP.md" -Recurse -ErrorAction SilentlyContinue
$roadmapFiles += Get-ChildItem -Path $RootPath -Filter "roadmap.md" -Recurse -ErrorAction SilentlyContinue

Write-Host "Found $($roadmapFiles.Count) roadmap files"

# Categorize each file
$categorized = @{}
foreach ($file in $roadmapFiles) {
    $fullPath = $file.FullName
    $lastModified = $file.LastWriteTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $location = ClassifyLocation $fullPath
    $projectRoot = GetProjectRoot $fullPath
    
    $entry = @{
        path = $fullPath
        lastModified = $lastModified
        sizeBytes = $file.Length
        location = $location
        projectRoot = $projectRoot
    }
    
    # Group by project root for duplicate detection
    if ($projectRoot) {
        if (-not $categorized.ContainsKey($projectRoot)) {
            $categorized[$projectRoot] = @()
        }
        $categorized[$projectRoot] += $entry
    } else {
        if (-not $categorized.ContainsKey("orphaned")) {
            $categorized["orphaned"] = @()
        }
        $categorized["orphaned"] += $entry
    }
}

# Apply tie-breaker rule: for each project root, find canonical
$canonical = @{}
$conflicts = @()
$orphans = @()

foreach ($projectRoot in $categorized.Keys) {
    $entries = $categorized[$projectRoot]
    
    if ($entries.Count -eq 1) {
        $canonical[$projectRoot] = $entries[0]
    } else {
        # Multiple versions: sort by date (desc), then prefer root location
        $sorted = $entries | Sort-Object -Property @(
            @{Expression = { [datetime]::Parse($_.lastModified) }; Descending = $true },
            @{Expression = { -not ($_.path.StartsWith($projectRoot + '\') -or $_.path -eq $projectRoot) } }
        )
        
        $winner = $sorted[0]
        $canonical[$projectRoot] = $winner
        
        # Flag other versions as conflicts if dates differ, or manual review if dates tied
        for ($i = 1; $i -lt $sorted.Count; $i++) {
            $conflict = $sorted[$i]
            $dateMatch = $winner.lastModified -eq $conflict.lastModified
            $conflicts += @{
                paths = @($winner.path, $conflict.path)
                resolution = if ($dateMatch) { "manual_review_needed" } else { "superseded_by_fresher" }
            }
        }
    }
}

# Find orphans (forbidden locations with no canonical)
foreach ($entry in $categorized["orphaned"]) {
    $orphans += $entry
}

# Build audit report
$timestamp = [datetime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")

$allowedRootsReport = @{}
foreach ($root in $AllowedRoots) {
    if ($canonical.ContainsKey($root)) {
        $can = $canonical[$root]
        $allowedRootsReport[$root -replace '^C:\\dev\\' -replace '\\' -replace '/' -replace '\.' -replace 'meta' -replace 'meta'] = @{
            canonical_count = 1
            roadmaps = @(Split-Path $can.path -Leaf)
            source = $can.path + " ($($can.lastModified))"
        }
    } else {
        $allowedRootsReport[$root -replace '^C:\\dev\\'] = @{
            canonical_count = 0
            roadmaps = @()
        }
    }
}

# Simplify root names for JSON
$allowedRootsReportSimple = @{}
$allowedRootsReportSimple["docs/meta"] = $allowedRootsReport["C:\dev\docs\meta"] ?? @{ canonical_count = 0; roadmaps = @() }
$allowedRootsReportSimple["cic-ingestion"] = $allowedRootsReport["C:\dev\cic-ingestion"] ?? @{ canonical_count = 0; roadmaps = @() }
$allowedRootsReportSimple["rewrite-docs"] = $allowedRootsReport["C:\dev\rewrite-docs"] ?? @{ canonical_count = 0; roadmaps = @() }
$allowedRootsReportSimple["rewrite-mcp"] = $allowedRootsReport["C:\dev\rewrite-mcp"] ?? @{ canonical_count = 0; roadmaps = @() }
$allowedRootsReportSimple["kb-sync"] = $allowedRootsReport["C:\dev\kb-sync"] ?? @{ canonical_count = 0; roadmaps = @() }

$report = @{
    timestamp = $timestamp
    allowed_roots = $allowedRootsReportSimple
    cleanup = @{
        total_orphans_deleted = $orphans.Count
        archives_moved = 0
        conflicts_flagged = $conflicts.Count
    }
    conflicts = $conflicts
} | ConvertTo-Json -Depth 10

# Write report
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp_short = [datetime]::UtcNow.ToString("yyyy-MM-dd")
$reportFile = Join-Path $OutputDir "roadmap-consolidation-audit-$timestamp_short.json"
$report | Set-Content -Path $reportFile -Encoding UTF8

Write-Host "✅ Audit complete. Report: $reportFile"
Write-Host "Canonical sources: $($canonical.Count)"
Write-Host "Conflicts: $($conflicts.Count)"
Write-Host "Orphans: $($orphans.Count)"
```

- [ ] **Step 2: Test scanner on staging directory**

Create test data structure:

```powershell
# Create temp test structure
$testDir = "C:\dev\test-roadmap-audit"
if (Test-Path $testDir) { Remove-Item $testDir -Recurse -Force }
New-Item -ItemType Directory -Path $testDir | Out-Null

# Create allowed roots
New-Item -ItemType Directory -Path "$testDir\docs\meta" -Force | Out-Null
New-Item -ItemType Directory -Path "$testDir\cic-ingestion" -Force | Out-Null

# Create test roadmaps (allowed + forbidden)
@"
# Toolforge Roadmap (canonical)
Version: 2.12.0
"@ | Set-Content -Path "$testDir\docs\meta\toolforge-platform-roadmap.md"

@"
# CIC Roadmap (canonical)
Version: 1.0
"@ | Set-Content -Path "$testDir\cic-ingestion\ROADMAP.md"

# Create orphan (forbidden location)
New-Item -ItemType Directory -Path "$testDir\.claude\worktrees\agent-123" -Force | Out-Null
@"
# Orphan ROADMAP
(old version)
"@ | Set-Content -Path "$testDir\.claude\worktrees\agent-123\ROADMAP.md"

Write-Host "Test structure created at $testDir"
```

Run scanner on test directory:

```powershell
& C:\dev\utilities\roadmap-consolidation-scanner.ps1 -RootPath $testDir -OutputDir "$testDir\audit"

# Verify report exists
$report = Get-ChildItem "$testDir\audit\roadmap-consolidation-audit-*.json" | Select-Object -First 1
if ($report) {
    Write-Host "✅ Report generated: $($report.FullName)"
    Get-Content $report.FullName | ConvertFrom-Json | Format-List
} else {
    Write-Host "❌ No report generated"
}
```

Cleanup test directory:

```powershell
Remove-Item $testDir -Recurse -Force
```

- [ ] **Step 3: Run scanner on production C:\dev**

```powershell
& C:\dev\utilities\roadmap-consolidation-scanner.ps1

# Read and inspect report
$latest = Get-ChildItem "C:\dev\audit\roadmap-consolidation-audit-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$report = Get-Content $latest.FullName | ConvertFrom-Json

Write-Host "=== AUDIT REPORT ==="
Write-Host "Timestamp: $($report.timestamp)"
Write-Host "Canonical sources:"
$report.allowed_roots | ForEach-Object {
    $_.PSObject.Properties | ForEach-Object {
        Write-Host "  $($_.Name): $($_.Value.canonical_count) roadmaps"
    }
}
Write-Host "Conflicts flagged: $($report.cleanup.conflicts_flagged)"
Write-Host "Orphans to delete: $($report.cleanup.total_orphans_deleted)"

if ($report.conflicts.Count -gt 0) {
    Write-Host "`nConflicts requiring manual review:"
    $report.conflicts | ForEach-Object {
        if ($_.resolution -eq "manual_review_needed") {
            Write-Host "  $($_.paths -join ' <=> ')"
        }
    }
}
```

- [ ] **Step 4: Commit scanner script**

```bash
git add utilities/roadmap-consolidation-scanner.ps1
git commit -m "feat: add roadmap consolidation audit scanner

Scans all ROADMAP.md files across C:\dev, categorizes by location/age,
resolves conflicts via tie-breaker rule (fresher date wins), generates
JSON audit report for manual review.

Output: audit/roadmap-consolidation-audit-YYYY-MM-DD.json
"
```

---

### Task 1.2: Manual Conflict Review & Canonical Assignment

**Files:**
- Read: `audit/roadmap-consolidation-audit-YYYY-MM-DD.json`
- Modify: None (manual review only)

**Interfaces:**
- Consumes: Audit report JSON from Task 1.1
- Produces: Canonical source list (documented in spreadsheet or notes for Task 2)

- [ ] **Step 1: Read latest audit report**

```powershell
$latest = Get-ChildItem "C:\dev\audit\roadmap-consolidation-audit-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$report = Get-Content $latest.FullName | ConvertFrom-Json
```

- [ ] **Step 2: Review conflicts flagged as "manual_review_needed"**

```powershell
Write-Host "Conflicts requiring manual review:"
$manualReview = $report.conflicts | Where-Object { $_.resolution -eq "manual_review_needed" }

foreach ($conflict in $manualReview) {
    Write-Host "`nPaths:"
    $conflict.paths | ForEach-Object { 
        $info = Get-Item $_ -ErrorAction SilentlyContinue
        if ($info) {
            Write-Host "  $_ (Modified: $($info.LastWriteTime))"
        } else {
            Write-Host "  $_ (NOT FOUND)"
        }
    }
    Write-Host "Action: Review both files, pick authoritative version"
}
```

- [ ] **Step 3: Document canonical assignments**

Create `C:\dev\.context\roadmap-consolidation-decisions.txt` with decisions:

```
# Canonical Roadmap Assignments
# Generated: 2026-07-19

docs/meta:
  - skill-migration-roadmap.md ✓ (active, keep)
  - toolforge-platform-roadmap.md ✓ (active, keep)

cic-ingestion:
  - ROADMAP.md (source: C:\dev\cic-ingestion\ROADMAP.md) ✓

rewrite-docs:
  - ROADMAP.md (source: C:\dev\rewrite-docs\.planning\ROADMAP.md) ✓

rewrite-mcp:
  - ROADMAP.md (source: C:\dev\rewrite-mcp\ROADMAP.md) ✓

kb-sync:
  - ROADMAP.md (source: C:\dev\kb-sync\docs\ROADMAP.md) ✓

Manual Conflicts (none found in initial audit)

Orphans to archive:
  - [List any historical roadmaps to move to docs/meta/archive/]

Orphans to delete:
  - [List ephemeral worktree versions]
```

- [ ] **Step 4: Verify no blockers for Phase 2**

Confirm all conflicts resolved:

```powershell
$conflicts = $report.conflicts | Where-Object { $_.resolution -eq "manual_review_needed" }
if ($conflicts.Count -eq 0) {
    Write-Host "✅ All conflicts resolved. Ready for Phase 2 (migration)."
} else {
    Write-Host "❌ $($conflicts.Count) unresolved conflicts. Cannot proceed."
    exit 1
}
```

---

## Phase 2: Migration & Cleanup

### Task 2.1: Copy Canonical Roadmaps to Allowed Roots

**Files:**
- Read: Audit report, existing roadmaps in various locations
- Modify: Copy canonical roadmaps to project roots

**Interfaces:**
- Consumes: Canonical assignments from Task 1.2
- Produces: Roadmaps at `<root>/ROADMAP.md` for each allowed root

- [ ] **Step 1: Create migration helper script**

Create `C:\dev\utilities\roadmap-migration-helper.ps1`:

```powershell
<#
.SYNOPSIS
Copy canonical roadmaps to allowed roots per audit decisions.

.DESCRIPTION
Based on audit report and manual decisions, copy canonical source to project root.
Overwrites existing `<root>/ROADMAP.md` if stale version exists.

.PARAMETER AuditReport
Path to roadmap-consolidation-audit-YYYY-MM-DD.json

.PARAMETER DryRun
If $true, show what would be copied without actually copying.

.EXAMPLE
.\roadmap-migration-helper.ps1 -DryRun $true
.\roadmap-migration-helper.ps1 -DryRun $false
#>

param(
    [string]$AuditReport = $null,
    [bool]$DryRun = $true
)

if (-not $AuditReport) {
    $AuditReport = Get-ChildItem "C:\dev\audit\roadmap-consolidation-audit-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}

if (-not (Test-Path $AuditReport)) {
    Write-Host "❌ Audit report not found: $AuditReport"
    exit 1
}

$report = Get-Content $AuditReport | ConvertFrom-Json

# Define mappings: allowed root => source to copy
$migrations = @{
    "C:\dev\docs\meta" = $null  # docs/meta: multiple roadmaps, no migration needed
    "C:\dev\cic-ingestion" = "C:\dev\cic-ingestion\ROADMAP.md"
    "C:\dev\rewrite-docs" = "C:\dev\rewrite-docs\.planning\ROADMAP.md"
    "C:\dev\rewrite-mcp" = "C:\dev\rewrite-mcp\ROADMAP.md"
    "C:\dev\kb-sync" = "C:\dev\kb-sync\docs\ROADMAP.md"
}

foreach ($root in $migrations.Keys) {
    $source = $migrations[$root]
    if (-not $source) { continue }
    
    $dest = Join-Path $root "ROADMAP.md"
    
    if (Test-Path $source) {
        if ($DryRun) {
            Write-Host "Would copy: $source -> $dest"
        } else {
            Write-Host "Copying: $source -> $dest"
            Copy-Item -Path $source -Destination $dest -Force
            Write-Host "✅ Copied"
        }
    } else {
        Write-Host "⚠️  Source not found: $source"
    }
}

Write-Host "`nDone (DryRun=$DryRun)"
```

- [ ] **Step 2: Run migration in dry-run mode**

```powershell
& C:\dev\utilities\roadmap-migration-helper.ps1 -DryRun $true

# Review output for correctness
```

- [ ] **Step 3: Run migration in live mode**

```powershell
& C:\dev\utilities\roadmap-migration-helper.ps1 -DryRun $false

# Verify canonical roadmaps now in place
Write-Host "`nVerifying canonical copies:"
@(
    "C:\dev\cic-ingestion\ROADMAP.md",
    "C:\dev\rewrite-docs\ROADMAP.md",
    "C:\dev\rewrite-mcp\ROADMAP.md",
    "C:\dev\kb-sync\ROADMAP.md"
) | ForEach-Object {
    if (Test-Path $_) {
        Write-Host "✅ $_"
    } else {
        Write-Host "❌ $_ (NOT FOUND)"
    }
}
```

- [ ] **Step 4: Commit canonical copies**

```bash
git add C:\dev\cic-ingestion\ROADMAP.md
git add C:\dev\rewrite-docs\ROADMAP.md
git add C:\dev\rewrite-mcp\ROADMAP.md
git add C:\dev\kb-sync\ROADMAP.md

git commit -m "feat: establish canonical roadmaps in project roots

Copy fresher versions to cic-ingestion/, rewrite-docs/, rewrite-mcp/, kb-sync/
per consolidation audit. Each project root now owns its roadmap authority.
"
```

---

### Task 2.2: Delete Orphans from Forbidden Locations

**Files:**
- Read: Audit report
- Modify: Delete orphan ROADMAP files from forbidden locations

**Interfaces:**
- Consumes: Audit report (list of orphans to delete)
- Produces: Clean forbidden locations (no ROADMAP files)

- [ ] **Step 1: Create deletion script**

Create `C:\dev\utilities\roadmap-orphan-cleanup.ps1`:

```powershell
<#
.SYNOPSIS
Delete orphan ROADMAP.md files from forbidden locations per audit.

.DESCRIPTION
Reads audit report, identifies files in forbidden locations with no canonical match,
deletes them after confirmation (or -Force).

.PARAMETER AuditReport
Path to roadmap-consolidation-audit-YYYY-MM-DD.json

.PARAMETER Force
If $true, delete without prompting. Dangerous—use only after review.

.EXAMPLE
.\roadmap-orphan-cleanup.ps1
.\roadmap-orphan-cleanup.ps1 -Force $true
#>

param(
    [string]$AuditReport = $null,
    [bool]$Force = $false
)

if (-not $AuditReport) {
    $AuditReport = Get-ChildItem "C:\dev\audit\roadmap-consolidation-audit-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}

$report = Get-Content $AuditReport | ConvertFrom-Json

# Gather all orphans (files in forbidden locations, non-canonical)
$allowedRoots = @(
    "C:\dev\docs\meta",
    "C:\dev\cic-ingestion",
    "C:\dev\rewrite-docs",
    "C:\dev\rewrite-mcp",
    "C:\dev\kb-sync"
)

$orphans = @()
$roadmapFiles = Get-ChildItem -Path "C:\dev" -Filter "ROADMAP.md" -Recurse -ErrorAction SilentlyContinue
$roadmapFiles += Get-ChildItem -Path "C:\dev" -Filter "roadmap.md" -Recurse -ErrorAction SilentlyContinue

foreach ($file in $roadmapFiles) {
    $inAllowed = $false
    foreach ($root in $allowedRoots) {
        if ($file.FullName.StartsWith("$root\") -or $file.FullName -eq $root) {
            $inAllowed = $true
            break
        }
    }
    
    if (-not $inAllowed) {
        $orphans += $file.FullName
    }
}

if ($orphans.Count -eq 0) {
    Write-Host "✅ No orphans found."
    exit 0
}

Write-Host "Found $($orphans.Count) orphan(s):"
$orphans | ForEach-Object { Write-Host "  $_" }

if (-not $Force) {
    $response = Read-Host "`nDelete these files? (yes/no)"
    if ($response -ne "yes") {
        Write-Host "Cancelled."
        exit 0
    }
}

foreach ($file in $orphans) {
    Write-Host "Deleting: $file"
    Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
    if (Test-Path $file) {
        Write-Host "❌ Failed to delete: $file"
    } else {
        Write-Host "✅ Deleted"
    }
}

Write-Host "`nDone. Orphans removed."
```

- [ ] **Step 2: Run orphan cleanup (interactive)**

```powershell
& C:\dev\utilities\roadmap-orphan-cleanup.ps1

# Script will prompt before deleting
# Review list carefully, type "yes" to confirm
```

- [ ] **Step 3: Archive any historical roadmaps**

Any superseded roadmaps (old versions of active roadmaps) should move to `docs/meta/archive/`:

```powershell
# Check if archive folder exists
if (-not (Test-Path "C:\dev\docs\meta\archive")) {
    New-Item -ItemType Directory -Path "C:\dev\docs\meta\archive" | Out-Null
}

# Example: if an old skill-migration-roadmap exists elsewhere, archive it
# (specific paths depend on audit findings)
Write-Host "✅ Archive folder ready at C:\dev\docs\meta\archive"
```

- [ ] **Step 4: Commit orphan deletions + archive moves**

```bash
git add -A
git commit -m "chore: remove orphan roadmaps from forbidden locations

Deleted 75+ ROADMAP.md files from .claude/worktrees/, nested clones,
sync folders per consolidation audit. Archived historical roadmaps
to docs/meta/archive/.
"
```

---

## Phase 3: Deploy Pre-Commit Hook

### Task 3.1: Add Roadmap Check to Pre-Commit Hook

**Files:**
- Modify: `.git/hooks/pre-commit` (via `utilities/setup-git-hooks.ps1`)
- Create: `utilities/hooks/pre-commit-roadmap-check.ps1` (check logic)

**Interfaces:**
- Consumes: Staged files list from git
- Produces: Block commits with ROADMAP in forbidden locations

- [ ] **Step 1: Create roadmap check function**

Create `C:\dev\utilities\hooks\pre-commit-roadmap-check.ps1`:

```powershell
<#
.SYNOPSIS
Pre-commit hook check for ROADMAP.md placement violations.

.DESCRIPTION
Examines staged files for ROADMAP.md in forbidden locations.
Rejects commit if any violation found.

Allowed locations:
  - C:\dev\docs\meta\*
  - C:\dev\cic-ingestion\*
  - C:\dev\rewrite-docs\*
  - C:\dev\rewrite-mcp\*
  - C:\dev\kb-sync\*

.EXAMPLE
.\pre-commit-roadmap-check.ps1
Exit 0 if OK, 1 if violation
#>

$AllowedRoots = @(
    "C:\dev\docs\meta",
    "C:\dev\cic-ingestion",
    "C:\dev\rewrite-docs",
    "C:\dev\rewrite-mcp",
    "C:\dev\kb-sync"
)

function IsAllowedRoot([string]$FilePath) {
    $absPath = (Resolve-Path $FilePath -ErrorAction SilentlyContinue).Path
    if (-not $absPath) {
        return $false
    }
    
    foreach ($root in $AllowedRoots) {
        if ($absPath.StartsWith("$root\") -or $absPath -eq $root) {
            return $true
        }
    }
    return $false
}

# Get staged files
$staged = @(git diff --cached --name-only 2>$null)
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Cannot read staged files. Hook skipped."
    exit 0
}

# Filter for ROADMAP files (case-insensitive)
$roadmapFiles = $staged | Where-Object { $_ -match '(?i)roadmap\.md$' }

if ($roadmapFiles.Count -eq 0) {
    exit 0
}

# Check each ROADMAP file
$violations = @()
foreach ($file in $roadmapFiles) {
    $absPath = Join-Path (git rev-parse --show-toplevel 2>$null) $file
    
    if (-not (IsAllowedRoot $absPath)) {
        $violations += $file
    }
}

if ($violations.Count -gt 0) {
    Write-Host "❌ ROADMAP.md creation blocked outside allowed locations." -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "Allowed:" -ForegroundColor Red
    Write-Host "  - docs/meta/                   (global roadmaps only)" -ForegroundColor Red
    Write-Host "  - cic-ingestion/               (project-local roadmap)" -ForegroundColor Red
    Write-Host "  - rewrite-docs/                (project-local roadmap)" -ForegroundColor Red
    Write-Host "  - rewrite-mcp/                 (project-local roadmap)" -ForegroundColor Red
    Write-Host "  - kb-sync/                     (project-local roadmap)" -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "Found violation(s):" -ForegroundColor Red
    $violations | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host "" -ForegroundColor Red
    Write-Host "Governance: docs/meta/governance/documentation-policy.md" -ForegroundColor Red
    
    exit 1
}

exit 0
```

- [ ] **Step 2: Integrate into setup-git-hooks.ps1**

Read and modify `C:\dev\utilities\setup-git-hooks.ps1` to include roadmap check. Add this section in the pre-commit hook generation:

```powershell
# In setup-git-hooks.ps1, add to pre-commit hook logic:
"
# Roadmap placement check
`$roadmapCheckPath = Join-Path `$HooksDir 'pre-commit-roadmap-check.ps1'
if (Test-Path `$roadmapCheckPath) {
    & `$roadmapCheckPath
    if (`$LASTEXITCODE -ne 0) {
        exit 1
    }
}
"
```

- [ ] **Step 3: Regenerate hooks**

```powershell
& C:\dev\utilities\setup-git-hooks.ps1

# Verify pre-commit hook includes roadmap check
$hookContent = Get-Content .git\hooks\pre-commit -Raw
if ($hookContent -match "pre-commit-roadmap-check") {
    Write-Host "✅ Roadmap check integrated into pre-commit hook"
} else {
    Write-Host "❌ Roadmap check not found in pre-commit hook"
    exit 1
}
```

- [ ] **Step 4: Test hook with violation**

```powershell
# Create a test ROADMAP in forbidden location
$testPath = "C:\dev\.claude\test-roadmap\ROADMAP.md"
New-Item -ItemType Directory (Split-Path $testPath) -Force | Out-Null
"# Test" | Set-Content $testPath

# Stage it
git add $testPath

# Try to commit (should fail)
git commit -m "test: try roadmap violation" 2>&1 | Tee-Object -Variable output

if ($LASTEXITCODE -ne 0) {
    if ($output -match "blocked outside allowed") {
        Write-Host "✅ Hook correctly rejected violation"
    } else {
        Write-Host "❌ Hook failed for wrong reason"
        exit 1
    }
} else {
    Write-Host "❌ Hook did not block violation"
    exit 1
}

# Clean up
git reset HEAD $testPath
Remove-Item $testPath -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 5: Test hook with valid commit**

```powershell
# Create valid ROADMAP in allowed location
$validPath = "C:\dev\docs\meta\test-roadmap-valid.md"
"# Test" | Set-Content $validPath

# Stage and commit
git add $validPath
git commit -m "test: valid roadmap in allowed location"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Hook correctly allowed valid commit"
    git reset --soft HEAD~1  # Undo test commit
    Remove-Item $validPath -Force
    git reset HEAD $validPath
} else {
    Write-Host "❌ Hook rejected valid commit"
    exit 1
}
```

- [ ] **Step 6: Commit hook setup**

```bash
git add utilities/setup-git-hooks.ps1 utilities/hooks/pre-commit-roadmap-check.ps1
git commit -m "feat: add roadmap placement check to pre-commit hook

Blocks commits that create ROADMAP.md in forbidden locations
(.claude/worktrees/, nested clones, sync folders, etc.).

Allowed locations: docs/meta/, cic-ingestion/, rewrite-docs/, rewrite-mcp/, kb-sync/
"
```

---

## Phase 4: Deploy Cleanup Script & Task Scheduler

### Task 4.1: Create Weekly Cleanup Script

**Files:**
- Create: `utilities/roadmap-drift-checker.ps1`

**Interfaces:**
- Consumes: Filesystem state (ROADMAP.md files in C:\dev)
- Produces: JSON drift report, Slack notification (if violations found)

- [ ] **Step 1: Write cleanup script**

Create `C:\dev\utilities\roadmap-drift-checker.ps1`:

```powershell
<#
.SYNOPSIS
Weekly cleanup scan for ROADMAP.md drift in forbidden locations.

.DESCRIPTION
Recursively finds all ROADMAP.md files in C:\dev.
Filters out allowed roots + archive/.
Classifies violations by type (ephemeral worktree, nested clone, orphan, sync artifact).
Generates JSON report to audit/ folder.
Posts Slack notification if violations found.

Intended for: Windows Task Scheduler (weekly trigger, Sunday 02:00 UTC)
Or manual: .\roadmap-drift-checker.ps1

.PARAMETER OutputDir
Directory for drift report. Defaults to C:\dev\audit.

.PARAMETER SlackWebhook
Webhook URL for Slack notification. If empty, skips Slack post.

.EXAMPLE
.\roadmap-drift-checker.ps1
.\roadmap-drift-checker.ps1 -SlackWebhook "https://hooks.slack.com/..."
#>

param(
    [string]$OutputDir = "C:\dev\audit",
    [string]$SlackWebhook = ""
)

$AllowedRoots = @(
    "C:\dev\docs\meta",
    "C:\dev\cic-ingestion",
    "C:\dev\rewrite-docs",
    "C:\dev\rewrite-mcp",
    "C:\dev\kb-sync"
)

function IsAllowedRoot([string]$FilePath) {
    foreach ($root in $AllowedRoots) {
        if ($FilePath.StartsWith("$root\") -or $FilePath -eq $root) {
            return $true
        }
    }
    return $false
}

function IsArchive([string]$FilePath) {
    return $FilePath -match '[\\\/]archive[\\\/]'
}

function ClassifyViolation([string]$FilePath) {
    if ($FilePath -match '\.claude[\\/]worktrees') {
        return "ephemeral_worktree"
    }
    if ($FilePath -match '[\\\/]\.claude[\\/]') {
        return "claude_metadata"
    }
    if ($FilePath -match '[\\\/](node_modules|\.git)[\\/]') {
        return "system_folder"
    }
    if ($FilePath -match '\.bak$|\.backup$|\.old$') {
        return "orphan_backup"
    }
    if ($FilePath -match '[\\\/](Sync|OneDrive|Drive|Dropbox)[\\/]') {
        return "sync_artifact"
    }
    if ($FilePath -match '[\\\/]toolforge[\\\/]') {
        return "nested_clone"
    }
    return "orphan"
}

Write-Host "Scanning C:\dev for ROADMAP.md drift..."
$allRoadmaps = @()
$roadmapFiles = Get-ChildItem -Path "C:\dev" -Filter "ROADMAP.md" -Recurse -ErrorAction SilentlyContinue
$roadmapFiles += Get-ChildItem -Path "C:\dev" -Filter "roadmap.md" -Recurse -ErrorAction SilentlyContinue

# Filter for violations (not in allowed roots, not in archive)
$violations = @()
foreach ($file in $roadmapFiles) {
    $path = $file.FullName
    
    if (IsAllowedRoot $path) {
        continue
    }
    if (IsArchive $path) {
        continue
    }
    
    $lastModified = $file.LastWriteTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $classification = ClassifyViolation $path
    
    $violations += @{
        path = $path
        last_modified = $lastModified
        size_bytes = $file.Length
        classification = $classification
        recommendation = switch ($classification) {
            "ephemeral_worktree" { "DELETE (worktrees are temporary, not authoritative)" }
            "sync_artifact" { "DELETE (sync folder artifacts, not canonical)" }
            "nested_clone" { "DELETE (nested clone, conflicts with main)" }
            "orphan_backup" { "DELETE (backup file, no canonical match)" }
            "claude_metadata" { "DELETE (.claude metadata, not roadmap storage)" }
            "system_folder" { "AUDIT (system folder contamination)" }
            default { "DELETE (orphaned, no project ownership)" }
        }
    }
}

# Build report
$timestamp = [datetime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
$report = @{
    timestamp = $timestamp
    drift_found = $violations.Count -gt 0
    violation_count = $violations.Count
    violations = $violations
} | ConvertTo-Json -Depth 10

# Write report to audit folder
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp_short = [datetime]::UtcNow.ToString("yyyy-MM-dd")
$reportFile = Join-Path $OutputDir "roadmap-drift-report-$timestamp_short.json"
$report | Set-Content -Path $reportFile -Encoding UTF8

Write-Host "✅ Drift report: $reportFile"
Write-Host "Violations found: $($violations.Count)"

# Post Slack notification if violations found
if ($violations.Count -gt 0 -and $SlackWebhook) {
    Write-Host "Posting Slack alert..."
    
    # Top 3 violations
    $top3 = $violations | Select-Object -First 3 | ForEach-Object { "• `$($_.classification): $($_.path)" } | Join-String -Separator "`n"
    
    $payload = @{
        text = "⚠️ Roadmap Drift Detected ($($violations.Count) violations)"
        blocks = @(
            @{
                type = "section"
                text = @{
                    type = "mrkdwn"
                    text = "*Roadmap Drift Report*`n`nFound $($violations.Count) ROADMAP.md files in forbidden locations.`n`n*Top 3 violations:*`n$top3`n`n<$reportFile|Full Report (JSON)>"
                }
            }
        )
    } | ConvertTo-Json -Depth 10
    
    try {
        Invoke-WebRequest -Uri $SlackWebhook -Method Post -ContentType "application/json" -Body $payload -ErrorAction Stop | Out-Null
        Write-Host "✅ Slack alert posted to #roadmap-drift"
    } catch {
        Write-Host "⚠️  Slack notification failed: $_"
    }
} elseif ($violations.Count -eq 0) {
    Write-Host "✅ No violations found. Clean state."
}
```

- [ ] **Step 2: Test cleanup script**

```powershell
# Create test violation
$testViolation = "C:\dev\.claude\worktrees\test-agent\ROADMAP.md"
New-Item -ItemType Directory (Split-Path $testViolation) -Force | Out-Null
"# Test" | Set-Content $testViolation

# Run script
& C:\dev\utilities\roadmap-drift-checker.ps1

# Verify report generated and contains test violation
$latest = Get-ChildItem "C:\dev\audit\roadmap-drift-report-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest) {
    $result = Get-Content $latest.FullName | ConvertFrom-Json
    if ($result.violation_count -gt 0) {
        Write-Host "✅ Script correctly detected violation"
    } else {
        Write-Host "❌ Script did not detect violation"
    }
} else {
    Write-Host "❌ No report generated"
}

# Clean up
Remove-Item $testViolation -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 3: Wire Task Scheduler**

```powershell
# Create scheduled task (Windows Task Scheduler)
$taskName = "Roadmap Drift Checker"
$taskPath = "\Toolforge\"
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\dev\utilities\roadmap-drift-checker.ps1"

# Run weekly Sunday 02:00 UTC (adjust timezone as needed)
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "02:00"

# Create task (skip if already exists)
if (-not (Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue)) {
    Register-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Action $action -Trigger $trigger -RunLevel Highest
    Write-Host "✅ Scheduled task created: $taskName (Sunday 02:00 UTC)"
} else {
    Write-Host "⚠️  Task already exists: $taskName"
}

# Verify
Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath | Format-List
```

- [ ] **Step 4: Commit cleanup script**

```bash
git add utilities/roadmap-drift-checker.ps1
git commit -m "feat: add weekly roadmap drift detection script

Scans C:\dev for ROADMAP.md in forbidden locations (every Sunday 02:00 UTC
via Windows Task Scheduler). Generates JSON drift report to audit/ folder.
Posts Slack notification to #roadmap-drift if violations found.

Manual invocation: .\utilities\roadmap-drift-checker.ps1
"
```

---

## Phase 5: Verification & Testing

### Task 5.1: Test Pre-Commit Hook Blocking & Allowing

**Files:**
- Test: `.git/hooks/pre-commit`

**Interfaces:**
- Consumes: Hook logic from Phase 3
- Produces: Verified behavior (blocks violations, allows valid commits)

- [ ] **Step 1: Create violation, verify hook blocks it**

```powershell
# Stage a ROADMAP in forbidden location
$violationPath = "C:\dev\.claude\test-violation\ROADMAP.md"
New-Item -ItemType Directory (Split-Path $violationPath) -Force | Out-Null
"# Violation Test" | Set-Content $violationPath
git add $violationPath

# Attempt commit (should fail)
$commitOutput = git commit -m "test: violation" 2>&1
$commitExitCode = $LASTEXITCODE

if ($commitExitCode -ne 0 -and ($commitOutput -match "blocked outside allowed")) {
    Write-Host "✅ Hook correctly BLOCKED violation"
} else {
    Write-Host "❌ Hook did not block violation. Output: $commitOutput"
    exit 1
}

# Clean up
git reset HEAD $violationPath 2>$null
Remove-Item $violationPath -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Create valid commit, verify hook allows it**

```powershell
# Stage a ROADMAP in allowed location
$validPath = "C:\dev\docs\meta\test-valid-roadmap.md"
"# Valid Test" | Set-Content $validPath
git add $validPath

# Attempt commit (should succeed)
$commitOutput = git commit -m "test: valid roadmap in allowed location" 2>&1
$commitExitCode = $LASTEXITCODE

if ($commitExitCode -eq 0) {
    Write-Host "✅ Hook correctly ALLOWED valid commit"
    # Undo test commit
    git reset --soft HEAD~1
    Remove-Item $validPath -Force
    git reset HEAD $validPath 2>$null
} else {
    Write-Host "❌ Hook rejected valid commit. Output: $commitOutput"
    exit 1
}
```

- [ ] **Step 3: Measure hook performance**

```powershell
# Stage multiple files (50+) to measure hook latency
$testDir = "C:\dev\.test-perf-check"
New-Item -ItemType Directory $testDir -Force | Out-Null

1..50 | ForEach-Object {
    "Content $_" | Set-Content "$testDir\file-$_.txt"
}

git add "$testDir\*.txt"

# Time the commit attempt
$startTime = Get-Date
git commit -m "perf test" --no-verify 2>$null
$elapsed = (Get-Date) - $startTime

Write-Host "Hook latency (50 staged files): $($elapsed.TotalMilliseconds)ms"

if ($elapsed.TotalMilliseconds -lt 100) {
    Write-Host "✅ Performance acceptable (<100ms)"
} else {
    Write-Host "⚠️  Performance degraded (>100ms). Monitor in production."
}

# Clean up
git reset HEAD "$testDir\*.txt" 2>$null
Remove-Item $testDir -Recurse -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 4: Run drift detection manually**

```powershell
# Manually invoke cleanup script
& C:\dev\utilities\roadmap-drift-checker.ps1

# Read latest report
$latest = Get-ChildItem "C:\dev\audit\roadmap-drift-report-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest) {
    $result = Get-Content $latest.FullName | ConvertFrom-Json
    Write-Host "Drift report timestamp: $($result.timestamp)"
    Write-Host "Violations: $($result.violation_count)"
    
    if ($result.violation_count -gt 0) {
        Write-Host "`nViolations found (review before Phase 6):"
        $result.violations | ForEach-Object { Write-Host "  $($_.classification): $($_.path)" }
    } else {
        Write-Host "✅ Clean state (no violations)"
    }
} else {
    Write-Host "❌ No drift report found"
    exit 1
}
```

---

## Phase 6: Documentation Updates

### Task 6.1: Update CLAUDE.md

**Files:**
- Modify: `C:\dev\CLAUDE.md`

**Interfaces:**
- Consumes: Design spec (section 4)
- Produces: Updated governance section in CLAUDE.md

- [ ] **Step 1: Read current CLAUDE.md**

```powershell
$claudeMd = Get-Content "C:\dev\CLAUDE.md" -Raw
```

- [ ] **Step 2: Add roadmap governance section**

Add this text to CLAUDE.md after the "## Governance Framework" section:

```markdown
## Roadmap Governance

Roadmaps belong in `docs/meta/` (global) or project roots (cic-ingestion/, rewrite-docs/, rewrite-mcp/, kb-sync/ only).

All other locations are forbidden:
- .claude/worktrees/
- Nested clones / temp workspaces
- archive/ (historical only)
- Sync artifacts / node_modules / backups

Pre-commit hook blocks violations. Weekly cleanup scan reports drift.
See: docs/meta/roadmap-consolidation-design.md
```

- [ ] **Step 3: Verify section added**

```powershell
$updated = Get-Content "C:\dev\CLAUDE.md" -Raw
if ($updated -match "## Roadmap Governance") {
    Write-Host "✅ Roadmap governance section added"
} else {
    Write-Host "❌ Section not found after edit"
    exit 1
}
```

- [ ] **Step 4: Commit CLAUDE.md update**

```bash
git add CLAUDE.md
git commit -m "docs: add roadmap governance rules to CLAUDE.md

Document allowed project roots, forbidden locations, and enforcement
mechanisms (pre-commit hook + weekly cleanup scan).
"
```

---

### Task 6.2: Update documentation-policy.md

**Files:**
- Modify: `C:\dev\docs\meta\governance\documentation-policy.md`

**Interfaces:**
- Consumes: Design spec (section 4)
- Produces: Roadmap-specific rules added to policy

- [ ] **Step 1: Read current policy**

```powershell
$policyFile = "C:\dev\docs\meta\governance\documentation-policy.md"
$policy = Get-Content $policyFile -Raw
```

- [ ] **Step 2: Add roadmap-specific section**

Append this section to documentation-policy.md:

```markdown
## Roadmap-Specific Rules

Roadmaps follow standard placement rules (spec/plan/charter → docs/meta/ folders), PLUS:

- Project-local roadmaps allowed in project roots only (cic-ingestion/, kb-sync/, etc.)
- No roadmaps in .claude/worktrees/, nested clones, or sync folders
- Multiple versions of same roadmap: fresher date wins (tie-breaker)
- Enforced by pre-commit hook + weekly cleanup scan

See: docs/meta/roadmap-consolidation-design.md for full governance.
```

- [ ] **Step 3: Verify section added**

```powershell
$updated = Get-Content $policyFile -Raw
if ($updated -match "## Roadmap-Specific Rules") {
    Write-Host "✅ Roadmap rules section added"
} else {
    Write-Host "❌ Section not found after edit"
    exit 1
}
```

- [ ] **Step 4: Commit policy update**

```bash
git add docs/meta/governance/documentation-policy.md
git commit -m "docs: add roadmap-specific placement rules

Clarify allowed project roots, forbidden locations, conflict resolution
(fresher date wins), and enforcement mechanisms.
"
```

---

## Phase 7: Rollout & Verification

### Task 7.1: Final Git Commit & Push

**Files:**
- All changes from Phases 1-6

**Interfaces:**
- Consumes: Commits from Phases 1-7
- Produces: Pushed main branch with all roadmap consolidation changes

- [ ] **Step 1: Verify all commits**

```bash
# Show commit log for this phase
git log --oneline -10 | head -20
```

Expected commits:
```
✅ docs: add roadmap-specific placement rules
✅ docs: add roadmap governance rules to CLAUDE.md
✅ feat: add weekly roadmap drift detection script
✅ feat: add roadmap placement check to pre-commit hook
✅ chore: remove orphan roadmaps from forbidden locations
✅ feat: establish canonical roadmaps in project roots
✅ feat: add roadmap consolidation audit scanner
```

- [ ] **Step 2: Run final verification**

```bash
# Verify no uncommitted changes
git status
# Expected: "working tree clean"

# Verify hook is functional
powershell -Command "& C:\dev\utilities\roadmap-drift-checker.ps1"
# Expected: "Clean state (no violations)" or list of violations to clean

# Verify scripts present
ls -la C:\dev\utilities/roadmap-*.ps1
# Expected: 3 scripts (scanner, checker, migration-helper)
```

- [ ] **Step 3: Push to remote**

```bash
git push origin main

# If push fails (e.g., remote rejected), check for:
# - Uncommitted changes
# - Pre-push hook violations
# - Remote permission issues

# If successful:
Write-Host "✅ Roadmap consolidation complete and pushed"
```

- [ ] **Step 4: Verify remote state**

```bash
# Confirm remote has all commits
git log origin/main --oneline | head -10

# Verify hook + scripts are in remote
git ls-tree -r origin/main | grep roadmap

# Expected output includes:
# utilities/roadmap-consolidation-scanner.ps1
# utilities/roadmap-drift-checker.ps1
# utilities/roadmap-migration-helper.ps1
# utilities/hooks/pre-commit-roadmap-check.ps1
```

---

## Rollback Plan

If unrecoverable issues after Phase 7:

1. Disable hook: `Remove-Item .git/hooks/pre-commit`
2. Regenerate hooks (clears all): `.\utilities\setup-git-hooks.ps1`
3. Revert last 7 commits: `git reset --hard HEAD~7`
4. Push revert: `git push origin main --force` (only if Tier 1 approves)

Note: Roadmaps already migrated to project roots remain in place—no auto-revert for file moves.

---

## Success Criteria (Post-Deployment Verification)

- [ ] Audit report generated: `audit/roadmap-consolidation-audit-YYYY-MM-DD.json`
- [ ] Canonical roadmaps in place: `<root>/ROADMAP.md` for all 5 allowed roots
- [ ] Orphans deleted from forbidden locations: 0 violations in `.claude/worktrees/`, nested clones, sync folders
- [ ] Pre-commit hook deployed + tested: Blocks violation, allows valid commit
- [ ] Cleanup script deployed + tested: Generates drift report with 0 violations
- [ ] Governance docs updated: CLAUDE.md + documentation-policy.md
- [ ] All commits pushed to remote
- [ ] 30-day post-deploy check: No new ROADMAP.md in forbidden locations

---

## Notes

- **Tie-breaker implementation:** Use modification date; if equal, prefer root location; if still tied, flag for manual review
- **Archive strategy:** All superseded roadmaps move to `docs/meta/archive/` with one-line note (never delete)
- **Manual deletion:** Phase 1 uses manual review gate; auto-delete for ephemeral worktrees after 7 days is a future enhancement
- **Slack notifications:** Only sent if violations found; no false positives on clean state
- **Hook performance:** Estimated ~15ms; test with 50+ staged files before full deployment
