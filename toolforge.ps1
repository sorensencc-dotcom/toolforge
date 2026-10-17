param(
  [string]$SourcePath,
  [string]$DestinationPath,
  [switch]$AgentMemorySync,
  [switch]$AgentTodoSync,
  [string]$WorkspacePath,
  [switch]$DryRun,
  [switch]$Help
)
if ($AgentMemorySync) {
  $nodeArgs = @('sync-tools/agent-memory-sync.cjs')
  if ($DryRun) { $nodeArgs += '--dry-run' }
  if ($WorkspacePath) { $nodeArgs += $WorkspacePath }
  & node @nodeArgs
  exit $LASTEXITCODE
}
if ($AgentTodoSync) {
  $nodeArgs = @('sync-tools/agent-todo-sync.cjs')
  if ($DryRun) { $nodeArgs += '--dry-run' }
  if ($WorkspacePath) { $nodeArgs += '--workspace-path'; $nodeArgs += $WorkspacePath }
  & node @nodeArgs
  exit $LASTEXITCODE
}

# Forward to Toolforge Marketplace CLI
$cliScript = Join-Path $PSScriptRoot "skills\toolforge-cli\src\cli.ps1"
if (Test-Path $cliScript) {
  $forwardArgs = @()
  if ($SourcePath) { $forwardArgs += $SourcePath }
  if ($DestinationPath) { $forwardArgs += $DestinationPath }
  if ($DryRun) { $forwardArgs += "--dry-run" }
  if ($Help) { $forwardArgs += "--help" }
  $forwardArgs += $args
  & pwsh -NoProfile -File $cliScript @forwardArgs
  exit $LASTEXITCODE
}

Copy-Item -Recurse -Force "C:\dev\_TEMPLATE" "C:\dev\\"
