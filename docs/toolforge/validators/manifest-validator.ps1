param(
    [string]$Path,
    [string]$Schema
)

function Validate-PluginManifest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillPath,

        [Parameter(Mandatory = $true)]
        [string]$SchemaPath
    )

    $errors = @()
    $warnings = @()
    $valid = $true

    # Check if SKILL.json exists
    $skillJsonPath = Join-Path $SkillPath "SKILL.json"
    if (-not (Test-Path $skillJsonPath)) {
        $errors += "SKILL.json not found at $skillJsonPath"
        return @{ Valid = $false; Errors = $errors; Warnings = $warnings }
    }

    # Load SKILL.json
    try {
        $skillManifest = Get-Content $skillJsonPath | ConvertFrom-Json
    }
    catch {
        $errors += "Failed to parse SKILL.json: $_"
        return @{ Valid = $false; Errors = $errors; Warnings = $warnings }
    }

    # Load schema
    try {
        $schemaContent = Get-Content $SchemaPath | ConvertFrom-Json
    }
    catch {
        $errors += "Failed to parse schema: $_"
        return @{ Valid = $false; Errors = $errors; Warnings = $warnings }
    }

    # Check required fields
    $requiredFields = @("id", "name", "version", "description", "status", "category", "runtime", "entrypoint", "owner")
    foreach ($field in $requiredFields) {
        if (-not (Get-Member -InputObject $skillManifest -Name $field -MemberType NoteProperty)) {
            $errors += "Required field '$field' is missing"
            $valid = $false
        }
        elseif ([string]::IsNullOrWhiteSpace($skillManifest.$field)) {
            $errors += "Required field '$field' is empty"
            $valid = $false
        }
    }

    # Validate version semver
    if (Get-Member -InputObject $skillManifest -Name "version" -MemberType NoteProperty) {
        if ($skillManifest.version -notmatch '^\d+\.\d+\.\d+$') {
            $errors += "Version '$($skillManifest.version)' does not match semver pattern"
            $valid = $false
        }
    }

    # Validate ID pattern
    if (Get-Member -InputObject $skillManifest -Name "id" -MemberType NoteProperty) {
        if ($skillManifest.id -notmatch '^[a-z0-9-]+$') {
            $errors += "ID '$($skillManifest.id)' does not match pattern ^[a-z0-9-]+"
            $valid = $false
        }
    }

    # Validate enum values
    $categoryEnum = @("monitoring", "pipeline", "utility", "integration", "governance")
    if (Get-Member -InputObject $skillManifest -Name "category" -MemberType NoteProperty) {
        if ($skillManifest.category -notin $categoryEnum) {
            $errors += "Category '$($skillManifest.category)' is not in allowed values: $($categoryEnum -join ', ')"
            $valid = $false
        }
    }

    $statusEnum = @("active", "deprecated", "inactive")
    if (Get-Member -InputObject $skillManifest -Name "status" -MemberType NoteProperty) {
        if ($skillManifest.status -notin $statusEnum) {
            $errors += "Status '$($skillManifest.status)' is not in allowed values: $($statusEnum -join ', ')"
            $valid = $false
        }
    }

    $runtimeEnum = @("typescript", "powershell", "bash", "node")
    if (Get-Member -InputObject $skillManifest -Name "runtime" -MemberType NoteProperty) {
        if ($skillManifest.runtime -notin $runtimeEnum) {
            $errors += "Runtime '$($skillManifest.runtime)' is not in allowed values: $($runtimeEnum -join ', ')"
            $valid = $false
        }
    }

    # Validate _marketplace if present
    if (Get-Member -InputObject $skillManifest -Name "_marketplace" -MemberType NoteProperty) {
        $marketplace = $skillManifest._marketplace

        # Check registry_entry
        if (-not (Get-Member -InputObject $marketplace -Name "registry_entry" -MemberType NoteProperty)) {
            $errors += "_marketplace.registry_entry is required"
            $valid = $false
        }
        elseif ($marketplace.registry_entry -ne "toolforge-marketplace:1.0") {
            $errors += "_marketplace.registry_entry must be 'toolforge-marketplace:1.0', got '$($marketplace.registry_entry)'"
            $valid = $false
        }

        # Validate submission_status enum if present
        if (Get-Member -InputObject $marketplace -Name "submission_status" -MemberType NoteProperty) {
            $statusEnumMarketplace = @("pending", "approved", "published", "rejected", "deprecated")
            if ($marketplace.submission_status -notin $statusEnumMarketplace) {
                $errors += "_marketplace.submission_status '$($marketplace.submission_status)' is not valid"
                $valid = $false
            }
        }

        # Validate visibility enum if present
        if (Get-Member -InputObject $marketplace -Name "marketplace_visibility" -MemberType NoteProperty) {
            $visibilityEnum = @("public", "private", "deprecated")
            if ($marketplace.marketplace_visibility -notin $visibilityEnum) {
                $errors += "_marketplace.marketplace_visibility '$($marketplace.marketplace_visibility)' is not valid"
                $valid = $false
            }
        }

        # Validate caveman_review enum in conformance_check if present
        if (Get-Member -InputObject $marketplace -Name "conformance_check" -MemberType NoteProperty) {
            $conformance = $marketplace.conformance_check
            if (Get-Member -InputObject $conformance -Name "checks" -MemberType NoteProperty) {
                if (Get-Member -InputObject $conformance.checks -Name "caveman_review" -MemberType NoteProperty) {
                    $cavemanEnum = @("pending", "pass", "fail")
                    if ($conformance.checks.caveman_review -notin $cavemanEnum) {
                        $errors += "_marketplace.conformance_check.checks.caveman_review is not valid"
                        $valid = $false
                    }
                }
            }
        }
    }

    return @{ Valid = $valid; Errors = $errors; Warnings = $warnings }
}

# If called with parameters, validate the skill
if ($Path -and $Schema) {
    $result = Validate-PluginManifest -SkillPath $Path -SchemaPath $Schema
    if ($result.Valid) {
        Write-Output "✓ Manifest is valid"
        exit 0
    }
    else {
        Write-Output "✗ Manifest validation failed:"
        foreach ($error in $result.Errors) {
            Write-Output "  - $error"
        }
        exit 1
    }
}
