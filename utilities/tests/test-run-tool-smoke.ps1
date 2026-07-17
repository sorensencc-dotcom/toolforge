param([string]$DbPath = "C:\dev\test-run-store-smoke.db")

# Smoke test for run-tool.ps1 -Run/-Inspect/-List against a real registered skill.
# Guards the 6-bug class found 2026-07-17 (wrong TOOLFORGE_ROOT, metadata.* mis-nesting,
# id/name lookup mismatch, missing path fallback, telemetry DB_PATH) — all silent
# failures with zero prior test coverage. See TODOS.md.

$ErrorActionPreference = "Stop"
$script:pass = 0
$script:fail = 0

function Assert-True {
    param([bool]$Condition, [string]$Label)
    if ($Condition) {
        Write-Host "  PASS: $Label" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  FAIL: $Label" -ForegroundColor Red
        $script:fail++
    }
}

$runTool  = "C:\dev\run-tool.ps1"
$knownSkill = "automation-audit"

Assert-True (Test-Path $runTool) "run-tool.ps1 exists"

# Clean start so a leftover DB from a prior failed run can't mask a fresh failure
if (Test-Path $DbPath) { Remove-Item $DbPath -Force }
if (Test-Path "C:\dev\run-store.db") {
    # init-run-store schema must already exist at the real path; smoke test reuses it
    Copy-Item "C:\dev\run-store.db" $DbPath -Force
}

# Test 1: -List does not throw and mentions the known skill (manifest stores it under
# displayName "Automation Audit", not the lookup id -- match case-insensitively on the
# id fragment which appears in both forms)
$listOutput = & $runTool -List *>&1 | Out-String -Width 4096
$listExit = $LASTEXITCODE
Assert-True ($listExit -eq 0) "-List exits 0"
Assert-True ($listOutput -match "(?i)automation.audit") "-List output includes '$knownSkill'"

# Test 2: -Inspect resolves the skill by id (catches id/name lookup bugs). Hand-curated
# manifest entries have no "path" field by design (Invoke-Tool falls back to
# SKILLS_DIR/id at run time; Inspect-Tool does not) so Path is legitimately blank here --
# assert on Entrypoint/Category instead, which prove the lookup found the right item.
$inspectOutput = & $runTool -Inspect -Name $knownSkill *>&1 | Out-String -Width 4096
$inspectExit = $LASTEXITCODE
Assert-True ($inspectExit -eq 0) "-Inspect exits 0"
Assert-True ($inspectOutput -notmatch "not found") "-Inspect resolves '$knownSkill' by id"
Assert-True ($inspectOutput -match "Entrypoint:\s*src/index\.ts") "-Inspect shows the real entrypoint"

# Test 3: -Run actually executes the skill entrypoint end to end
$runOutput = & $runTool -Run -Name $knownSkill -DbPath $DbPath *>&1 | Out-String -Width 4096
$runExit = $LASTEXITCODE
Assert-True ($runExit -eq 0) "-Run $knownSkill exits 0"
Assert-True ($runOutput -notmatch "Cannot resolve directory") "-Run does not hit the no-path-field bug"
Assert-True ($runOutput -notmatch "Entrypoint not found") "-Run finds the real entrypoint"
Assert-True ($runOutput -match "(?i)complete") "-Run reports completion"

# Test 4: telemetry actually landed a row for this invocation (catches DB_PATH drift)
if (Get-Module -ListAvailable PSSQLite) {
    Import-Module PSSQLite -ErrorAction SilentlyContinue
    $row = Invoke-SqliteQuery -DataSource $DbPath -Query "SELECT status FROM runs WHERE tool = @t ORDER BY timestamp DESC LIMIT 1" -SqlParameters @{ t = $knownSkill }
    Assert-True ($null -ne $row -and $row.status -eq 'success') "telemetry row written with status=success"
} else {
    Write-Host "  SKIP: telemetry check (PSSQLite not installed)" -ForegroundColor Yellow
}

if (Test-Path $DbPath) { Remove-Item $DbPath -Force }

Write-Host ""
Write-Host "Results: $script:pass passed, $script:fail failed" -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Red" })
if ($script:fail -gt 0) { exit 1 }
exit 0
