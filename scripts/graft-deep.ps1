<#
.SYNOPSIS
    Multi-Model Cost-Routing Gateway Wrapper for Graft Deep Concept Synthesis.

.DESCRIPTION
    Automates Tier 0 (Local Ollama $0.00), Tier 1 (Paid Muscle / OpenRouter), 
    and Tier 2 (Frontier) execution for `graft build --deep` across workspaces.

.PARAMETER RepoPath
    Target repository path (default: ".").

.PARAMETER Tier
    Routing tier: 'auto' (default), 'tier0' ('ollama'), 'tier1' ('muscle'), or 'tier2' ('frontier').

.PARAMETER Model
    Override model identifier.

.PARAMETER Concurrency
    Concurrent files to summarize (default: 5).

.PARAMETER AllowPartial
    Accept partial meaning coverage without failing. Defaults to $true on Tier 0.

.PARAMETER NoReuse
    Force cold re-parse of all files instead of replaying cache.

.PARAMETER DryRun
    Display resolved tier, model, and execution flags without running graft.
#>

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$RepoPath = ".",

    [Parameter()]
    [ValidateSet("auto", "tier0", "tier1", "tier2", "ollama", "muscle", "frontier")]
    [string]$Tier = "auto",

    [Parameter()]
    [string]$Model,

    [Parameter()]
    [int]$Concurrency = 5,

    [Parameter()]
    [switch]$AllowPartial,

    [Parameter()]
    [switch]$NoReuse,

    [Parameter()]
    [switch]$DryRun,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Resolve target directory
$resolvedRepo = (Resolve-Path $RepoPath).Path
if (-not (Test-Path $resolvedRepo)) {
    Write-Error "Target repository path does not exist: $RepoPath"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Graft Multi-Model Cost-Routing Gateway — Deep Synthesis" -ForegroundColor Cyan
Write-Host " Target Repo: $resolvedRepo" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan

# Helper to probe local Ollama health
function Test-OllamaHealth {
    param([string]$Url = "http://127.0.0.1:11434")
    try {
        $response = Invoke-RestMethod -Uri "$Url/api/tags" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($response -and $response.models) {
            return @{
                Available = $true
                Models = ($response.models | ForEach-Object { $_.name })
            }
        }
    } catch {
        # Offline or unreachable
    }
    return @{ Available = $false; Models = @() }
}

$ollamaStatus = Test-OllamaHealth

# Resolve Tier & Provider Configuration
$selectedTier = $Tier.ToLower()
$provider = ""
$baseUrl = ""
$apiKey = ""
$selectedModel = $Model
$enableAllowPartial = $AllowPartial.IsPresent

if ($selectedTier -eq "auto") {
    if ($env:OPENROUTER_API_KEY) {
        $selectedTier = "tier1"
        Write-Host "[Gateway Routing] OPENROUTER_API_KEY detected -> Selecting Tier 1 (Paid Muscle Cloud)" -ForegroundColor Green
    } elseif ($ollamaStatus.Available) {
        $selectedTier = "tier0"
        Write-Host "[Gateway Routing] Local Ollama detected -> Selecting Tier 0 (Offline Substrate $0.00)" -ForegroundColor Green
    } elseif ($env:ANTHROPIC_API_KEY) {
        $selectedTier = "tier2"
        Write-Host "[Gateway Routing] ANTHROPIC_API_KEY detected -> Selecting Tier 2 (Frontier Native)" -ForegroundColor Green
    } else {
        Write-Error "No active provider found. Please start local Ollama (http://127.0.0.1:11434) or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY."
        exit 1
    }
}

switch ($selectedTier) {
    { $_ -in "tier0", "ollama" } {
        if (-not $ollamaStatus.Available) {
            Write-Warning "Local Ollama appears offline on http://127.0.0.1:11434. Trying to proceed anyway..."
        }
        $provider = "openai"
        $baseUrl = "http://127.0.0.1:11434/v1"
        $apiKey = "ollama"
        if (-not $selectedModel) {
            # Prefer Qwen 2.5 7B, fall back to Llama 3.1 8B or first available model
            if ($ollamaStatus.Models -contains "qwen2.5:7b") {
                $selectedModel = "qwen2.5:7b"
            } elseif ($ollamaStatus.Models -contains "llama3.1:8b") {
                $selectedModel = "llama3.1:8b"
            } elseif ($ollamaStatus.Models.Count -gt 0) {
                $selectedModel = $ollamaStatus.Models[0]
            } else {
                $selectedModel = "qwen2.5:7b"
            }
        }
        # Tier 0 defaults to graceful partial fallback to ensure exit 0 on minor schema drop
        $enableAllowPartial = $true
        Write-Host "[Tier 0: Local Ollama] Model: $selectedModel | Rate: $0.00/1M tokens" -ForegroundColor Cyan
    }

    { $_ -in "tier1", "muscle" } {
        $apiKey = if ($env:OPENROUTER_API_KEY) { $env:OPENROUTER_API_KEY } else { "missing_key" }
        if ($apiKey -eq "missing_key") {
            Write-Error "OPENROUTER_API_KEY environment variable is required for Tier 1 (Paid Muscle)."
            exit 1
        }
        $provider = "openai"
        $baseUrl = "https://openrouter.ai/api/v1"
        if (-not $selectedModel) {
            $selectedModel = "deepseek/deepseek-chat"
        }
        Write-Host "[Tier 1: Paid Muscle] Model: $selectedModel | Endpoint: OpenRouter" -ForegroundColor Magenta
    }

    { $_ -in "tier2", "frontier" } {
        if ($env:ANTHROPIC_API_KEY) {
            $provider = "anthropic"
            $apiKey = $env:ANTHROPIC_API_KEY
            if (-not $selectedModel) {
                $selectedModel = "claude-3-5-sonnet-20241022"
            }
            Write-Host "[Tier 2: Frontier Native] Model: $selectedModel | Provider: Anthropic" -ForegroundColor Yellow
        } elseif ($env:OPENROUTER_API_KEY) {
            $provider = "openai"
            $baseUrl = "https://openrouter.ai/api/v1"
            $apiKey = $env:OPENROUTER_API_KEY
            if (-not $selectedModel) {
                $selectedModel = "anthropic/claude-3.5-sonnet"
            }
            Write-Host "[Tier 2: Frontier Routed] Model: $selectedModel | Endpoint: OpenRouter" -ForegroundColor Yellow
        } else {
            Write-Error "ANTHROPIC_API_KEY or OPENROUTER_API_KEY required for Tier 2."
            exit 1
        }
    }
}

# Construct graft CLI command arguments
$graftArgs = @("build", "--deep")

if ($provider) { $graftArgs += @("--provider", $provider) }
if ($baseUrl)  { $graftArgs += @("--base-url", $baseUrl) }
if ($apiKey)   { $graftArgs += @("--api-key", $apiKey) }
if ($selectedModel) { $graftArgs += @("--model", $selectedModel) }
if ($Concurrency)   { $graftArgs += @("--concurrency", "$Concurrency") }
if ($enableAllowPartial) { $graftArgs += "--allow-partial" }
if ($NoReuse) { $graftArgs += "--no-reuse" }
if ($ExtraArgs) { $graftArgs += $ExtraArgs }

if ($DryRun) {
    Write-Host "`n[DRY RUN] Would execute in $resolvedRepo :" -ForegroundColor DarkYellow
    $maskedKey = if ($apiKey.Length -gt 8) { $apiKey.Substring(0, 4) + "..." + $apiKey.Substring($apiKey.Length - 4) } else { "***" }
    $displayArgs = $graftArgs | ForEach-Object { if ($_ -eq $apiKey) { $maskedKey } else { $_ } }
    Write-Host "graft $($displayArgs -join ' ')" -ForegroundColor White
    exit 0
}

# Run graft build --deep inside target repo
Push-Location $resolvedRepo
try {
    Write-Host "`n[*] Starting graft build --deep..." -ForegroundColor DarkGray
    & graft @graftArgs
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host "`n[SUCCESS] Concept synthesis and wiring graph complete." -ForegroundColor Green
    } else {
        Write-Host "`n[WARNING] graft exited with code $exitCode. (Cached nodes preserved; run again to resume)." -ForegroundColor Yellow
    }
    exit $exitCode
} catch {
    Write-Error "Execution failed: $_"
    exit 1
} finally {
    Pop-Location
}
