# schedule-task-wrapper-TRM-Notebooklm-Mine.ps1
# Weekly sweep: runs `trm mine-notebooklm <id>` for every notebook in
# notebooklm-registry.json. Registered in Windows Task Scheduler, weekly
# trigger -- see docs/superpowers/specs/2026-08-12-notebooklm-cic-ingest-mining-design.md §5.

$ErrorActionPreference = 'Stop'
$vaultRoot = 'C:\dev'
$logDir = Join-Path $vaultRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "trm-notebooklm-mine-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

Set-Location $vaultRoot

$registryPath = Join-Path $vaultRoot 'notebooklm-registry.json'
if (-not (Test-Path $registryPath)) {
    "notebooklm-registry.json not found at $registryPath -- nothing to mine" | Tee-Object -FilePath $logFile
    exit 1
}

$registry = Get-Content $registryPath -Raw | ConvertFrom-Json
$exitCode = 0

foreach ($notebook in $registry.notebooks) {
    "=== mining $($notebook.title) ($($notebook.notebook_id)) ===" | Tee-Object -FilePath $logFile -Append
    try {
        & node C:\dev\trm\dist\cli\index.js mine-notebooklm $notebook.notebook_id 2>&1 | Tee-Object -FilePath $logFile -Append
        if ($LASTEXITCODE -ne 0) {
            "mine-notebooklm failed for $($notebook.notebook_id) with exit code $LASTEXITCODE" | Tee-Object -FilePath $logFile -Append
            $exitCode = 1
        }
    } catch {
        "mine-notebooklm threw for $($notebook.notebook_id): $_" | Tee-Object -FilePath $logFile -Append
        $exitCode = 1
    }
}

exit $exitCode
