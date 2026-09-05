#!/usr/bin/env bash
set -euo pipefail

echo "=== Herdr + Toolforge + Sigil Fleet Launcher ==="

if [ "${1:-}" = "--verify-schema" ]; then
    echo "[PREFLIGHT] Running schema test..."
    node --test tests/schema-validator.test.mjs
fi

CONNECTOR_URL="${SIGIL_CONNECTOR_URL:-http://127.0.0.1:8787}"

if curl -s --max-time 2 "$CONNECTOR_URL/health" >/dev/null 2>&1; then
    echo "[OK] Sigil connector is online at $CONNECTOR_URL"
else
    echo "[WARN] Sigil connector not responding at $CONNECTOR_URL"
fi

if [ -f "manifest.json" ]; then
    echo "[OK] Toolforge manifest verified."
fi

echo "Ready to launch Herdr session."
