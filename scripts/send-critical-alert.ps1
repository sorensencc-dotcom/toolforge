# ==============================================================================
# send-critical-alert.ps1
# Multi-channel high-visibility alert dispatcher for automated tasks and daemons.
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $false)]
    [string]$Title = "Critical Automated Task Failure",

    [Parameter(Mandatory = $false)]
    [string]$Message = "An automated background task encountered a critical failure.",

    [Parameter(Mandatory = $false)]
    [ValidateSet("CRITICAL", "WARNING", "INFO")]
    [string]$Severity = "CRITICAL",

    [Parameter(Mandatory = $false)]
    [string]$ActionRequired = "",

    [Parameter(Mandatory = $false)]
    [string]$LogFile = "",

    [Parameter(Mandatory = $false)]
    [switch]$ClearAlert
)

$RepoRoot = "C:\dev"
$CiAlertsPath = Join-Path $RepoRoot "_status-feed\ci_alerts.json"

# ------------------------------------------------------------------------------
# 1. Update Status Feed (_status-feed/ci_alerts.json)
# ------------------------------------------------------------------------------
try {
    if (Test-Path $CiAlertsPath) {
        $feed = Get-Content $CiAlertsPath -Raw | ConvertFrom-Json
    } else {
        $feed = [PSCustomObject]@{
            timestamp = (Get-Date).ToUniversalTime().ToString("o")
            status = "ALL_PASSING"
            alerts = @()
        }
    }

    if ($ClearAlert) {
        # Remove any existing alerts from this source
        $remainingAlerts = @($feed.alerts | Where-Object { $_.source -ne $Source -and $_.name -ne $Source })
        $feed.alerts = $remainingAlerts
        $feed.status = if ($remainingAlerts.Count -gt 0) { "FAILURES_DETECTED" } else { "ALL_PASSING" }
        $feed.timestamp = (Get-Date).ToUniversalTime().ToString("o")
        $feed | ConvertTo-Json -Depth 10 | Set-Content $CiAlertsPath -Encoding utf8
        Write-Host "[ALERT-DISPATCH] Cleared prior alert for '$Source' in ci_alerts.json." -ForegroundColor Green
        return
    } else {
        $existing = @($feed.alerts | Where-Object { $_.source -ne $Source -and $_.name -ne $Source })
        $newAlert = [PSCustomObject]@{
            source = $Source
            name = $Source
            title = $Title
            message = $Message
            severity = $Severity
            actionRequired = $ActionRequired
            logFile = $LogFile
            timestamp = (Get-Date).ToUniversalTime().ToString("o")
        }
        $feed.alerts = $existing + @($newAlert)
        $feed.status = "FAILURES_DETECTED"
        $feed.timestamp = (Get-Date).ToUniversalTime().ToString("o")
        $feed | ConvertTo-Json -Depth 10 | Set-Content $CiAlertsPath -Encoding utf8
        Write-Host "[ALERT-DISPATCH] Recorded critical alert for '$Source' in ci_alerts.json." -ForegroundColor Red
    }
} catch {
    Write-Warning "[ALERT-DISPATCH] Failed to update ci_alerts.json: $($_.Exception.Message)"
}

# ------------------------------------------------------------------------------
# 2. Windows Action Center & Desktop Notification
# ------------------------------------------------------------------------------
try {
    $escapedTitle = [System.Security.SecurityElement]::Escape($Title)
    $escapedMsg = [System.Security.SecurityElement]::Escape($Message)
    $toastScript = @"
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
`$template = '<toast><visual><binding template="ToastGeneric"><text>$escapedTitle</text><text>$escapedMsg</text></binding></visual></toast>'
`$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
`$xml.LoadXml(`$template)
`$toast = [Windows.UI.Notifications.ToastNotification]::new(`$xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('$Source').Show(`$toast)
"@
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command $toastScript | Out-Null
} catch {
    # Fallback to NotifyIcon balloon
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
        $balloon = New-Object System.Windows.Forms.NotifyIcon
        $balloon.Icon = [System.Drawing.SystemIcons]::Error
        $balloon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Error
        $balloon.BalloonTipTitle = $Title
        $balloon.BalloonTipText = $Message
        $balloon.Visible = $true
        $balloon.ShowBalloonTip(10000)
    } catch {}
}

# Audible system alert tone
try {
    [Console]::Beep(1200, 250)
    Start-Sleep -Milliseconds 50
    [Console]::Beep(900, 350)
} catch {}

# ------------------------------------------------------------------------------
# 3. Slack Webhook Notification (if configured)
# ------------------------------------------------------------------------------
$webhookUrl = $env:SLACK_WEBHOOK_URL
if (-not $webhookUrl -and (Test-Path "C:\Users\soren\.secrets\slack.env")) {
    Get-Content "C:\Users\soren\.secrets\slack.env" | ForEach-Object {
        if ($_ -match '^\s*SLACK_WEBHOOK_URL=(.*)$') {
            $webhookUrl = $matches[1].Trim()
        }
    }
}

if ($webhookUrl) {
    try {
        $slackPayload = @{
            text = "🚨 *$Title*`n*Source:* `$Source`n*Severity:* `$Severity`n*Error:* `$Message`n*Action Required:* ``$ActionRequired```n*Log:* `$LogFile"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $slackPayload -ContentType "application/json" -TimeoutSec 10 | Out-Null
        Write-Host "[ALERT-DISPATCH] Sent alert to Slack webhook successfully." -ForegroundColor Green
    } catch {
        Write-Warning "[ALERT-DISPATCH] Failed to post alert to Slack webhook: $($_.Exception.Message)"
    }
}
