[CmdletBinding()]
param(
    [string]$RepoRoot = $(if ($env:RETRO_REPO_ROOT) { $env:RETRO_REPO_ROOT } else { 'C:\dev' }),
    [string]$OutputDir = $(if ($env:RETRO_OUTPUT_DIR) { $env:RETRO_OUTPUT_DIR } else { 'C:\dev\.icf-retros\weekly' }),
    [string]$LogDir = $(if ($env:RETRO_LOG_DIR) { $env:RETRO_LOG_DIR } else { 'C:\dev\logs\retro' }),
    [string]$ProjectionPath = $(if ($env:RETRO_PROJECTION_PATH) { $env:RETRO_PROJECTION_PATH } else { '' }),
    [string]$RunnerExe = $(if ($env:RETRO_RUNNER_EXE) { $env:RETRO_RUNNER_EXE } elseif ($env:CLAUDE_EXE) { $env:CLAUDE_EXE } else { 'C:\Users\soren\.local\bin\claude.exe' }),
    [string[]]$RunnerArgs = @('-p', $(if ($env:RETRO_PROMPT) { $env:RETRO_PROMPT } else { '/retro' }), '--permission-mode', 'bypassPermissions')
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
$rawFile = Join-Path $OutputDir "retro-$date.raw.json"
$publisher = 'C:\dev\icf\scripts\publish-weekly-retro-artifact.mjs'

Push-Location $RepoRoot
try {
    $output = @(& $RunnerExe @RunnerArgs 2>&1)
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    $output | Tee-Object -FilePath $logFile | Out-Host
    if ($exitCode -ne 0) { throw "Retro runner failed with exit code $exitCode. See $logFile" }

    $rawJson = ($output | ForEach-Object { [string]$_ }) -join "`n"
    $jsonPayload = Get-JsonPayload -Text $rawJson
    try {
        $retro = $jsonPayload | ConvertFrom-Json -ErrorAction Stop
    } catch {
        # /retro may intentionally skip duplicate work and point to the last
        # valid snapshot instead of emitting JSON. Reuse that snapshot safely.
        if ($rawJson -match '(?i)(\.context[\\/]retros[\\/][^\s`"''<>]+\.json)') {
            $existingPath = Join-Path $RepoRoot ($Matches[1] -replace '/', '\\')
            if (Test-Path -LiteralPath $existingPath -PathType Leaf) {
                try { $retro = Get-Content -Raw -LiteralPath $existingPath | ConvertFrom-Json -ErrorAction Stop }
                catch { throw "Referenced retro snapshot is invalid: $existingPath. See $logFile" }
            } else {
                throw "Retro runner referenced missing snapshot: $existingPath. See $logFile"
            }
        } else {
            $retroCandidates = Get-ChildItem -LiteralPath (Join-Path $RepoRoot '.context\retros') -Filter '*.json' -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending
            foreach ($candidate in $retroCandidates) {
                try {
                    $candidateRetro = Get-Content -Raw -LiteralPath $candidate.FullName | ConvertFrom-Json -ErrorAction Stop
                    if ($null -ne $candidateRetro.metrics) { $retro = $candidateRetro; break }
                } catch { continue }
            }
            if ($null -eq $retro) {
                throw "Retro runner did not emit JSON and no valid snapshot was found. See $logFile"
            }
        }
    }
    if ($null -eq $retro.metrics) { throw 'Retro JSON is missing required top-level property: metrics' }

    Write-AtomicJsonArtifact -Path $rawFile -Value $retro
    $publishArgs = @($publisher, '--report', $rawFile, '--run', $runFile, '--latest', $latestFile)
    if ($ProjectionPath) {
        if (-not (Test-Path -LiteralPath $ProjectionPath -PathType Leaf)) {
            throw "Projection sidecar not found: $ProjectionPath"
        }
        $publishArgs += @('--projection', $ProjectionPath)
    }
    & node @publishArgs
    if ($LASTEXITCODE -ne 0) { throw "ICF artifact publication failed with exit code $LASTEXITCODE. See $logFile" }
    Write-Output "Weekly retro published: $runFile"
    Write-Output "Latest weekly retro updated: $latestFile"
} finally {
    if (Test-Path -LiteralPath $rawFile) { Remove-Item -LiteralPath $rawFile -Force }
    Pop-Location
}
