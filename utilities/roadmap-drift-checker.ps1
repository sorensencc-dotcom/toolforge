<#
.SYNOPSIS
Weekly cleanup scan for ROADMAP.md drift in forbidden locations.

.DESCRIPTION
Recursively finds all ROADMAP.md files in C:\dev.
Filters out allowed roots + archive/.
Classifies violations by type (ephemeral worktree, nested clone, orphan, sync artifact).
Generates JSON report to audit/ folder.
Posts Slack notification if violations found.

Intended for: Windows Task Scheduler (weekly trigger, Sunday 02:00 UTC)
Or manual: .\roadmap-drift-checker.ps1

.PARAMETER OutputDir
Directory for drift report. Defaults to C:\dev\audit.

.PARAMETER SlackWebhook
Webhook URL for Slack notification. If empty, skips Slack post.

.EXAMPLE
.\roadmap-drift-checker.ps1
.\roadmap-drift-checker.ps1 -SlackWebhook "https://hooks.slack.com/..."
#>

param(
    [string]$OutputDir = "C:\dev\audit",
    [string]$SlackWebhook = ""
)

$AllowedRoots = @(
    "C:\dev\docs\meta",
    "C:\dev\cic-ingestion",
    "C:\dev\rewrite-docs",
    "C:\dev\rewrite-mcp",
    "C:\dev\kb-sync"
)

function IsAllowedRoot([string]$FilePath) {
    foreach ($root in $AllowedRoots) {
        if ($FilePath.StartsWith("$root\") -or $FilePath -eq $root) {
            return $true
        }
    }
    return $false
}

function IsArchive([string]$FilePath) {
    return $FilePath -match '[\\\/]archive[\\\/]'
}

function ClassifyViolation([string]$FilePath) {
    if ($FilePath -match '\.claude[\\/]worktrees') {
        return "ephemeral_worktree"
    }
    if ($FilePath -match '[\\\/]\.claude[\\/]') {
        return "claude_metadata"
    }
    if ($FilePath -match '[\\\/](node_modules|\.git)[\\/]') {
        return "system_folder"
    }
    if ($FilePath -match '\.bak$|\.backup$|\.old$') {
        return "orphan_backup"
    }
    if ($FilePath -match '[\\\/](Sync|OneDrive|Drive|Dropbox)[\\/]') {
        return "sync_artifact"
    }
    if ($FilePath -match '[\\\/]toolforge[\\\/]') {
        return "nested_clone"
    }
    return "orphan"
}

Write-Host "Scanning C:\dev for ROADMAP.md drift..."
$allRoadmaps = @()
# Use single case-insensitive filter (Windows filesystem is case-insensitive)
# Both "ROADMAP.md" and "roadmap.md" match the same file, deduplicate by FullName
$roadmapFiles = Get-ChildItem -Path "C:\dev" -Filter "ROADMAP.md" -Recurse -ErrorAction SilentlyContinue | Sort-Object -Property FullName -Unique

# Filter for violations (not in allowed roots, not in archive)
$violations = @()
foreach ($file in $roadmapFiles) {
    $path = $file.FullName

    if (IsAllowedRoot $path) {
        continue
    }
    if (IsArchive $path) {
        continue
    }

    $lastModified = $file.LastWriteTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $classification = ClassifyViolation $path

    $violations += @{
        path = $path
        last_modified = $lastModified
        size_bytes = $file.Length
        classification = $classification
        recommendation = switch ($classification) {
            "ephemeral_worktree" { "DELETE (worktrees are temporary, not authoritative)" }
            "sync_artifact" { "DELETE (sync folder artifacts, not canonical)" }
            "nested_clone" { "DELETE (nested clone, conflicts with main)" }
            "orphan_backup" { "DELETE (backup file, no canonical match)" }
            "claude_metadata" { "DELETE (.claude metadata, not roadmap storage)" }
            "system_folder" { "AUDIT (system folder contamination)" }
            default { "DELETE (orphaned, no project ownership)" }
        }
    }
}

# Build report
$timestamp = [datetime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
$report = @{
    timestamp = $timestamp
    drift_found = $violations.Count -gt 0
    violation_count = $violations.Count
    violations = $violations
} | ConvertTo-Json -Depth 10

# Write report to audit folder
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp_short = [datetime]::UtcNow.ToString("yyyy-MM-dd")
$reportFile = Join-Path $OutputDir "roadmap-drift-report-$timestamp_short.json"
$report | Set-Content -Path $reportFile -Encoding UTF8

Write-Host "✅ Drift report: $reportFile"
Write-Host "Violations found: $($violations.Count)"

# Post Slack notification if violations found
if ($violations.Count -gt 0 -and $SlackWebhook) {
    Write-Host "Posting Slack alert..."

    # Top 3 violations
    $top3 = $violations | Select-Object -First 3 | ForEach-Object { "• $($_.classification): $($_.path)" } | Join-String -Separator "`n"

    $payload = @{
        text = "⚠️ Roadmap Drift Detected ($($violations.Count) violations)"
        blocks = @(
            @{
                type = "section"
                text = @{
                    type = "mrkdwn"
                    text = "*Roadmap Drift Report*`n`nFound $($violations.Count) ROADMAP.md files in forbidden locations.`n`n*Top 3 violations:*`n$top3`n`n<$reportFile|Full Report (JSON)>"
                }
            }
        )
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-WebRequest -Uri $SlackWebhook -Method Post -ContentType "application/json" -Body $payload -ErrorAction Stop | Out-Null
        Write-Host "✅ Slack alert posted to #roadmap-drift"
    } catch {
        Write-Host "⚠️  Slack notification failed: $_"
    }
} else {
    Write-Host ""
}

# Register Windows Task Scheduler job (if on Windows and not already registered)
Write-Host ""
Write-Host "Registering Windows Task Scheduler job..."

if ($PSVersionTable.Platform -eq "Win32NT" -or $PSVersionTable.PSVersion.Major -lt 6) {
    $taskName = "Roadmap Drift Checker"
    $taskPath = "\Toolforge\"
    $scriptPath = "C:\dev\utilities\roadmap-drift-checker.ps1"

    try {
        # Check if task already exists
        $existingTask = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue

        if ($existingTask) {
            Write-Host "✅ Task already registered: $taskPath$taskName"
        } else {
            # Define trigger: weekly, Sunday 02:00 UTC
            $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "02:00" -ErrorAction Stop

            # Define action: run PowerShell script
            $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -File `"$scriptPath`"" -ErrorAction Stop

            # Create task with high privilege
            $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

            # Register task
            Register-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Trigger $trigger -Action $action -Principal $principal -Force -ErrorAction Stop | Out-Null
            Write-Host "✅ Task scheduled: $taskPath$taskName (weekly Sunday 02:00 UTC)"
        }
    } catch {
        Write-Host "⚠️  Task Scheduler registration failed: $_"
    }
} else {
    Write-Host "⚠️  Not on Windows, skipping Task Scheduler registration"
}

if ($violations.Count -eq 0) {
    Write-Host "✅ No violations found. Clean state."
}
