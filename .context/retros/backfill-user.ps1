# Backfill missing "user" field in retro files
# One-time migration to standardize retro schema

param(
    [string]$RetrosDir = "C:\dev\.context\retros",
    [string]$DefaultUser = "Chris Sorensen",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

$retroFiles = Get-ChildItem $RetrosDir -Filter "*.json" | Where-Object { $_.Name -ne "retro.schema.json" }

Write-Host "Backfill: Adding 'user' field to retro files"
Write-Host "Target directory: $RetrosDir"
Write-Host "Default user: $DefaultUser"
Write-Host "Dry run: $DryRun"
Write-Host ""

$updatedCount = 0

foreach ($file in $retroFiles) {
    try {
        $content = Get-Content $file.FullName -Raw
        $json = $content | ConvertFrom-Json -ErrorAction Stop

        # Check if user field exists
        if ($null -eq $json.user -or [string]::IsNullOrWhiteSpace($json.user)) {
            $json | Add-Member -MemberType NoteProperty -Name "user" -Value $DefaultUser -Force

            if (-not $DryRun) {
                $json | ConvertTo-Json -Depth 10 | Set-Content $file.FullName -Encoding UTF8
                Write-Host "✓ Updated: $($file.Name)"
            } else {
                Write-Host "  (dry-run) Would update: $($file.Name)"
            }

            $updatedCount++
        } else {
            Write-Host "- Already has user: $($file.Name)"
        }

    } catch {
        Write-Host "✗ Error processing $($file.Name): $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Complete: $updatedCount/$($retroFiles.Count) files updated"

if ($DryRun) {
    Write-Host "Dry run only. Run without -DryRun to commit changes."
}
