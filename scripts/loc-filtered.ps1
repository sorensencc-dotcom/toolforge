#!/usr/bin/env pwsh
<#
.SYNOPSIS
LOC metrics with lockfile noise excluded. Standard command for retro/trend reporting.

.DESCRIPTION
git log --numstat counts lockfile regeneration (package-lock.json, yarn.lock, etc.) as
code churn, which can be 60-90% of raw insertions on a dependency-bump commit. This
filters those paths out of insertions/deletions/net_loc and reports them separately,
per memory/retro_lockfile_loc_exclusion.md.

Also excludes commits tagged `chore(sync):` (bulk/automated resync commits, e.g. large
.ijfw/ regen) from the headline code metric and reports them separately, per
CLAUDE.md Productivity Discipline #5 / memory/feedback_commit_chore_sync_tag.md.
Manual correction for this was needed 3x in prior retros before being scripted here.

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

function Test-IsSyncCommit($subject) {
    return $subject -match '^chore\(sync\):'
}

Push-Location $Repo
try {
    # Marker-line trick: emit a COMMIT sentinel + subject before each commit's numstat block,
    # so sync-tagged commits can be excluded without a second git invocation.
    $raw = git log --since="$Since" --numstat --pretty=format:"@@COMMIT@@%x09%s" 2>$null

    $codeIns = 0; $codeDel = 0
    $lockIns = 0; $lockDel = 0
    $syncIns = 0; $syncDel = 0
    $syncCommitCount = 0
    $inSyncCommit = $false

    foreach ($line in $raw) {
        if ($line.StartsWith('@@COMMIT@@')) {
            $subject = $line.Substring(10).TrimStart("`t")
            $inSyncCommit = Test-IsSyncCommit $subject
            if ($inSyncCommit) { $syncCommitCount++ }
            continue
        }
        if ($line.Trim() -eq "") { continue }

        $parts = $line -split "`t"
        if ($parts.Count -lt 3) { continue }
        $insStr, $delStr, $path = $parts[0], $parts[1], $parts[2]

        # Binary files report "-" for ins/del; skip.
        if ($insStr -eq '-' -or $delStr -eq '-') { continue }

        $ins = [int]$insStr
        $del = [int]$delStr

        if ($inSyncCommit) {
            $syncIns += $ins
            $syncDel += $del
        } elseif (Test-IsLockfile $path) {
            $lockIns += $ins
            $lockDel += $del
        } else {
            $codeIns += $ins
            $codeDel += $del
        }
    }

    $netCode = $codeIns - $codeDel
    $netLock = $lockIns - $lockDel
    $netSync = $syncIns - $syncDel

    Write-Host "LOC since '$Since' (lockfiles + chore(sync) commits excluded from headline metric):"
    Write-Host ""
    Write-Host "  Code    insertions=$codeIns deletions=$codeDel net=$netCode"
    Write-Host "  Lockfile insertions=$lockIns deletions=$lockDel net=$netLock (reported separately, not in code metric)"
    Write-Host "  Sync    insertions=$syncIns deletions=$syncDel net=$netSync ($syncCommitCount chore(sync) commits, reported separately, not in code metric)"
}
finally {
    Pop-Location
}
