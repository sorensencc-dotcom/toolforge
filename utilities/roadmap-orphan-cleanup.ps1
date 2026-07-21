<#
.SYNOPSIS
Delete orphan ROADMAP.md files identified by the Task 1.1 audit report.

.DESCRIPTION
Consumes the audit report JSON produced by Task 1.1 (roadmap-consolidation-audit-*.json).
Primary source of orphan paths is $audit.orphans_list (array of file paths), per the
Task 2.2 spec.

KNOWN SCHEMA GAP: as of the 2026-07-20 audit report, the JSON does not emit an
orphans_list array -- it reports only a count (cleanup.orphans_found) plus a
conflicts[] array of superseded-roadmap pairs (see
roadmap-consolidation-audit-2026-07-20.SCHEMA-NOTES.md). When orphans_list is
absent, this script falls back to the legacy targeted scan of known orphan
locations and prints a reconciliation warning comparing the scan count to
audit.cleanup.orphans_found. This gap is a Task 1.1 audit-output issue, not
something this script can safely paper over -- flagged for human follow-up
rather than fabricated.

.PARAMETER AuditReport
Path to audit JSON (default: latest in C:\dev\audit\)

.PARAMETER Force
If $true, delete without prompting. Use only after manual review.

.PARAMETER DryRun
If set, scan and report orphans but do not delete or prompt.

.EXAMPLE
.\roadmap-orphan-cleanup.ps1
.\roadmap-orphan-cleanup.ps1 -Force $true
.\roadmap-orphan-cleanup.ps1 -DryRun
#>

param(
    [string]$AuditReport = $null,
    [bool]$Force = $false,
    [switch]$DryRun
)

# Find latest audit report
if (-not $AuditReport) {
    $AuditReport = Get-ChildItem "C:\dev\audit\roadmap-consolidation-audit-*.json" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}

if (-not $AuditReport -or -not (Test-Path $AuditReport)) {
    Write-Host "Audit report not found: $AuditReport"
    exit 1
}

Write-Host "Loading audit report: $AuditReport"
$auditRaw = Get-Content -Path $AuditReport -Raw -ErrorAction Stop
try {
    $audit = $auditRaw | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Host "Failed to parse audit report JSON: $_"
    exit 1
}

$auditOrphanCount = $audit.cleanup.orphans_found
$orphans = @()

if (($audit.PSObject.Properties.Name -contains 'orphans_list') -and $audit.orphans_list) {
    Write-Host "Consuming orphans_list from audit JSON ($($audit.orphans_list.Count) entries)."
    $orphans = @($audit.orphans_list)
} else {
    Write-Host "WARNING: audit JSON has no 'orphans_list' array (schema gap -- see roadmap-consolidation-audit-2026-07-20.SCHEMA-NOTES.md)."
    Write-Host "Falling back to legacy targeted scan of known orphan locations."

    # 1. Worktree in rewrite-mcp
    if (Test-Path "C:\dev\rewrite-mcp\.claude\worktrees") {
        $orphans += @(Get-ChildItem -Path "C:\dev\rewrite-mcp\.claude\worktrees" -Filter "roadmap.md" -Recurse -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName })
    }

    # 2. Archive build-output (nested clones)
    if (Test-Path "C:\dev\docs\archive\build-output") {
        $orphans += @(Get-ChildItem -Path "C:\dev\docs\archive\build-output" -Filter "roadmap.md" -Recurse -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName })
    }

    # 3. node_modules (third-party package docs)
    if (Test-Path "C:\dev\docs\archive\projects\castironforge\cic-ingestion\node_modules\smart-buffer\docs\ROADMAP.md") {
        $orphans += "C:\dev\docs\archive\projects\castironforge\cic-ingestion\node_modules\smart-buffer\docs\ROADMAP.md"
    }

    # 4. charlie-deep-research (orphan root, not in allowed locations)
    if (Test-Path "C:\dev\charlie-deep-research") {
        $orphans += @(Get-ChildItem -Path "C:\dev\charlie-deep-research" -Filter "*ROADMAP*" -Recurse -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName })
    }

    # 5. rewrite-docs .planning (conflicting/superseded)
    if (Test-Path "C:\dev\rewrite-docs\.planning\ROADMAP.md") {
        $orphans += "C:\dev\rewrite-docs\.planning\ROADMAP.md"
    }
}

# Remove duplicates and sort
$orphans = @($orphans | Sort-Object -Unique)

# Reconcile scan/list count against audit's reported count
if ($null -ne $auditOrphanCount) {
    if ($orphans.Count -ne $auditOrphanCount) {
        Write-Host "RECONCILE WARNING: found $($orphans.Count) orphan(s); audit report claims $auditOrphanCount (cleanup.orphans_found). Investigate before deleting."
    } else {
        Write-Host "Reconcile OK: orphan count matches audit.cleanup.orphans_found ($auditOrphanCount)."
    }
}

if ($orphans.Count -eq 0) {
    Write-Host "No orphans found."
    exit 0
}

Write-Host ""
Write-Host "Found $($orphans.Count) orphan(s):"
$orphans | ForEach-Object { Write-Host "  $_" }

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run: no files deleted."
    exit 0
}

if (-not $Force) {
    $response = Read-Host "`nDelete these files? (type 'yes' to confirm)"
    if ($response -ne "yes") {
        Write-Host "Cancelled."
        exit 0
    }
}

# Delete orphans
Write-Host ""
Write-Host "Deleting orphans..."
$deleted = 0
$failed = 0
foreach ($file in $orphans) {
    Write-Host "Deleting: $file"
    try {
        Remove-Item -Path $file -Force -ErrorAction Stop
        if (Test-Path $file) {
            Write-Host "  FAILED (still present after delete)"
            $failed++
        } else {
            Write-Host "  Deleted"
            $deleted++
        }
    } catch {
        Write-Host "  FAILED: $_"
        $failed++
    }
}

Write-Host ""
Write-Host "Orphan cleanup complete: $deleted deleted, $failed failed."
if ($failed -gt 0) { exit 1 }
