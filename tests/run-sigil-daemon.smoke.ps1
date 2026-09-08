# tests/run-sigil-daemon.smoke.ps1
#
# Static regression guard for scripts/run-sigil-daemon.ps1. Parses the mesh
# supervisor script and asserts its port + persistent-store contract without
# launching node, Postgres, or any child process. Run: pwsh -File this.ps1

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot '..\scripts\run-sigil-daemon.ps1'
if (-not (Test-Path $scriptPath)) {
    throw "run-sigil-daemon smoke: script not found at $scriptPath"
}

# 1. The supervisor must parse without syntax errors.
$tokens = $null
$parseErrors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path $scriptPath), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors -and $parseErrors.Count -gt 0) {
    throw "run-sigil-daemon smoke: parse errors: $(($parseErrors | ForEach-Object { $_.Message }) -join '; ')"
}

# 2. The mesh port + persistent-store contract must stay intact. These are the
#    values relay/stream/connector clients and the pre-push secret-scan
#    allowlist are pinned to; a silent change breaks the daemon or the scan.
$text = Get-Content -Raw $scriptPath
$required = @(
    '$RelayPort = 8791',
    '$StreamPort = 8793',
    '$ConnectorPort = 4411',
    '$env:SIGIL_DATABASE_URL',
    'postgresql://sigil:sigil_password@localhost:55432/sigil',
    '--database-url'
)
foreach ($needle in $required) {
    if ($text.IndexOf($needle) -lt 0) {
        throw "run-sigil-daemon smoke: regression - '$needle' missing from run-sigil-daemon.ps1"
    }
}

# 3. The persistent store must be wired into the relay launch, not just exported.
if ($text -notmatch '"--database-url",\s*"\$env:SIGIL_DATABASE_URL"') {
    throw "run-sigil-daemon smoke: regression - relay launch no longer passes --database-url from SIGIL_DATABASE_URL"
}

Write-Output 'run-sigil-daemon smoke: OK (parse clean, port + persistent-store contract intact)'
