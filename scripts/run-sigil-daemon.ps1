# scripts/run-sigil-daemon.ps1
$ErrorActionPreference = "Stop"

$SigilDir = "C:\dev\sigil-repo"
$LogDir = Join-Path $SigilDir ".sigil\logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }

$RelayLog = Join-Path $LogDir "relay.log"
$ConnectorLog = Join-Path $LogDir "connector.log"

Write-Output "[$(Get-Date -Format o)] Starting Sigil Relay on port 3000..."
$relayProc = Start-Process -FilePath "node" `
  -ArgumentList "bin/sigil.mjs", "relay", "up", "--registry", ".sigil/registry.json", "--port", "3000" `
  -WorkingDirectory $SigilDir `
  -RedirectStandardOutput $RelayLog `
  -RedirectStandardError $RelayLog `
  -PassThru -NoNewWindow

# Wait up to 10 seconds for relay to bind port 3000
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 500
  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Error "Relay failed to start on port 3000. Inspect $RelayLog"
}

Write-Output "[$(Get-Date -Format o)] Starting Sigil Connector on port 4411..."
$connectorProc = Start-Process -FilePath "node" `
  -ArgumentList "sigil/cli/connector-daemon.mjs", "--port", "4411", "--relay-url", "http://127.0.0.1:3000", "--identity", ".sigil/grokbot.identity.json" `
  -WorkingDirectory $SigilDir `
  -RedirectStandardOutput $ConnectorLog `
  -RedirectStandardError $ConnectorLog `
  -PassThru -NoNewWindow

# Monitor processes
try {
  while ($true) {
    if ($relayProc.HasExited) {
      Write-Error "Sigil Relay terminated unexpectedly. ExitCode: $($relayProc.ExitCode)"
    }
    if ($connectorProc.HasExited) {
      Write-Error "Sigil Connector terminated unexpectedly. ExitCode: $($connectorProc.ExitCode)"
    }
    Start-Sleep -Seconds 2
  }
} finally {
  if ($relayProc -and -not $relayProc.HasExited) { Stop-Process -Id $relayProc.Id -Force -ErrorAction SilentlyContinue }
  if ($connectorProc -and -not $connectorProc.HasExited) { Stop-Process -Id $connectorProc.Id -Force -ErrorAction SilentlyContinue }
}
