<#
.SYNOPSIS
  Stop Ollama (serve + llama-server runners) while a command runs, then restore it.
.EXAMPLE
  pwsh -NoProfile -File scripts\with-ollama-paused.ps1 -WorkingDirectory C:\dev\sigil-repo -Command 'npm test'
.NOTES
  Ollama keeps llama-server alive and respawns it whenever a client calls the API
  (helix daemon, bun workers). Stopping `ollama serve` itself is the only way to
  keep the runner dead. Restore relaunches `ollama serve` hidden with the same
  OLLAMA_HOST the original launcher used. Exit code is the command's exit code.
#>
param(
  [Parameter(Mandatory)][string]$Command,
  [string]$WorkingDirectory = (Get-Location).Path
)
$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
$wasRunning = [bool](Get-Process ollama -ErrorAction SilentlyContinue)
$flag = Join-Path $env:TEMP 'ollama-paused.flag'

function Stop-OllamaAll {
  # launcher pwsh first so nothing re-execs serve, then serve, then runners
  Get-CimInstance Win32_Process -Filter "Name='pwsh.exe'" |
    Where-Object { $_.CommandLine -match 'ollama\.exe.*serve' -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-Process ollama, 'ollama app', llama-server -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

$code = 1
try {
  Set-Content $flag (Get-Date -Format o)
  Stop-OllamaAll
  Start-Sleep 2
  Push-Location $WorkingDirectory
  & pwsh -NoProfile -Command $Command
  $code = $LASTEXITCODE
  Pop-Location
}
finally {
  Remove-Item $flag -ErrorAction SilentlyContinue
  if ($wasRunning) {
    $env:OLLAMA_HOST = '127.0.0.1:11434'
    Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden
    Write-Host '[with-ollama-paused] ollama restored'
  }
}
exit $code
