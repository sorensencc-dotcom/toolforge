<#
.SYNOPSIS
  Universal Toolforge tool runner. Discovers and executes tools from any category.

.PARAMETER Name
  Tool name (directory name). Required for -Run.

.PARAMETER List
  List all discovered tools with metadata.

.PARAMETER Run
  Execute tool by name.

.PARAMETER Config
  Path to config file (passed to tool).

.PARAMETER Inspect
  Show full details of a tool.

.PARAMETER Refresh
  Rescan directories and update manifest.

.EXAMPLE
  ./run-tool.ps1 -List
  ./run-tool.ps1 -Run multiRepoRoadmapSync -Config config.json
  ./run-tool.ps1 -Inspect multiRepoRoadmapSync
#>

param(
  [string]$Name,
  [switch]$List,
  [switch]$Run,
  [string]$Config,
  [switch]$Inspect,
  [switch]$Refresh,
  [string]$DbPath = "C:\dev\toolforge\run-store.db"
)

$ErrorActionPreference = "Stop"
$TOOLFORGE_ROOT = Split-Path -Parent $PSCommandPath
$MANIFEST_FILE = Join-Path $TOOLFORGE_ROOT "manifest.json"
$SKILLS_DIR = Join-Path $TOOLFORGE_ROOT "skills"
$CATEGORIES = @("sync-tools", "daemons", "adapters", "mcp-servers", "utilities", "scaffolds", "prototypes")

function Classify-Error {
  # Total, deterministic error classifier (Step 2). First-match-wins over the
  # ordered rule set below; the final default guarantees totality.
  param([string]$ErrorMessage)

  if ([string]::IsNullOrWhiteSpace($ErrorMessage)) { return "E_RUNTIME" }

  switch -Regex ($ErrorMessage) {
    '(?i)timeout|timed out|has timed out|operation.*timed'                                              { return "E_TIMEOUT" }
    '(?i)not found|cannot find|no such file|module not found|could not load|unable to (resolve|load)|is not recognized|command not found|ENOENT' { return "E_DEPENDENCY" }
    '(?i)invalid|validation|malformed|is required|must be (a|an|non-|greater|less)|bad request|parse error|failed to parse|schema' { return "E_VALIDATION" }
    '(?i)environment variable|env var|\.env|access is denied|permission denied|unauthorized|not set|missing.*variable|configuration (error|missing)' { return "E_ENVIRONMENT" }
    default { return "E_RUNTIME" }
  }
}

function Write-Telemetry {
  param(
    [Parameter(Mandatory)][string]$InvocationId,
    [Parameter(Mandatory)][string]$Tool,
    [Parameter(Mandatory)][ValidateSet("success", "fail")][string]$Status,
    [Parameter(Mandatory)][int]$DurationMs,
    [string]$ErrorCode,
    [string]$ErrorMessage,
    [string]$StackTrace,     # <-- ADD: only used on fail; error stack for the errors table
    [string]$Version,
    [Parameter(Mandatory)][string]$DbPath
  )

  # Telemetry must NEVER change the tool's own outcome. Any failure here is
  # swallowed and surfaced only as a warning (§5.1 isolation guarantee).
  try {
    if (-not (Get-Module -ListAvailable PSSQLite)) {
      Write-Warning "telemetry: PSSQLite module not installed; skipping write for $InvocationId. Install with: Install-Module PSSQLite -Scope CurrentUser -Force"
      return
    }
    Import-Module PSSQLite -ErrorAction Stop

    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

    # errors.error_code is NOT NULL. Guarantee a non-null code on every fail so the
    # (co-transactional) errors insert can never roll back the runs insert.
    $effectiveCode = if ($ErrorCode) { $ErrorCode }
                     elseif ($Status -eq 'fail') { 'E_RUNTIME' }
                     else { $null }

    # On fail, insert a structured errors row in the SAME transaction, AFTER the runs
    # insert (FK errors.invocation_id -> runs.invocation_id resolves in-txn).
    $errorInsert = ""
    if ($Status -eq 'fail') {
      $errorInsert = @"

INSERT INTO errors
  (error_id, invocation_id, tool, timestamp, error_code, error_message, stack_trace)
VALUES
  (@error_id, @invocation_id, @tool, @ts, @error_code, @error_message, @stack_trace);
"@
    }

    $sql = @"
BEGIN IMMEDIATE;

INSERT INTO tools (name, first_seen, last_run)
VALUES (@tool, @ts, @ts)
ON CONFLICT(name) DO UPDATE SET last_run = @ts;

INSERT INTO runs
  (invocation_id, tool, timestamp, duration_ms, status, error_code, error_message, version)
VALUES
  (@invocation_id, @tool, @ts, @duration_ms, @status, @error_code, @error_message, @version);
$errorInsert
COMMIT;
"@

    $params = @{
      tool          = $Tool
      ts            = $ts
      invocation_id = $InvocationId
      duration_ms   = $DurationMs
      status        = $Status
      error_code    = $effectiveCode
      error_message = if ($ErrorMessage) { $ErrorMessage } else { $null }
      version       = if ($Version) { $Version } else { $null }
    }
    if ($Status -eq 'fail') {
      $params['error_id']    = [guid]::NewGuid().ToString().ToLower()
      $params['stack_trace'] = if ($StackTrace) { $StackTrace } else { $null }
    }

    Invoke-SqliteQuery -DataSource $DbPath -Query "PRAGMA foreign_keys=ON;" | Out-Null
    Invoke-SqliteQuery -DataSource $DbPath -Query "PRAGMA busy_timeout=5000;" | Out-Null
    Invoke-SqliteQuery -DataSource $DbPath -Query $sql -SqlParameters $params | Out-Null

    Write-Verbose "telemetry written id=$InvocationId tool=$Tool status=$Status duration_ms=$DurationMs"
  } catch {
    Write-Warning "telemetry: failed to write invocation $InvocationId for tool '$Tool': $($_.Exception.Message)"
  }
}

function Load-Manifest {
  if (Test-Path $MANIFEST_FILE) {
    return Get-Content $MANIFEST_FILE | ConvertFrom-Json
  }
  return $null
}

function Discover-Tools {
  Write-Host "🔍 Scanning toolforge directories..." -ForegroundColor Cyan
  $tools = @()

  foreach ($category in $CATEGORIES) {
    $categoryPath = Join-Path $TOOLFORGE_ROOT $category
    if (-not (Test-Path $categoryPath)) { continue }

    Get-ChildItem -Path $categoryPath -File -Include "*.cjs", "*.ts", "*.ps1", "*.sh" | ForEach-Object {
      $tool = @{
        name        = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
        category    = $category
        filename    = $_.Name
        path        = $_.FullName
        discovered  = $true
      }
      $tools += $tool
    }
  }

  Write-Host "✓ Found $($tools.Count) tool files" -ForegroundColor Green
  return $tools
}

function Discover-Skills {
  Write-Host "🎯 Scanning skills directory..." -ForegroundColor Cyan
  $skills = @()

  if (-not (Test-Path $SKILLS_DIR)) {
    Write-Host "⚠️  Skills directory not found: $SKILLS_DIR" -ForegroundColor Yellow
    return $skills
  }

  Get-ChildItem -Path $SKILLS_DIR -Directory | ForEach-Object {
    $skillDir = $_.FullName
    $skillJsonPath = Join-Path $skillDir "skill.json"

    if (Test-Path $skillJsonPath) {
      try {
        $skillJson = Get-Content $skillJsonPath | ConvertFrom-Json
        $skill = @{
          name        = $skillJson.id
          displayName = $skillJson.name
          category    = "skills"
          version     = $skillJson.version ?? "0.1.0"
          description = $skillJson.description ?? ""
          entrypoint  = $skillJson.metadata.entrypoint ?? "src/index.ts"
          path        = $skillDir
          discovered  = $true
          skillType   = $skillJson.metadata.runtime ?? "typescript"
        }
        $skills += $skill
      } catch {
        Write-Host "⚠️  Failed to parse skill.json in $($_.Name): $($_.Exception.Message)" -ForegroundColor Yellow
      }
    }
  }

  Write-Host "✓ Found $($skills.Count) skills" -ForegroundColor Green
  return $skills
}

function Update-Manifest {
  $discoveredTools = Discover-Tools
  $discoveredSkills = Discover-Skills
  $current = Load-Manifest

  if ($null -eq $current) {
    $current = @{ version = "1.0.0"; generated = (Get-Date -AsUTC -Format o); tools = @(); skills = @() }
  }

  # Preserve existing tools, update discovery status
  $mergedTools = @()
  foreach ($tool in $discoveredTools) {
    $existing = $current.tools | Where-Object { $_.name -eq $tool.name }
    if ($existing) {
      $existing | Add-Member -MemberType NoteProperty -Name "discovered" -Value $true -Force
      $mergedTools += $existing
    } else {
      $tool | Add-Member -MemberType NoteProperty -Name status -Value "beta"
      $tool | Add-Member -MemberType NoteProperty -Name version -Value "0.1.0"
      $mergedTools += $tool
    }
  }

  # Preserve existing skills, update discovery status
  $mergedSkills = @()
  $existingSkills = $current.skills
  if ($null -eq $existingSkills) { $existingSkills = @() }

  foreach ($skill in $discoveredSkills) {
    $existing = $existingSkills | Where-Object { $_.name -eq $skill.name }
    if ($existing) {
      $existing | Add-Member -MemberType NoteProperty -Name "discovered" -Value $true -Force
      $existing | Add-Member -MemberType NoteProperty -Name "version" -Value $skill.version -Force
      $existing | Add-Member -MemberType NoteProperty -Name "entrypoint" -Value $skill.entrypoint -Force
      $mergedSkills += $existing
    } else {
      $skill | Add-Member -MemberType NoteProperty -Name status -Value "beta"
      $mergedSkills += $skill
    }
  }

  # Create new manifest object to ensure clean structure
  $newManifest = @{
    version   = $current.version ?? "1.0.0"
    generated = (Get-Date -AsUTC -Format o)
    tools     = $mergedTools
    skills    = $mergedSkills
  }

  $newManifest | ConvertTo-Json -Depth 5 | Set-Content $MANIFEST_FILE
  Write-Host "✓ Manifest updated: $MANIFEST_FILE" -ForegroundColor Green
}

function List-Tools {
  $manifest = Load-Manifest
  if ($null -eq $manifest -or ($manifest.tools.Count -eq 0 -and $manifest.skills.Count -eq 0)) {
    Write-Host "No tools or skills found. Run with -Refresh to scan." -ForegroundColor Yellow
    return
  }

  Write-Host ""
  Write-Host "📦 Toolforge Tools & Skills (v$($manifest.version))" -ForegroundColor Cyan
  Write-Host ""

  # List tools
  if ($manifest.tools.Count -gt 0) {
    Write-Host "  [Tools]" -ForegroundColor Blue
    $manifest.tools | Group-Object -Property category | ForEach-Object {
      Write-Host "    [$($_.Name)]" -ForegroundColor Gray
      $_.Group | ForEach-Object {
        $status = $_.status ?? "unknown"
        $ver = $_.version ?? "0.0.0"
        Write-Host "      • $($_.name) ($ver) [$status]" -ForegroundColor White
        if ($_.description) { Write-Host "        $($_.description)" -ForegroundColor DarkGray }
      }
    }
    Write-Host ""
  }

  # List skills
  if ($manifest.skills.Count -gt 0) {
    Write-Host "  [Skills]" -ForegroundColor Blue
    $manifest.skills | ForEach-Object {
      $status = $_.status ?? "unknown"
      $ver = $_.version ?? "0.0.0"
      $displayName = $_.displayName ?? $_.name
      Write-Host "    • $($_.name) — $displayName ($ver) [$status]" -ForegroundColor White
      if ($_.description) { Write-Host "      $($_.description)" -ForegroundColor DarkGray }
    }
    Write-Host ""
  }
}

function Inspect-Tool {
  param([string]$ToolName)

  $manifest = Load-Manifest
  $item = $manifest.tools | Where-Object { $_.name -eq $ToolName }
  $itemType = "Tool"

  if (-not $item) {
    $item = $manifest.skills | Where-Object { $_.name -eq $ToolName }
    $itemType = "Skill"
  }

  if (-not $item) {
    Write-Host "❌ Tool or skill not found: $ToolName" -ForegroundColor Red
    exit 1
  }

  Write-Host ""
  Write-Host "📋 $itemType`: $($item.name)" -ForegroundColor Cyan
  Write-Host "  Display Name: $($item.displayName ?? $item.name)"
  Write-Host "  Category:     $($item.category)"
  Write-Host "  Version:      $($item.version ?? '0.0.0')"
  Write-Host "  Status:       $($item.status ?? 'unknown')"
  Write-Host "  Description:  $($item.description ?? '(none)')"
  Write-Host "  Path:         $($item.path)"
  Write-Host "  Entrypoint:   $($item.entrypoint ?? 'run.ps1')"
  if ($item.skillType) {
    Write-Host "  Runtime:      $($item.skillType)"
  }
  if ($item.dependencies) {
    Write-Host "  Dependencies: $($item.dependencies -join ', ')"
  }
  Write-Host ""
}

function Invoke-Tool {
  param([string]$ToolName, [string]$ConfigPath, [string]$DbPath = "C:\dev\toolforge\run-store.db")

  $manifest = Load-Manifest
  $item = $manifest.tools | Where-Object { $_.name -eq $ToolName }
  $itemType = "Tool"

  if (-not $item) {
    $item = $manifest.skills | Where-Object { $_.name -eq $ToolName }
    $itemType = "Skill"
  }

  if (-not $item) {
    Write-Host "❌ Tool or skill not found: $ToolName" -ForegroundColor Red
    exit 1
  }

  $entrypoint = $item.entrypoint ?? "run.ps1"
  $itemDir = $item.path
  $runPath = Join-Path $itemDir $entrypoint

  if (-not (Test-Path $runPath)) {
    Write-Host "❌ Entrypoint not found: $runPath" -ForegroundColor Red
    exit 1
  }

  Write-Host ""
  Write-Host "▶️  Running $itemType`: $($item.name) v$($item.version ?? '0.0.0')" -ForegroundColor Cyan
  Write-Host "   Category: $($item.category)" -ForegroundColor Gray
  Write-Host ""

  $toolArgs = @()
  if ($ConfigPath) { $toolArgs += $ConfigPath }

  # ---- Telemetry: capture invocation identity + start time (§4.1) ----
  $invocationId = [guid]::NewGuid().ToString().ToLower()
  $startTime    = Get-Date
  $version      = $item.version
  Write-Verbose "telemetry start id=$invocationId tool=$ToolName"   # start = console only (C2)

  try {
    switch ([System.IO.Path]::GetExtension($runPath)) {
      ".ps1" {
        & $runPath @toolArgs
      }
      ".cjs" {
        node $runPath @toolArgs
      }
      ".ts" {
        npx ts-node $runPath @toolArgs
      }
      ".sh" {
        bash $runPath @toolArgs
      }
      default {
        Write-Host "❌ Unknown entrypoint type: $([System.IO.Path]::GetExtension($runPath))" -ForegroundColor Red
        exit 1
      }
    }

    if ($LASTEXITCODE -ne 0) {
      # native/node/ts/sh non-zero exit (C4: telemetry written before this exit)
      $dur     = [int]((Get-Date) - $startTime).TotalMilliseconds
      $failMsg = "exit code $LASTEXITCODE"
      Write-Telemetry -InvocationId $invocationId -Tool $ToolName -Status 'fail' `
        -DurationMs $dur -ErrorCode (Classify-Error -ErrorMessage $failMsg) -ErrorMessage $failMsg `
        -Version $version -DbPath $DbPath
      Write-Host "❌ $itemType exited with code $LASTEXITCODE" -ForegroundColor Red
      exit $LASTEXITCODE
    }

    $dur = [int]((Get-Date) - $startTime).TotalMilliseconds
    Write-Telemetry -InvocationId $invocationId -Tool $ToolName -Status 'success' `
      -DurationMs $dur -Version $version -DbPath $DbPath
    Write-Host ""
    Write-Host "✓ Complete" -ForegroundColor Green
  }
  catch {
    # PS terminating error (ErrorActionPreference = Stop)
    $dur     = [int]((Get-Date) - $startTime).TotalMilliseconds
    $failMsg = $_.Exception.Message
    Write-Telemetry -InvocationId $invocationId -Tool $ToolName -Status 'fail' `
      -DurationMs $dur -ErrorCode (Classify-Error -ErrorMessage $failMsg) -ErrorMessage $failMsg `
      -StackTrace $_.ScriptStackTrace -Version $version -DbPath $DbPath
    throw
  }
}

# Main dispatcher
if ($Refresh) {
  Update-Manifest
  exit 0
}

if ($List) {
  List-Tools
  exit 0
}

if ($Inspect) {
  if (-not $Name) {
    Write-Host "Error: -Inspect requires -Name" -ForegroundColor Red
    exit 1
  }
  Inspect-Tool -ToolName $Name
  exit 0
}

if ($Run) {
  if (-not $Name) {
    Write-Host "Error: -Run requires -Name" -ForegroundColor Red
    exit 1
  }
  Invoke-Tool -ToolName $Name -ConfigPath $Config -DbPath $DbPath
  exit 0
}

# No action specified
Write-Host "Toolforge Tool Runner" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usage:" -ForegroundColor Yellow
Write-Host "  ./run-tool.ps1 -List              # Show all tools"
Write-Host "  ./run-tool.ps1 -Run <name>        # Execute a tool"
Write-Host "  ./run-tool.ps1 -Inspect <name>    # Show tool details"
Write-Host "  ./run-tool.ps1 -Refresh           # Rescan directories"
Write-Host ""
Write-Host "Examples:" -ForegroundColor Yellow
Write-Host "  ./run-tool.ps1 -List"
Write-Host "  ./run-tool.ps1 -Run multiRepoRoadmapSync -Config config.json"
Write-Host "  ./run-tool.ps1 -Inspect multiRepoRoadmapSync"
Write-Host ""
