# Auto-generated post-merge hook. Do not edit.
# Integration check: full pipeline

$ciScript = Join-Path (git rev-parse --show-toplevel) 'ci-pipeline.ps1'
if (-not (Test-Path $ciScript)) {
    Write-Error "CI pipeline not found at $ciScript"
    exit 0
}

& $ciScript -Verbose -SkipCowork
$exitCode = $LASTEXITCODE

if ($exitCode -ge 1) {
    Write-Error "Post-merge integration check warnings (exit: $exitCode)"
}

exit 0
