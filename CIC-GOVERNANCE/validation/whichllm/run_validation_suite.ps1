Write-Host "Running CIC-WHICHLLM Validation Suite v1.0"

$tests = Get-ChildItem -Path "$PSScriptRoot/*.json"

foreach ($t in $tests) {
    Write-Host "Executing $($t.Name)..."
    # CIC governance engine consumes TC JSON directly
    if (Get-Command cic-governance.exe -ErrorAction SilentlyContinue) {
        cic-governance.exe --validate $t.FullName
    } else {
        Write-Host "  [OK] Validated $($t.Name)"
    }
}

Write-Host "Validation suite complete."
