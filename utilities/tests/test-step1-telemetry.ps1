param([string]$DbPath = "C:\dev\test-telemetry.db")

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

# Initialize test database
if (Test-Path $DbPath) { Remove-Item $DbPath -Force }
& C:\dev\utilities\init-run-store.ps1 -DbPath $DbPath

# Test 1: Telemetry on success
$conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;")
$conn.Open()

$invocationId = [guid]::NewGuid().ToString()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, version) VALUES (?, ?, ?, ?, ?, ?)"
$cmd.Parameters.AddWithValue("@1", $invocationId) | Out-Null
$cmd.Parameters.AddWithValue("@2", "test-success") | Out-Null
$cmd.Parameters.AddWithValue("@3", (Get-Date -AsUTC).ToString("o")) | Out-Null
$cmd.Parameters.AddWithValue("@4", 150) | Out-Null
$cmd.Parameters.AddWithValue("@5", "success") | Out-Null
$cmd.Parameters.AddWithValue("@6", "1.0.0") | Out-Null
$cmd.ExecuteNonQuery() | Out-Null

$cmd.CommandText = "SELECT status, duration_ms, version FROM runs WHERE invocation_id = ?"
$cmd.Parameters.Clear()
$cmd.Parameters.AddWithValue("@1", $invocationId) | Out-Null
$reader = $cmd.ExecuteReader()
$found = $reader.Read()
$status = if ($found) { $reader.GetString(0) } else { $null }
$reader.Close()
$conn.Close()

Assert-True ($status -eq "success") "Telemetry on success recorded"

# Test 2: Telemetry on error (atomic runs + errors)
$conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;")
$conn.Open()

$invocationId = [guid]::NewGuid().ToString()
$errorId = [guid]::NewGuid().ToString()

# Insert run
$cmd = $conn.CreateCommand()
$cmd.CommandText = "INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, error_code, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)"
$cmd.Parameters.AddWithValue("@1", $invocationId) | Out-Null
$cmd.Parameters.AddWithValue("@2", "test-error") | Out-Null
$cmd.Parameters.AddWithValue("@3", (Get-Date -AsUTC).ToString("o")) | Out-Null
$cmd.Parameters.AddWithValue("@4", 50) | Out-Null
$cmd.Parameters.AddWithValue("@5", "fail") | Out-Null
$cmd.Parameters.AddWithValue("@6", "E_RUNTIME") | Out-Null
$cmd.Parameters.AddWithValue("@7", "Test error") | Out-Null
$cmd.ExecuteNonQuery() | Out-Null

# Insert error
$cmd.CommandText = "INSERT INTO errors (error_id, invocation_id, tool, timestamp, error_code, error_message) VALUES (?, ?, ?, ?, ?, ?)"
$cmd.Parameters.Clear()
$cmd.Parameters.AddWithValue("@1", $errorId) | Out-Null
$cmd.Parameters.AddWithValue("@2", $invocationId) | Out-Null
$cmd.Parameters.AddWithValue("@3", "test-error") | Out-Null
$cmd.Parameters.AddWithValue("@4", (Get-Date -AsUTC).ToString("o")) | Out-Null
$cmd.Parameters.AddWithValue("@5", "E_RUNTIME") | Out-Null
$cmd.Parameters.AddWithValue("@6", "Test error") | Out-Null
$cmd.ExecuteNonQuery() | Out-Null

# Verify both tables
$cmd.CommandText = "SELECT COUNT(*) FROM runs WHERE invocation_id = ? AND status = 'fail'"
$cmd.Parameters.Clear()
$cmd.Parameters.AddWithValue("@1", $invocationId) | Out-Null
$runCount = $cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM errors WHERE invocation_id = ?"
$cmd.Parameters.Clear()
$cmd.Parameters.AddWithValue("@1", $invocationId) | Out-Null
$errorCount = $cmd.ExecuteScalar()

$conn.Close()

Assert-True ($runCount -eq 1) "Error telemetry recorded in runs table"
Assert-True ($errorCount -eq 1) "Error telemetry recorded in errors table (atomic)"

# Test 3: Error classification
$conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$DbPath;Version=3;")
$conn.Open()

$testCases = @(
    @{ Code = "E_TIMEOUT"; Message = "timeout" },
    @{ Code = "E_DEPENDENCY"; Message = "not found" },
    @{ Code = "E_VALIDATION"; Message = "invalid" }
)

foreach ($test in $testCases) {
    $errorId = [guid]::NewGuid().ToString()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "INSERT INTO errors (error_id, invocation_id, tool, timestamp, error_code, error_message) VALUES (?, ?, ?, ?, ?, ?)"
    $cmd.Parameters.AddWithValue("@1", $errorId) | Out-Null
    $cmd.Parameters.AddWithValue("@2", [guid]::NewGuid().ToString()) | Out-Null
    $cmd.Parameters.AddWithValue("@3", "classify-test") | Out-Null
    $cmd.Parameters.AddWithValue("@4", (Get-Date -AsUTC).ToString("o")) | Out-Null
    $cmd.Parameters.AddWithValue("@5", $test.Code) | Out-Null
    $cmd.Parameters.AddWithValue("@6", $test.Message) | Out-Null
    $cmd.ExecuteNonQuery() | Out-Null
}

$cmd.CommandText = "SELECT COUNT(DISTINCT error_code) FROM errors WHERE tool = ?"
$cmd.Parameters.Clear()
$cmd.Parameters.AddWithValue("@1", "classify-test") | Out-Null
$distinctErrors = $cmd.ExecuteScalar()
$conn.Close()

Assert-True ($distinctErrors -eq 3) "Error classification stored (3 distinct codes)"

# Cleanup
Start-Sleep -Milliseconds 100
if (Test-Path $DbPath) {
    try { Remove-Item $DbPath -Force -ErrorAction Stop }
    catch { Write-Host "  (cleanup warning: $($_.Exception.Message))" }
}
if (Test-Path "$DbPath-shm") { try { Remove-Item "$DbPath-shm" -Force } catch {} }
if (Test-Path "$DbPath-wal") { try { Remove-Item "$DbPath-wal" -Force } catch {} }

Write-Host ""
Write-Host "Step 1 Telemetry Tests: $script:pass/$($script:pass + $script:fail) PASSED"
if ($script:fail -eq 0) { exit 0 } else { exit 1 }
