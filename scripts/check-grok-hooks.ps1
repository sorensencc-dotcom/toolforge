# scripts/check-grok-hooks.ps1
# Guardrail & health check for Grok CLI hooks and compatibility settings.

$ErrorActionPreference = "Stop"

Write-Host "Running Grok hook health inspection..." -ForegroundColor Cyan

$grokBin = "C:\Users\soren\.grok\bin\grok.exe"
if (-not (Test-Path $grokBin)) {
    Write-Host "FAIL: Grok executable not found at $grokBin" -ForegroundColor Red
    exit 1
}

$inspectRaw = & $grokBin inspect --json
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($inspectRaw)) {
    Write-Host "FAIL: 'grok inspect --json' failed to execute." -ForegroundColor Red
    exit 1
}

$inspect = $inspectRaw | ConvertFrom-Json
$failures = @()

# 1. Check Hook Load Errors
$errorCount = if ($null -ne $inspect.hookLoadErrors) { $inspect.hookLoadErrors.Count } else { 0 }
if ($errorCount -gt 0) {
    $failures += "Grok reported $errorCount hook load error(s):"
    foreach ($err in $inspect.hookLoadErrors) {
        $failures += "  - $err"
    }
}

# 2. Check Harness Compatibility isolation
$claudeHooks = $inspect.externalCompat.cells | Where-Object { $_.vendor -eq "claude" -and $_.surface -eq "hooks" }
if ($null -ne $claudeHooks -and $claudeHooks.enabled -eq $true) {
    $failures += "Harness compatibility for Claude hooks is ENABLED. Set [compat.claude] hooks = false in ~/.grok/config.toml."
}

$cursorHooks = $inspect.externalCompat.cells | Where-Object { $_.vendor -eq "cursor" -and $_.surface -eq "hooks" }
if ($null -ne $cursorHooks -and $cursorHooks.enabled -eq $true) {
    $failures += "Harness compatibility for Cursor hooks is ENABLED. Set [compat.cursor] hooks = false in ~/.grok/config.toml."
}

# 3. Check for blocking synchronous hooks in Grok plugins/overlays
$claudeMemHooksFile = "C:\Users\soren\.grok\plugins\claude-mem\hooks\hooks.json"
if (Test-Path $claudeMemHooksFile) {
    $cmHooks = Get-Content $claudeMemHooksFile -Raw | ConvertFrom-Json
    if ($null -ne $cmHooks.hooks -and ($cmHooks.hooks | Get-Member -MemberType NoteProperty).Count -gt 0) {
        $failures += "Synchronous hooks detected in claude-mem overlay ($claudeMemHooksFile). Grok lacks async hook support; hooks.json must remain empty."
    }
}

# 4. Check for unexpanded Claude variables in superpower hooks
$spHooksFile = "C:\Users\soren\.grok\plugins\superpowers\hooks\hooks.json"
if (Test-Path $spHooksFile) {
    $spContent = Get-Content $spHooksFile -Raw
    if ($spContent -match '\$\{CLAUDE_PLUGIN_ROOT\}') {
        $failures += "Unexpanded variable \${CLAUDE_PLUGIN_ROOT} found in $spHooksFile."
    }
}

if ($failures.Count -gt 0) {
    Write-Host "`nGrok Hook Guardrail FAILED:" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  $f" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host "PASS: Grok hook configuration is healthy (0 load errors, foreign hooks isolated, no synchronous blocking hooks)." -ForegroundColor Green
exit 0
