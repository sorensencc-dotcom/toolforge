#!/bin/bash
# Test suite for kb-sync-nightly skill

set -e

KB_DIR="C:\dev\cic-os\personal-knowledge-base"
PYTHON="python3"

echo "Testing Knowledge Base Sync..."

# Test 1: Verify prerequisites
echo "[Test 1] Checking prerequisites..."
if ! command -v $PYTHON &> /dev/null; then
    echo "FAIL: Python3 not found"
    exit 1
fi
echo "PASS: Python3 found"

# Test 2: Verify files exist
echo "[Test 2] Checking required files..."
required_files=(
    "$KB_DIR/sync.py"
    "$KB_DIR/sync-all.py"
    "$KB_DIR/integrate.py"
    "$KB_DIR/integration-config.json"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "FAIL: Missing $file"
        exit 1
    fi
done
echo "PASS: All required files found"

# Test 3: Verify Python syntax
echo "[Test 3] Checking Python syntax..."
for py_file in "$KB_DIR"/sync-all.py "$KB_DIR"/integrate.py; do
    if ! $PYTHON -m py_compile "$py_file" 2>/dev/null; then
        echo "FAIL: Syntax error in $py_file"
        exit 1
    fi
done
echo "PASS: Python files have valid syntax"

# Test 4: Verify JSON config
echo "[Test 4] Validating JSON configuration..."
if ! $PYTHON -m json.tool "$KB_DIR/integration-config.json" > /dev/null 2>&1; then
    echo "FAIL: Invalid JSON in integration-config.json"
    exit 1
fi
echo "PASS: JSON configuration is valid"

# Test 5: Test dry run (optional, commented out)
# echo "[Test 5] Testing sync execution..."
# cd "$KB_DIR"
# if ! $PYTHON sync-all.py --dry-run 2>&1 | grep -q "complete"; then
#     echo "FAIL: sync-all.py execution failed"
#     exit 1
# fi
# echo "PASS: sync-all.py executed successfully"

echo ""
echo "All tests passed!"
exit 0
