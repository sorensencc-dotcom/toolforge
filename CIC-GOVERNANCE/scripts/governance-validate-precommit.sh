#!/usr/bin/env bash
# ==============================================================================
# CIC-GOVERNANCE Git Pre-Commit Validation Hook
# ==============================================================================
set -e

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR_PATH="${SCRIPT_DIR}/validate-governance-contract.mjs"

echo -e "${BOLD}${CYAN}[CIC-GOVERNANCE Pre-Commit Hook] Validating staged artifacts...${NC}\n"

# 1. Contract Validation Step
node "$VALIDATOR_PATH"
CONTRACT_EXIT=$?

if [ $CONTRACT_EXIT -ne 0 ]; then
  echo -e "\n${RED}[FAIL] Governance contract validation failed. Commit blocked.${NC}"
  exit 1
fi

# 2. Sibling Pattern Leakage Scan
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(md|py|js|mjs|sh|json)$' || true)

if [ -n "$STAGED_FILES" ]; then
  echo -e "${BOLD}Scanning staged files for sibling pattern leaks...${NC}"
  LEAK_FOUND=false
  for FILE in $STAGED_FILES; do
    if [ -f "$FILE" ]; then
      # Strip code blocks, inline backticks, and YAML literals before checking leakage
      CLEANED_CONTENT=$(sed -e '/```/,/```/d' -e 's/`[^`]*`//g' "$FILE")
      if echo "$CLEANED_CONTENT" | grep -E -q '(C:[/\\]dev[/\\](rewrite-docs|rewrite-mcp|toolforge|financeos)|\.\./\.\./(rewrite-docs|rewrite-mcp|toolforge))'; then
        echo -e "  ${RED}✘ Sibling pattern leak detected in: ${FILE}${NC}"
        LEAK_FOUND=true
      fi
    fi
  done

  if [ "$LEAK_FOUND" = true ]; then
    echo -e "\n${RED}[FAIL] Hardcoded sibling path leaks detected in staged files. Commit blocked.${NC}"
    exit 1
  fi
fi

echo -e "\n${GREEN}✔ [PASS] Pre-commit checks completed cleanly.${NC}"
exit 0
