<#
.SYNOPSIS
  Conservative Node/Git process janitor for Toolforge Windows boxes.

.DESCRIPTION
  Detects orphaned and duplicate Node daemons that accumulate from Claude/Codex/
  agent session hooks, plus orphaned Git for Windows fsmonitor daemons, then
  optionally terminates them.

  Default mode is dry-run (list candidates only). Pass -Apply to kill.

  Rules:
    1. Kill node.exe whose parent PID is dead (orphans / parent-dead leftovers).
    2. Singleton classes — keep newest CreationDate only; mark older as
       duplicate-singleton:
         - dashboard-server
         - mcp-memory-server
         - ijfw-mcp-server  (paths containing mcp-server/src/server.js)
         - http-server
    3. Kill node --test / vitest workers older than -TestMaxAgeMinutes (default 30).
    4. Kill git.exe `fsmonitor--daemon` whose parent PID is dead (Task Manager
       shows these as "Git for Windows"; they stack for days after the parent
       git/IDE exits).

  Sigil-related node processes are left alone unless -IncludeSigil is set.

.PARAMETER Apply
  Actually terminate candidates. Without this switch, only prints candidates.

.PARAMETER IncludeSigil
  Include processes whose command line mentions sigil (default: excluded).

.PARAMETER TestMaxAgeMinutes
  Age threshold for hung node --test / vitest workers (default: 30).

.PARAMETER SkipGit
  Skip git fsmonitor orphan cleanup (included by default).

.EXAMPLE
  ./node-process-janitor.ps1
  ./node-process-janitor.ps1 -Apply
  ./node-process-janitor.ps1 -Apply -IncludeSigil
  ./node-process-janitor.ps1 -TestMaxAgeMinutes 60
  ./node-process-janitor.ps1 -Apply -SkipGit
#>

[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$IncludeSigil,
  [switch]$SkipGit,
  [ValidateRange(1, 24 * 60)]
  [int]$TestMaxAgeMinutes = 30
)

$ErrorActionPreference = 'Continue'

function Format-Age([TimeSpan]$span) {
  if ($span.TotalDays -ge 1) {
    return ('{0:N1}d' -f $span.TotalDays)
  }
  if ($span.TotalHours -ge 1) {
    return ('{0:N1}h' -f $span.TotalHours)
  }
  return ('{0:N0}m' -f $span.TotalMinutes)
}

function Test-IsSigilProcess([string]$cmd) {
  return ($cmd -match '(?i)\bsigil\b')
}

function Get-SingletonClass([string]$cmd) {
  if ($cmd -match '(?i)dashboard-server') { return 'dashboard-server' }
  if ($cmd -match '(?i)mcp-memory-server') { return 'mcp-memory-server' }
  if ($cmd -match '(?i)([/\\]\.ijfw[/\\]mcp-server|mcp-server[/\\]src[/\\]server\.js)') {
    return 'ijfw-mcp-server'
  }
  if ($cmd -match '(?i)([/\\]| )http-server(\.js|\.mjs|\.cjs)?(\s|$)') {
    return 'http-server'
  }
  return $null
}

function Test-IsTestWorker([string]$cmd) {
  return (
    $cmd -match '(?i)(^|\s)--test(\s|$)' -or
    $cmd -match '(?i)\bvitest\b' -or
    $cmd -match '(?i)[/\\]vitest[/\\]' -or
    $cmd -match '(?i)node_modules[/\\].*[/\\]vitest'
  )
}

function Test-IsGitFsmonitor([string]$cmd) {
  return ($cmd -match '(?i)fsmonitor--daemon')
}

function Get-LivePidSet {
  $set = @{}
  foreach ($p in Get-Process -ErrorAction SilentlyContinue) {
    $set[[int]$p.Id] = $true
  }
  return $set
}

function Convert-CreationDate($created, [datetime]$fallback) {
  if ($created -is [datetime]) { return $created }
  try {
    return [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$created)
  } catch {
    return $fallback
  }
}

Write-Host ''
Write-Host '=== Node/Git Process Janitor ===' -ForegroundColor Cyan
if ($Apply) {
  Write-Host 'Mode: APPLY (will terminate candidates)' -ForegroundColor Yellow
} else {
  Write-Host 'Mode: dry-run (pass -Apply to kill)' -ForegroundColor Green
}
Write-Host ("IncludeSigil: {0}" -f $(if ($IncludeSigil) { 'yes' } else { 'no (default)' }))
Write-Host ("SkipGit: {0}" -f $(if ($SkipGit) { 'yes' } else { 'no (fsmonitor orphans included)' }))
Write-Host ("TestMaxAgeMinutes: {0}" -f $TestMaxAgeMinutes)
Write-Host ''

$now = Get-Date
$livePids = Get-LivePidSet

$nodeProcs = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue)
$records = @()
foreach ($p in $nodeProcs) {
  $cmd = if ($p.CommandLine) { [string]$p.CommandLine } else { '' }
  $created = Convert-CreationDate $p.CreationDate $now
  $age = $now - $created
  $ppid = [int]$p.ParentProcessId
  $parentAlive = ($ppid -gt 0) -and $livePids.ContainsKey($ppid)

  $records += [pscustomobject]@{
    Pid            = [int]$p.ProcessId
    ParentPid      = $ppid
    ParentAlive    = $parentAlive
    Name           = 'node.exe'
    Cmd            = $cmd
    Created        = $created
    Age            = $age
    SingletonClass = Get-SingletonClass $cmd
    IsTestWorker   = Test-IsTestWorker $cmd
    IsSigil        = Test-IsSigilProcess $cmd
    IsGitFsmonitor = $false
  }
}

if (-not $SkipGit) {
  $gitProcs = @(Get-CimInstance Win32_Process -Filter "Name = 'git.exe'" -ErrorAction SilentlyContinue)
  foreach ($p in $gitProcs) {
    $cmd = if ($p.CommandLine) { [string]$p.CommandLine } else { '' }
    if (-not (Test-IsGitFsmonitor $cmd)) { continue }
    $created = Convert-CreationDate $p.CreationDate $now
    $age = $now - $created
    $ppid = [int]$p.ParentProcessId
    $parentAlive = ($ppid -gt 0) -and $livePids.ContainsKey($ppid)

    $records += [pscustomobject]@{
      Pid            = [int]$p.ProcessId
      ParentPid      = $ppid
      ParentAlive    = $parentAlive
      Name           = 'git.exe'
      Cmd            = $cmd
      Created        = $created
      Age            = $age
      SingletonClass = $null
      IsTestWorker   = $false
      IsSigil        = $false
      IsGitFsmonitor = $true
    }
  }
}

if ($records.Count -eq 0) {
  Write-Host 'No matching node.exe / git fsmonitor processes found.' -ForegroundColor DarkGray
  if ($Apply) {
    Write-Host 'killed_count: 0'
    Write-Host 'node_remaining: 0'
    Write-Host 'git_fsmonitor_remaining: 0'
  }
  exit 0
}

$candidateMap = @{}

function Add-Candidate {
  param(
    [int]$ProcessId,
    [string]$Reason,
    [string]$Class
  )
  if (-not $candidateMap.ContainsKey($ProcessId)) {
    $candidateMap[$ProcessId] = [pscustomobject]@{
      Pid     = $ProcessId
      Reasons = New-Object System.Collections.Generic.List[string]
      Class   = $Class
    }
  }
  if ($candidateMap[$ProcessId].Reasons -notcontains $Reason) {
    [void]$candidateMap[$ProcessId].Reasons.Add($Reason)
  }
  if ([string]::IsNullOrEmpty($candidateMap[$ProcessId].Class) -and $Class) {
    $candidateMap[$ProcessId].Class = $Class
  }
}

foreach ($r in $records) {
  if ($r.Name -eq 'node.exe' -and $r.IsSigil -and -not $IncludeSigil) {
    continue
  }

  # Rule 1: dead parent (node orphans)
  if ($r.Name -eq 'node.exe' -and -not $r.ParentAlive) {
    Add-Candidate -ProcessId $r.Pid -Reason 'orphan-dead-parent' -Class $(if ($r.SingletonClass) { $r.SingletonClass } else { 'orphan' })
  }

  # Rule 3: aged test/vitest workers
  if ($r.IsTestWorker -and $r.Age.TotalMinutes -ge $TestMaxAgeMinutes) {
    Add-Candidate -ProcessId $r.Pid -Reason ("test-worker-age>{0}m" -f $TestMaxAgeMinutes) -Class 'test-worker'
  }

  # Rule 4: orphaned git fsmonitor--daemon
  if ($r.IsGitFsmonitor -and -not $r.ParentAlive) {
    Add-Candidate -ProcessId $r.Pid -Reason 'orphan-dead-parent' -Class 'git-fsmonitor'
  }
}

# Rule 2: singleton duplicates (keep newest CreationDate) — node only
$singletonGroups = $records |
  Where-Object {
    $_.Name -eq 'node.exe' -and
    $_.SingletonClass -and
    ($IncludeSigil -or -not $_.IsSigil)
  } |
  Group-Object -Property SingletonClass

foreach ($g in $singletonGroups) {
  $ordered = @($g.Group | Sort-Object Created -Descending)
  if ($ordered.Count -le 1) { continue }
  $keep = $ordered[0]
  foreach ($dup in $ordered[1..($ordered.Count - 1)]) {
    Add-Candidate -ProcessId $dup.Pid -Reason 'duplicate-singleton' -Class $g.Name
  }
  Write-Host ("Singleton '{0}': keeping newest pid={1} (created {2:u})" -f $g.Name, $keep.Pid, $keep.Created) -ForegroundColor DarkGray
}

$recByPid = @{}
foreach ($r in $records) { $recByPid[$r.Pid] = $r }

$candidates = @(
  $candidateMap.Values |
    Sort-Object Pid |
    ForEach-Object {
      $rec = $recByPid[$_.Pid]
      [pscustomobject]@{
        Pid     = $_.Pid
        Reason  = ($_.Reasons -join ',')
        Class   = $_.Class
        Age     = Format-Age $rec.Age
        Name    = $rec.Name
        Cmd     = $(if ($rec.Cmd.Length -gt 120) { $rec.Cmd.Substring(0, 117) + '...' } else { $rec.Cmd })
        CmdFull = $rec.Cmd
      }
    }
)

$nodeTotal = @($records | Where-Object { $_.Name -eq 'node.exe' }).Count
$gitFsTotal = @($records | Where-Object { $_.IsGitFsmonitor }).Count

Write-Host ''
Write-Host ("Candidates: {0}  (node.exe: {1}, git fsmonitor: {2})" -f $candidates.Count, $nodeTotal, $gitFsTotal) -ForegroundColor Cyan

if ($candidates.Count -eq 0) {
  Write-Host 'Nothing to clean.' -ForegroundColor Green
  if ($Apply) {
    Write-Host 'killed_count: 0'
    Write-Host ("node_remaining: {0}" -f @(Get-Process -Name node -ErrorAction SilentlyContinue).Count)
    $gitLeft = @(Get-CimInstance Win32_Process -Filter "Name = 'git.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and ($_.CommandLine -match '(?i)fsmonitor--daemon') }).Count
    Write-Host ("git_fsmonitor_remaining: {0}" -f $gitLeft)
  }
  exit 0
}

$candidates | Format-Table -AutoSize Pid, Name, Reason, Class, Age, Cmd | Out-String | Write-Host

$killed = 0
$failed = 0
if ($Apply) {
  Write-Host 'Applying kills...' -ForegroundColor Yellow
  foreach ($c in $candidates) {
    try {
      Stop-Process -Id $c.Pid -Force -ErrorAction Stop
      Write-Host ("  killed pid={0} name={1} reason={2} class={3}" -f $c.Pid, $c.Name, $c.Reason, $c.Class) -ForegroundColor Red
      $killed++
    } catch {
      Write-Host ("  FAILED pid={0}: {1}" -f $c.Pid, $_.Exception.Message) -ForegroundColor Magenta
      $failed++
    }
  }
  Start-Sleep -Milliseconds 400
  $remaining = @(Get-Process -Name node -ErrorAction SilentlyContinue).Count
  $gitLeft = @(Get-CimInstance Win32_Process -Filter "Name = 'git.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match '(?i)fsmonitor--daemon') }).Count
  Write-Host ''
  Write-Host ("killed_count: {0}" -f $killed)
  if ($failed -gt 0) {
    Write-Host ("kill_failed: {0}" -f $failed)
  }
  Write-Host ("node_remaining: {0}" -f $remaining)
  Write-Host ("git_fsmonitor_remaining: {0}" -f $gitLeft)
} else {
  Write-Host 'Dry-run complete. Re-run with -Apply to terminate the candidates above.' -ForegroundColor Green
}

exit 0
