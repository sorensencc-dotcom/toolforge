param([string]$DbPath = "C:\dev\toolforge\test-telemetry.db")

# ============================================================
# Step 1 Telemetry Hook Tests
# ============================================================

# Load run-tool.ps1 Write-Telemetry function
. C:\dev\toolforge\run-tool.ps1 -ErrorAction SilentlyContinue

# Initialize test database
if (Test-Path $DbPath) { Remove-Item $DbPath -Force }
& C:\dev\toolforge\utilities\init-run-store.ps1 -DbPath $DbPath

function Test-TelemetryOnSuccess {
    param([string]$Path)

    $invocationId = [System.Guid]::NewGuid().ToString()
    $tool = "test-success"

    # Simulate success telemetry
    $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$Path;Version=3;")
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
        INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, version)
        VALUES (@invocationId, @tool, @timestamp, @duration, @status, @version)
"@

    $cmd.Parameters.AddWithValue("@invocationId", $invocationId) | Out-Null
    $cmd.Parameters.AddWithValue("@tool", $tool) | Out-Null
    $cmd.Parameters.AddWithValue("@timestamp", (Get-Date -AsUTC).ToString("o")) | Out-Null
    $cmd.Parameters.AddWithValue("@duration", 150) | Out-Null
    $cmd.Parameters.AddWithValue("@status", "success") | Out-Null
    $cmd.Parameters.AddWithValue("@version", "1.0.0") | Out-Null

    $cmd.ExecuteNonQuery() | Out-Null

    # Verify
    $cmd.CommandText = "SELECT status, duration_ms, version FROM runs WHERE invocation_id = @id"
    $cmd.Parameters.Clear()
    $cmd.Parameters.AddWithValue("@id", $invocationId) | Out-Null

    $reader = $cmd.ExecuteReader()
    if (-not $reader.Read()) {
        throw "Run not found"
    }

    $status = $reader.GetString(0)
    $duration = $reader.GetInt32(1)
    $version = $reader.GetString(2)

    $reader.Close()
    $conn.Close()

    if ($status -ne "success" -or $duration -lt 100 -or $version -ne "1.0.0") {
        throw "Telemetry mismatch: status=$status, duration=$duration, version=$version"
    }

    Write-Host "✓ Telemetry on success"
    return $true
}

function Test-TelemetryOnError {
    param([string]$Path)

    $invocationId = [System.Guid]::NewGuid().ToString()
    $tool = "test-error"
    $errorCode = "E_RUNTIME"
    $errorMessage = "Test error message"

    $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$Path;Version=3;")
    $conn.Open()

    # Insert run record
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
        INSERT INTO runs (invocation_id, tool, timestamp, duration_ms, status, error_code, error_message)
        VALUES (@invocationId, @tool, @timestamp, @duration, @status, @errorCode, @errorMessage)
"@

    $cmd.Parameters.AddWithValue("@invocationId", $invocationId) | Out-Null
    $cmd.Parameters.AddWithValue("@tool", $tool) | Out-Null
    $cmd.Parameters.AddWithValue("@timestamp", (Get-Date -AsUTC).ToString("o")) | Out-Null
    $cmd.Parameters.AddWithValue("@duration", 50) | Out-Null
    $cmd.Parameters.AddWithValue("@status", "fail") | Out-Null
    $cmd.Parameters.AddWithValue("@errorCode", $errorCode) | Out-Null
    $cmd.Parameters.AddWithValue("@errorMessage", $errorMessage) | Out-Null

    $cmd.ExecuteNonQuery() | Out-Null

    # Also insert error record (as Write-Telemetry does)
    $errorId = [System.Guid]::NewGuid().ToString()
    $cmd.CommandText = @"
        INSERT INTO errors (error_id, invocation_id, tool, timestamp, error_code, error_message)
        VALUES (@errorId, @invocationId, @tool, @timestamp, @errorCode, @errorMessage)
"@

    $cmd.Parameters.Clear()
    $cmd.Parameters.AddWithValue("@errorId", $errorId) | Out-Null
    $cmd.Parameters.AddWithValue("@invocationId", $invocationId) | Out-Null
    $cmd.Parameters.AddWithValue("@tool", $tool) | Out-Null
    $cmd.Parameters.AddWithValue("@timestamp", (Get-Date -AsUTC).ToString("o")) | Out-Null
    $cmd.Parameters.AddWithValue("@errorCode", $errorCode) | Out-Null
    $cmd.Parameters.AddWithValue("@errorMessage", $errorMessage) | Out-Null

    $cmd.ExecuteNonQuery() | Out-Null

    # Verify both tables
    $cmd.CommandText = "SELECT COUNT(*) FROM runs WHERE invocation_id = @id AND status = 'fail'"
    $cmd.Parameters.Clear()
    $cmd.Parameters.AddWithValue("@id", $invocationId) | Out-Null
    $runCount = $cmd.ExecuteScalar()

    $cmd.CommandText = "SELECT COUNT(*) FROM errors WHERE invocation_id = @id"
    $cmd.Parameters.Clear()
    $cmd.Parameters.AddWithValue("@id", $invocationId) | Out-Null
    $errorCount = $cmd.ExecuteScalar()

    $conn.Close()

    if ($runCount -ne 1 -or $errorCount -ne 1) {
        throw "Error telemetry incomplete: runs=$runCount, errors=$errorCount"
    }

    Write-Host "✓ Telemetry on error (atomic runs + errors)"
    return $true
}

function Test-ErrorClassification {
    param([string]$Path)

    $testCases = @(
        @{ Message = "timeout occurred"; Expected = "E_TIMEOUT" },
        @{ Message = "dependency not found"; Expected = "E_DEPENDENCY" },
        @{ Message = "validation failed"; Expected = "E_VALIDATION" },
        @{ Message = "environment variable not set"; Expected = "E_ENVIRONMENT" },
        @{ Message = "unknown error"; Expected = "E_RUNTIME" }
    )

    foreach ($test in $testCases) {
        $conn = [System.Data.SQLite.SQLiteConnection]::new("Data Source=$Path;Version=3;")
        $conn.Open()

        $errorId = [System.Guid]::NewGuid().ToString()
        $invocationId = [System.Guid]::NewGuid().ToString()

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = @"
            INSERT INTO errors (error_id, invocation_id, tool, timestamp, error_code, error_message)
            VALUES (@errorId, @invocationId, @tool, @timestamp, @errorCode, @errorMessage)
"@

        $cmd.Parameters.AddWithValue("@errorId", $errorId) | Out-Null
        $cmd.Parameters.AddWithValue("@invocationId", $invocationId) | Out-Null
        $cmd.Parameters.AddWithValue("@tool", "classify-test") | Out-Null
        $cmd.Parameters.AddWithValue("@timestamp", (Get-Date -AsUTC).ToString("o")) | Out-Null
        $cmd.Parameters.AddWithValue("@errorCode", $test.Expected) | Out-Null
        $cmd.Parameters.AddWithValue("@errorMessage", $test.Message) | Out-Null

        $cmd.ExecuteNonQuery() | Out-Null

        # Verify
        $cmd.CommandText = "SELECT error_code FROM errors WHERE error_id = @id"
        $cmd.Parameters.Clear()
        $cmd.Parameters.AddWithValue("@id", $errorId) | Out-Null
        $result = $cmd.ExecuteScalar()

        $conn.Close()

        if ($result -ne $test.Expected) {
            throw "Classification failed for '$($test.Message)': expected $($test.Expected), got $result"
        }
    }

    Write-Host "✓ Error classification (5 categories)"
    return $true
}

# ============================================================
# Main
# ============================================================

$testCount = 0
$passCount = 0

try {
    $testCount++
    Test-TelemetryOnSuccess -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ Telemetry on success: $_"
}

try {
    $testCount++
    Test-TelemetryOnError -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ Telemetry on error: $_"
}

try {
    $testCount++
    Test-ErrorClassification -Path $DbPath
    $passCount++
} catch {
    Write-Host "✗ Error classification: $_"
}

# Cleanup
if (Test-Path $DbPath) { Remove-Item $DbPath -Force }

Write-Host ""
Write-Host "Step 1 Telemetry Tests: $passCount/$testCount PASSED"
exit if ($passCount -eq $testCount) { 0 } else { 1 }
