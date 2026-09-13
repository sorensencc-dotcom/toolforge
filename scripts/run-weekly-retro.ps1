$ErrorActionPreference = "Stop"

$RepoRoot = "C:\dev"
$ClaudeExe = "C:\Users\soren\.local\bin\claude.exe"
$LogDir = Join-Path $RepoRoot "logs\retro"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "retro-$Stamp.log"

Set-Location $RepoRoot
& $ClaudeExe -p "/retro" --permission-mode bypassPermissions *>&1 | Tee-Object -FilePath $LogFile
