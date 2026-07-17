<#
.SYNOPSIS
  Create/migrate the Toolforge telemetry SQLite store (run-store.db).

.DESCRIPTION
  Idempotent. Safe to re-run — never drops data. Executes schema.sql (which uses
  CREATE TABLE/INDEX IF NOT EXISTS) against $DbPath, enables WAL journal mode
  (persisted in the DB header) and foreign_keys, then verifies the expected
  table set exists.

.PARAMETER DbPath
  Path to the SQLite database file. Default: C:\dev\run-store.db

.PARAMETER SchemaPath
  Path to the canonical DDL. Default: C:\dev\schema.sql

.PREREQUISITE
  PSSQLite module: Install-Module PSSQLite -Scope CurrentUser -Force

.EXAMPLE
  ./init-run-store.ps1
  ./init-run-store.ps1 -DbPath C:\dev\run-store.db
#>

param(
  [string]$DbPath     = "C:\dev\run-store.db",
  [string]$SchemaPath = "C:\dev\schema.sql"
)

$ErrorActionPreference = "Stop"

# ---- Prerequisite guard: PSSQLite ----
if (-not (Get-Module -ListAvailable PSSQLite)) {
  Write-Host "❌ PSSQLite module not found." -ForegroundColor Red
  Write-Host "   Install it with: Install-Module PSSQLite -Scope CurrentUser -Force" -ForegroundColor Yellow
  exit 1
}
Import-Module PSSQLite -ErrorAction Stop

if (-not (Test-Path $SchemaPath)) {
  Write-Host "❌ Schema file not found: $SchemaPath" -ForegroundColor Red
  exit 1
}

# ---- Backup existing DB (non-destructive migration) ----
if (Test-Path $DbPath) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = Join-Path (Split-Path -Parent $DbPath) "run-store-backup-$stamp.db"
  Copy-Item -Path $DbPath -Destination $backupPath -Force
  Write-Host "✓ Existing DB backed up to $backupPath" -ForegroundColor Green
}

# ---- Open connection, set PRAGMAs, execute schema ----
try {
  Invoke-SqliteQuery -DataSource $DbPath -Query "PRAGMA journal_mode=WAL;" | Out-Null
  Invoke-SqliteQuery -DataSource $DbPath -Query "PRAGMA foreign_keys=ON;" | Out-Null
  Invoke-SqliteQuery -DataSource $DbPath -Query "PRAGMA busy_timeout=5000;" | Out-Null
  Invoke-SqliteQuery -DataSource $DbPath -Query "PRAGMA synchronous=NORMAL;" | Out-Null

  $schemaSql = Get-Content -Path $SchemaPath -Raw
  Invoke-SqliteQuery -DataSource $DbPath -Query $schemaSql | Out-Null

  Write-Host "✓ Schema applied to $DbPath" -ForegroundColor Green
} catch {
  Write-Host "❌ Failed to initialize run-store.db: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# ---- Verify ----
$tables = Invoke-SqliteQuery -DataSource $DbPath -Query "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
$tableNames = $tables | ForEach-Object { $_.name }
$expected = @("alerts", "errors", "runs", "tools")

Write-Host ""
Write-Host "Tables present: $($tableNames -join ', ')" -ForegroundColor Cyan

$missing = $expected | Where-Object { $tableNames -notcontains $_ }
if ($missing.Count -gt 0) {
  Write-Host "❌ Missing expected tables: $($missing -join ', ')" -ForegroundColor Red
  exit 1
}

$journalMode = (Invoke-SqliteQuery -DataSource $DbPath -Query "PRAGMA journal_mode;").journal_mode
Write-Host "✓ journal_mode = $journalMode" -ForegroundColor Green

if ($journalMode -ne "wal") {
  Write-Host "❌ Expected WAL journal mode, got: $journalMode" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "✓ run-store.db ready: $DbPath" -ForegroundColor Green
exit 0
