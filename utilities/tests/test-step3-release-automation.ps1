<#
.SYNOPSIS
  Unit + integration tests for Phase 2b Step 3: bump-version.ps1 and
  generate-changelog.ps1. No external test framework — plain assertions,
  matching the inline Assert-Equal style used in the Phase 2b plan's TEST
  STRATEGY section. Exits 1 on any failure so it can gate a commit.

.EXAMPLE
  pwsh -NoProfile -File C:\dev\toolforge\utilities\tests\test-step3-release-automation.ps1
#>

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $PSCommandPath
$utilRoot = Split-Path -Parent $here
$bumpScript = Join-Path $utilRoot "bump-version.ps1"
$changelogScript = Join-Path $utilRoot "generate-changelog.ps1"

$script:pass = 0
$script:fail = 0

function Assert-Equal {
  param($Actual, $Expected, [string]$Label)
  if ("$Actual" -eq "$Expected") {
    Write-Host "  PASS: $Label" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "  FAIL: $Label -- expected [$Expected] got [$Actual]" -ForegroundColor Red
    $script:fail++
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Label)
  if ($Condition) {
    Write-Host "  PASS: $Label" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "  FAIL: $Label" -ForegroundColor Red
    $script:fail++
  }
}

$tmpRoot = Join-Path $env:TEMP "toolforge-step3-tests-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null

try {
  # ============================================================
  # bump-version.ps1
  # ============================================================
  Write-Host "`n--- bump-version.ps1 ---" -ForegroundColor Cyan

  function New-TestVersionFile([string]$Version, [string]$Date = "2020-01-01") {
    $path = Join-Path $tmpRoot "VERSION-$([guid]::NewGuid().ToString('N')).md"
    Set-Content -Path $path -Value "version: $Version`ndate: $Date" -NoNewline -Encoding utf8
    return $path
  }

  # patch bump
  $vf = New-TestVersionFile "1.2.3"
  $out = & $bumpScript -BumpType patch -VersionFile $vf
  $content = Get-Content $vf -Raw
  Assert-Equal $out "1.2.4" "patch bump returns 1.2.4"
  Assert-True ($content -match "(?m)^version:\s*1\.2\.4\s*$") "patch bump writes version line"
  Assert-True ($content -match "(?m)^date:\s*$(Get-Date -Format 'yyyy-MM-dd')\s*$") "patch bump updates date to today"

  # minor bump resets patch
  $vf = New-TestVersionFile "1.2.3"
  $out = & $bumpScript -BumpType minor -VersionFile $vf
  Assert-Equal $out "1.3.0" "minor bump resets patch to 0"

  # major bump resets minor+patch
  $vf = New-TestVersionFile "1.2.3"
  $out = & $bumpScript -BumpType major -VersionFile $vf
  Assert-Equal $out "2.0.0" "major bump resets minor+patch to 0"

  # default BumpType is patch
  $vf = New-TestVersionFile "0.0.1"
  $out = & $bumpScript -VersionFile $vf
  Assert-Equal $out "0.0.2" "default BumpType is patch"

  # only touches the version/date lines, preserves other content
  $vf = Join-Path $tmpRoot "VERSION-preserve.md"
  Set-Content -Path $vf -Value "version: 1.0.0`ndate: 2020-01-01`nnotes: keep me" -NoNewline -Encoding utf8
  & $bumpScript -BumpType patch -VersionFile $vf | Out-Null
  $content = Get-Content $vf -Raw
  Assert-True ($content -match "notes: keep me") "bump preserves unrelated content lines"

  # missing file -> exit 1, no crash
  $missing = Join-Path $tmpRoot "does-not-exist.md"
  & $bumpScript -VersionFile $missing 2>$null | Out-Null
  Assert-Equal $LASTEXITCODE 1 "missing VersionFile exits 1"

  # malformed file -> exit 1, no crash
  $malformed = Join-Path $tmpRoot "malformed.md"
  Set-Content -Path $malformed -Value "not a version file" -Encoding utf8
  & $bumpScript -VersionFile $malformed 2>$null | Out-Null
  Assert-Equal $LASTEXITCODE 1 "malformed VersionFile exits 1"

  # ============================================================
  # generate-changelog.ps1 — isolated throwaway git repos
  # ============================================================
  Write-Host "`n--- generate-changelog.ps1 ---" -ForegroundColor Cyan

  function New-TestRepo([string]$Name) {
    $repoPath = Join-Path $tmpRoot $Name
    New-Item -ItemType Directory -Path $repoPath -Force | Out-Null
    git -C $repoPath init -q -b main
    git -C $repoPath config user.email "test@toolforge.local"
    git -C $repoPath config user.name "Toolforge Test"
    return $repoPath
  }

  # Repo A: two commits, no tags -> full history, no "no changes" fallback
  $repoA = New-TestRepo "repoA"
  Set-Content -Path (Join-Path $repoA "a.txt") -Value "1" -Encoding utf8
  git -C $repoA add a.txt | Out-Null
  git -C $repoA commit -q -m "feat: first commit" | Out-Null
  Set-Content -Path (Join-Path $repoA "a.txt") -Value "2" -Encoding utf8
  git -C $repoA add a.txt | Out-Null
  git -C $repoA commit -q -m "fix: second commit" | Out-Null

  $vfA = Join-Path $tmpRoot "VERSION-A.md"
  Set-Content -Path $vfA -Value "version: 9.9.1`ndate: 2020-01-01" -NoNewline -Encoding utf8
  $chA = Join-Path $tmpRoot "CHANGELOG-A.md"

  & $changelogScript -OutputFile $chA -VersionFile $vfA -RepoRoot $repoA
  $bodyA = Get-Content $chA -Raw
  Assert-True ($bodyA -match "## Version 9\.9\.1") "no-tag repo: entry header present"
  Assert-True ($bodyA -match "feat: first commit") "no-tag repo: includes first commit"
  Assert-True ($bodyA -match "fix: second commit") "no-tag repo: includes second commit"
  Assert-True ($bodyA -notmatch "No changes recorded") "no-tag repo: does not show fallback text"

  # Repo B: tag at commit 2, one commit after -> range should show only the 3rd commit
  $repoB = New-TestRepo "repoB"
  Set-Content -Path (Join-Path $repoB "b.txt") -Value "1" -Encoding utf8
  git -C $repoB add b.txt | Out-Null
  git -C $repoB commit -q -m "chore: init" | Out-Null
  git -C $repoB tag v1.0.0
  Set-Content -Path (Join-Path $repoB "b.txt") -Value "2" -Encoding utf8
  git -C $repoB add b.txt | Out-Null
  git -C $repoB commit -q -m "feat: after tag" | Out-Null

  $vfB = Join-Path $tmpRoot "VERSION-B.md"
  Set-Content -Path $vfB -Value "version: 1.1.0`ndate: 2020-01-01" -NoNewline -Encoding utf8
  $chB = Join-Path $tmpRoot "CHANGELOG-B.md"

  & $changelogScript -OutputFile $chB -VersionFile $vfB -RepoRoot $repoB
  $bodyB = Get-Content $chB -Raw
  Assert-True ($bodyB -match "feat: after tag") "tagged repo: includes post-tag commit"
  Assert-True ($bodyB -notmatch "chore: init") "tagged repo: excludes pre-tag commit"

  # Repo C: tag exactly at HEAD -> zero commits since tag -> fallback text
  $repoC = New-TestRepo "repoC"
  Set-Content -Path (Join-Path $repoC "c.txt") -Value "1" -Encoding utf8
  git -C $repoC add c.txt | Out-Null
  git -C $repoC commit -q -m "chore: only commit" | Out-Null
  git -C $repoC tag v1.0.0

  $vfC = Join-Path $tmpRoot "VERSION-C.md"
  Set-Content -Path $vfC -Value "version: 1.0.1`ndate: 2020-01-01" -NoNewline -Encoding utf8
  $chC = Join-Path $tmpRoot "CHANGELOG-C.md"

  & $changelogScript -OutputFile $chC -VersionFile $vfC -RepoRoot $repoC
  $bodyC = Get-Content $chC -Raw
  Assert-True ($bodyC -match "No changes recorded") "zero-commits-since-tag: shows fallback text"

  # Idempotent header handling: run twice against repo A's changelog, expect
  # exactly ONE '# Changelog' H1 and entries stacked newest-first.
  & $changelogScript -OutputFile $chA -VersionFile $vfA -RepoRoot $repoA
  $bodyA2 = Get-Content $chA -Raw
  $headingMatches = [regex]::Matches($bodyA2, '(?m)^# Changelog\s*$')
  Assert-Equal $headingMatches.Count 1 "repeated runs: exactly one '# Changelog' H1"
  $firstHeadingIdx = $bodyA2.IndexOf("# Changelog")
  $firstVersionIdx = $bodyA2.IndexOf("## Version 9.9.1")
  Assert-True ($firstHeadingIdx -lt $firstVersionIdx) "H1 stays above version sections after repeat run"

  # Prepending onto an existing real-format CHANGELOG.md (with H1 already
  # present) does not duplicate or relocate the H1.
  $chExisting = Join-Path $tmpRoot "CHANGELOG-existing.md"
  Set-Content -Path $chExisting -Value "# Changelog`n`n## Version 0.1.0`nDate: 2019-01-01`n`n### Changes`n- initial`n" -Encoding utf8
  & $changelogScript -OutputFile $chExisting -VersionFile $vfA -RepoRoot $repoA
  $bodyExisting = Get-Content $chExisting -Raw
  $headingMatches2 = [regex]::Matches($bodyExisting, '(?m)^# Changelog\s*$')
  Assert-Equal $headingMatches2.Count 1 "existing CHANGELOG.md: H1 not duplicated"
  Assert-True ($bodyExisting -match "## Version 0\.1\.0") "existing CHANGELOG.md: prior entry preserved"
  $idxNew = $bodyExisting.IndexOf("## Version 9.9.1")
  $idxOld = $bodyExisting.IndexOf("## Version 0.1.0")
  Assert-True ($idxNew -lt $idxOld) "existing CHANGELOG.md: newest entry above older entry"

} finally {
  Remove-Item -Path $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n=== Step 3 test summary: $script:pass passed, $script:fail failed ===" -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Red" })
if ($script:fail -gt 0) { exit 1 }
exit 0
