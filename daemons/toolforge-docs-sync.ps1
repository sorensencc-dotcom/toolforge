$root = "C:\dev\toolforge"
$manifestPath = Join-Path $root "manifest.json"
$docsIndex = Join-Path $root "DOCS_INDEX.md"

if (-not (Test-Path $manifestPath)) {
    Write-Error "manifest.json not found. Run toolforge-manifest-sync.ps1 first."
    exit 1
}

$manifest = Get-Content $manifestPath | ConvertFrom-Json

$content = "# Toolforge Docs Index`n`nGenerated: $(Get-Date)`n`n"

foreach ($tool in $manifest.tools) {
    $readmePath = Join-Path $tool.path "README.md"
    $readme = ""
    if (Test-Path $readmePath) {
        $readme = Get-Content $readmePath -Raw
    }

    $content += "## ${($tool.name)} [${($tool.category)}]`n`n"
    $content += "**Path:** `$($tool.path)`  `n"
    $content += "**Version:** $($tool.version)`n`n"
    if ($readme) {
        $content += "$readme`n`n"
    } else {
        $content += "_No README.md found._`n`n"
    }
}

Set-Content -Path $docsIndex -Value $content
Write-Output "Toolforge DOCS_INDEX.md updated."
