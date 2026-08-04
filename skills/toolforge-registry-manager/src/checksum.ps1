param(
    [string]$Path,
    [string]$Algorithm = "SHA256"
)

function Get-PluginChecksum {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillPath,

        [Parameter(Mandatory = $true)]
        [string]$AlgorithmArg = "SHA256"
    )

    # Verify path exists
    if (-not (Test-Path $SkillPath)) {
        Write-Error "Path not found: $SkillPath"
        return $null
    }

    $root = (Resolve-Path $SkillPath).Path.TrimEnd('\')
    $excludedDirectories = @(".git", "node_modules", "tests")
    $excludedFiles = @("package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml")

    # Match install payload: omit development-only content and use relative paths.
    $files = Get-ChildItem -Path $SkillPath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $relative = $_.FullName.Substring($root.Length).TrimStart('\')
            $parts = $relative -split '[\\/]'
            ($parts | Where-Object { $excludedDirectories -contains $_ }).Count -eq 0 -and
            $excludedFiles -notcontains $_.Name -and
            $_.Name -notmatch '^\.env($|\.)'
        } |
        Sort-Object FullName

    if ($files.Count -eq 0) {
        Write-Error "No files found in $SkillPath"
        return $null
    }

    # Create combined hash input
    $hashInput = @()
    foreach ($file in $files) {
        $fileContent = Get-Content $file -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if ($fileContent) {
            $relative = $file.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
            $hashInput += $relative + "|" + $fileContent
        }
    }

    # Combine all and hash
    $combinedString = $hashInput -join "`n"

    # Create hash object
    $hashAlgorithm = [System.Security.Cryptography.HashAlgorithm]::Create($AlgorithmArg)
    $hashBytes = $hashAlgorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($combinedString))
    $hashHex = ($hashBytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""

    return "$($AlgorithmArg.ToLower())-$hashHex"
}

# If called with parameters, generate checksum
if ($Path) {
    $checksum = Get-PluginChecksum -SkillPath $Path -AlgorithmArg $Algorithm
    if ($checksum) {
        Write-Output $checksum
        exit 0
    }
    else {
        exit 1
    }
}
