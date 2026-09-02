<#
.SYNOPSIS
    Empirical Performance Profiler for Tier 3 Iron Gates.
.DESCRIPTION
    Runs 10 baseline iterations of the validation scripts to establish 
    statistically sound pre-commit latency boundaries, replacing arbitrary WAGs.
#>

$ErrorActionPreference = 'Stop'
$Iterations = 10
$ReportPath = Join-Path $PWD ".performance-baselines.json"

# Targets matching your active core orchestration and validation scripts
$Targets = @(
    @{ Name = "flatten.sh"; Command = "bash kb-sync/core/flatten.sh --repo-root kb-sync --output $env:TEMP\\kb-sync-profile --pack-name profile-pack.md" },
    @{ Name = "validate-contract.mjs"; Command = "node kb-sync/modules/wiki/validate-contract.mjs kb-sync/obsidian/vault/wiki" }
)

$Platform = if ($IsWindows -ne $null) { if ($IsWindows) { "win32" } else { "posix" } } else { if ($env:OS -match "Windows") { "win32" } else { "posix" } }

$Results = @{
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platform = $Platform
    baselines = @{}
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " Profiling Tier 3 Iron Gates ($Iterations iterations per target)" -ForegroundColor Cyan
Write-Host "================================================================================`n" -ForegroundColor Cyan

foreach ($Target in $Targets) {
    Write-Host "Profiling: $($Target.Name)..." -ForegroundColor Yellow
    $Timings = @()

    for ($i = 1; $i -le $Iterations; $i++) {
        $Time = Measure-Command {
            # Suppress standard output/errors to prevent terminal noise during profiling
            $null = bash -lc "$($Target.Command) >/dev/null 2>&1"
        }
        $Timings += $Time.TotalMilliseconds
    }

    # Statistical calculations
    $Sorted = $Timings | Sort-Object
    $Median = ($Sorted[($Iterations / 2) - 1] + $Sorted[$Iterations / 2]) / 2
    
    $P95Index = [math]::Ceiling($Iterations * 0.95) - 1
    if ($P95Index -eq $Iterations) { $P95Index-- }
    $P95 = $Sorted[$P95Index]
    
    # Establish the fail-safe boundary at 1.5x the median to account for environmental noise
    $Threshold15x = [math]::Round($Median * 1.5)

    $Results.baselines[$Target.Name] = @{
        iterations = $Iterations
        median_ms = [math]::Round($Median)
        p95_ms = [math]::Round($P95)
        max_ms = [math]::Round(($Sorted | Measure-Object -Maximum).Maximum)
        samples_ms = @($Sorted | ForEach-Object { [math]::Round($_, 3) })
        recommended_gate_ms = $Threshold15x
        recommendation_basis = 'ceil(1.5 * median); review against p95 and max before changing hooks'
    }

    Write-Host "  -> Median: $([math]::Round($Median))ms | P95: $([math]::Round($P95))ms"
    Write-Host "  -> Safe Pre-Commit Gate (1.5x): ${Threshold15x}ms
" -ForegroundColor Green
}

# Export to JSON telemetry report
$Results | ConvertTo-Json -Depth 4 | Out-File -FilePath $ReportPath -Encoding utf8
Write-Host "[SUCCESS] Baseline profiles exported to $ReportPath" -ForegroundColor Cyan


