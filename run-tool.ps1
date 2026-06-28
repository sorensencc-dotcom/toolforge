param(
    [Parameter(Mandatory=$true)]
    [string]$Name,

    [Parameter(Mandatory=$true)]
    [string]$Category
)

$root = "C:\dev\toolforge"
$manifestPath = Join-Path $root "manifest.json"

if (-not (Test-Path $manifestPath)) {
    Write-Error "manifest.json not found. Run toolforge-manifest-sync.ps1 first."
    exit 1
}

$manifest = Get-Content $manifestPath | ConvertFrom-Json
$tool = $manifest.tools | Where-Object { $_.name -eq $Name -and $_.category -eq $Category }

if (-not $tool) {
    Write-Error "Tool '$Name' in category '$Category' not found in manifest."
    exit 1
}

$entry = $tool.entrypoint
if (-not $entry) {
    Write-Error "Tool '$Name' has no entrypoint defined."
    exit 1
}

$entryPath = Join-Path $tool.path $entry

if (-not (Test-Path $entryPath)) {
    Write-Error "Entrypoint '$entryPath' does not exist."
    exit 1
}

Write-Output "Running $Name ($Category) via $entryPath"

if ($entryPath.EndsWith(".ps1")) {
    pwsh $entryPath
} elseif ($entryPath.EndsWith(".js") -or $entryPath.EndsWith(".ts")) {
    node $entryPath
} else {
    & $entryPath
}
