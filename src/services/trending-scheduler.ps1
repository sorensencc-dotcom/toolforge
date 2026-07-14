<#
.SYNOPSIS
  Register (or remove) the nightly trending-refresh Windows Scheduled Task.

.DESCRIPTION
  NOT AUTO-INSTALLED. Run manually in target env: `pwsh src/services/trending-scheduler.ps1`.

  Creates a Windows Scheduled Task that invokes `npm run trending:refresh`
  (-> src/services/trending-batch.js) once per day at 00:00 UTC.

  Uses the Schedule.Service COM object directly (native Task Scheduler 2.0 API),
  NOT schtasks.exe. This is the proven approach from the project memory
  (session-2026-07-12-wmi-solution.md): schtasks.exe hangs when driven from
  Node child_process, and Get-WmiObject Win32_ScheduledTask has incomplete
  property coverage. Schedule.Service is the object the ScheduledTask cmdlets
  wrap, so direct COM access is reliable here.

  Idempotent: unregisters an existing task of the same name before (re)creating
  it, so re-running never duplicates or errors.

.PARAMETER TaskName
  Scheduled Task name (default: "ToolforgeTrendingRefresh").

.PARAMETER RepoPath
  Absolute path to the repo root (working directory for `npm run`).
  Defaults to two levels up from this script (…\src\services -> repo root).

.PARAMETER DailyTimeUtc
  Time-of-day in UTC to run, "HH:mm" (default "00:00"). Converted to the box's
  local time at registration; see the DST note in docs/wave-d/TRENDING-SCHEDULER.md.

.PARAMETER Unregister
  Remove the task instead of creating it.

.EXAMPLE
  pwsh src/services/trending-scheduler.ps1
  pwsh src/services/trending-scheduler.ps1 -DailyTimeUtc "00:00"
  pwsh src/services/trending-scheduler.ps1 -Unregister
#>

[CmdletBinding()]
param(
  [string]$TaskName = "ToolforgeTrendingRefresh",
  [string]$RepoPath,
  [string]$DailyTimeUtc = "00:00",
  [switch]$Unregister
)

$ErrorActionPreference = "Stop"

# TASK_TRIGGER_DAILY = 2, TASK_ACTION_EXEC = 0
# RegisterTaskDefinition flags: TASK_CREATE_OR_UPDATE = 6
# Logon type: TASK_LOGON_INTERACTIVE_TOKEN = 3
$TASK_TRIGGER_DAILY = 2
$TASK_ACTION_EXEC = 0
$TASK_CREATE_OR_UPDATE = 6
$TASK_LOGON_INTERACTIVE_TOKEN = 3
$TASK_FOLDER = "\"

# Resolve repo root: default to <scriptdir>\..\.. (src\services -> repo root).
if (-not $RepoPath -or $RepoPath.Trim() -eq "") {
  $RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
if (-not (Test-Path $RepoPath)) {
  throw "RepoPath does not exist: $RepoPath"
}

# Connect to the Task Scheduler service via COM.
$service = New-Object -ComObject "Schedule.Service"
$service.Connect()
$rootFolder = $service.GetFolder($TASK_FOLDER)

function Remove-ExistingTask {
  param($Folder, $Name)
  try {
    # DeleteTask throws if the task does not exist; treat that as a no-op.
    $Folder.DeleteTask($Name, 0)
    Write-Host "Removed existing task: $Name"
    return $true
  } catch {
    return $false
  }
}

if ($Unregister) {
  $removed = Remove-ExistingTask -Folder $rootFolder -Name $TaskName
  if ($removed) {
    Write-Host "Unregistered scheduled task '$TaskName'."
  } else {
    Write-Host "No scheduled task named '$TaskName' was found. Nothing to do."
  }
  return
}

# --- Register (idempotent: delete-if-exists, then create) ---

# Compute the local StartBoundary that corresponds to today's DailyTimeUtc.
$parts = $DailyTimeUtc.Split(":")
if ($parts.Count -ne 2) { throw "DailyTimeUtc must be 'HH:mm' (got '$DailyTimeUtc')." }
$utcHour = [int]$parts[0]
$utcMinute = [int]$parts[1]

$nowUtc = [DateTime]::UtcNow
$todayUtcMidnight = [DateTime]::new($nowUtc.Year, $nowUtc.Month, $nowUtc.Day, $utcHour, $utcMinute, 0, [DateTimeKind]::Utc)
$startLocal = $todayUtcMidnight.ToLocalTime()
# Task Scheduler StartBoundary is local ISO8601 without timezone suffix.
$startBoundary = $startLocal.ToString("yyyy-MM-ddTHH:mm:ss")

# Idempotency: remove any prior registration first.
Remove-ExistingTask -Folder $rootFolder -Name $TaskName | Out-Null

$taskDef = $service.NewTask(0)

$reg = $taskDef.RegistrationInfo
$reg.Description = "Nightly Toolforge marketplace trending refresh (npm run trending:refresh). Registered by trending-scheduler.ps1."
$reg.Author = "CIC Team"

$settings = $taskDef.Settings
$settings.Enabled = $true
$settings.StartWhenAvailable = $true      # run after a missed window (box asleep at 00:00)
$settings.DisallowStartIfOnBatteries = $false
$settings.StopIfGoingOnBatteries = $false
$settings.ExecutionTimeLimit = "PT1H"     # kill a hung refresh after 1 hour
$settings.MultipleInstances = 2           # IgnoreNew: don't stack overlapping runs

$trigger = $taskDef.Triggers.Create($TASK_TRIGGER_DAILY)
$trigger.StartBoundary = $startBoundary
$trigger.DaysInterval = 1
$trigger.Enabled = $true

# Action: run `npm run trending:refresh` in the repo dir via cmd.exe.
# npm resolves to npm.cmd on Windows; cmd.exe /c is the reliable launcher.
$action = $taskDef.Actions.Create($TASK_ACTION_EXEC)
$action.Path = "$env:SystemRoot\System32\cmd.exe"
$action.Arguments = "/c npm run trending:refresh"
$action.WorkingDirectory = $RepoPath

# Register under the current interactive user token.
$null = $rootFolder.RegisterTaskDefinition(
  $TaskName,
  $taskDef,
  $TASK_CREATE_OR_UPDATE,
  $null,   # user (null -> current user)
  $null,   # password
  $TASK_LOGON_INTERACTIVE_TOKEN
)

Write-Host "Registered scheduled task '$TaskName'."
Write-Host "  Command:   cmd.exe /c npm run trending:refresh"
Write-Host "  WorkingDir: $RepoPath"
Write-Host "  Daily at:   $DailyTimeUtc UTC  (local StartBoundary: $startBoundary)"
Write-Host "  Verify:     Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host "  Rollback:   pwsh src/services/trending-scheduler.ps1 -Unregister"
