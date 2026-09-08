# scripts/run-sigil-daemon.ps1
# Persistent Sigil mesh: relay (:8791) + stream (:8793) + connector (:4411) + ep_grokbot inbox loop.
$ErrorActionPreference = "Stop"

$SigilDir = "C:\dev\sigil-repo"
$LogDir = Join-Path $SigilDir ".sigil\logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }

$RelayPort = 8791
$StreamPort = 8793
$ConnectorPort = 4411
$RelayUrl = "http://127.0.0.1:$RelayPort"
$StreamUrl = "ws://127.0.0.1:$StreamPort/v1/stream"

$RelayLog = Join-Path $LogDir "relay.log"
$ConnectorLog = Join-Path $LogDir "connector.log"
$GrokbotInboxLog = Join-Path $LogDir "grokbot-inbox.log"

function Test-PortListen([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Start-LoggedNode {
  param(
    [string]$Name,
    [string[]]$ArgumentList,
    [string]$LogPath
  )
  $errPath = "$LogPath.err"
  Write-Output "[$(Get-Date -Format o)] Starting $Name..."
  return Start-Process -FilePath "node" `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $SigilDir `
    -RedirectStandardOutput $LogPath `
    -RedirectStandardError $errPath `
    -PassThru -NoNewWindow
}

$env:SIGIL_DATABASE_URL = "postgresql://sigil:sigil_password@localhost:55432/sigil"

$procs = @()

if (Test-PortListen $RelayPort) {
  Write-Output "[$(Get-Date -Format o)] Relay already listening on $RelayPort — reusing."
  $relayProc = $null
} else {
  $relayProc = Start-LoggedNode -Name "Sigil Relay" -LogPath $RelayLog -ArgumentList @(
    "sigil/cli/sigil.mjs", "relay", "up",
    "--registry", ".sigil/registry.json",
    "--port", "$RelayPort",
    "--stream-port", "$StreamPort",
    "--database-url", "$env:SIGIL_DATABASE_URL"
  )
  $procs += $relayProc
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-PortListen $RelayPort) { $ready = $true; break }
  }
  if (-not $ready) {
    Write-Error "Relay failed to start on port $RelayPort. Inspect $RelayLog / $RelayLog.err"
  }
}

$existingConnector = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*connector-daemon*' }
if ($existingConnector -and (Test-PortListen $ConnectorPort)) {
  Write-Output "[$(Get-Date -Format o)] Connector already on $ConnectorPort — reusing."
  $connectorProc = $null
} else {
  if ($existingConnector) {
    foreach ($p in @($existingConnector)) {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
  }
  $connectorProc = Start-LoggedNode -Name "Sigil Connector" -LogPath $ConnectorLog -ArgumentList @(
    "sigil/cli/connector-daemon.mjs",
    "--port", "$ConnectorPort",
    "--relay-url", $RelayUrl,
    "--identity", ".sigil/grokbot.identity.json"
  )
  $procs += $connectorProc
  Start-Sleep -Seconds 1
  if (-not (Test-PortListen $ConnectorPort)) {
    Write-Error "Connector failed to start on port $ConnectorPort. Inspect $ConnectorLog / $ConnectorLog.err"
  }
}

$existingListener = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*sigil.mjs*inbox*' -and $_.CommandLine -like '*grokbot.identity.json*' -and $_.CommandLine -like '*--loop*' }
if ($existingListener) {
  Write-Output "[$(Get-Date -Format o)] grokbot inbox --loop already running (PID $($existingListener.ProcessId)) — reusing."
  $inboxProc = $null
} else {
  Write-Output "[$(Get-Date -Format o)] Starting ep_grokbot inbox --wait --loop..."
  $inboxProc = Start-Process -FilePath "node" `
    -ArgumentList @(
      "sigil/cli/sigil.mjs", "inbox",
      "--identity", ".sigil/grokbot.identity.json",
      "--relay-url", $RelayUrl,
      "--stream-url", $StreamUrl,
      "--wait", "--loop"
    ) `
    -WorkingDirectory $SigilDir `
    -RedirectStandardOutput $GrokbotInboxLog `
    -RedirectStandardError ($GrokbotInboxLog + ".err") `
    -PassThru -NoNewWindow
  $procs += $inboxProc
}

Write-Output "[$(Get-Date -Format o)] Sigil mesh up: relay=$RelayUrl stream=$StreamUrl connector=http://127.0.0.1:$ConnectorPort grokbot-inbox-log=$GrokbotInboxLog"

try {
  while ($true) {
    foreach ($proc in $procs) {
      if ($proc -and $proc.HasExited) {
        Write-Error "Child process terminated unexpectedly (PID $($proc.Id), ExitCode $($proc.ExitCode))."
      }
    }
    Start-Sleep -Seconds 2
  }
} finally {
  foreach ($proc in $procs) {
    if ($proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
