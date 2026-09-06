# scripts/install-sigil-service.ps1
$TaskName = "SigilMeshDaemon"
$ScriptPath = "C:\dev\scripts\run-sigil-daemon.ps1"
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

# Trigger on user logon
$Trigger = New-ScheduledTaskTrigger -AtLogOn

# Action: launch powershell headless
$Action = New-ScheduledTaskAction `
  -Execute "pwsh.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -File `"$ScriptPath`""

# Settings: restart on failure, run indefinitely
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Principal $Principal `
  -Trigger $Trigger `
  -Action $Action `
  -Settings $Settings `
  -Description "Persistent Sigil Relay & Loopback Connector Mesh Daemon" `
  -Force

Write-Output "Task '$TaskName' registered successfully."
