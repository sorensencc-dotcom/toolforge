#!/usr/bin/env bash
# PostToolUse hook, fires after a Bash tool call matching "git push*".
# Waits briefly for GitHub Actions to register the new runs, then reports status.
set -u

remote=$(git remote get-url origin 2>/dev/null | sed -E 's#^git@github\.com:##; s#^https://github\.com/##; s#\.git$##')
[ -z "$remote" ] && exit 0

sleep 8
echo "--- CI status for $remote (post-push) ---"
gh run list --repo "$remote" --limit 5 2>/dev/null || true
