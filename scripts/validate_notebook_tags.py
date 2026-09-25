#!/usr/bin/env python3
"""
validate_notebook_tags.py
CI/Pre-commit validation script to verify cell tag uniqueness in Jupyter notebooks.
"""

import argparse
import collections
import json
import sys
from pathlib import Path
from typing import List, Tuple, Union


def validate_notebook_directory(
    directory: Union[str, Path],
    prefix: str = "kb-sync:target:",
) -> Tuple[int, List[str]]:
    """
    Recursively scans directory for Jupyter notebooks (.ipynb), validating JSON
    AST integrity and asserting tag uniqueness for tags matching prefix.
    Ignores .ipynb_checkpoints and temporary *.tmp.ipynb files.
    """
    dir_path = Path(directory)
    errors: List[str] = []

    if not dir_path.is_dir():
        return 1, [f"Error: Directory not found: {dir_path}"]

    nb_files = sorted(dir_path.rglob("*.ipynb"))

    for nb_path in nb_files:
        # Ignore checkpoints and temp swap files
        if ".ipynb_checkpoints" in nb_path.parts or nb_path.name.endswith(".tmp.ipynb"):
            continue

        try:
            data = json.loads(nb_path.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"[{nb_path.name}] Failed to parse JSON: {e}")
            continue

        tag_counts: collections.defaultdict[str, int] = collections.defaultdict(int)
        for idx, cell in enumerate(data.get("cells", [])):
            metadata = cell.get("metadata", {})
            tags = metadata.get("tags", [])
            if not isinstance(tags, list):
                continue
            for tag in tags:
                if not prefix or tag.startswith(prefix):
                    tag_counts[tag] += 1

        for tag, count in sorted(tag_counts.items()):
            if count > 1:
                errors.append(
                    f"[{nb_path.name}] Duplicate tag '{tag}' found {count} times."
                )

    exit_code = 1 if errors else 0
    return exit_code, errors


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify tag uniqueness in Jupyter notebooks for CI/pre-commit."
    )
    parser.add_argument(
        "directory",
        type=Path,
        nargs="?",
        default=Path("."),
        help="Root directory to scan (default: current directory)",
    )
    parser.add_argument(
        "--prefix",
        type=str,
        default="kb-sync:target:",
        help="Tag prefix to validate uniqueness for (default: 'kb-sync:target:')",
    )

    args = parser.parse_args()

    if not args.directory.is_dir():
        print(f"Error: Directory not found: {args.directory}", file=sys.stderr)
        sys.exit(1)

    code, errors = validate_notebook_directory(args.directory, prefix=args.prefix)
    if code != 0:
        print("Notebook Tag Validation Failed:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
    else:
        print("All notebook cell tags are valid and unique.")
    sys.exit(code)


if __name__ == "__main__":
    main()
