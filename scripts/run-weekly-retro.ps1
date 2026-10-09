[CmdletBinding()]
param(
    [string]$RepoRoot = $(if ($env:RETRO_REPO_ROOT) { $env:RETRO_REPO_ROOT } else { 'C:\dev' }),
    [string]$OutputDir = $(if ($env:RETRO_OUTPUT_DIR) { $env:RETRO_OUTPUT_DIR } else { 'C:\dev\.icf-retros\weekly' }),
    [string]$LogDir = $(if ($env:RETRO_LOG_DIR) { $env:RETRO_LOG_DIR } else { 'C:\dev\logs\retro' }),
    [string]$ProjectionPath = $(if ($env:RETRO_PROJECTION_PATH) { $env:RETRO_PROJECTION_PATH } else { '' }),
    [string]$RunnerExe = $(if ($env:RETRO_RUNNER_EXE) { $env:RETRO_RUNNER_EXE } elseif ($env:CLAUDE_EXE) { $env:CLAUDE_EXE } else { 'C:\Users\soren\.local\bin\claude.exe' }),
    [string[]]$RunnerArgs = @('-p', $(if ($env:RETRO_PROMPT) { $env:RETRO_PROMPT } else { '/retro' }))
)

$ErrorActionPreference = 'Stop'

function Write-AtomicJsonArtifact {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)]$Value)
    $tempPath = "$Path.tmp-$PID"
    try {
        $json = $Value | ConvertTo-Json -Depth 50
        $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($tempPath, $json, $utf8NoBom)
        Move-Item -LiteralPath $tempPath -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
    }
}

function Get-JsonPayload {
    param([Parameter(Mandatory)][string]$Text)

    if ($Text -match '(?ms)```(?:json)?\s*(\{.*?\})\s*```') { return $Matches[1] }

    for ($start = 0; $start -lt $Text.Length; $start++) {
        if ($Text[$start] -ne '{') { continue }
        $depth = 0; $inString = $false; $escaped = $false
        for ($i = $start; $i -lt $Text.Length; $i++) {
            $char = $Text[$i]
            if ($inString) {
                if ($escaped) { $escaped = $false }
                elseif ($char -eq '\') { $escaped = $true }
                elseif ($char -eq '"') { $inString = $false }
                continue
            }
            if ($char -eq '"') { $inString = $true; continue }
            if ($char -eq '{') { $depth++ }
            elseif ($char -eq '}') {
                $depth--
                if ($depth -eq 0) { return $Text.Substring($start, $i - $start + 1) }
            }
        }
    }
    return $Text
}

if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) { throw "Repository root not found: $RepoRoot" }
if (-not (Test-Path -LiteralPath $RunnerExe -PathType Leaf)) { throw "Retro runner not found: $RunnerExe" }

New-Item -ItemType Directory -Force -Path $OutputDir, $LogDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$date = Get-Date -Format 'yyyy-MM-dd'
$logFile = Join-Path $LogDir "retro-$stamp.log"
$runFile = Join-Path $OutputDir "retro-$date.json"
$latestFile = Join-Path $OutputDir 'latest-weekly-retro.json'
$compiler = Join-Path $RepoRoot 'scripts\compile-weekly-retro.mjs'

Push-Location $RepoRoot
try {
    Write-Output "[$stamp] Compiling deterministic weekly retro for $date..." | Tee-Object -FilePath $logFile
    & node $compiler --date $date | Tee-Object -FilePath $logFile -Append
    if ($LASTEXITCODE -ne 0) {
        throw "Weekly retro compilation failed with exit code $LASTEXITCODE. See $logFile"
    }
    Write-Output "Weekly retro successfully compiled and published." | Tee-Object -FilePath $logFile -Append
} finally {
    Pop-Location
}
