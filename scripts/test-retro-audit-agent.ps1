#!/usr/bin/env pwsh
<# Regression checks for retro audit scheduling contracts. #>

$ErrorActionPreference = 'Stop'
$schedule = Get-Content (Join-Path $PSScriptRoot 'setup-retro-audit-schedule.ps1') -Raw
$workflow = Get-Content (Join-Path $PSScriptRoot '..\.github\workflows\retro-full-audit.yml') -Raw

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "FAIL: $Message" }
  Write-Host "PASS: $Message" -ForegroundColor Green
}

Assert-True ($schedule -match '-Execute "pwsh\.exe"') 'scheduled task uses PowerShell 7'
Assert-True ($schedule -match '-Daily') 'Windows scheduled task runs daily'
Assert-True ($schedule -notmatch '-Weekly') 'Windows scheduled task is not weekly'
Assert-True ($schedule -notmatch '-DaysOfWeek') 'Windows scheduled task is not day-of-week gated'
Assert-True ($schedule -match 'Daily retro history validation and audit report') 'scheduled task description says daily'
Assert-True ($workflow -match "cron:\s*'30 7 \* \* \*'") 'GitHub retro audit workflow runs daily'
Write-Host 'All retro audit schedule regression tests passed.' -ForegroundColor Green
