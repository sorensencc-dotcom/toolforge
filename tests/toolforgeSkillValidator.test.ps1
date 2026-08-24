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