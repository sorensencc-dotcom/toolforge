# =====================================================================
# CIC-WHICHLLM Weekly Model Upgrade Sweep Runner
# Scheduled Task: \CIC\CIC-WhichLLM-Weekly-Sweep (Sundays 09:00 AM)
# =====================================================================

$ErrorActionPreference = "Continue"
$RootPath = "C:\dev\CIC-GOVERNANCE"
$LogPath = "$RootPath\logs\weekly-sweep-latest.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Output "[$Timestamp] Starting CIC-WHICHLLM Weekly Upgrade Sweep..." | Out-File -FilePath $LogPath -Encoding utf8

Set-Location -Path $RootPath

# Execute weekly sweep via npm
$output = npm run sweep:whichllm 2>&1

$output | Out-File -FilePath $LogPath -Append -Encoding utf8

Write-Output "[$Timestamp] Sweep execution finished." | Out-File -FilePath $LogPath -Append -Encoding utf8
