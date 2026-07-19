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

# Output results
$resultsJson = $results | ConvertTo-Json -Depth 10
Write-Output $resultsJson

if ($results.tests | Where-Object { $_.passed -eq $false }) {
    exit 1
} else {
    exit 0
}
