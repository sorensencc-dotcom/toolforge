<#
.SYNOPSIS
    Audits third-party Git repositories and Docker images across the workspace against upstream remotes.
.DESCRIPTION
    Scans configured third-party repositories and Docker images, fetches remote refs/manifests,
    and outputs commit deltas, release tags, uncommitted changes, and image freshness.
.PARAMETER Repositories
    Optional array of repository paths to audit.
.PARAMETER DockerImages
    Optional array of Docker images to audit.
.PARAMETER Fetch
    If set, fetches latest upstream Git refs and Docker image manifests before comparing.
.PARAMETER Json
    If set, outputs results as a structured JSON object.
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
    [string[]]$DockerImages = @(
        "ghcr.io/tashfeenahmed/freellmapi:latest",
        "ghcr.io/headroomlabs-ai/headroom:latest",
        "diegosouzapw/omniroute:latest",
        "ghcr.io/github/github-mcp-server:latest",
        "ollama/ollama:latest",
        "lscr.io/linuxserver/bookstack:latest",
        "lscr.io/linuxserver/mariadb:latest"
    ),
    [switch]$Fetch = $true,
    [switch]$Json
)

$repoResults = @()

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

    $repoResults += [PSCustomObject]@{
        Repository        = $repoName
        Type              = "Git"
        Path              = $repo
        Remote            = $origin
        Branch            = $branch
        Commit            = $headSha
        Status            = $statusString
        Behind            = $behind
        Ahead             = $ahead
        LatestTag         = $latestUpstreamTag
        DirtyFiles        = $dirtyCount
        LastCommitMessage = $lastCommit
    }
}

# Audit Docker Images
$dockerResults = @()
$hasDocker = Get-Command docker -ErrorAction SilentlyContinue

if ($hasDocker) {
    $localImages = (docker images --format "{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedAt}}" 2>$null)

    foreach ($image in $DockerImages) {
        $localMatch = $localImages | Where-Object { $_ -like "$image*" } | Select-Object -First 1

        if ($localMatch) {
            $parts = $localMatch -split '\|'
            $imageId = $parts[1]
            $createdAt = $parts[2]

            $status = "INSTALLED"
            if ($Fetch) {
                # Test pull output
                $pullOutput = (docker pull $image 2>&1 | Out-String)
                if ($pullOutput -match "Downloaded newer image") {
                    $status = "UPDATED"
                } elseif ($pullOutput -match "Image is up to date") {
                    $status = "UP_TO_DATE"
                }
            }

            $dockerResults += [PSCustomObject]@{
                Image     = $image
                Type      = "Docker"
                Status    = $status
                ImageID   = $imageId
                CreatedAt = $createdAt
            }
        } else {
            $dockerResults += [PSCustomObject]@{
                Image     = $image
                Type      = "Docker"
                Status    = "NOT_INSTALLED"
                ImageID   = "N/A"
                CreatedAt = "N/A"
            }
        }
    }
}

if ($Json) {
    [PSCustomObject]@{
        GitRepositories = $repoResults
        DockerImages    = $dockerResults
    } | ConvertTo-Json -Depth 4
} else {
    Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host "                THIRD-PARTY REPOSITORIES (GIT)                                  " -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
    $repoResults | Format-Table -Property Repository, Status, Behind, Ahead, LatestTag, DirtyFiles, Commit -AutoSize

    Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host "                THIRD-PARTY DOCKER IMAGES                                       " -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
    $dockerResults | Format-Table -Property Image, Status, ImageID, CreatedAt -AutoSize

    Write-Host "Scan completed across $($repoResults.Count) Git repos and $($dockerResults.Count) Docker images.`n" -ForegroundColor Green
}
