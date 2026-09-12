param(
  [string]$SourcePath,
  [string]$DestinationPath,
  [switch]$AgentMemorySync,
  [string]$WorkspacePath,
  [switch]$DryRun
)
if ($AgentMemorySync) {
  $args = @('sync-tools/agent-memory-sync.cjs')
  if ($DryRun) { $args += '--dry-run' }
  if ($WorkspacePath) { $args += $WorkspacePath }
  & node @args
  exit $LASTEXITCODE
}
Copy-Item -Recurse -Force "C:\dev\_TEMPLATE" "C:\dev\\"
