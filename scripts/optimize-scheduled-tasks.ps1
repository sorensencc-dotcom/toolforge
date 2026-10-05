<#
.SYNOPSIS
    Converts developer, bot, and background scheduled tasks to run 100% silently
    via wscript.exe and silent-run.vbs to prevent console windows and focus stealing.
#>

$backupFile = "C:\dev\config\scheduled-tasks-backup.json"
$silentRunner = "C:\dev\scripts\silent-run.vbs"

$taskPaths = @('\Ironbots\', '\CIC\', '\toolforge\', '\TRM\', '\KB-SYNC\', '\Claude\', '\Helix\', '\RewriteLabs\', '\Sigil\', '\IronLedger\', '\IronBot\')

# Resolve binary full paths
$pwshPath = "C:\Program Files\PowerShell\7\pwsh.exe"
$ps5Path  = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
$nodePath = "C:\Program Files\nodejs\node.exe"

$tasksToUpdate = Get-ScheduledTask | Where-Object {
    $match = $false
    foreach ($p in $taskPaths) {
        if ($_.TaskPath.StartsWith($p)) { $match = $true; break }
    }
    $match
}

Write-Host "Found $($tasksToUpdate.Count) scheduled tasks matching developer/bot paths."

# Backup current definitions
$backupData = @()
foreach ($t in $tasksToUpdate) {
    $backupData += [PSCustomObject]@{
        TaskName = $t.TaskName
        TaskPath = $t.TaskPath
        Execute  = $t.Actions.Execute
        Arguments= $t.Actions.Arguments
        WorkingDir = $t.Actions.WorkingDirectory
        LogonType = $t.Principal.LogonType
        TimeLimit = $t.Settings.ExecutionTimeLimit
    }
}
$backupData | ConvertTo-Json -Depth 5 | Set-Content -Path $backupFile -Encoding utf8
Write-Host "Backup saved to $backupFile"

foreach ($t in $tasksToUpdate) {
    $exec = $t.Actions.Execute
    $args = $t.Actions.Arguments
    $workingDir = $t.Actions.WorkingDirectory

    # If already using wscript.exe silent-run, skip
    if ($exec -match 'wscript\.exe' -and $args -match 'silent-run\.vbs') {
        Write-Host "Task $($t.TaskName) is already wrapped with silent-run." -ForegroundColor Gray
        continue
    }

    # Resolve executable
    $resolvedExec = $exec
    if ($exec -eq 'pwsh.exe' -or $exec -eq 'pwsh') {
        $resolvedExec = $pwshPath
    } elseif ($exec -eq 'powershell.exe' -or $exec -eq 'powershell') {
        $resolvedExec = $ps5Path
    } elseif ($exec -eq 'node.exe' -or $exec -eq 'node') {
        $resolvedExec = $nodePath
    }

    # Build silent invocation command
    $innerCmd = "`"$resolvedExec`" $args".Trim()
    $newExec = "wscript.exe"
    $newArgs = "//B //Nologo `"$silentRunner`" $innerCmd"

    $newAction = New-ScheduledTaskAction -Execute $newExec -Argument $newArgs
    if ($workingDir) {
        $newAction.WorkingDirectory = $workingDir
    }

    # Set safe settings (PT30M limit, restart count, ignore new if already running)
    $settings = $t.Settings
    if (-not $settings.ExecutionTimeLimit -or $settings.ExecutionTimeLimit -eq 'PT72H') {
        $settings.ExecutionTimeLimit = 'PT30M'
    }
    $settings.MultipleInstancesPolicy = [Microsoft.PowerShell.Cmdletization.GeneratedTypes.ScheduledTask.MultipleInstancesPolicy]::IgnoreNew

    try {
        Set-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -Action $newAction -Settings $settings -ErrorAction Stop | Out-Null
        Write-Host "Updated task: $($t.TaskPath)$($t.TaskName) -> Silent wrapper" -ForegroundColor Green
    } catch {
        Write-Warning "Failed to update $($t.TaskName): $_"
    }
}

Write-Host "Optimization complete."
