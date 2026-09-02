param(
  [string]$IndexPath = '.ijfw/index/files.md',
  [int]$MaxEntries = 5000
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $IndexPath)) { throw "Index not found: $IndexPath" }
$lines = Get-Content -LiteralPath $IndexPath
$entries = @($lines | Where-Object { $_ -match '^- `([^`]+)`' })
$paths = @($entries | ForEach-Object { [regex]::Match($_, '^- `([^`]+)`').Groups[1].Value })
$errors = [System.Collections.Generic.List[string]]::new()

if ($entries.Count -gt $MaxEntries) { $errors.Add("entry count $($entries.Count) exceeds cap $MaxEntries") }
if (@($paths | Sort-Object -Unique).Count -ne $paths.Count) { $errors.Add('duplicate index paths detected') }
foreach ($pattern in @('/.claude/worktrees/','/.venv/','/_kb-sync-staging/','/node_modules/','/.ijfw/')) {
  if (@($paths | Where-Object { $_ -like "*$pattern*" }).Count -gt 0) { $errors.Add("forbidden path detected: $pattern") }
}
if (@($lines | Where-Object { $_ -eq 'Files: 5000' }).Count -gt 1) { $errors.Add('duplicate Files header') }
if (@($lines | Where-Object { $_ -eq '## By file' }).Count -ne 1) { $errors.Add('expected exactly one By file section') }
if (@($lines | Where-Object { $_ -match '[ \t]+$' }).Count -gt 0) { $errors.Add('trailing whitespace detected') }
if (@($lines | Where-Object { $_ -match '^NOTE: index truncated' }).Count -gt 1) { $errors.Add('duplicate truncation footer') }

if ($errors.Count) {
  $errors | ForEach-Object { Write-Error $_ }
  exit 1
}
Write-Output "Index valid: $($paths.Count) unique entries"
