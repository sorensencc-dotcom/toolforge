# Auto-generated pre-commit hook. Do not edit.
# Runs four gates in sequence:
# 1. Retro schema validation (.context/retros/*.json only)
# 2. Roadmap location check (all commits)
# 3. Validator gate (skills/utilities only)
# 4. Paired-test nudge (advisory)

function Test-RetroFiles {
    $stagedFiles = git diff --cached --name-only
    $retroFiles = $stagedFiles | Where-Object { $_ -match '\.context[\\/]retros[\\/].*\.json$' -and $_ -notmatch 'schema\.json$' }

    if ($retroFiles.Count -eq 0) {
        return $true
    }

    $validatorScript = '.context\retros\validate.ps1'
    if (-not (Test-Path $validatorScript)) {
        Write-Error "Retro validator not found: $validatorScript"
        return $false
    }

    & $validatorScript -Strict
    if ($LASTEXITCODE -ne 0) {
        return $false
    }

    return $true
}

function Test-RoadmapLocations {
    $stagedFiles = git diff --cached --name-only
    $allowedRoots = @(
        "docs/meta",
        "cic-ingestion",
        "rewrite-docs",
        "rewrite-mcp",
        "kb-sync"
    )

    $violations = @()
    foreach ($file in $stagedFiles) {
        if ($file -imatch '(?i)roadmap\.md$') {
            $isAllowed = $false
            foreach ($root in $allowedRoots) {
                if ($file.StartsWith($root)) {
                    $isAllowed = $true
                    break
                }
            }

            if (-not $isAllowed) {
                $violations += $file
            }
        }
    }

    if ($violations.Count -gt 0) {
        Write-Error "ROADMAP.md creation blocked outside allowed locations."
        Write-Host ""
        Write-Host "Allowed:"
        Write-Host "  - docs/meta/                   (global roadmaps only)"
        Write-Host "  - cic-ingestion/               (project-local roadmap)"
        Write-Host "  - rewrite-docs/                (project-local roadmap)"
        Write-Host "  - rewrite-mcp/                 (project-local roadmap)"
        Write-Host "  - kb-sync/                     (project-local roadmap)"
        Write-Host ""
        Write-Host "Found violation(s):"
        foreach ($v in $violations) {
            Write-Host "  - $v"
        }
        Write-Host ""
        Write-Host "Governance: docs/meta/governance/documentation-policy.md"
        return $false
    }

    return $true
}

# Gate 1: Retro schema validation
Write-Host "Validating retro files..."
if (-not (Test-RetroFiles)) {
    exit 1
}

# Gate 2: Roadmap location check (always runs)
Write-Host "Checking roadmap locations..."
if (-not (Test-RoadmapLocations)) {
    exit 1
}

# Gate 3: Validator gate (skills/utilities only)
$staged = git diff --cached --name-only
if ($staged -match '^(skills/|utilities/)') {
    $ciScript = Join-Path (git rev-parse --show-toplevel) 'ci-pipeline.ps1'
    if (-not (Test-Path $ciScript)) {
        Write-Error "CI pipeline not found at $ciScript"
        exit 1
    }

    & $ciScript -Stage validator -Verbose
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 1) {
        Write-Error "Pre-commit validation failed"
        exit 1
    }
}
else {
    Write-Host "No skills/ or utilities/ files staged, skipping validator"
}

# Gate 4: Paired-test nudge (advisory, never blocks)
$codeExtPattern = '\.(ps1|psm1|py|js|ts|tsx|jsx|mjs|cjs)$'
$testPathPattern = '(^|[\\/])(tests?|__tests__|spec)[\\/]|(^|[\\/])test-[^\\/]+$|\.(test|spec)\.[a-z]+$'

$codeFiles = $staged | Where-Object { $_ -match $codeExtPattern -and $_ -notmatch $testPathPattern }
$testFiles = $staged | Where-Object { $_ -match $testPathPattern }

if ($codeFiles.Count -gt 0 -and $testFiles.Count -eq 0) {
    Write-Host "`e[33m[Hook]`e[0m Non-test code staged with no paired test file:"
    foreach ($f in $codeFiles) {
        Write-Host "  - $f"
    }
    Write-Host "`e[33m[Hook]`e[0m Advisory only, not blocking. Consider adding/updating a test."
}

exit 0
