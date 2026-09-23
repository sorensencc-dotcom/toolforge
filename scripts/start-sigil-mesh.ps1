# scripts/start-sigil-mesh.ps1
# Launches and health-checks local Sigil Relay (port 3000) and Connector (port 4411)

param(
  [int]$RelayPort = 3000,
  [int]$ConnectorPort = 4411,
  [string]$SigilRepoPath = "C:\dev\sigil-repo",
  [string]$Domain = "local"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Starting Sigil Mesh Service Orchestrator ===" -ForegroundColor Cyan

# 1. Ensure .sigil state directory exists
$sigilDir = Join-Path $SigilRepoPath ".sigil"
if (-not (Test-Path $sigilDir)) {
  New-Item -ItemType Directory -Path $sigilDir -Force | Out-Null
}

$registryFile = Join-Path $sigilDir "registry.json"
if (-not (Test-Path $registryFile)) {
  "[]" | Set-Content -Path $registryFile -Encoding utf8
}

# 2. Initialize Identities with federated owner syntax (e.g. usr_system@local)
$grokIdentity = Join-Path $sigilDir "grokbot.identity.json"
if (-not (Test-Path $grokIdentity)) {
  Write-Host "[1/4] Initializing grokbot identity (usr_system@$Domain)..." -ForegroundColor Yellow
  node (Join-Path $SigilRepoPath "bin\sigil.mjs") init grokbot --owner "usr_system@$Domain" --registry $registryFile --domain $Domain --kind agent
} else {
  Write-Host "[1/4] grokbot identity exists" -ForegroundColor Green
}

$claudeIdentity = Join-Path $sigilDir "claude.identity.json"
if (-not (Test-Path $claudeIdentity)) {
  Write-Host "[2/4] Initializing claude recipient identity (usr_operator@$Domain)..." -ForegroundColor Yellow
  node (Join-Path $SigilRepoPath "bin\sigil.mjs") init claude --owner "usr_operator@$Domain" --registry $registryFile --domain $Domain --kind agent
} else {
  Write-Host "[2/4] claude identity exists" -ForegroundColor Green
}

# 3. Check / Launch Relay on port 3000
$relayListening = Get-NetTCPConnection -LocalPort $RelayPort -ErrorAction SilentlyContinue
if (-not $relayListening) {
  Write-Host "[3/4] Launching Sigil Relay on port $RelayPort..." -ForegroundColor Yellow
  $relayScript = Join-Path $SigilRepoPath "bin\sigil.mjs"
  Start-Process -FilePath "node" -ArgumentList "$relayScript relay up --registry $registryFile --port $RelayPort" -WorkingDirectory $SigilRepoPath -WindowStyle Hidden
  Start-Sleep -Seconds 2
} else {
  Write-Host "[3/4] Sigil Relay listening on port $RelayPort" -ForegroundColor Green
}

# 4. Check / Launch Connector loopback on port 4411
$connectorListening = Get-NetTCPConnection -LocalPort $ConnectorPort -ErrorAction SilentlyContinue
if (-not $connectorListening) {
  Write-Host "[4/4] Launching Sigil Connector loopback on port $ConnectorPort..." -ForegroundColor Yellow
  $daemonScript = Join-Path $SigilRepoPath "sigil\cli\connector-daemon.mjs"
  Start-Process -FilePath "node" -ArgumentList "$daemonScript --port $ConnectorPort --relay-url http://127.0.0.1:$RelayPort --identity $grokIdentity" -WorkingDirectory $SigilRepoPath -WindowStyle Hidden
  Start-Sleep -Seconds 2
} else {
  Write-Host "[4/4] Sigil Connector listening on port $ConnectorPort" -ForegroundColor Green
}

Write-Host "=== Sigil Mesh Check Complete ===" -ForegroundColor Cyan
