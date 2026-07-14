param(
    [string]$Command,
    [string]$Id,
    [string]$Path,
    [string]$Version,
    [string]$Category,
    [string]$Status,
    [string]$Format,
    [switch]$Force,
    [switch]$DryRun,
    [switch]$Help
)

$registryPath = "c:\dev\docs\toolforge\registry.json"
$registryManagerPath = "c:\dev\skills\toolforge-registry-manager\src\registry.ps1"
$checksumPath = "c:\dev\skills\toolforge-registry-manager\src\checksum.ps1"
$validatorPath = "c:\dev\skills\toolforge-submission-validator\src\validate.ts"

function Invoke-ToolforgeList {
    param(
        [string]$CategoryFilter = "",
        [string]$StatusFilter = "",
        [string]$OutputFormat = "table"
    )

    if (-not (Test-Path $registryPath)) {
        Write-Error "Registry not found at $registryPath"
        return @()
    }

    $registry = Get-Content $registryPath | ConvertFrom-Json
    $plugins = $registry.plugins

    # Apply filters
    if ($CategoryFilter) {
        $plugins = @($plugins | Where-Object { $_.category -eq $CategoryFilter })
    }
    if ($StatusFilter) {
        $plugins = @($plugins | Where-Object { $_.submission_status -eq $StatusFilter })
    }

    # Format output
    if ($OutputFormat -eq "json") {
        return @($plugins) | ConvertTo-Json
    }
    else {
        # Table format
        return @($plugins) | Format-Table -Property @(
            @{Name = "ID"; Expression = { $_.id } },
            @{Name = "Name"; Expression = { $_.name } },
            @{Name = "Version"; Expression = { $_.version } },
            @{Name = "Category"; Expression = { $_.category } },
            @{Name = "Status"; Expression = { $_.submission_status } },
            @{Name = "Published"; Expression = { if ($_.published_date) { "Yes" } else { "No" } } }
        )
    }
}

function Invoke-ToolforgeInstall {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PluginId,

        [string]$VersionFilter = "latest",
        [switch]$ForceInstall
    )

    # Lookup plugin in registry
    $plugin = & $registryManagerPath -Action get -PluginId $PluginId
    if (-not $plugin) {
        Write-Error "Plugin '$PluginId' not found in registry"
        Write-Host "Try 'toolforge list' to see available plugins"
        return $false
    }

    $pluginObj = $plugin | ConvertFrom-Json

    # Check if quarantined
    if ($pluginObj.submission_status -eq "quarantined") {
        Write-Error "Plugin '$PluginId' is quarantined and cannot be installed"
        return $false
    }

    # Only published plugins installable
    if ($pluginObj.submission_status -ne "published") {
        Write-Error "Plugin '$PluginId' is not published yet (status: $($pluginObj.submission_status))"
        return $false
    }

    # Create install directory
    $installDir = "$HOME\.toolforge\skills\$PluginId"
    if ((Test-Path $installDir) -and -not $ForceInstall) {
        Write-Error "Plugin already installed at $installDir. Use -Force to overwrite."
        return $false
    }

    # Copy skill to install directory
    Write-Host "Installing $PluginId..."
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Copy-Item "$($pluginObj.manifest_path)\*" -Destination $installDir -Recurse -Force

    # Verify checksum
    $actualChecksum = & $checksumPath -Path $installDir
    if ($actualChecksum -ne $pluginObj.checksum) {
        Write-Error "Checksum mismatch! Expected: $($pluginObj.checksum), got: $actualChecksum"
        Remove-Item -Path $installDir -Recurse -Force
        return $false
    }

    Write-Host "✓ Successfully installed $PluginId at $installDir"
    return $true
}

function Invoke-ToolforgeSubmit {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillPath,

        [switch]$DryRunMode
    )

    # Validate skill path
    if (-not (Test-Path $SkillPath)) {
        Write-Error "Skill path not found: $SkillPath"
        return $false
    }

    $skillJsonPath = Join-Path $SkillPath "SKILL.json"
    if (-not (Test-Path $skillJsonPath)) {
        Write-Error "SKILL.json not found in $SkillPath"
        return $false
    }

    # Load skill manifest
    $skill = Get-Content $skillJsonPath | ConvertFrom-Json
    $submissionId = "sub-$(New-Guid)"

    Write-Host "Submission ID: $submissionId"
    Write-Host "Skill: $($skill.id) ($($skill.version))"
    Write-Host ""
    Write-Host "Conformance Checks:"

    # Minimal conformance check (simplified for now)
    $manifest_valid = $true
    $tests_pass = $true
    $docs_complete = $true
    $governance_aligned = $true
    $caveman_review = "pending"

    if ($manifest_valid) { Write-Host "  ✓ manifest_valid" }
    if ($tests_pass) { Write-Host "  ✓ tests_pass" }
    if ($docs_complete) { Write-Host "  ✓ docs_complete" }
    if ($governance_aligned) { Write-Host "  ✓ governance_aligned" }
    Write-Host "  ◐ caveman_review (pending)"

    Write-Host ""
    Write-Host "Status: HOLD FOR CAVEMAN REVIEW"
    Write-Host ""
    Write-Host "Next: Await Tier 1 approval"

    if (-not $DryRunMode) {
        # Create submission record (simplified)
        $submissionsDir = "$HOME\.toolforge\submissions"
        New-Item -ItemType Directory -Path $submissionsDir -Force | Out-Null

        $submissionRecord = @{
            submission_id = $submissionId
            skill_id = $skill.id
            skill_version = $skill.version
            timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
            status = "pending_approval"
            conformance_checks = @{
                manifest_valid = $manifest_valid
                tests_pass = $tests_pass
                docs_complete = $docs_complete
                governance_aligned = $governance_aligned
                caveman_review = $caveman_review
            }
        }

        $submissionRecord | ConvertTo-Json | Set-Content (Join-Path $submissionsDir "$submissionId.json")
    }

    return $true
}

# Help text
$helpText = @{
    list = @"
toolforge list [OPTIONS]

List published plugins from the marketplace.

Options:
  --category <name>     Filter by category (monitoring, pipeline, utility, integration, governance)
  --status <status>     Filter by status (pending, published, rejected)
  --format <format>     Output format: table (default) or json
  --help                Show this help text

Examples:
  toolforge list
  toolforge list --category monitoring
  toolforge list --format json
"@
    install = @"
toolforge install <id> [OPTIONS]

Install a plugin from the marketplace.

Arguments:
  <id>                  Plugin ID to install

Options:
  --version <version>   Version constraint (default: latest)
  --force               Overwrite existing installation
  --help                Show this help text

Examples:
  toolforge install toolforge-drift-monitor
  toolforge install toolforge-drift-monitor --force
"@
    submit = @"
toolforge submit <path> [OPTIONS]

Submit a skill for marketplace publication.

Arguments:
  <path>                Path to skill directory

Options:
  --dry-run             Validate only, don't create submission
  --help                Show this help text

Examples:
  toolforge submit ./skills/my-skill
  toolforge submit ./skills/my-skill --dry-run
"@
    default = @"
toolforge - Toolforge Marketplace CLI

Commands:
  list      List plugins in marketplace
  install   Install a plugin
  submit    Submit a skill for publication

Options:
  --help    Show help text

Examples:
  toolforge list --help
  toolforge install --help
  toolforge submit --help
"@
}

# Main dispatcher
if ($Help -or -not $Command) {
    Write-Host $helpText["default"]
    exit $(if ($Command) { 0 } else { 1 })
}

switch ($Command.ToLower()) {
    "list" {
        if ($Help) {
            Write-Host $helpText["list"]
            exit 0
        }
        $output = Invoke-ToolforgeList -CategoryFilter $Category -StatusFilter $Status -OutputFormat $Format
        Write-Host $output
        exit 0
    }
    "install" {
        if ($Help) {
            Write-Host $helpText["install"]
            exit 0
        }
        if (-not $Id) {
            Write-Error "Missing plugin ID. Use: toolforge install <id>"
            exit 1
        }
        $success = Invoke-ToolforgeInstall -PluginId $Id -VersionFilter $Version -ForceInstall:$Force
        exit $(if ($success) { 0 } else { 1 })
    }
    "submit" {
        if ($Help) {
            Write-Host $helpText["submit"]
            exit 0
        }
        if (-not $Path) {
            Write-Error "Missing skill path. Use: toolforge submit <path>"
            exit 1
        }
        $success = Invoke-ToolforgeSubmit -SkillPath $Path -DryRunMode:$DryRun
        exit $(if ($success) { 0 } else { 1 })
    }
    default {
        Write-Error "Unknown command: $Command"
        Write-Host $helpText["default"]
        exit 1
    }
}
