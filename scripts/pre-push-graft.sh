#!/usr/bin/env bash
### Git Pre-Push Hook: execute deep, AST-aware dependency call-graph checks
### using Graft and run-sibling-check-v2.mjs before code is pushed to remote.
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# Hook receives parameters on stdin: <local ref> <local sha> <remote ref> <remote sha>
# Read stdin to determine if we are pushing commits
read -r local_ref local_sha remote_ref remote_sha

# Zero-hash represents branch deletion; skip checks
if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
  exit 0
fi

# Determine commit range
if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
  # New branch, compare against main or upstream tracking branch
  RANGE="origin/main..$local_sha"
  # Fallback if origin/main doesn't exist locally
  if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
    RANGE="HEAD~1..$local_sha"
  fi
else
  RANGE="$remote_sha..$local_sha"
fi

echo "[GRAFT-PRE-PUSH] Scanning commit range: $RANGE"

# Identify any code files modified in this push
CHANGED_CODE=$(git diff --name-only "$RANGE" | grep -E '\.(js|mjs|ts|sh)$' || true)

# Resolve validator path defensively
VALIDATOR="run-sibling-check-v2.mjs"
if [ ! -f "$VALIDATOR" ]; then
  VALIDATOR="scripts/run-sibling-check-v2.mjs"
fi

if [ -n "$CHANGED_CODE" ]; then
  echo "[GRAFT-PRE-PUSH] Staged code changes detected in commit history."
  echo "[GRAFT-PRE-PUSH] Performing compiler-grade Graft context-graph validation..."
  
  if [ ! -f "$VALIDATOR" ]; then
    echo "[GRAFT-PRE-PUSH] ⚠ Warning: run-sibling-check-v2.mjs not found at root or scripts/."
    echo "[GRAFT-PRE-PUSH] Bypassing checks. Please verify your script organization."
    exit 0
  fi

  # Execute the pre-push sibling check (triggers graft callers)
  if node "$VALIDATOR" --mode=pre-push; then
    echo "[GRAFT-PRE-PUSH] ✓ AST-aware interface checks passed. Ready to push."
    exit 0
  else
    echo "[GRAFT-PRE-PUSH] ✗ Sibling pattern checks failed! Broken API contracts detected."
    echo "[GRAFT-PRE-PUSH] Push blocked. Fix the dependency conflicts or bypass with 'git push --no-verify'."
    exit 1
  fi
else
  echo "[GRAFT-PRE-PUSH] No code files modified in this push. Bypassing AST checks."
  exit 0
fi