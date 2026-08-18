#!/usr/bin/env pwsh
<#
.SYNOPSIS
Retro Audit Agent
Validates retro history and generates audit findings report.

.DESCRIPTION
Runs validation against .context/retros/*.json and executes generate-retro-audit-report.ps1
for the latest retro file. Writes results to logs/retro-audit-YYYYMMDD.log.
#>

param(
  [string]$RepoRoot = "C:\dev",
  [DateTime]$AgentStartTime = (Get-Date),
  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

$retrosDir = Join-Path $RepoRoot ".context\retros"
$logsDir = Join-Path $RepoRoot "logs"

if (-not (Test-Path $logsDir)) {
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
}

$dateStamp = $AgentStartTime.ToString("yyyyMMdd")
$logPath = Join-Path $logsDir "retro-audit-$dateStamp.log"

$startTimeStr = $AgentStartTime.ToString("yyyy-MM-dd HH:mm:ss")
Write-Output "[$startTimeStr] [INFO] === Retro Audit Pipeline Started ===" | Tee-Object -FilePath $logPath

try {
  # Step 1: Validate
  Write-Output "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [INFO] Running validator..." | Tee-Object -FilePath $logPath -Append
  $validateScript = Join-Path $retrosDir "validate.ps1"
  if (Test-Path $validateScript) {
    & pwsh -NoProfile -ExecutionPolicy Bypass -File $validateScript | Tee-Object -FilePath $logPath -Append
  }

  # Step 2: Identify latest retro
  $latest = Get-ChildItem $retrosDir -Filter '*.json' |
    Where-Object { $_.Name -ne 'retro.schema.json' } |
    Sort-Object Name | Select-Object -Last 1

  if (-not $latest) {
    throw "No retro JSON files found in $retrosDir"
  }

  # Step 3: Run Audit Reporter
  Write-Output "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [INFO] Running audit reporter for $($latest.Name)..." | Tee-Object -FilePath $logPath -Append
  $reporterScript = Join-Path $RepoRoot "scripts\generate-retro-audit-report.ps1"
  & pwsh -NoProfile -ExecutionPolicy Bypass -File $reporterScript -RetroFile $latest.Name -Path $retrosDir | Tee-Object -FilePath $logPath -Append

  Write-Output "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [INFO] === Retro Audit Pipeline Complete ===" | Tee-Object -FilePath $logPath -Append
  exit 0
} catch {
  Write-Output "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [ERROR] Pipeline failed: $_" | Tee-Object -FilePath $logPath -Append
  exit 1
}
