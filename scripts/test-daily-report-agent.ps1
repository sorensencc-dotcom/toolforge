#!/usr/bin/env pwsh
<# Regression checks for Windows-native stderr handling in daily-report-agent. #>

$ErrorActionPreference = 'Stop'
$agent = Get-Content (Join-Path $PSScriptRoot 'daily-report-agent.ps1') -Raw
$schedule = Get-Content (Join-Path $PSScriptRoot 'setup-daily-report-schedule.ps1') -Raw

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "FAIL: $Message" }
  Write-Host "PASS: $Message" -ForegroundColor Green
}

Assert-True ($agent -match '\$PSNativeCommandUseErrorActionPreference\s*=\s*\$false') 'native command preference disabled'
Assert-True (($agent -split "`n" | Select-String '\$ErrorActionPreference = ''Continue''').Count -ge 2) 'native calls use Continue locally'
Assert-True ($agent -match 'finally\s*\{[\s\S]*?\$ErrorActionPreference = \$previousErrorActionPreference') 'error preference restored'
Assert-True ($schedule -match '-Execute "pwsh\.exe"') 'scheduled task uses PowerShell 7'
Write-Host 'All daily report agent regression tests passed.' -ForegroundColor Green
