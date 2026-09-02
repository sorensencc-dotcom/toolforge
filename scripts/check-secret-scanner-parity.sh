#!/usr/bin/env bash
# Fails if any repo's secret-scan-hook.sh copy has drifted from canonical.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CANONICAL="$SCRIPT_DIR/secret-scan-hook.sh"
REPOS="cic-ingestion rewrite-docs rewrite-mcp kb-sync"
FAIL=0

for repo in $REPOS; do
  COPY="$SCRIPT_DIR/../$repo/scripts/secret-scan-hook.sh"
  if [ ! -f "$COPY" ]; then
    echo "MISSING: $COPY"
    FAIL=1
    continue
  fi
  if ! diff -q "$CANONICAL" "$COPY" > /dev/null; then
    echo "DRIFT: $COPY differs from canonical ($CANONICAL)"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "OK: all secret-scan-hook.sh copies match canonical."
fi

exit $FAIL
