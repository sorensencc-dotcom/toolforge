$root = "C:\dev\toolforge"
$manifest = "$root\manifest.json"

$categories = @(
  "mcp-servers","adapters","daemons",
  "sync-tools","scaffolds","prototypes","utilities"
)

$tools = @()

foreach ($cat in $categories) {
  $path = "$root\$cat"
  if (Test-Path $path) {
    Get-ChildItem -Directory $path | Where-Object { $_.Name -notlike "_*" } | ForEach-Object {
      $toolPath = $_.FullName
      $versionFile = Join-Path $toolPath "VERSION.md"
      $version = "0.0.0"
      if (Test-Path $versionFile) {
        $version = (Get-Content $versionFile | Select-String "version:").ToString().Split(":")[1].Trim()
      }

      $tools += [pscustomobject]@{
        name        = $_.Name
        category    = $cat
        path        = $toolPath
        description = ""
        entrypoint  = ""
        status      = "active"
        version     = $version
      }
    }
  }
}

$manifestObj = [pscustomobject]@{
  version   = "1.0.0"
  generated = (Get-Date).ToString("o")
  tools     = $tools
}

$manifestJson = $manifestObj | ConvertTo-Json -Depth 5
Set-Content -Path $manifest -Value $manifestJson

Write-Output "Toolforge manifest.json updated."
