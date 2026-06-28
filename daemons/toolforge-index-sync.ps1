$root = "C:\dev\toolforge"
$index = "$root\INDEX.md"

$categories = @(
    "mcp-servers",
    "adapters",
    "daemons",
    "sync-tools",
    "scaffolds",
    "prototypes",
    "utilities"
)

$content = "# Toolforge Index`n`nGenerated: $(Get-Date)`n`n"

foreach ($cat in $categories) {
    $content += "## $cat`n`n"
    $path = "$root\$cat"

    if (Test-Path $path) {
        $tools = Get-ChildItem -Directory $path | Where-Object { $_.Name -notlike "_*" }
        foreach ($t in $tools) {
            $content += "- **$($t.Name)**`n"
        }
    }

    $content += "`n"
}

Set-Content -Path $index -Value $content
Write-Output "Toolforge INDEX.md updated."
