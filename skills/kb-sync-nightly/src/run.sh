#!/bin/bash
# Knowledge Base Sync Orchestrator
# Wrapper script that executes the actual sync-all.py in cic-os/personal-knowledge-base/

set -e  # Exit on any error

KB_DIR="C:\dev\cic-os\personal-knowledge-base"

if [ ! -d "$KB_DIR" ]; then
    echo "Error: Knowledge base directory not found: $KB_DIR"
    exit 1
fi

if [ ! -f "$KB_DIR/sync-all.py" ]; then
    echo "Error: sync-all.py not found in $KB_DIR"
    exit 1
fi

echo "Knowledge Base Sync: Starting..."
echo "Working directory: $KB_DIR"

cd "$KB_DIR"
python3 sync-all.py

echo "Knowledge Base Sync: Complete"
exit 0
