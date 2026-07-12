param([string]$DbPath = "C:\dev\toolforge\test-run-store.db")

# ============================================================
# Step 1 Database Tests
# ============================================================

function Test-DbInitialization {
    param([string]$Path)

    # Clean start
    if (Test-Path $Path) { Remove-Item $Path -Force }

    # Initialize
    & C:\dev\toolforge\utilities\init-run-store.ps1 -DbPath $Path

    if (-not (Test-Path $Path)) {
        throw "Database file not created"
    }

    Write-Host "OK Database initialization"
    return $true
}

function Test-DbSchema {
    param([string]$Path)

    $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$Path;Version=3;Read Only=True;")
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    $reader = $cmd.ExecuteReader()

    $tables = @()
    while ($reader.Read()) {
        $tables += $reader.GetString(0)
    }
    $reader.Close()
    $conn.Close()

    $expected = @('alerts', 'errors', 'runs', 'tools')
    $missing = $expected | Where-Object { $_ -notin $tables }

    if ($missing) {
        throw "Missing tables: $($missing -join ', ')"
    }

    Write-Host "OK Schema validation (tables: $($tables -join ', '))"
    return $true
}

function Test-DbIndexes {
    param([string]$Path)

    $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$Path;Version=3;Read Only=True;")
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
    $reader = $cmd.ExecuteReader()

    $indexes = @()
    while ($reader.Read()) {
        $indexes += $reader.GetString(0)
    }
    $reader.Close()
    $conn.Close()

    $expectedIndexes = @(
        'idx_runs_tool_timestamp',
        'idx_runs_status_timestamp',
        'idx_runs_timestamp',
        'idx_errors_tool_timestamp',
        'idx_errors_error_code',
        'idx_alerts_tool_timestamp'
    )

    $missing = $expectedIndexes | Where-Object { $_ -notin $indexes }

    if ($missing) {
        throw "Missing indexes: $($missing -join ', ')"
    }

    Write-Host "OK Indexes validation ($($indexes.Count) indexes present)"
    return $true
}

function Test-DbWalMode {
    param([string]$Path)

    $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$Path;Version=3;")
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "PRAGMA journal_mode"
    $mode = $cmd.ExecuteScalar()

    $conn.Close()

    if ($mode -ne 'wal') {
        throw "WAL mode not enabled (got: $mode)"
    }

    Write-Host "OK WAL mode enabled"
    return $true
}

function Test-InsertRun {
    param([string]$Path)

    $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$Path;Version=3;")
    $conn.Open()

    $invocationId = [System.Guid]::NewGuid().ToString()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
        INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, version)
        VALUES (@invocationId, @tool, @timestamp, @duration, @status, @version)
"@

    $cmd.Parameters.AddWithValue("@invocationId", $invocationId) | Out-Null
    $cmd.Parameters.AddWithValue("@tool", "test-tool") | Out-Null
    $cmd.Parameters.AddWithValue("@timestamp", (Get-Date -AsUTC).ToString("o")) | Out-Null
    $cmd.Parameters.AddWithValue("@duration", 100) | Out-Null
    $cmd.Parameters.AddWithValue("@status", "success") | Out-Null
    $cmd.Parameters.AddWithValue("@version", "1.0.0") | Out-Null

    $cmd.ExecuteNonQuery() | Out-Null

    # Verify
    $cmd.CommandText = "SELECT COUNT(*) FROM runs WHERE invocation_id = @id"
    $cmd.Parameters.Clear()
    $cmd.Parameters.AddWithValue("@id", $invocationId) | Out-Null
    $count = $cmd.ExecuteScalar()

    $conn.Close()

    if ($count -ne 1) {
        throw "Insert verification failed"
    }

    Write-Host "OK Insert run record"
    return $true
}

function Test-QueryRuns {
    param([string]$Path)

    $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$Path;Version=3;Read Only=True;")
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(*) FROM runs"
    $count = $cmd.ExecuteScalar()

    $conn.Close()

    if ($count -lt 1) {
        throw "No runs found after insert"
    }

    Write-Host "OK Query runs (found: $count)"
    return $true
}

# ============================================================
# Main
# ============================================================

$testCount = 0
$passCount = 0

try {
    $testCount++
    Test-DbInitialization -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ Database initialization: $_"
}

try {
    $testCount++
    Test-DbSchema -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ Schema validation: $_"
}

try {
    $testCount++
    Test-DbIndexes -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ Indexes validation: $_"
}

try {
    $testCount++
    Test-DbWalMode -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ WAL mode: $_"
}

try {
    $testCount++
    Test-InsertRun -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ Insert run: $_"
}

try {
    $testCount++
    Test-QueryRuns -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ Query runs: $_"
}

# Cleanup
if (Test-Path $DbPath) { Remove-Item $DbPath -Force }

Write-Host ""
Write-Host "Step 1 Database Tests: $passCount/$testCount PASSED"
exit if ($passCount -eq $testCount) { 0 } else { 1 }
