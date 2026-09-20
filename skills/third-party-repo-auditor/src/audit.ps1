<#
.SYNOPSIS
    Audits third-party Git repositories across the workspace against upstream remotes.
.DESCRIPTION
    Scans configured third-party repositories, fetches remote refs, and outputs
    commit deltas, latest tags, uncommitted changes, and patch status.
.PARAMETER Repositories
    Optional array of repository paths to audit. Defaults to standard workspace 3rd-party repos.
.PARAMETER Fetch
    If set, fetches the latest upstream remote refs before comparing.
.PARAMETER Json
    If set, outputs results as a JSON string.
#>
[CmdletBinding()]
param(
    [string[]]$Repositories = @(
        "C:\dev\dev-sandbox\open-notebook",
        "C:\dev\graft\context-graph-engine",
        "C:\dev\kb-sync\notebooklm-mcp-cli",
        "C:\dev\kb-sync\notebooklm-mcp-cli\notebooklm-py",
        "C:\dev\markitdown"
    ),
    [switch]$Fetch = $true,
    [switch]$Json
)

$results = @()

foreach ($repo in $Repositories) {
    if (-not (Test-Path $repo)) {
        continue
    }

    $gitDir = Join-Path $repo ".git"
    if (-not (Test-Path $gitDir)) {
        continue
    }

    $repoName = Split-Path $repo -Leaf
    $origin = (git -C $repo remote get-url origin 2>$null)
    $branch = (git -C $repo rev-parse --abbrev-ref HEAD 2>$null)
    $headSha = (git -C $repo rev-parse --short HEAD 2>$null)
    $lastCommit = (git -C $repo log -n 1 --pretty=format:"%s" 2>$null)
    $status = (git -C $repo status --porcelain 2>$null)
    $dirtyCount = if ($status) { @($status).Count } else { 0 }

    if ($Fetch -and $origin) {
        git -C $repo fetch origin --tags 2>$null | Out-Null
    }

    # Determine default tracking branch
    $remoteBranches = git -C $repo branch -r 2>$null
    $defaultBranch = if ($remoteBranches -match "origin/main") {
        "origin/main"
    } elseif ($remoteBranches -match "origin/master") {
        "origin/master"
    } else {
        "origin/$branch"
    }

    $behind = 0
    $ahead = 0
    if ($defaultBranch) {
        $behindStr = (git -C $repo rev-list --count "HEAD..$defaultBranch" 2>$null)
        $aheadStr = (git -C $repo rev-list --count "$defaultBranch..HEAD" 2>$null)
        $behind = if ($behindStr) { [int]$behindStr } else { 0 }
        $ahead = if ($aheadStr) { [int]$aheadStr } else { 0 }
    }

    $latestTag = (git -C $repo describe --tags --abbrev=0 2>$null)
    $upstreamTags = (git -C $repo tag -l --sort=-v:refname 2>$null)
    $latestUpstreamTag = if ($upstreamTags) { $upstreamTags[0] } else { $latestTag }

    $statusString = if ($behind -eq 0 -and $ahead -eq 0 -and $dirtyCount -eq 0) {
        "UP_TO_DATE"
    } elseif ($behind -gt 0) {
        "BEHIND_UPSTREAM"
    } elseif ($ahead -gt 0) {
        "AHEAD_OF_UPSTREAM"
    } else {
        "DIRTY"
    }

    $item = [PSCustomObject]@{
        Repository       = $repoName
        Path             = $repo
        Remote           = $origin
        Branch           = $branch
        Commit           = $headSha
        Status           = $statusString
        Behind           = $behind
        Ahead            = $ahead
        LatestTag        = $latestUpstreamTag
        DirtyFiles       = $dirtyCount
        LastCommitMessage = $lastCommit
    }

    $results += $item
}

if ($Json) {
    $results | ConvertTo-Json -Depth 4
} else {
    Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host "                THIRD-PARTY REPOSITORY AUDIT REPORT                             " -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan

    $results | Format-Table -Property Repository, Status, Behind, Ahead, LatestTag, DirtyFiles, Commit -AutoSize

    Write-Host "Scan completed across $($results.Count) repositories.`n" -ForegroundColor Green
}
