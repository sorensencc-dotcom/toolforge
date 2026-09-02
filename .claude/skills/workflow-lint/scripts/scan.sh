#!/usr/bin/env bash
# Scans one or more repo roots for known GitHub Actions anti-patterns
# discovered via live CI failures (see ci-triage skill for the incidents).
# Usage: scan.sh [repo-root ...]   (defaults to every immediate subdir of cwd with a .github/workflows dir, plus cwd itself)

set -u
roots=("$@")
if [ ${#roots[@]} -eq 0 ]; then
  roots=(".")
  for d in */; do
    [ -d "${d}.github/workflows" ] && roots+=("$d")
  done
fi

found_any=0

check() {
  local pattern="$1" label="$2" root="$3"
  local hits
  hits=$(grep -rln "$pattern" "$root/.github/workflows"/*.yml 2>/dev/null)
  if [ -n "$hits" ]; then
    found_any=1
    echo "[$label]"
    while IFS= read -r f; do echo "  $f"; done <<< "$hits"
  fi
}

for root in "${roots[@]}"; do
  [ -d "$root/.github/workflows" ] || continue
  echo "=== $root ==="

  check "upload-artifact@v[123]\b" "deprecated upload-artifact version" "$root"
  check "download-artifact@v[123]\b" "deprecated download-artifact version" "$root"
  check "actions/checkout@v[123]\b" "old checkout version (v4+ recommended)" "$root"
  check "runs-on: ubuntu-1[68]\.04" "retired ubuntu runner image" "$root"
  check "runs-on: ubuntu-20\.04" "retired ubuntu-20.04 runner image" "$root"
  check '\$args\s*=' "PowerShell reserved-variable reassignment ('\$args' shadows automatic variable — breaks named splatting)" "$root"

  echo
done

if [ "$found_any" -eq 0 ]; then
  echo "No known anti-patterns found."
fi
