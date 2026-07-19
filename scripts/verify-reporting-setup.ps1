# Phase 0 Verification: PowerShell + Git + Timezone + Cowork Logs

param(
    [switch]$Verbose
)

$results = @{
    timestamp = Get-Date -Format "o"
    environment = $PSVersionTable.PSVersion.ToString()
    tests = @()
}

function Test-Result {
    param([string]$name, [bool]$pass, [string]$detail)
    $results.tests += @{
        name = $name
        passed = $pass
        detail = $detail
    }
    if ($Verbose) {
        Write-Host "[$($pass ? 'PASS' : 'FAIL')] ${name}: $detail"
    }
}

# Test 1: Git log with --since across repos
Write-Host "Test 1: Git log --since across multiple repos..."
$repos = @("C:\dev", "C:\tmp\.github")
foreach ($repo in $repos) {
    if (Test-Path "$repo\.git") {
        try {
            $commits = & git -C $repo log --since "24 hours ago" --oneline 2>&1
            $pass = $commits -is [object[]] -or $commits -is [string]
            Test-Result "git-log-24h-$repo" $pass "Found $($commits.Count) commits"
        } catch {
            Test-Result "git-log-24h-$repo" $false "Error: $_"
        }
    } else {
        Test-Result "git-log-24h-$repo" $false "Not a git repo"
    }
}

# Test 2: Encoding check (UTF-8 vs UTF-16)
Write-Host "Test 2: PowerShell encoding..."
$encoding = [System.Console]::OutputEncoding.BodyName
Test-Result "encoding-check" ($encoding -eq "utf-8") "Current encoding: $encoding"

# Test 3: Date/time arithmetic
Write-Host "Test 3: Date arithmetic (24h window)..."
$now = Get-Date
$24hAgo = $now.AddHours(-24)
$diff = ($now - $24hAgo).TotalHours
Test-Result "date-arithmetic" ($diff -ge 23.99 -and $diff -le 24.01) "Diff: $diff hours"

# Test 4: Cowork daemon logs exist and are readable
Write-Host "Test 4: Cowork daemon logs..."
$coworkPaths = @(
    "$env:USERPROFILE\.cowork\sessions",
    "$env:USERPROFILE\.cowork\logs",
    "$env:APPDATA\.cowork",
    ".ijfw\cowork"
)

$coworkFound = $false
$coworkPath = $null

foreach ($path in $coworkPaths) {
    if (Test-Path $path) {
        $files = Get-ChildItem $path -File -ErrorAction SilentlyContinue
        if ($files.Count -gt 0) {
            $coworkFound = $true
            $coworkPath = $path
            Test-Result "cowork-logs-found" $true "Path: $path, files: $($files.Count)"
            break
        }
    }
}

if (-not $coworkFound) {
    Test-Result "cowork-logs-found" $false "No cowork logs found in standard locations"
}

# Test 5: Cowork log format validation (if found)
if ($coworkFound) {
    Write-Host "Test 5: Cowork log schema..."
    try {
        $logFile = Get-ChildItem $coworkPath -File | Select-Object -First 1
        $content = Get-Content $logFile.FullName -Raw

        # Try JSON parse
        if ($content -match '^\{' -or $content -match '^\[') {
            $parsed = $content | ConvertFrom-Json
            Test-Result "cowork-log-json" $true "Valid JSON, $($parsed | Measure-Object).Count items"
        } else {
            Test-Result "cowork-log-json" $false "Not JSON format (plain text or other)"
        }
    } catch {
        Test-Result "cowork-log-json" $false "Parse error: $_"
    }
}

# Store cowork path for later use
$results.cowork_path = $coworkPath

# Output results
$resultsJson = $results | ConvertTo-Json -Depth 10
Write-Output $resultsJson

if ($results.tests | Where-Object { $_.passed -eq $false }) {
    exit 1
} else {
    exit 0
}
