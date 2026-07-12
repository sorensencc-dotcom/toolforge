param([string]$DbPath = "C:\dev\toolforge\test-run-store.db")

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

# Clean start
if (Test-Path $DbPath) { Remove-Item $DbPath -Force }

# Initialize database
& C:\dev\toolforge\utilities\init-run-store.ps1 -DbPath $DbPath

# Test 1: File exists
Assert-True (Test-Path $DbPath) "Database file created"

# Test 2: Schema tables
$conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;Read Only=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(name) FROM sqlite_master WHERE type='table'"
$tableCount = $cmd.ExecuteScalar()
$conn.Close()
Assert-True ($tableCount -ge 4) "All 4 tables created (found: $tableCount)"

# Test 3: WAL mode
$conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "PRAGMA journal_mode"
$mode = $cmd.ExecuteScalar()
$conn.Close()
Assert-True ($mode -eq 'wal') "WAL mode enabled (got: $mode)"

# Test 4: Indexes
$conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;Read Only=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(name) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
$indexCount = $cmd.ExecuteScalar()
$conn.Close()
Assert-True ($indexCount -ge 6) "Indexes created (found: $indexCount)"

# Test 5: Insert + Query
$conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;")
$conn.Open()
$invocationId = [guid]::NewGuid().ToString()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, version) VALUES (?, ?, ?, ?, ?, ?)"
$cmd.Parameters.AddWithValue("@1", $invocationId) | Out-Null
$cmd.Parameters.AddWithValue("@2", "test-tool") | Out-Null
$cmd.Parameters.AddWithValue("@3", (Get-Date -AsUTC).ToString("o")) | Out-Null
$cmd.Parameters.AddWithValue("@4", 150) | Out-Null
$cmd.Parameters.AddWithValue("@5", "success") | Out-Null
$cmd.Parameters.AddWithValue("@6", "1.0.0") | Out-Null
$cmd.ExecuteNonQuery() | Out-Null

$cmd.CommandText = "SELECT COUNT(*) FROM runs WHERE invocation_id = ?"
$cmd.Parameters.Clear()
$cmd.Parameters.AddWithValue("@1", $invocationId) | Out-Null
$count = $cmd.ExecuteScalar()
$conn.Close()
Assert-True ($count -eq 1) "Insert + query successful"

# Cleanup
Start-Sleep -Milliseconds 100
if (Test-Path $DbPath) {
    try { Remove-Item $DbPath -Force -ErrorAction Stop }
    catch { Write-Host "  (cleanup warning: $($_.Exception.Message))" }
}
if (Test-Path "$DbPath-shm") { try { Remove-Item "$DbPath-shm" -Force } catch {} }
if (Test-Path "$DbPath-wal") { try { Remove-Item "$DbPath-wal" -Force } catch {} }

Write-Host ""
Write-Host "Step 1 Database Tests: $script:pass/$($script:pass + $script:fail) PASSED"
if ($script:fail -eq 0) { exit 0 } else { exit 1 }
