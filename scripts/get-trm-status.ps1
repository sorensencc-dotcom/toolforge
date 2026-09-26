# get-trm-status.ps1
# Displays the live status and audit trail of TRM action cards.

node (Join-Path "c:\dev" "scripts\trm-ingress-watcher.mjs") --status
