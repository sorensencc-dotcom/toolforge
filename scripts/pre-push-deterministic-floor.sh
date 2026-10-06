#!/usr/bin/env bash
# Deterministic Floor: $0-token CPU-executed verification gate
# Enforces path boundaries, character-span SHA-256 integrity, and AST call-graph invariants.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "[deterministic-floor] Starting pre-push deterministic gate verification..."

# 1. Read pushed refs from stdin (<local_ref> <local_sha> <remote_ref> <remote_sha>)
PUSH_HAS_COMMITS=0
ZERO_SHA="0000000000000000000000000000000000000000"

while read -r local_ref local_sha remote_ref remote_sha; do
  # Ignore branch deletions
  if [ "$local_sha" = "$ZERO_SHA" ]; then
    continue
  fi

  # Determine commit range
  if [ "$remote_sha" = "$ZERO_SHA" ]; then
    # New remote branch: compare against origin/main or HEAD~1
    if git rev-parse --verify origin/main >/dev/null 2>&1; then
      RANGE="origin/main..$local_sha"
    else
      RANGE="HEAD~1..$local_sha"
    fi
  else
    RANGE="$remote_sha..$local_sha"
  fi

  PUSH_HAS_COMMITS=1
  echo "[deterministic-floor] Validating commit range: $RANGE"

  # 2. Run local strict lint contracts if configured in package.json
  if [ -f "package.json" ]; then
    HAS_LINT=$(node -e "const p = require('./package.json'); process.stdout.write(p.scripts && p.scripts['lint:strict'] ? '1' : '0');" 2>/dev/null || echo "0")
    if [ "$HAS_LINT" = "1" ]; then
      echo "[deterministic-floor] Running local strict linter contract..."
      npm run --silent lint:strict
    fi
  fi

  # 3. Run Node.js Deterministic Floor self-checks
  if [ -f "tests/deterministicVerificationFloor.test.mjs" ]; then
    echo "[deterministic-floor] Running DeterministicVerificationFloor test suite..."
    node tests/deterministicVerificationFloor.test.mjs
  fi

  # 4. AST call-graph & blast radius inspection via Graft / Sibling Checker
  # Use NUL-delimited diff stream to handle spaces, newlines, and special characters
  CHANGED_CODE_COUNT=0
  while IFS= read -r -d '' FILE; do
    if [[ "$FILE" =~ \.(js|mjs|ts|tsx|py)$ ]] && [ -f "$FILE" ]; then
      CHANGED_CODE_COUNT=$((CHANGED_CODE_COUNT + 1))
    fi
  done < <(git diff --name-only -z "$RANGE" 2>/dev/null || true)

  if [ "$CHANGED_CODE_COUNT" -gt 0 ]; then
    echo "[deterministic-floor] $CHANGED_CODE_COUNT modified code files detected."
    
    if [ -f "scripts/run-sibling-check-v2.mjs" ]; then
      echo "[deterministic-floor] Executing AST-aware interface & sibling checks..."
      node scripts/run-sibling-check-v2.mjs --mode=pre-push || {
        echo "[SECURITY_VIOLATION] Sibling API contract validation failed!"
        exit 1
      }
    elif command -v graft >/dev/null 2>&1; then
      echo "[deterministic-floor] Running graft call-graph validation..."
      UNVERIFIED_SYMS=0
      while IFS= read -r -d '' FILE; do
        if [[ "$FILE" =~ \.(js|mjs|ts|py)$ ]] && [ -f "$FILE" ]; then
          SYMBOLS=$(graft skeleton "$FILE" 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i ~ /^[a-zA-Z_$][a-zA-Z0-9_$]*$/) print $i}' | sort -u || true)
          for SYM in $SYMBOLS; do
            if [ -n "$SYM" ]; then
              if ! graft callers "$SYM" --depth 1 >/dev/null 2>&1; then
                UNVERIFIED_SYMS=$((UNVERIFIED_SYMS + 1))
              fi
            fi
          done
        fi
      done < <(git diff --name-only -z "$RANGE" 2>/dev/null || true)
      if [ "$UNVERIFIED_SYMS" -gt 0 ]; then
        echo "[deterministic-floor] Advisory: $UNVERIFIED_SYMS symbols unindexed or without callers in graft."
      fi
    fi
  fi
done

echo "[deterministic-floor] All deterministic floor checks PASSED (exit 0)."
exit 0
