$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '..\utilities\toolforgeSkillValidator.ps1'
$source = Get-Content $scriptPath -Raw
$definitions = $source.Split('# MAIN EXECUTION')[0]
. ([scriptblock]::Create($definitions))

$validation = @{
  canonical = @{ errors = 0 }
  distributed = @{ errors = 0 }
  manifest = @{ errors = 0 }
  cowork = @{ errors = 1 }
  dependencies = @{ errors = 0 }
  runtime = @{ errors = 0 }
  audit = @{ errors = 2 }
}

$total = Get-TotalValidationErrors -Validation $validation
if ($total -ne 3) {
  throw "Expected Cowork and audit errors to count; got $total"
}
Write-Output 'PASS: validation error aggregation includes Cowork and audit domains'
$outputPath = Join-Path ([IO.Path]::GetTempPath()) 'toolforge-validation-whatif-report.md'
if (Test-Path $outputPath) { Remove-Item -LiteralPath $outputPath -Force }
$validation = @{
  timestamp = '2026-08-23T00:00:00Z'
  canonical = @{ errors = 0; warnings = 0; passed = 0; details = @() }
  distributed = @{ errors = 0; warnings = 0; passed = 0; details = @() }
  manifest = @{ errors = 0; warnings = 0; passed = 0; details = @() }
  cowork = @{ errors = 0; warnings = 0; passed = 0; details = @() }
  dependencies = @{ errors = 0; warnings = 0; passed = 0; details = @() }
  runtime = @{ errors = 0; warnings = 0; passed = 0; details = @() }
  audit = @{ errors = 0; warnings = 0; passed = 0; details = @() }
  skills = @{}
}

New-ValidationReport -OutputPath $outputPath -WhatIf
if (Test-Path $outputPath) {
  throw 'WhatIf must not create a validation report'
}
Write-Output 'PASS: New-ValidationReport -WhatIf does not write a report'

$env:TOOLFORGE_VALIDATOR_RUNNING = $null
$validatorPath = Join-Path $PSScriptRoot '..\utilities\toolforgeSkillValidator.ps1'
$validatorPath = (Resolve-Path -LiteralPath $validatorPath).Path
$skipGeneratorsReport = Join-Path ([IO.Path]::GetTempPath()) 'toolforge-validation-skip-generators-report.md'
Remove-Item -LiteralPath $skipGeneratorsReport -Force -ErrorAction SilentlyContinue
$skipGeneratorsOutput = & pwsh -NoProfile -File $validatorPath -SkipGenerators -OutputPath $skipGeneratorsReport 2>&1 | Out-String
if ($LASTEXITCODE -notin @(0, 1)) { throw "SkipGenerators validation failed unexpectedly with exit code $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $skipGeneratorsReport)) { throw 'SkipGenerators must still produce the requested validation report' }
if ($skipGeneratorsOutput -match 'Running Phase 1\.4|All generators completed successfully|generator\(s\) failed') { throw 'SkipGenerators must not invoke or report Phase 1.4–1.7 generators' }
Remove-Item -LiteralPath $skipGeneratorsReport -Force
Write-Output 'PASS: -SkipGenerators skips generators and writes requested report'
