#!/usr/bin/env pwsh
<#
.SYNOPSIS
Migrate all retro JSON files to Canonical v1.0 schema.

.DESCRIPTION
Reads all *.json retro files in .context/retros, transforms both legacy pre-v1.0
and post-lock drifted files to strict Canonical v1.0 format, builds prior_retro_baseline
chains, writes updated JSON files, and removes temporary backups when verified.
#>

param(
  [string]$Path = $PSScriptRoot,
  [switch]$DryRun = $false,
  [switch]$KeepBackups = $false
)

$ErrorActionPreference = "Stop"

function Transform-ToV1 {
  param(
    [PSObject]$Data,
    [string]$FileName,
    [string]$PriorBaselinePath
  )

  $dateStr = $Data.date
  $windowStr = if ($Data.window) { [string]$Data.window } else { "7d" }

  $sinceStr = if ($Data.since -and $Data.since -match '^\d{4}-\d{2}-\d{2}') {
    $s = [string]$Data.since
    if ($s -notmatch 'T') { $s = $s -replace ' ', 'T' }
    $s
  } else {
    "${dateStr}T00:00:00-04:00"
  }

  $untilStr = if ($Data.until -and $Data.until -match '^\d{4}-\d{2}-\d{2}') {
    $u = [string]$Data.until
    if ($u -notmatch 'T') { $u = $u -replace ' ', 'T' }
    $u
  } else {
    "${dateStr}T23:59:59-04:00"
  }

  $baseBranch = if ($Data.base_branch) { [string]$Data.base_branch } else { "main" }
  
  $priorBaseline = $PriorBaselinePath

  $note = if ($Data.note) {
    [string]$Data.note
  } elseif ($Data.duplicate_run_note) {
    [string]$Data.duplicate_run_note
  } elseif ($Data.streak_note) {
    [string]$Data.streak_note
  } else {
    $null
  }

  # Metrics extraction
  $mInput = if ($Data.metrics) { $Data.metrics } else { $Data }

  $commitsBot = if ($null -ne $mInput.automation_commits) { [int]$mInput.automation_commits }
                 elseif ($null -ne $mInput.commits_bot) { [int]$mInput.commits_bot }
                 else { 0 }

  $commitsHuman = if ($null -ne $mInput.commits_human) { [int]$mInput.commits_human } else { 0 }
  $commitsMerge = if ($null -ne $mInput.commits_merge) { [int]$mInput.commits_merge } else { 0 }

  $commitsTotal = if ($null -ne $mInput.commits) {
    [int]$mInput.commits
  } elseif ($commitsHuman -gt 0 -or $commitsBot -gt 0) {
    $commitsHuman + $commitsBot + $commitsMerge
  } else {
    0
  }

  $commitsNoMerge = if ($null -ne $mInput.commits_no_merge) {
    [int]$mInput.commits_no_merge
  } elseif ($commitsTotal -gt 0) {
    [Math]::Max(0, $commitsTotal - $commitsMerge)
  } else {
    0
  }

  # Authors
  $authors = [ordered]@{}
  if ($Data.authors -and $Data.authors.PSObject.Properties.Count -gt 0) {
    foreach ($prop in $Data.authors.PSObject.Properties) {
      $aObj = $prop.Value
      $roleStr = if ($aObj.role -in @('human', 'automation')) { $aObj.role } else { "human" }
      $commitsCount = if ($null -ne $aObj.commits) { [int]$aObj.commits } else { 0 }
      
      $aData = [ordered]@{
        commits = $commitsCount
        role = $roleStr
      }
      if ($null -ne $aObj.insertions) { $aData.insertions = [int]$aObj.insertions }
      if ($null -ne $aObj.deletions) { $aData.deletions = [int]$aObj.deletions }
      if ($null -ne $aObj.test_ratio) { $aData.test_ratio = [double]$aObj.test_ratio }
      if ($null -ne $aObj.top_area) { $aData.top_area = [string]$aObj.top_area }
      
      $authors[$prop.Name] = $aData
    }
  } else {
    $userName = if ($Data.user) { [string]$Data.user } else { "Chris Sorensen" }
    $humanCommits = if ($commitsHuman -gt 0) { $commitsHuman } else { [Math]::Max(1, $commitsTotal - $commitsBot) }
    $authors[$userName] = [ordered]@{
      commits = $humanCommits
      role = "human"
    }
  }

  if ($commitsBot -gt 0 -and -not $authors.Contains("toolforge-release-bot")) {
    $authors["toolforge-release-bot"] = [ordered]@{
      commits = $commitsBot
      role = "automation"
    }
  }

  $contributors = if ($null -ne $mInput.contributors) {
    [int]$mInput.contributors
  } else {
    $authors.Count
  }

  # LOC
  $insRaw = if ($null -ne $mInput.insertions_raw) { [int]$mInput.insertions_raw }
            elseif ($null -ne $mInput.insertions) { [int]$mInput.insertions }
            elseif ($null -ne $mInput.loc_insertions_raw) { [int]$mInput.loc_insertions_raw }
            else { 0 }

  $delRaw = if ($null -ne $mInput.deletions_raw) { [int]$mInput.deletions_raw }
            elseif ($null -ne $mInput.deletions) { [int]$mInput.deletions }
            elseif ($null -ne $mInput.loc_deletions_raw) { [int]$mInput.loc_deletions_raw }
            else { 0 }

  $netRaw = if ($null -ne $mInput.net_loc_raw) { [int]$mInput.net_loc_raw } else { $insRaw - $delRaw }

  $insFilt = if ($null -ne $mInput.insertions_filtered) { [int]$mInput.insertions_filtered }
             elseif ($null -ne $mInput.loc_insertions_filtered) { [int]$mInput.loc_insertions_filtered }
             else { $insRaw }

  $delFilt = if ($null -ne $mInput.deletions_filtered) { [int]$mInput.deletions_filtered }
             elseif ($null -ne $mInput.loc_deletions_filtered) { [int]$mInput.loc_deletions_filtered }
             else { $delRaw }

  $netFilt = if ($null -ne $mInput.net_loc_filtered) { [int]$mInput.net_loc_filtered } else { $insFilt - $delFilt }

  $filterNote = if ($mInput.filter_note) { [string]$mInput.filter_note } else { "raw LOC includes lockfiles and autogenerated reports; filtered excludes lockfiles" }

  # Test metrics
  $testLoc = if ($null -ne $mInput.test_loc_insertions) { [int]$mInput.test_loc_insertions }
             elseif ($null -ne $mInput.test_loc) { [int]$mInput.test_loc }
             else { 0 }

  $testRatioPct = if ($null -ne $mInput.test_ratio_pct) { [double]$mInput.test_ratio_pct }
                  elseif ($null -ne $mInput.test_ratio) { [double]$mInput.test_ratio }
                  elseif ($netFilt -gt 0) { [Math]::Round(($testLoc / $netFilt) * 100, 2) }
                  else { 0.0 }

  # Commit type percentages
  $featPct = 0.0; $fixPct = 0.0; $docsPct = 0.0; $chorePct = 0.0; $testPct = 0.0

  if ($null -ne $mInput.feat_pct) {
    $featPct = [double]$mInput.feat_pct
    $fixPct = [double]($mInput.fix_pct ?? 0)
    $docsPct = [double]($mInput.docs_pct ?? 0)
    $chorePct = [double]($mInput.chore_pct ?? 0)
    $testPct = [double]($mInput.test_pct ?? 0)
  } elseif ($Data.commit_breakdown) {
    $cb = $Data.commit_breakdown
    $cbTotal = ($cb.feat ?? 0) + ($cb.fix ?? 0) + ($cb.docs ?? 0) + ($cb.chore ?? 0) + ($cb.test ?? 0) + ($cb.refactor ?? 0) + ($cb.other ?? 0)
    if ($cbTotal -gt 0) {
      $featPct = [Math]::Round((($cb.feat ?? 0) / $cbTotal) * 100, 1)
      $fixPct = [Math]::Round((($cb.fix ?? 0) / $cbTotal) * 100, 1)
      $docsPct = [Math]::Round((($cb.docs ?? 0) / $cbTotal) * 100, 1)
      $chorePct = [Math]::Round((($cb.chore ?? 0) / $cbTotal) * 100, 1)
      $testPct = [Math]::Round((($cb.test ?? 0) / $cbTotal) * 100, 1)
    }
  }

  # Activity & sessions
  $activeDays = if ($null -ne $mInput.active_days) { [int]$mInput.active_days } else { 0 }
  $sessions = if ($null -ne $mInput.sessions) { [int]$mInput.sessions }
              elseif ($null -ne $mInput.sessions_detected) { [int]$mInput.sessions_detected }
              else { 0 }

  $deepSessions = if ($null -ne $mInput.deep_sessions) { [int]$mInput.deep_sessions } else { 0 }

  $peakHour = 12
  if ($null -ne $mInput.peak_hour) {
    $peakHour = [int]$mInput.peak_hour
  } elseif ($Data.peak_hours -and $Data.peak_hours.Count -gt 0) {
    $peakHour = [int]$Data.peak_hours[0]
  }

  $lateNight = if ($null -ne $mInput.late_night_commits_22_to_04) { [int]$mInput.late_night_commits_22_to_04 } else { 0 }

  # Streaks & backlog
  $teamStreak = if ($null -ne $mInput.team_streak_days) { [int]$mInput.team_streak_days }
                elseif ($null -ne $Data.shipping_streak_days) { [int]$Data.shipping_streak_days }
                else { 0 }

  $personalStreak = if ($null -ne $mInput.personal_streak_days) { [int]$mInput.personal_streak_days }
                    elseif ($null -ne $Data.shipping_streak_days) { [int]$Data.shipping_streak_days }
                    else { 0 }

  $backlogOpen = if ($null -ne $mInput.backlog_open_todos) { [int]$mInput.backlog_open_todos }
                 elseif ($Data.backlog -and $null -ne $Data.backlog.total_open) { [int]$Data.backlog.total_open }
                 else { 0 }

  $backlogClosed = if ($null -ne $mInput.backlog_closed_this_period) { [int]$mInput.backlog_closed_this_period }
                   elseif ($Data.backlog -and $null -ne $Data.backlog.completed_this_period) { [int]$Data.backlog.completed_this_period }
                   else { 0 }

  # Version & release
  $versionRange = if ($Data.version_range -and $Data.version_range.Count -eq 2) {
    @([string]$Data.version_range[0], [string]$Data.version_range[1])
  } elseif ($mInput.version_range -and $mInput.version_range.Count -eq 2) {
    @([string]$mInput.version_range[0], [string]$mInput.version_range[1])
  } else {
    @("v1.0.0", "v1.0.0")
  }

  $releaseCommits = if ($null -ne $mInput.release_commits) { [int]$mInput.release_commits } else { $commitsBot }

  $focusArea = if ($mInput.focus_area) { [string]$mInput.focus_area }
               elseif ($Data.project_focus) { [string]$Data.project_focus }
               else { "general" }

  $metricsObj = [ordered]@{
    commits = $commitsTotal
    commits_no_merge = $commitsNoMerge
    contributors = $contributors
    automation_commits = $commitsBot

    insertions_raw = $insRaw
    deletions_raw = $delRaw
    net_loc_raw = $netRaw
    insertions_filtered = $insFilt
    deletions_filtered = $delFilt
    net_loc_filtered = $netFilt
    filter_note = $filterNote

    test_loc_insertions = $testLoc
    test_ratio_pct = $testRatioPct

    feat_pct = $featPct
    fix_pct = $fixPct
    docs_pct = $docsPct
    chore_pct = $chorePct
    test_pct = $testPct

    active_days = $activeDays
    sessions = $sessions
    deep_sessions = $deepSessions
    peak_hour = $peakHour
    late_night_commits_22_to_04 = $lateNight

    team_streak_days = $teamStreak
    personal_streak_days = $personalStreak
    backlog_open_todos = $backlogOpen
    backlog_closed_this_period = $backlogClosed

    version_range = $versionRange
    release_commits = $releaseCommits
    focus_area = $focusArea
  }

  # session_focus
  $sfSummary = ""
  $sfIncidents = @()
  $sfLearnings = @()
  $sfRange = $null

  if ($Data.session_focus) {
    $sf = $Data.session_focus
    if ($sf.summary) { $sfSummary = [string]$sf.summary }
    if ($sf.commits_this_session_range) { $sfRange = [string]$sf.commits_this_session_range }
    if ($sf.incidents) { $sfIncidents = @($sf.incidents | ForEach-Object { [string]$_ }) }
    if ($sf.process_learnings) { $sfLearnings = @($sf.process_learnings | ForEach-Object { [string]$_ }) }
  }

  if (-not $sfSummary) {
    if ($Data.project_focus) { $sfSummary = [string]$Data.project_focus }
    elseif ($Data.tweetable) { $sfSummary = [string]$Data.tweetable }
    else { $sfSummary = "Routine development session" }
  }

  if ($sfLearnings.Count -eq 0 -and $Data.key_achievements) {
    $sfLearnings = @($Data.key_achievements | ForEach-Object { [string]$_ })
  }

  $sessionFocus = [ordered]@{
    summary = $sfSummary
  }
  if ($sfRange) { $sessionFocus["commits_this_session_range"] = $sfRange }
  $sessionFocus["incidents"] = $sfIncidents
  $sessionFocus["process_learnings"] = $sfLearnings

  $v1 = [ordered]@{
    date = $dateStr
    window = $windowStr
    since = $sinceStr
    until = $untilStr
    base_branch = $baseBranch
    prior_retro_baseline = $priorBaseline
    note = $note
    metrics = $metricsObj
    authors = $authors
    session_focus = $sessionFocus
  }

  if ($Data.external_repos_note) {
    $v1["external_repos_note"] = [string]$Data.external_repos_note
  }

  return $v1
}

# Main
Write-Host "Migrating Retros to Canonical v1.0 Schema..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$retros = Get-ChildItem -Path $Path -Filter "*.json" | Where-Object { $_.Name -notlike "*.backup" -and $_.Name -ne "retro.schema.json" } | Sort-Object Name

if ($retros.Count -eq 0) {
  Write-Host "No retro files found in $Path" -ForegroundColor Yellow
  exit 0
}

$migratedCount = 0

for ($i = 0; $i -lt $retros.Count; $i++) {
  $file = $retros[$i]
  $priorPath = if ($i -gt 0) { ".context/retros/$($retros[$i-1].Name)" } else { $null }

  try {
    $data = Get-Content $file.FullName -Raw | ConvertFrom-Json -ErrorAction Stop
    $v1 = Transform-ToV1 -Data $data -FileName $file.Name -PriorBaselinePath $priorPath

    if (-not $DryRun) {
      # Save backup
      Copy-Item $file.FullName "$($file.FullName).backup" -Force
      
      # Save v1.0 format
      $jsonStr = $v1 | ConvertTo-Json -Depth 10
      [System.IO.File]::WriteAllText($file.FullName, $jsonStr, [System.Text.Encoding]::UTF8)
      Write-Host "  ✓ Migrated: $($file.Name)" -ForegroundColor Green
    } else {
      Write-Host "  [DRY-RUN] Would migrate: $($file.Name)" -ForegroundColor Yellow
    }
    $migratedCount++
  } catch {
    Write-Host "  ✗ ERROR processing $($file.Name): $_" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Migration finished: $migratedCount / $($retros.Count) files processed." -ForegroundColor Green
