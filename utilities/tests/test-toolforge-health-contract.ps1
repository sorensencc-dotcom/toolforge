$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$healthScript = Get-Content (Join-Path $root 'utilities/toolforgeSkillHealthCheck.ps1') -Raw
$failures = @()
function Assert-True([bool]$condition, [string]$message) { if (-not $condition) { $script:failures += $message } }
foreach ($id in @('kb-sync-nightly','obsidian-ingest-wiki','skill-security-auditor','trm-feedback-report','trm-status')) {
  Assert-True (@($manifest.skills | Where-Object id -eq $id).Count -eq 1) "manifest has exactly one $id entry"
}
$checks = @{}; foreach ($entry in $manifest.skills) { $checks[$entry.id] = $entry }
Assert-True ($checks['kb-sync-nightly'].version -eq '1.0.2') 'kb-sync-nightly version is current'
Assert-True ($checks['obsidian-ingest-wiki'].version -eq '1.1.0') 'obsidian-ingest-wiki version is current'
Assert-True ($checks['skill-security-auditor'].runtime -eq 'python') 'security auditor runtime is python'
Assert-True ($checks['skill-security-auditor'].entrypoint -eq 'src/skill_security_auditor.py') 'security auditor entrypoint is skill-relative'
Assert-True ($healthScript -match '\$INTERNAL_SKILLS = @\("_cic-shared"\)') 'internal package exclusion exists'
Assert-True ($healthScript -match 'Sync-WarningsToTodos') 'TODO warning sync remains wired'
Assert-True (Test-Path (Join-Path $root 'skills/cic-orchestrate-flow/SKILL.md')) 'orchestrator SKILL.md exists'
if ($failures.Count) { $failures | ForEach-Object { "FAIL: $_" }; exit 1 }
Write-Host 'PASS: Toolforge health contract checks' -ForegroundColor Green
