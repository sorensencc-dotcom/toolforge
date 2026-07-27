#!/usr/bin/env pwsh
<#
.SYNOPSIS
LOC metrics with lockfile noise excluded. Standard command for retro/trend reporting.

.DESCRIPTION
git log --numstat counts lockfile regeneration (package-lock.json, yarn.lock, etc.) as
code churn, which can be 60-90% of raw insertions on a dependency-bump commit. This
filters those paths out of insertions/deletions/net_loc and reports them separately,
per memory/retro_lockfile_loc_exclusion.md.

.PARAMETER Since
git log --since value (default: 7 days ago)

.PARAMETER Repo
Target repo path (default: current directory)

.EXAMPLE
./scripts/loc-filtered.ps1 -Since "2026-07-19"
./scripts/loc-filtered.ps1 -Since "1 week ago" -Repo "C:\dev\cic-ingestion"
#>

param(
    [string]$Since = "7 days ago",
    [string]$Repo = "."
)

$ErrorActionPreference = 'Stop'

# Keep in sync with .gitattributes' linguist-generated lockfile entries.
$LockfilePatterns = @(
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
    'Cargo.lock',
    'poetry.lock'
)

function Test-IsLockfile($path) {
    foreach ($pattern in $LockfilePatterns) {
        if ($path -eq $pattern -or $path.EndsWith("/$pattern")) {
            return $true
        }
    }
    return $false
}

Push-Location $Repo
try {
    $raw = git log --since="$Since" --numstat --pretty=format:"" 2>$null |
        Where-Object { $_.Trim() -ne "" }

    $codeIns = 0; $codeDel = 0
    $lockIns = 0; $lockDel = 0

    foreach ($line in $raw) {
        $parts = $line -split "`t"
        if ($parts.Count -lt 3) { continue }
        $insStr, $delStr, $path = $parts[0], $parts[1], $parts[2]

        # Binary files report "-" for ins/del; skip.
        if ($insStr -eq '-' -or $delStr -eq '-') { continue }

        $ins = [int]$insStr
        $del = [int]$delStr

        if (Test-IsLockfile $path) {
            $lockIns += $ins
            $lockDel += $del
        } else {
            $codeIns += $ins
            $codeDel += $del
        }
    }

    $netCode = $codeIns - $codeDel
    $netLock = $lockIns - $lockDel

    Write-Host "LOC since '$Since' (lockfiles excluded from headline metric):"
    Write-Host ""
    Write-Host "  Code    insertions=$codeIns deletions=$codeDel net=$netCode"
    Write-Host "  Lockfile insertions=$lockIns deletions=$lockDel net=$netLock (reported separately, not in code metric)"
}
finally {
    Pop-Location
}
