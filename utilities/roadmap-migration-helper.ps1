<#
.SYNOPSIS
Copy canonical roadmaps to project roots per audit decisions.

.DESCRIPTION
Based on Task 1.2 decisions, copy canonical sources to project roots.
Supports dry-run mode for verification before committing.

.PARAMETER DryRun
If $true, show what would be copied without actually copying (default: $true).

.EXAMPLE
.\roadmap-migration-helper.ps1 -DryRun $true
.\roadmap-migration-helper.ps1 -DryRun $false
#>

param(
    [bool]$DryRun = $true
)

# Canonical mappings from Task 1.2 decisions
$migrations = @(
    @{
        source = "C:\dev\rewrite-docs\castironforge\cic-ingestion\toolforge\ROADMAP.md"
        dest = "C:\dev\rewrite-docs\ROADMAP.md"
        root = "rewrite-docs"
    }
    # cic-ingestion and rewrite-mcp already at project root (no copy needed)
    # docs/meta and kb-sync have no canonical (skip)
)

Write-Host "Migration helper: DryRun=$DryRun`n"

foreach ($mapping in $migrations) {
    $source = $mapping.source
    $dest = $mapping.dest
    $root = $mapping.root

    if (Test-Path $source) {
        if ($DryRun) {
            Write-Host "Would copy ($root):"
            Write-Host "  Source: $source"
            Write-Host "  Dest:   $dest"
        } else {
            Write-Host "Copying ($root): $source -> $dest"
            Copy-Item -Path $source -Destination $dest -Force
            if (Test-Path $dest) {
                Write-Host "✅ Success"
            } else {
                Write-Host "❌ Copy failed"
                exit 1
            }
        }
    } else {
        Write-Host "❌ Source not found ($root): $source"
        exit 1
    }
}

Write-Host "`n✅ Migration complete (DryRun=$DryRun)"
