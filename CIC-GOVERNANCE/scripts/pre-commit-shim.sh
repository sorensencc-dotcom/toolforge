#!/usr/bin/env bash
# Canonical pre-commit shim installed by both repository hook installers.
if [ -f "CIC-GOVERNANCE/scripts/governance-validate-precommit.sh" ]; then
  bash CIC-GOVERNANCE/scripts/governance-validate-precommit.sh || exit 1
elif [ -f "scripts/governance-validate-precommit.sh" ]; then
  bash scripts/governance-validate-precommit.sh || exit 1
fi

if [ -f "scripts/secret-scan-hook.sh" ]; then
  bash scripts/secret-scan-hook.sh || exit 1
fi

if [ -f "scripts/secret-scan.mjs" ]; then
  node scripts/secret-scan.mjs || exit 1
fi

if [ -f "CIC-GOVERNANCE/packages/delivery-guard/scripts/evaluate-automation-policy.mjs" ]; then
  node CIC-GOVERNANCE/packages/delivery-guard/scripts/evaluate-automation-policy.mjs --staged --advisory || echo "[WARN] Delivery guard automation policy is advisory; unable to evaluate."
fi

if [ -f "$(dirname "$0")/pre-commit.ps1" ]; then
  pwsh -NoProfile -File "$(dirname "$0")/pre-commit.ps1" "$@" || exit 1
fi

exit 0
