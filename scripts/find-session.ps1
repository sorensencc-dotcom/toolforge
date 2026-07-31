<#
.SYNOPSIS
    Find Claude Code sessions (transcripts) mentioning a keyword, even if
    their VSCode tab never reopened after an extension/window update.

.DESCRIPTION
    Session transcripts persist on disk independent of VSCode's UI/tab
    restore state. This searches all .jsonl transcripts for a project and
    reports which session(s) matched, when, and a snippet — so a "lost" tab
    is one command to relocate instead of a manual open-everything search.

.PARAMETER Keyword
    Text to search for (plain substring, case-insensitive).

.PARAMETER ProjectDir
    Claude project transcript directory. Defaults to this repo's (c--dev).

.EXAMPLE
    ./scripts/find-session.ps1 "torquequery reconciliation"

.EXAMPLE
    ./scripts/find-session.ps1 -Keyword "video ingestion" -ProjectDir "C:\Users\soren\.claude\projects\c--dev"
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Keyword,

    [string]$ProjectDir = "C:\Users\soren\.claude\projects\c--dev"
)

$files = Get-ChildItem -Path $ProjectDir -Filter "*.jsonl" -File -ErrorAction Stop

$results = foreach ($f in $files) {
    $matches = Select-String -Path $f.FullName -Pattern ([regex]::Escape($Keyword)) -SimpleMatch -CaseSensitive:$false -ErrorAction SilentlyContinue
    if ($matches) {
        $line = $matches[0].Line
        $idx = $line.IndexOf($Keyword, [System.StringComparison]::OrdinalIgnoreCase)
        $start = [Math]::Max(0, $idx - 60)
        $len = [Math]::Min(220, $line.Length - $start)
        $snippet = $line.Substring($start, $len) -replace '\\n', ' ' -replace '\s+', ' '
        if ($start -gt 0) { $snippet = "..." + $snippet }
        [PSCustomObject]@{
            SessionId    = $f.BaseName
            LastModified = $f.LastWriteTime
            Hits         = $matches.Count
            Snippet      = $snippet
        }
    }
}

if (-not $results) {
    Write-Host "No sessions found matching '$Keyword' in $ProjectDir"
    exit 0
}

$results | Sort-Object LastModified -Descending | Format-Table -AutoSize -Wrap
Write-Host ""
Write-Host "Resume a session in Claude Code: session id above, or 'claude --resume <id>' from CLI if available."
