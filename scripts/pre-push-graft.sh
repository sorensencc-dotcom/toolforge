#!/usr/bin/env bash
### Git Pre-Push Hook: execute deep, AST-aware dependency call-graph checks
### using Graft and run-sibling-check-v2.mjs before code is pushed to remote.
###
### Chain from .git/hooks/pre-push so stdin (the pushed refs) reaches this script.
### Set GRAFT_GATE_STRICT=1 to block the push when graft itself is unavailable.
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

ZERO=0000000000000000000000000000000000000000

VALIDATOR="scripts/run-sibling-check-v2.mjs"
if [ ! -f "$VALIDATOR" ]; then
  echo "[GRAFT-PRE-PUSH] ✗ $VALIDATOR not found. Push blocked (gate is part of this repo)."
  exit 1
fi

FAIL=0

# Hook receives one line per pushed ref on stdin: <local ref> <local sha> <remote ref> <remote sha>
while read -r local_ref local_sha remote_ref remote_sha; do
  [ -z "$local_sha" ] && continue

  # Branch deletion: nothing to check
  if [ "$local_sha" = "$ZERO" ]; then
    continue
  fi

  if [ "$remote_sha" != "$ZERO" ] && git cat-file -e "${remote_sha}^{commit}" 2>/dev/null; then
    RANGE="$remote_sha..$local_sha"
  elif git rev-parse --verify origin/main >/dev/null 2>&1; then
    RANGE="origin/main..$local_sha"
  else
    RANGE="$local_sha~1..$local_sha"
  fi

  echo "[GRAFT-PRE-PUSH] $local_ref: scanning $RANGE"

  CHANGED_CODE=$(git diff --name-only "$RANGE" | grep -E '\.(js|mjs|ts)$' || true)
  if [ -z "$CHANGED_CODE" ]; then
    echo "[GRAFT-PRE-PUSH] No JS/TS files modified in $local_ref. Skipping AST checks."
    continue
  fi

  if node "$VALIDATOR" --mode=pre-push --range="$RANGE"; then
    echo "[GRAFT-PRE-PUSH] ✓ $local_ref: interface checks passed."
  else
    echo "[GRAFT-PRE-PUSH] ✗ $local_ref: sibling pattern checks failed."
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "[GRAFT-PRE-PUSH] Push blocked. Update the affected consumers, or bypass with 'git push --no-verify'."
  exit 1
fi

exit 0
