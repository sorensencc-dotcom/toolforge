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

    # Get all files in directory (excluding .git, node_modules, .env)
    $files = Get-ChildItem -Path $SkillPath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $path = $_.FullName
            -not ($path -match '\.git\\' -or $path -match 'node_modules\\' -or $path -match '\.env$')
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
            $hashInput += $file.FullName + "|" + $fileContent
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
