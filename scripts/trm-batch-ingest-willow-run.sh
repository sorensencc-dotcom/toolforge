#!/usr/bin/env bash
# Batch-ingest the staged willow-run intake (589 files) one at a time via
# `trm ingest`, since the CLI has no native batch/directory ingest command.
# Resumable: skips any file whose title already exists in sources/metadata.json.
# Logs every outcome to the log file so a partial/interrupted run can be resumed.
# HEIC is supported (heic-convert wired into extractImage as of 2026-08-06) --
# ingested as type=photo like any other image, not skipped.
set -uo pipefail

VAULT="/c/Users/soren/trm-vault"
STAGING="$VAULT/topics/charlie/willow-run/_staging-intake-20260805-b88caebe"
CLI="node /c/dev/trm/dist/cli/index.js"
ACTOR="ACTOR-001"
LOG="$VAULT/logs/willow-run-batch-ingest-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$VAULT/logs"

cd "$VAULT" || exit 1

already_ingested() {
  local title="$1"
  # NOTE: path must be relative (we cd into $VAULT above) -- node.exe is a native
  # Windows binary and cannot resolve MSYS-style "/c/Users/..." paths embedded in
  # a -e script string, so an absolute $VAULT path here always fails existsSync
  # and silently disables the skip check. Found 2026-08-07 after it let the batch
  # re-ingest the same files across multiple runs undetected.
  node -e '
    const fs = require("fs");
    const path = "topics/charlie/willow-run/sources/metadata.json";
    if (!fs.existsSync(path)) process.exit(1);
    const { sources } = JSON.parse(fs.readFileSync(path, "utf-8"));
    const target = process.argv[1];
    process.exit(sources.some(s => s.title === target) ? 0 : 1);
  ' "$title"
}

total=0 ok=0 skipped=0 failed=0 attempted=0
LIMIT="${LIMIT:-0}"  # 0 = no limit; set LIMIT=N to attempt N NEW ingests this run (chunking)

while IFS= read -r -d '' file; do
  total=$((total+1))
  basename_file="$(basename "$file")"
  ext="${basename_file##*.}"
  ext_lower="$(echo "$ext" | tr 'A-Z' 'a-z')"

  if already_ingested "$basename_file"; then
    skipped=$((skipped+1))
    echo "SKIP (already ingested): $basename_file" | tee -a "$LOG"
    continue
  fi

  if [ "$LIMIT" -gt 0 ] && [ "$attempted" -ge "$LIMIT" ]; then
    echo "CHUNK LIMIT reached ($LIMIT new ingests) -- stopping, resume by rerunning" | tee -a "$LOG"
    break
  fi
  attempted=$((attempted+1))

  type="photo"
  case "$ext_lower" in
    docx) type="document" ;;
  esac

  echo "INGESTING: $basename_file" | tee -a "$LOG"
  if $CLI ingest charlie/willow-run \
      --type "$type" --origin intake --actor "$ACTOR" \
      --title "$basename_file" --file "$file" >>"$LOG" 2>&1; then
    ok=$((ok+1))
    echo "OK: $basename_file" | tee -a "$LOG"
  else
    failed=$((failed+1))
    echo "FAILED: $basename_file" | tee -a "$LOG"
  fi
done < <(find "$STAGING" -type f -print0)

echo "" | tee -a "$LOG"
echo "=== SUMMARY ===" | tee -a "$LOG"
echo "scanned: $total  attempted: $attempted  ok: $ok  skipped(already ingested): $skipped  failed: $failed" | tee -a "$LOG"
echo "log: $LOG"
