param(
    [Parameter(Mandatory=$true)]
    [string]$Name,

    [Parameter(Mandatory=$true)]
    [ValidateSet("mcp-servers","adapters","daemons","sync-tools","scaffolds","prototypes","utilities")]
    [string]$Category
)

$root = "C:\dev\toolforge"
$template = "$root\_TEMPLATE"
$target = "$root\$Category\$Name"

if (Test-Path $target) {
    Write-Error "Tool '$Name' already exists in category '$Category'."
    exit 1
}

Copy-Item -Recurse -Force $template $target

(Get-Content "$target\README.md") -replace "<Tool Name>", $Name |
    Set-Content "$target\README.md"

New-Item -ItemType File -Path "$target\VERSION.md" -Value "version: 0.1.0`ndate: $(Get-Date -Format yyyy-MM-dd)`nnotes:`n  - initial scaffold" | Out-Null

Write-Output "Created new tool: $target"
