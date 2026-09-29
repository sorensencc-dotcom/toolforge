#!/usr/bin/env pwsh
<#
.SYNOPSIS
Pushes current branch and synchronously waits for Devin AI and CI status check rollup.

.DESCRIPTION
Executes `git push origin <branch>`, resolves the associated GitHub Pull Request,
and polls the GitHub API with a progress spinner until Devin AI review and CI checks
complete, printing a structured terminal report.

.PARAMETER Branch
The branch name to push. Defaults to the current active git branch.

.PARAMETER TimeoutSeconds
Maximum duration in seconds to wait for checks to complete. Defaults to 180s.

.PARAMETER SkipWait
Pushes the branch but skips polling for reviews.

.PARAMETER PRNumber
Optional explicit PR number to monitor if different from head branch.
#>

[CmdletBinding()]
param(
    [string]$Branch = $(git branch --show-current 2>$null),
    [int]$TimeoutSeconds = 180,
    [int]$PollIntervalSeconds = 4,
    [int]$PRNumber = 0,
    [switch]$SkipWait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Branch)) {
    Write-Error "Unable to determine current git branch. Specify -Branch explicitly."
    exit 1
}

$localHead = $(git rev-parse HEAD 2>$null)
if ($localHead) { $localHead = $localHead.Trim() }

Write-Host "🚀 Pushing branch '$Branch' to origin..." -ForegroundColor Cyan
git push origin $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Error "git push failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

if ($SkipWait) {
    Write-Host "✅ Push complete (-SkipWait specified)." -ForegroundColor Green
    exit 0
}

Write-Host "⏳ Pushed commit ($localHead). Polling for Devin AI review & CI status checks (Timeout: ${TimeoutSeconds}s)..." -ForegroundColor Yellow

$startTime = [DateTime]::UtcNow
$resolvedPR = $null

function Get-Prop($obj, [string]$name, $default = $null) {
    if ($null -ne $obj -and $obj.PSObject.Properties[$name]) {
        return $obj.$name
    }
    return $default
}

# Resolve PR associated with this branch
if ($PRNumber -gt 0) {
    $resolvedPR = [PSCustomObject]@{
        number = $PRNumber
        url = "https://github.com/sorensencc-dotcom/toolforge/pull/$PRNumber"
    }
} else {
    for ($i = 0; $i -lt 5; $i++) {
        try {
            $prJson = gh pr view $Branch --json number,url,headRefOid,state 2>$null
            if (-not $prJson) {
                $prJson = gh pr list --head $Branch --state open --json number,url,headRefOid,state 2>$null
            }
            if ($prJson) {
                $parsed = $prJson | ConvertFrom-Json
                $firstPr = if ($parsed -is [System.Array]) { $parsed[0] } else { $parsed }
                if ($firstPr -and (Get-Prop $firstPr 'number') -gt 0) {
                    $resolvedPR = $firstPr
                    break
                }
            }
        } catch {}
        Start-Sleep -Seconds 2
    }
}

if ($null -eq $resolvedPR) {
    Write-Host "ℹ️ No active open PR found for branch '$Branch'. Push completed successfully on remote." -ForegroundColor Green
    exit 0
}

Write-Host "🔍 Monitoring PR #$($resolvedPR.number) ($($resolvedPR.url))..." -ForegroundColor Cyan

function Test-CheckCompleted($c) {
    if ($null -eq $c) { return $false }
    $status = Get-Prop $c 'status'
    if ($status) {
        return $status -in @('COMPLETED', 'COMPLETED_SUCCESSFULLY', 'DONE')
    }
    $state = Get-Prop $c 'state'
    if ($state) {
        return $state -in @('SUCCESS', 'FAILURE', 'ERROR')
    }
    return $false
}

function Test-CheckPassed($c) {
    if ($null -eq $c) { return $false }
    $status = Get-Prop $c 'status'
    if ($status -and ($status -in @('COMPLETED', 'COMPLETED_SUCCESSFULLY', 'DONE'))) {
        $concl = Get-Prop $c 'conclusion' ''
        return $concl -in @('SUCCESS', 'NEUTRAL', 'SKIPPED')
    }
    $state = Get-Prop $c 'state'
    if ($state) {
        return $state -eq 'SUCCESS'
    }
    return $false
}

function Test-CheckFailed($c) {
    if ($null -eq $c) { return $false }
    $status = Get-Prop $c 'status'
    if ($status -and ($status -in @('COMPLETED', 'COMPLETED_SUCCESSFULLY', 'DONE'))) {
        $concl = Get-Prop $c 'conclusion' ''
        return $concl -in @('FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE')
    }
    $state = Get-Prop $c 'state'
    if ($state) {
        return $state -in @('FAILURE', 'ERROR')
    }
    return $false
}

$spinnerChars = @('|', '/', '-', '\')
$spinnerIdx = 0

while (([DateTime]::UtcNow - $startTime).TotalSeconds -lt $TimeoutSeconds) {
    $elapsed = [Math]::Round(([DateTime]::UtcNow - $startTime).TotalSeconds)
    $spinner = $spinnerChars[$spinnerIdx % $spinnerChars.Length]
    $spinnerIdx++

    Write-Host -NoNewline "`r[$spinner] Waiting for Devin AI & CI checks... (${elapsed}s/${TimeoutSeconds}s)"

    try {
        $viewJson = gh pr view $resolvedPR.number --json reviews,statusCheckRollup,state,headRefOid 2>$null
        if ($viewJson) {
            $view = $viewJson | ConvertFrom-Json
            $headOid = Get-Prop $view 'headRefOid'
            
            # Verify commit matches local head if localHead is present
            if ($localHead -and $headOid -and ($headOid -ne $localHead)) {
                Start-Sleep -Seconds $PollIntervalSeconds
                continue
            }

            $checks = if ($view.PSObject.Properties['statusCheckRollup'] -and $view.statusCheckRollup) {
                @($view.statusCheckRollup)
            } else {
                @()
            }

            $devinCheck = $checks | Where-Object { 
                $ctx = Get-Prop $_ 'context'
                $name = Get-Prop $_ 'name'
                ($ctx -eq 'Devin Review') -or ($name -match 'Devin')
            } | Select-Object -First 1

            $devinReview = $null
            if ($view.PSObject.Properties['reviews'] -and $view.reviews) {
                $devinReview = @($view.reviews) | Where-Object { 
                    $author = Get-Prop $_ 'author'
                    $login = if ($author) { Get-Prop $author 'login' } else { $null }
                    $commit = Get-Prop $_ 'commit'
                    $commitOid = if ($commit) { Get-Prop $commit 'oid' } else { $null }
                    ($login -eq 'devin-ai-integration') -and ($null -eq $commitOid -or -not $localHead -or $commitOid -eq $localHead)
                } | Select-Object -Last 1
            }

            # Check if any checks failed immediately
            $failedChecks = @($checks | Where-Object { Test-CheckFailed $_ })
            if ($failedChecks.Count -gt 0) {
                Write-Host "`n======================================================" -ForegroundColor Red
                Write-Host "❌ CI STATUS CHECKS FAILED (PR #$($resolvedPR.number))" -ForegroundColor Red
                Write-Host "======================================================" -ForegroundColor Red
                foreach ($fc in $failedChecks) {
                    $name = Get-Prop $fc 'name' (Get-Prop $fc 'context' 'Unknown check')
                    $detail = Get-Prop $fc 'conclusion' (Get-Prop $fc 'state' 'Failed')
                    Write-Host " - $name : $detail" -ForegroundColor Red
                }
                exit 1
            }

            # Check if all checks completed
            $allCompleted = $false
            if ($checks.Count -gt 0) {
                $allCompleted = $true
                foreach ($c in $checks) {
                    if (-not (Test-CheckCompleted $c)) {
                        $allCompleted = $false
                        break
                    }
                }
            } elseif ($null -ne $devinReview) {
                $allCompleted = $true
            }

            # Evaluate Devin findings
            $devinHasIssues = $false
            if ($null -ne $devinReview) {
                $devinState = Get-Prop $devinCheck 'state'
                $revState = Get-Prop $devinReview 'state'
                $revBody = Get-Prop $devinReview 'body' ''
                if ($devinState -eq 'SUCCESS') {
                    $devinHasIssues = $false
                } elseif ($revState -eq 'CHANGES_REQUESTED') {
                    $devinHasIssues = $true
                } elseif ($revBody -match 'found (\d+) potential issues') {
                    $issuesCount = [int]$Matches[1]
                    if ($issuesCount -gt 0) {
                        $devinHasIssues = $true
                    }
                }
            }

            if ($allCompleted) {
                Write-Host "`n"
                if ($devinHasIssues) {
                    Write-Host "======================================================" -ForegroundColor Red
                    Write-Host "❌ DEVIN AI REVIEW: FLAGGED ISSUES (PR #$($resolvedPR.number))" -ForegroundColor Red
                    Write-Host "======================================================" -ForegroundColor Red
                    if ($null -ne $devinReview -and (Get-Prop $devinReview 'body')) {
                        Write-Host $devinReview.body -ForegroundColor Yellow
                    }
                    Write-Host "`nUse 'gh pr view $($resolvedPR.number) --comments' to inspect line-by-line review comments." -ForegroundColor Cyan
                    exit 1
                } else {
                    $statusMsg = if ($null -ne $devinReview) { "ALL CI CHECKS & DEVIN REVIEW PASSED" } else { "ALL CI CHECKS PASSED" }
                    Write-Host "======================================================" -ForegroundColor Green
                    Write-Host "✅ $statusMsg (PR #$($resolvedPR.number))" -ForegroundColor Green
                    Write-Host "======================================================" -ForegroundColor Green
                    if ($null -ne $devinReview -and (Get-Prop $devinReview 'body')) {
                        Write-Host $devinReview.body -ForegroundColor Gray
                    }
                    exit 0
                }
            }
        }
    } catch {
        # Non-fatal transient network/API retry
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}

Write-Host "`n❌ Timeout reached after ${TimeoutSeconds}s while waiting for CI checks / Devin AI review." -ForegroundColor Red
Write-Host "Branch '$Branch' is pushed, but pending checks did not finish in time. Inspect: $($resolvedPR.url)" -ForegroundColor Yellow
exit 1
