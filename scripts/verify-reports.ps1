<#
.SYNOPSIS
Verification gate for daily and weekly reporting system integrity.

.DESCRIPTION
Audits report files for integrity before ship-gate. Validates reports are
well-formed, have required sections, and cover expected date ranges.

.PARAMETER DailyReportsPath
Path to daily reports directory (default: C:\dev\docs\reports\daily\)

.PARAMETER WeeklyReportsPath
Path to weekly reports directory (default: C:\dev\docs\reports\weekly\)

.EXAMPLE
$result = Invoke-ReportVerification
$result | ConvertTo-Json | Write-Host
#>

param(
    [string]$DailyReportsPath = "C:\dev\docs\reports\daily",
    [string]$WeeklyReportsPath = "C:\dev\docs\reports\weekly"
)

# ============================================================================
# Test-DailyReportStructure
# ============================================================================
function Test-DailyReportStructure {
    <#
    .SYNOPSIS
    Validates the structure of a single daily report file.

    .PARAMETER FilePath
    Path to the daily report markdown file

    .RETURNS
    PSCustomObject with properties: Pass (bool), Issues (string[])
    #>
    param(
        [string]$FilePath
    )

    $issues = @()

    try {
        if (-not (Test-Path $FilePath)) {
            return @{
                Pass = $false
                Issues = @("File not found: $FilePath")
            }
        }

        $content = Get-Content $FilePath -Raw -ErrorAction Stop
        $filename = Split-Path $FilePath -Leaf

        # Extract expected date from filename (YYYY-MM-DD.md)
        $dateMatch = [regex]::Match($filename, '(\d{4}-\d{2}-\d{2})')
        if (-not $dateMatch.Success) {
            $issues += "Filename doesn't follow YYYY-MM-DD.md pattern"
        } else {
            $expectedDate = $dateMatch.Captures[0].Value

            # Check for markdown header
            if (-not ($content -match "# Daily Report: $expectedDate")) {
                $issues += "Missing or incorrect header: '# Daily Report: $expectedDate'"
            }
        }

        # Check for required sections
        if (-not ($content -match "## Metrics")) {
            $issues += "Missing required section: ## Metrics"
        }

        if (-not ($content -match "## Summary")) {
            $issues += "Missing required section: ## Summary"
        }

        # Determine pass/fail
        $pass = $issues.Count -eq 0

        return @{
            Pass = $pass
            Issues = $issues
        }
    }
    catch {
        return @{
            Pass = $false
            Issues = @("Error reading file: $_")
        }
    }
}

# ============================================================================
# Test-WeeklyReportStructure
# ============================================================================
function Test-WeeklyReportStructure {
    <#
    .SYNOPSIS
    Validates the structure of a single weekly report file.

    .PARAMETER FilePath
    Path to the weekly report markdown file

    .RETURNS
    PSCustomObject with properties: Pass (bool), Issues (string[])
    #>
    param(
        [string]$FilePath
    )

    $issues = @()

    try {
        if (-not (Test-Path $FilePath)) {
            return @{
                Pass = $false
                Issues = @("File not found: $FilePath")
            }
        }

        $content = Get-Content $FilePath -Raw -ErrorAction Stop
        $filename = Split-Path $FilePath -Leaf

        # Extract expected week from filename (YYYY-W##.md)
        $weekMatch = [regex]::Match($filename, '(\d{4}-W\d{2})')
        if (-not $weekMatch.Success) {
            $issues += "Filename doesn't follow YYYY-W##.md pattern"
        } else {
            $expectedWeek = $weekMatch.Captures[0].Value

            # Check for markdown header
            if (-not ($content -match "# Weekly Report: $expectedWeek")) {
                $issues += "Missing or incorrect header: '# Weekly Report: $expectedWeek'"
            }
        }

        # Check for required sections
        if (-not ($content -match "## Weekly Totals")) {
            $issues += "Missing required section: ## Weekly Totals"
        }

        if (-not ($content -match "## Busiest Days")) {
            $issues += "Missing required section: ## Busiest Days"
        }

        if (-not ($content -match "## Summary")) {
            $issues += "Missing required section: ## Summary"
        }

        # Determine pass/fail
        $pass = $issues.Count -eq 0

        return @{
            Pass = $pass
            Issues = $issues
        }
    }
    catch {
        return @{
            Pass = $false
            Issues = @("Error reading file: $_")
        }
    }
}

# ============================================================================
# Invoke-ReportVerification
# ============================================================================
function Invoke-ReportVerification {
    <#
    .SYNOPSIS
    Main verification gate: audits all daily and weekly reports.

    .PARAMETER DailyReportsPath
    Path to daily reports directory

    .PARAMETER WeeklyReportsPath
    Path to weekly reports directory

    .RETURNS
    PSCustomObject with properties:
    - DailyCount: number of daily reports processed
    - DailyPass: number of passing daily reports
    - DailyFail: number of failing daily reports
    - WeeklyCount: number of weekly reports processed
    - WeeklyPass: number of passing weekly reports
    - WeeklyFail: number of failing weekly reports
    - Issues: array of issue strings
    - Verdict: "PASS", "WARN", or "FAIL"
    - Details: detailed results for each report
    #>
    param(
        [string]$DailyReportsPath = "C:\dev\docs\reports\daily",
        [string]$WeeklyReportsPath = "C:\dev\docs\reports\weekly"
    )

    $result = @{
        DailyCount = 0
        DailyPass = 0
        DailyFail = 0
        WeeklyCount = 0
        WeeklyPass = 0
        WeeklyFail = 0
        Issues = @()
        Details = @()
        Verdict = "PASS"
    }

    # Process daily reports
    if (Test-Path $DailyReportsPath) {
        $dailyFiles = @(Get-ChildItem $DailyReportsPath -Filter "*.md" -ErrorAction SilentlyContinue | Sort-Object Name)
        $result.DailyCount = $dailyFiles.Count

        foreach ($file in $dailyFiles) {
            $testResult = Test-DailyReportStructure -FilePath $file.FullName

            if ($testResult.Pass) {
                $result.DailyPass++
                $status = "PASS"
            } else {
                $result.DailyFail++
                $status = "FAIL"
                $result.Issues += $testResult.Issues | ForEach-Object { "Daily report '$($file.Name)': $_" }
            }

            $result.Details += @{
                Type = "Daily"
                File = $file.Name
                Status = $status
                Issues = $testResult.Issues
            }
        }
    } else {
        $result.Issues += "Daily reports directory not found: $DailyReportsPath"
    }

    # Process weekly reports
    if (Test-Path $WeeklyReportsPath) {
        $weeklyFiles = @(Get-ChildItem $WeeklyReportsPath -Filter "*.md" -ErrorAction SilentlyContinue | Sort-Object Name)
        $result.WeeklyCount = $weeklyFiles.Count

        foreach ($file in $weeklyFiles) {
            $testResult = Test-WeeklyReportStructure -FilePath $file.FullName

            if ($testResult.Pass) {
                $result.WeeklyPass++
                $status = "PASS"
            } else {
                $result.WeeklyFail++
                $status = "FAIL"
                $result.Issues += $testResult.Issues | ForEach-Object { "Weekly report '$($file.Name)': $_" }
            }

            $result.Details += @{
                Type = "Weekly"
                File = $file.Name
                Status = $status
                Issues = $testResult.Issues
            }
        }
    } else {
        $result.Issues += "Weekly reports directory not found: $WeeklyReportsPath"
    }

    # Determine verdict
    if ($result.DailyFail -gt 0 -or $result.WeeklyFail -gt 0) {
        if ($result.DailyFail -gt 3 -or $result.WeeklyFail -gt 1) {
            $result.Verdict = "FAIL"
        } else {
            $result.Verdict = "WARN"
        }
    }

    return $result
}

# ============================================================================
# If run as script, execute verification and display results
# ============================================================================
if ($PSCommandPath -eq $MyInvocation.MyCommand.Path) {
    $verifyResult = Invoke-ReportVerification -DailyReportsPath $DailyReportsPath -WeeklyReportsPath $WeeklyReportsPath

    # Display summary table
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "REPORT VERIFICATION GATE" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    Write-Host "Daily Reports:" -ForegroundColor Yellow
    Write-Host "  Total: $($verifyResult.DailyCount) | Pass: $($verifyResult.DailyPass) | Fail: $($verifyResult.DailyFail)"

    Write-Host "`nWeekly Reports:" -ForegroundColor Yellow
    Write-Host "  Total: $($verifyResult.WeeklyCount) | Pass: $($verifyResult.WeeklyPass) | Fail: $($verifyResult.WeeklyFail)"

    # Display detailed results table
    Write-Host "`n--- Detailed Results ---`n" -ForegroundColor Yellow

    $detailTable = $verifyResult.Details | Select-Object @{N='Type';E={$_.Type}},@{N='Report';E={$_.File}},@{N='Status';E={$_.Status}}
    $detailTable | Format-Table -AutoSize | Out-Host

    # Display any issues
    if ($verifyResult.Issues.Count -gt 0) {
        Write-Host "--- Issues Found ---`n" -ForegroundColor Red
        $verifyResult.Issues | ForEach-Object { Write-Host "  * $_" -ForegroundColor Red }
        Write-Host ""
    }

    # Display verdict
    $verdictColor = switch ($verifyResult.Verdict) {
        "PASS" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        default { "White" }
    }
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "VERDICT: $($verifyResult.Verdict)" -ForegroundColor $verdictColor
    Write-Host "========================================`n" -ForegroundColor Cyan

    # Return appropriate exit code
    $exitCode = switch ($verifyResult.Verdict) {
        "PASS" { 0 }
        "WARN" { 1 }
        "FAIL" { 2 }
        default { 3 }
    }
    exit $exitCode
}
