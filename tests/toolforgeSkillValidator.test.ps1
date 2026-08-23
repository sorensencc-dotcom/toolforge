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