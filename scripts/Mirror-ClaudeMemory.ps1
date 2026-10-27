<#
.SYNOPSIS
    Mirrors the protected Claude Code project-memory folder for the "c--dev"
    project into C:\dev\_status-feed\claude-memory\, where Cowork's connected
    C:\dev folder can read it.

.DESCRIPTION
    C:\Users\soren\.claude\ is Claude's own config directory and cannot be
    mounted directly into Cowork (protected system location). This script
    copies just the memory/*.md files out of the protected folder into a
    plain project folder so the daily status aggregator (aggregate_status.py)
    can read them.

    Safe to re-run: does a one-way mirror (source -> destination), only
    copying .md files, and removes destination files that no longer exist
    at the source.

.NOTES
    Run manually, or register as a Windows Task Scheduler job (daily, a few
    minutes before the CIC daily status task runs). See the -Register switch.
#>

[CmdletBinding()]
param(
    [string]$SourceDir = "C:\Users\soren\.claude\projects\c--dev\memory",
    [string]$DestDir   = "C:\dev\_status-feed\claude-memory",
    [switch]$Register,
    [string]$RegisterTime = "06:45"
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

if ($Register) {
    $scriptPath = $MyInvocation.MyCommand.Path
    $action = New-ScheduledTaskAction -Execute "pwsh.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $RegisterTime
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries
    Register-ScheduledTask -TaskName "CIC-Mirror-ClaudeMemory" `
        -Action $action -Trigger $trigger -Settings $settings -Force `
        -Description "Mirrors C:\Users\$env:USERNAME\.claude\projects\c--dev\memory\*.md into C:\dev\_status-feed\claude-memory for the CIC daily status artifact."
    Write-Log "Registered scheduled task 'CIC-Mirror-ClaudeMemory' to run daily at $RegisterTime."
    return
}

if (-not (Test-Path $SourceDir)) {
    Write-Log "Source not found: $SourceDir - nothing to mirror. Exiting cleanly."
    exit 0
}

New-Item -ItemType Directory -Path $DestDir -Force | Out-Null

$sourceFiles = Get-ChildItem -Path $SourceDir -Filter "*.md" -File -ErrorAction SilentlyContinue
$copied = 0
foreach ($f in $sourceFiles) {
    $destPath = Join-Path $DestDir $f.Name
    $needsCopy = $true
    if (Test-Path $destPath) {
        $destFile = Get-Item $destPath
        if ($destFile.LastWriteTimeUtc -ge $f.LastWriteTimeUtc) {
            $needsCopy = $false
        }
    }
    if ($needsCopy) {
        Copy-Item -Path $f.FullName -Destination $destPath -Force
        $copied++
    }
}

# Remove stale destination files that no longer exist at source
$destFiles = Get-ChildItem -Path $DestDir -Filter "*.md" -File -ErrorAction SilentlyContinue
$removed = 0
foreach ($d in $destFiles) {
    $srcPath = Join-Path $SourceDir $d.Name
    if (-not (Test-Path $srcPath)) {
        Remove-Item -Path $d.FullName -Force
        $removed++
    }
}

Write-Log "Mirror complete: $copied file(s) copied/updated, $removed stale file(s) removed. Destination: $DestDir"
