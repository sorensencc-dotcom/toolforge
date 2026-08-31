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
    # Forbidden-location patterns MUST be tested before the allowed-root prefix
    # check. IsAllowedRoot is a prefix match, so a worktree / node_modules / .git
    # / archive path that happens to sit UNDER an allowed root (e.g.
    # C:\dev\rewrite-mcp\.claude\worktrees\...\roadmap.md) would otherwise be
    # classified "allowed_root" and become a canonical candidate. Ordering these
    # first makes the checks live instead of dead code.
    if ($FilePath -match '\.claude[\\/]worktrees') {
        return "ephemeral_worktree"
    }
    if ($FilePath -match '[\\\/]archive[\\\/]') {
        return "archive_folder"
    }
    if ($FilePath -match '[\\\/](node_modules|\.git)[\\/]') {
        return "system_folder"
    }
    if (IsAllowedRoot $FilePath) {
        return "allowed_root"
    }
    return "forbidden_location"
}

function GetProjectRoot([string]$FilePath) {
    # Normalize both sides to lowercase so casing differences (e.g. C:\Dev vs
    # C:\dev) do not misclassify real roadmaps as orphans. Matches the
    # lowercase normalization used by IsAllowedRoot.
    $fileLower = $FilePath.ToLower()
    foreach ($root in $AllowedRoots) {
        $rootLower = $root.ToLower()
        if ($fileLower.StartsWith("$rootLower\") -or $fileLower -eq $rootLower) {
            return $root
        }
    }
    return $null
}

Write-Host "Scanning C:\dev for ROADMAP.md files..."
# Get-ChildItem -Filter is case-insensitive on Windows, so a single "ROADMAP.md"
# filter already matches roadmap.md / Roadmap.md. A second lowercase pass would
# double-count every file and inflate conflicts.
$roadmapFiles = Get-ChildItem -Path $RootPath -Filter "ROADMAP.md" -Recurse -ErrorAction SilentlyContinue

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

foreach ($projectRoot in $categorized.Keys | Where-Object { $_ -ne 'orphaned' }) {
    $entries = $categorized[$projectRoot]

    # Only allowed_root files are eligible to be canonical. Forbidden locations
    # (nested clones, node_modules, .git, worktrees, archive) that happen to sit
    # under a project root must be routed to orphans, never selected as canonical
    # or run through the tie-breaker (which would emit fake conflict pairs).
    $rejected = @($entries | Where-Object { $_.location -ne 'allowed_root' })
    foreach ($r in $rejected) { $orphans += $r }
    $entries = @($entries | Where-Object { $_.location -eq 'allowed_root' })

    if ($entries.Count -eq 0) {
        continue
    }

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
        $allowedRootsReport[$root] = @{
            canonical_count = 1
            roadmaps = @(Split-Path $can.path -Leaf)
            source = $can.path + " ($($can.lastModified))"
        }
    } else {
        $allowedRootsReport[$root] = @{
            canonical_count = 0
            roadmaps = @()
        }
    }
}

# Simplify root names for JSON
$allowedRootsReportSimple = @{}
# $allowedRootsReport is always fully populated (every AllowedRoot gets an entry
# in the loop above), so the lookups always succeed. No null-coalesce needed --
# and the ?? operator is PowerShell 7+ only, breaking 5.1 compatibility.
$allowedRootsReportSimple["docs/meta"] = $allowedRootsReport["C:\dev\docs\meta"]
$allowedRootsReportSimple["cic-ingestion"] = $allowedRootsReport["C:\dev\cic-ingestion"]
$allowedRootsReportSimple["rewrite-docs"] = $allowedRootsReport["C:\dev\rewrite-docs"]
$allowedRootsReportSimple["rewrite-mcp"] = $allowedRootsReport["C:\dev\rewrite-mcp"]
$allowedRootsReportSimple["kb-sync"] = $allowedRootsReport["C:\dev\kb-sync"]

$report = @{
    timestamp = $timestamp
    allowed_roots = $allowedRootsReportSimple
    cleanup = @{
        orphans_found = $orphans.Count
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

Write-Host "Audit complete. Report: $reportFile"
Write-Host "Canonical sources: $($canonical.Count)"
Write-Host "Conflicts: $($conflicts.Count)"
Write-Host "Orphans: $($orphans.Count)"
