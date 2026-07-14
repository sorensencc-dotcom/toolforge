param(
    [string]$Action,
    [string]$PluginId,
    [string]$Path,
    [string]$Checksum,
    [string]$Reason,
    [string]$Category
)

$registryPath = "c:\dev\docs\toolforge\registry.json"
$auditLogPath = "c:\dev\docs\toolforge\registry-audit.log"

function Get-CurrentTimestamp {
    return Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
}

function Add-AuditLog {
    param(
        [string]$Operation,
        [string]$PluginIdArg,
        [string]$Status,
        [string]$Details
    )

    $timestamp = Get-CurrentTimestamp
    $line = "$timestamp | $Operation | $PluginIdArg | $Status | $Details"
    Add-Content -Path $auditLogPath -Value $line
}

function Add-PluginToRegistry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PluginIdArg,

        [Parameter(Mandatory = $true)]
        [string]$PathArg,

        [Parameter(Mandatory = $true)]
        [string]$ChecksumArg
    )

    # Load registry
    $registry = Get-Content $registryPath | ConvertFrom-Json

    # Check if plugin already exists
    $existing = $registry.plugins | Where-Object { $_.id -eq $PluginIdArg }
    if ($existing) {
        Write-Error "Plugin '$PluginIdArg' already exists in registry"
        Add-AuditLog "ADD" $PluginIdArg "FAILED" "Plugin already exists"
        return $false
    }

    # Create new plugin entry
    $newEntry = @{
        id = $PluginIdArg
        manifest_path = $PathArg
        checksum = $ChecksumArg
        submission_status = "pending"
        published_date = $null
        installed_count = 0
        marketplace_visibility = "private"
        added_date = Get-CurrentTimestamp
        last_updated = Get-CurrentTimestamp
    }

    # Add to plugins array
    $registry.plugins += $newEntry
    $registry.metadata.total_plugins = $registry.plugins.Count
    $registry.metadata.pending_count = @($registry.plugins | Where-Object { $_.submission_status -eq "pending" }).Count
    $registry.metadata.published_count = @($registry.plugins | Where-Object { $_.submission_status -eq "published" }).Count
    $registry.metadata.deprecated_count = @($registry.plugins | Where-Object { $_.submission_status -eq "deprecated" }).Count
    $registry.generated = Get-CurrentTimestamp

    # Save registry
    $registry | ConvertTo-Json -Depth 10 | Set-Content $registryPath

    # Log
    Add-AuditLog "ADD" $PluginIdArg "SUCCESS" "Entry added with checksum $ChecksumArg"

    return $true
}

function Get-PluginFromRegistry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PluginIdArg
    )

    $registry = Get-Content $registryPath | ConvertFrom-Json
    return $registry.plugins | Where-Object { $_.id -eq $PluginIdArg } | Select-Object -First 1
}

function List-PublishedPlugins {
    param(
        [string]$CategoryFilter
    )

    $registry = Get-Content $registryPath | ConvertFrom-Json
    $result = $registry.plugins | Where-Object { $_.submission_status -eq "published" }

    if ($CategoryFilter) {
        $result = $result | Where-Object { $_.category -eq $CategoryFilter }
    }

    return @($result)
}

function Mark-PluginQuarantined {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PluginIdArg,

        [Parameter(Mandatory = $true)]
        [string]$ReasonArg
    )

    $registry = Get-Content $registryPath | ConvertFrom-Json

    # Find plugin
    $plugin = $registry.plugins | Where-Object { $_.id -eq $PluginIdArg }
    if (-not $plugin) {
        Write-Error "Plugin '$PluginIdArg' not found in registry"
        Add-AuditLog "QUARANTINE" $PluginIdArg "FAILED" "Plugin not found"
        return $false
    }

    # Update status
    $plugin.submission_status = "quarantined"
    $plugin.last_updated = Get-CurrentTimestamp

    # Save registry
    $registry.generated = Get-CurrentTimestamp
    $registry | ConvertTo-Json -Depth 10 | Set-Content $registryPath

    # Log
    Add-AuditLog "QUARANTINE" $PluginIdArg "SUCCESS" $ReasonArg

    return $true
}

function Update-RegistryMetadata {
    $registry = Get-Content $registryPath | ConvertFrom-Json

    # Recount all statuses
    $registry.metadata.total_plugins = $registry.plugins.Count
    $registry.metadata.pending_count = @($registry.plugins | Where-Object { $_.submission_status -eq "pending" }).Count
    $registry.metadata.published_count = @($registry.plugins | Where-Object { $_.submission_status -eq "published" }).Count
    $registry.metadata.deprecated_count = @($registry.plugins | Where-Object { $_.submission_status -eq "deprecated" }).Count
    $registry.generated = Get-CurrentTimestamp

    # Save registry
    $registry | ConvertTo-Json -Depth 10 | Set-Content $registryPath

    return $registry.metadata
}

# If called with parameters, execute action
if ($Action) {
    switch ($Action) {
        "add" {
            $success = Add-PluginToRegistry -PluginIdArg $PluginId -PathArg $Path -ChecksumArg $Checksum
            exit $(if ($success) { 0 } else { 1 })
        }
        "get" {
            $plugin = Get-PluginFromRegistry -PluginIdArg $PluginId
            if ($plugin) {
                Write-Output ($plugin | ConvertTo-Json)
                exit 0
            }
            else {
                Write-Error "Plugin not found"
                exit 1
            }
        }
        "list" {
            $plugins = List-PublishedPlugins -CategoryFilter $Category
            Write-Output ($plugins | ConvertTo-Json)
            exit 0
        }
        "quarantine" {
            $success = Mark-PluginQuarantined -PluginIdArg $PluginId -ReasonArg $Reason
            exit $(if ($success) { 0 } else { 1 })
        }
        "update-metadata" {
            $metadata = Update-RegistryMetadata
            Write-Output ($metadata | ConvertTo-Json)
            exit 0
        }
        default {
            Write-Error "Unknown action: $Action"
            exit 1
        }
    }
}
