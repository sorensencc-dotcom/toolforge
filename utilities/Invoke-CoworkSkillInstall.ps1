<#
.SYNOPSIS
  Register a canonical Toolforge skill into Cowork.

.DESCRIPTION
  Wrapper around cowork-plugin-customizer that registers skills
  with consistent error handling, logging, and metadata tracking.

  Calls:
    Invoke-CliScript -Skill cowork-plugin-customizer -Action create-skill

.PARAMETER SkillId
  Skill identifier (e.g., "roadmap-validator", "toolforge-drift-monitor")

.PARAMETER SourcePath
  Path to skill source (.SKILL.md or skill directory)

.PARAMETER Verbose
  Show detailed registration logs

.EXAMPLE
  Invoke-CoworkSkillInstall -SkillId "roadmap-validator" -SourcePath "C:\dev\skills\roadmap-validator"

.OUTPUTS
  Exit code 0 = success
  Exit code 1 = failure
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$SkillId,

  [Parameter(Mandatory=$true)]
  [string]$SourcePath,

  [switch]$Verbose
)

$ErrorActionPreference = "Stop"

$AUDIT_DIR = "C:\dev\audit"
$REGISTERED_LOG = Join-Path $AUDIT_DIR "COWORK-REGISTERED-SKILLS.md"
$ERROR_LOG = Join-Path $AUDIT_DIR "COWORK-REGISTRATION-ERRORS.md"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Log {
  param([string]$Message, [string]$Level = "INFO")
  if ($Verbose) {
    Write-Host "[$Level] $Message"
  }
}

function Ensure-AuditDir {
  if (-not (Test-Path $AUDIT_DIR)) {
    New-Item -ItemType Directory -Path $AUDIT_DIR -Force | Out-Null
    Log "Created audit directory: $AUDIT_DIR"
  }
}

function Initialize-RegisteredLog {
  if (-not (Test-Path $REGISTERED_LOG)) {
    @"
# Cowork Registered Skills

Generated: $(Get-Date -Format "o")

| Timestamp | Skill ID | Status | Message |
|-----------|----------|--------|---------|
"@ | Set-Content -Path $REGISTERED_LOG -Encoding UTF8
    Log "Created registered skills log: $REGISTERED_LOG"
  }
}

function Initialize-ErrorLog {
  if (-not (Test-Path $ERROR_LOG)) {
    @"
# Cowork Registration Errors

Generated: $(Get-Date -Format "o")

| Timestamp | Skill ID | Error |
|-----------|----------|-------|
"@ | Set-Content -Path $ERROR_LOG -Encoding UTF8
  }
}

function Log-Registration {
  param([string]$Status, [string]$Message)

  $entry = "| $timestamp | $SkillId | $Status | $Message |"
  Add-Content -Path $REGISTERED_LOG -Value $entry -Encoding UTF8
  Log "Logged registration: $SkillId → $Status"
}

function Log-Error {
  param([string]$ErrorMessage)

  $entry = "| $timestamp | $SkillId | $ErrorMessage |"
  Add-Content -Path $ERROR_LOG -Value $entry -Encoding UTF8
  Log "Logged error: $SkillId → $ErrorMessage" "ERROR"
}

# Validate inputs
Log "Validating inputs..."

if ([string]::IsNullOrWhiteSpace($SkillId)) {
  Write-Error "SkillId required"
  exit 1
}

if (-not (Test-Path $SourcePath)) {
  Write-Error "SourcePath not found: $SourcePath"
  exit 1
}

Log "SkillId: $SkillId"
Log "SourcePath: $SourcePath"

# Ensure audit directories exist
Ensure-AuditDir
Initialize-RegisteredLog
Initialize-ErrorLog

# Call Cowork plugin customizer
Write-Host "📦 Registering skill in Cowork: $SkillId" -ForegroundColor Cyan

Log "Calling Invoke-CliScript..."

try {
  $result = Invoke-CliScript -Skill cowork-plugin-customizer `
    -Action create-skill `
    -SkillName $SkillId `
    -SourcePath $SourcePath 2>&1

  Log "Cowork response: $result"

  Write-Host "✅ Skill registered: $SkillId" -ForegroundColor Green
  Log-Registration "SUCCESS" "Cowork plugin created"

  exit 0

} catch {
  $errorMsg = $_.Exception.Message
  Write-Host "❌ Registration failed: $SkillId" -ForegroundColor Red
  Write-Host "Error: $errorMsg" -ForegroundColor Red

  Log-Error "$errorMsg"
  Log-Registration "FAILED" "$errorMsg"

  exit 1
}
