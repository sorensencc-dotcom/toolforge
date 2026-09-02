<#
.SYNOPSIS
    Initialize and register Graft's local MCP tools with Claude Desktop and VS Code.
.DESCRIPTION
    Automates installation and wiring of the Graft Model Context Protocol (MCP) server
    into Claude Desktop configuration and VS Code workspace settings.
.VERSION
    1.0.2
.DATE
    2026-09-02
#>

$ErrorActionPreference = "Stop"

# ANSI Colors
$Esc = [char]27
$ColorGreen  = "$Esc[32m"
$ColorYellow = "$Esc[33m"
$ColorRed    = "$Esc[31m"
$ColorCyan   = "$Esc[36m"
$ColorReset  = "$Esc[0m"

function Write-LogInfo($msg) {
    Write-Host "${ColorGreen}[GRAFT-MCP-INIT] [INFO]${ColorReset} $msg"
}

function Write-LogWarn($msg) {
    Write-Host "${ColorYellow}[GRAFT-MCP-INIT] [WARN]${ColorReset} $msg"
}

function Write-LogError($msg) {
    Write-Host "${ColorRed}[GRAFT-MCP-INIT] [ERROR]${ColorReset} $msg" -ErrorAction Continue
}

Write-Host "`n${ColorCyan}=== [Graft MCP Registration & Workspace Wiring] ===${ColorReset}"

# 1. Verify Graft is installed on the local system
Write-LogInfo "Checking if Graft CLI is available in PATH..."
$graftCmd = "graft"
$graftPath = Get-Command graft -ErrorAction SilentlyContinue

if (-not $graftPath) {
    Write-LogWarn "Graft executable was not found in your system's PATH."
    Write-LogWarn "Falling back to default 'graft' execution path..."
} else {
    $resolvedPath = $graftPath.Source
    # On Windows, if PowerShell resolves to .ps1, prefer .cmd/.exe so Claude Desktop (Node child_process) can spawn it
    if ($resolvedPath.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
        $cmdCandidate = [System.IO.Path]::ChangeExtension($resolvedPath, ".cmd")
        $exeCandidate = [System.IO.Path]::ChangeExtension($resolvedPath, ".exe")
        if (Test-Path $cmdCandidate) {
            $resolvedPath = $cmdCandidate
        } elseif (Test-Path $exeCandidate) {
            $resolvedPath = $exeCandidate
        }
    }
    Write-LogInfo "Graft found at: $resolvedPath"
    $graftCmd = $resolvedPath
}

# 2. Resolve Claude Desktop global config path
Write-LogInfo "Resolving Claude Desktop global configuration file..."
$appDataPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
$claudeConfigDir = Join-Path $appDataPath "Claude"
$claudeConfigPath = Join-Path $claudeConfigDir "claude_desktop_config.json"

if (-not (Test-Path $claudeConfigDir)) {
    Write-LogInfo "Creating Claude Desktop config directory: $claudeConfigDir"
    New-Item -ItemType Directory -Path $claudeConfigDir -Force | Out-Null
}

# 3. Read or initialize Claude config
$config = @{ "mcpServers" = @{} }
if (Test-Path $claudeConfigPath) {
    Write-LogInfo "Existing Claude Desktop configuration detected. Merging Graft..."
    try {
        $existingContent = Get-Content -Raw -Path $claudeConfigPath
        if (-not [string]::IsNullOrWhiteSpace($existingContent)) {
            $config = ConvertFrom-Json $existingContent -AsHashtable
            if (-not $config.ContainsKey("mcpServers")) {
                $config["mcpServers"] = @{}
            }
        }
    } catch {
        Write-LogWarn "Failed to parse existing config. Backing up to .bak and starting fresh."
        Copy-Item $claudeConfigPath "$claudeConfigPath.bak" -Force
    }
}

# Add Graft MCP Server configurations
$graftMcpConfig = @{
    "command" = $graftCmd
    "args"    = @("mcp")
}

$config["mcpServers"]["graft"] = $graftMcpConfig

# Save config back
Write-LogInfo "Writing updated Claude configuration to: $claudeConfigPath"
$jsonConfig = ConvertTo-Json $config -Depth 100
[System.IO.File]::WriteAllText($claudeConfigPath, $jsonConfig, [System.Text.Encoding]::UTF8)

# 4. Wire Workspace-Level VS Code / Cursor Settings
$workspaceDir = Get-Location
$vscodeDir = Join-Path $workspaceDir ".vscode"
$settingsPath = Join-Path $vscodeDir "settings.json"

Write-LogInfo "Checking for local workspace settings in: $workspaceDir"
if (Test-Path $vscodeDir) {
    Write-LogInfo "Active .vscode workspace folder found. Configuring local integration..."
    
    $vscodeSettings = @{}
    if (Test-Path $settingsPath) {
        try {
            $existingSettings = Get-Content -Raw -Path $settingsPath
            if (-not [string]::IsNullOrWhiteSpace($existingSettings)) {
                $vscodeSettings = ConvertFrom-Json $existingSettings -AsHashtable
            }
        } catch {
            Write-LogWarn "Unable to parse local .vscode/settings.json. Proceeding safely."
        }
    }

    $vscodeSettings["graft.indexOnSave"] = $true
    $vscodeSettings["graft.autoSyncBuffers"] = $true
    
    Write-LogInfo "Updating workspace settings at: $settingsPath"
    $jsonSettings = ConvertTo-Json $vscodeSettings -Depth 100
    [System.IO.File]::WriteAllText($settingsPath, $jsonSettings, [System.Text.Encoding]::UTF8)
} else {
    Write-LogWarn "No active .vscode folder detected in current workspace directory."
    Write-LogWarn "Skipping local workspace extension overrides. Global Claude config has been successfully set."
}

Write-Host "================================================================================"
Write-Host "${ColorGreen}REGISTRATION SUCCESSFUL: Graft MCP tools have been configured!${ColorReset}"
Write-Host "Please restart Claude Desktop, Cursor, or VS Code to load the tools."
Write-Host "===============================================================================`n"
