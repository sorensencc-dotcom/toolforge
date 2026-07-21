<#
.SYNOPSIS
Delete orphan ROADMAP.md files from forbidden locations per audit.

.DESCRIPTION
Identifies ROADMAP files outside allowed roots. Prompts for confirmation before deletion
(or deletes immediately if -Force $true).

.PARAMETER AuditReport
Path to audit JSON (default: latest in C:\dev\audit\)

.PARAMETER Force
If $true, delete without prompting. Use only after manual review.

.EXAMPLE
.\roadmap-orphan-cleanup.ps1
.\roadmap-orphan-cleanup.ps1 -Force $true
#>

param(
    [string]$AuditReport = $null,
    [bool]$Force = $false
)

# Find latest audit report
if (-not $AuditReport) {
    $AuditReport = Get-ChildItem "C:\dev\audit\roadmap-consolidation-audit-*.json" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}

if (-not (Test-Path $AuditReport)) {
    Write-Host "❌ Audit report not found: $AuditReport"
    exit 1
}

# Scan for orphans in specific forbidden/orphan locations (efficient targeted scan)
Write-Host "Scanning for orphan ROADMAP files..."
$orphans = @()

# 1. Worktree in rewrite-mcp
if (Test-Path "C:\dev\rewrite-mcp\.claude\worktrees") {
    $worktreeFiles = Get-ChildItem -Path "C:\dev\rewrite-mcp\.claude\worktrees" -Filter "roadmap.md" -Recurse -ErrorAction SilentlyContinue
    $orphans += @($worktreeFiles | ForEach-Object { $_.FullName })
}

# 2. Archive build-output (nested clones)
if (Test-Path "C:\dev\docs\archive\build-output") {
    $archiveFiles = Get-ChildItem -Path "C:\dev\docs\archive\build-output" -Filter "roadmap.md" -Recurse -ErrorAction SilentlyContinue
    $orphans += @($archiveFiles | ForEach-Object { $_.FullName })
}

# 3. node_modules (third-party package docs)
if (Test-Path "C:\dev\docs\archive\projects\castironforge\cic-ingestion\node_modules\smart-buffer\docs\ROADMAP.md") {
    $orphans += "C:\dev\docs\archive\projects\castironforge\cic-ingestion\node_modules\smart-buffer\docs\ROADMAP.md"
}

# 4. charlie-deep-research (orphan root, not in allowed locations)
if (Test-Path "C:\dev\charlie-deep-research") {
    $cdFiles = Get-ChildItem -Path "C:\dev\charlie-deep-research" -Filter "*ROADMAP*" -Recurse -ErrorAction SilentlyContinue
    $orphans += @($cdFiles | ForEach-Object { $_.FullName })
}

# 5. rewrite-docs .planning (conflicting/superseded)
if (Test-Path "C:\dev\rewrite-docs\.planning\ROADMAP.md") {
    $orphans += "C:\dev\rewrite-docs\.planning\ROADMAP.md"
}

# Remove duplicates and sort
$orphans = @($orphans | Sort-Object -Unique)

if ($orphans.Count -eq 0) {
    Write-Host "✅ No orphans found."
    exit 0
}

# Prompt user
Write-Host "`nFound $($orphans.Count) orphan(s):"
$orphans | ForEach-Object { Write-Host "  $_" }

if (-not $Force) {
    $response = Read-Host "`nDelete these files? (type 'yes' to confirm)"
    if ($response -ne "yes") {
        Write-Host "Cancelled."
        exit 0
    }
}

# Delete orphans
Write-Host "`nDeleting orphans..."
foreach ($file in $orphans) {
    Write-Host "Deleting: $file"
    Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
    if (Test-Path $file) {
        Write-Host "  ❌ Failed"
    } else {
        Write-Host "  ✅ Deleted"
    }
}

Write-Host "`n✅ Orphan cleanup complete"
