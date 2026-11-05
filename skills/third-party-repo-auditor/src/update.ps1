<#
.SYNOPSIS
    Synchronizes and updates third-party Git repositories across the workspace against upstream remotes.
.DESCRIPTION
    Safely synchronizes configured third-party repositories:
    - Processes repositories in dependency order (e.g. inner submodules before parent repositories).
    - Detects and cleans up accidental nested clone directories.
    - Fast-forwards clean repositories and rebases repositories carrying local commits.
    - Synchronizes and commits updated submodule references in parent repositories.
.PARAMETER Repositories
    Optional list of repository paths to update.
.PARAMETER DryRun
    If set, reports pending updates without mutating working trees or Git refs.
.PARAMETER SkipFetch
    If set, skips running `git fetch origin` before comparison and update.
#>
[CmdletBinding()]
param(
    [string[]]$Repositories = @(
        "C:\dev\dev-sandbox\open-notebook",
        "C:\dev\graft\context-graph-engine",
        "C:\dev\kb-sync\notebooklm-mcp-cli\notebooklm-py",
        "C:\dev\kb-sync\notebooklm-mcp-cli",
        "C:\dev\markitdown"
    ),
    [switch]$DryRun,
    [switch]$SkipFetch,
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
    $beforeSha = (git -C $repo rev-parse --short HEAD 2>$null)

    # 1. Clean accidental nested duplicate clones (e.g. <repo>/<repo>/.git)
    $nestedPath = Join-Path $repo $repoName
    if ((Test-Path (Join-Path $nestedPath ".git")) -and (Test-Path $nestedPath)) {
        if ($DryRun) {
            Write-Host "[$repoName] DryRun: Would clean accidental nested clone at $nestedPath" -ForegroundColor Yellow
        } else {
            Write-Host "[$repoName] Cleaning accidental nested clone at $nestedPath" -ForegroundColor Yellow
            Remove-Item -Recurse -Force $nestedPath -ErrorAction SilentlyContinue
        }
    }

    # 2. Fetch upstream unless skipped
    if (-not $SkipFetch -and $origin) {
        git -C $repo fetch origin --tags 2>$null | Out-Null
    }

    # 3. Determine upstream tracking branch
    $remoteBranches = git -C $repo branch -r 2>$null
    $defaultBranch = if ($remoteBranches -match "origin/main") {
        "origin/main"
    } elseif ($remoteBranches -match "origin/master") {
        "origin/master"
    } else {
        "origin/$branch"
    }

    $behindStr = (git -C $repo rev-list --count "HEAD..$defaultBranch" 2>$null)
    $aheadStr = (git -C $repo rev-list --count "$defaultBranch..HEAD" 2>$null)
    $behind = if ($behindStr) { [int]$behindStr } else { 0 }
    $ahead = if ($aheadStr) { [int]$aheadStr } else { 0 }

    $rawStatus = (git -C $repo status --porcelain 2>$null)
    $dirtyCount = if ($rawStatus) { @($rawStatus).Count } else { 0 }
    $actionTaken = "UP_TO_DATE"

    # 4. Perform update if behind or if submodules changed
    if ($behind -gt 0) {
        if ($DryRun) {
            $actionTaken = "PENDING_UPDATE ($behind behind, $ahead ahead)"
        } else {
            $stashed = $false
            if ($dirtyCount -gt 0) {
                Write-Host "[$repoName] Stashing $dirtyCount local modification(s)..." -ForegroundColor Cyan
                git -C $repo stash push -m "Auto-stashed by update.ps1 before sync" 2>$null | Out-Null
                $stashed = $true
            }

            if ($ahead -gt 0) {
                Write-Host "[$repoName] Rebasing $ahead local commit(s) on top of $defaultBranch..." -ForegroundColor Cyan
                $rebaseOut = (git -C $repo rebase $defaultBranch 2>&1 | Out-String)
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "[$repoName] Rebase conflict or error: $rebaseOut"
                    $actionTaken = "REBASE_FAILED"
                } else {
                    $actionTaken = "REBASED ($behind upstream commits merged)"
                }
            } else {
                Write-Host "[$repoName] Fast-forwarding $behind commit(s) from $defaultBranch..." -ForegroundColor Cyan
                $mergeOut = (git -C $repo merge --ff-only $defaultBranch 2>&1 | Out-String)
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "[$repoName] Fast-forward failed: $mergeOut"
                    $actionTaken = "FF_FAILED"
                } else {
                    $actionTaken = "FAST_FORWARDED ($behind commits)"
                }
            }

            if ($stashed) {
                Write-Host "[$repoName] Restoring stashed modifications..." -ForegroundColor Cyan
                git -C $repo stash pop 2>$null | Out-Null
            }
        }
    }

    # 5. Check if parent repo needs to commit updated nested submodule
    if (-not $DryRun) {
        $postStatus = (git -C $repo status --porcelain 2>$null)
        if ($postStatus) {
            # Check for modified submodule pointers
            $submoduleLines = @($postStatus) | Where-Object { $_ -match "^ M (.+)$" }
            foreach ($subLine in $submoduleLines) {
                $subRelPath = $subLine.Substring(3).Trim()
                $subFullPath = Join-Path $repo $subRelPath
                if (Test-Path (Join-Path $subFullPath ".git")) {
                    $subSha = (git -C $subFullPath rev-parse --short HEAD 2>$null)
                    Write-Host "[$repoName] Syncing submodule commit pointer for $subRelPath ($subSha)..." -ForegroundColor Cyan
                    git -C $repo add $subRelPath 2>$null | Out-Null
                    git -C $repo commit -m "update: sync submodule $subRelPath to upstream ($subSha)" 2>$null | Out-Null
                    $actionTaken += " + SUBMODULE_SYNC ($subRelPath)"
                }
            }
        }
    }

    $afterSha = (git -C $repo rev-parse --short HEAD 2>$null)
    $finalBehind = [int](git -C $repo rev-list --count "HEAD..$defaultBranch" 2>$null)
    $finalAhead = [int](git -C $repo rev-list --count "$defaultBranch..HEAD" 2>$null)

    $results += [PSCustomObject]@{
        Repository = $repoName
        Action     = $actionTaken
        Before     = $beforeSha
        After      = $afterSha
        Behind     = $finalBehind
        Ahead      = $finalAhead
        Status     = if ($finalBehind -eq 0) { "UP_TO_DATE" } else { "BEHIND" }
    }
}

if ($Json) {
    [PSCustomObject]@{
        UpdatedRepositories = $results
    } | ConvertTo-Json -Depth 4
} else {
    Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host "                THIRD-PARTY REPOSITORIES UPDATE SUMMARY                         " -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
    $results | Format-Table -Property Repository, Action, Before, After, Behind, Ahead, Status -AutoSize | Out-Host
}
