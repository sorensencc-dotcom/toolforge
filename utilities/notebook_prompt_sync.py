"""Zero-dependency cell-targeted prompt synchronization engine for Jupyter notebooks."""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Tuple


def update_targeted_cell(
    notebook_path: Path,
    target_tag: str,
    new_prompt_content: str,
    dry_run: bool = False
) -> Tuple[int, str]:
    """
    Updates the cell identified by target_tag in the specified notebook.
    
    Args:
        notebook_path: Path to the target Jupyter notebook.
        target_tag: Tag uniquely identifying the cell in cell.metadata.tags.
        new_prompt_content: The new text/source to inject into the target cell.
        dry_run: If True, resolves the cell and validates changes without writing to disk.
        
    Returns:
        tuple[int, str]: (exit_code, status_or_error_message). 0 for success/no-op, 1 for errors.
    """
    path = Path(notebook_path)
    if not path.is_file():
        return (1, f"Error: Notebook file '{path}' not found")

    try:
        with open(path, "r", encoding="utf-8") as f:
            nb_dict = json.load(f)
    except json.JSONDecodeError as err:
        return (1, f"Error: Notebook '{path}' is not valid JSON: {err}")
    except Exception as err:
        return (1, f"Error: Failed to read notebook '{path}': {err}")

    cells = nb_dict.get("cells")
    if not isinstance(cells, list):
        return (1, f"Error: Malformed notebook structure (missing or invalid 'cells' array) in '{path}'")

    matching_indices = []
    for idx, cell in enumerate(cells):
        metadata = cell.get("metadata", {})
        tags = metadata.get("tags", [])
        if isinstance(tags, list) and target_tag in tags:
            matching_indices.append(idx)

    if not matching_indices:
        return (1, f"Error: Target tag '{target_tag}' not found in notebook '{path}'")

    if len(matching_indices) > 1:
        return (1, f"Error: Target tag '{target_tag}' matches multiple cells ({len(matching_indices)}) in notebook '{path}'")

    target_idx = matching_indices[0]
    target_cell = cells[target_idx]

    # Normalize new prompt content source lines
    new_source = new_prompt_content.splitlines(keepends=True)

    # Check if content already matches
    current_source = target_cell.get("source", [])
    if isinstance(current_source, list):
        current_content = "".join(current_source)
    else:
        current_content = str(current_source)

    if current_content == new_prompt_content:
        return (0, f"Cell with tag '{target_tag}' already matches target content in '{path}' (no-op)")

    if dry_run:
        return (0, f"[DRY-RUN] Target tag '{target_tag}' resolved at cell index {target_idx} in '{path}'. Changes would be applied.")

    # Apply changes
    target_cell["source"] = new_source
    if target_cell.get("cell_type") == "code":
        target_cell["outputs"] = []
        target_cell["execution_count"] = None

    # Atomic write back
    parent_dir = path.resolve().parent
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", dir=parent_dir, delete=False, encoding="utf-8", suffix=".tmp") as tf:
            tmp_path = Path(tf.name)
            json.dump(nb_dict, tf, indent=1, ensure_ascii=False)
            tf.write("\n")
        os.replace(tmp_path, path)
    except Exception as err:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass
        return (1, f"Error: Failed to write notebook atomically: {err}")

    return (0, f"Successfully updated cell with tag '{target_tag}' in '{path}'")


def main(argv=None) -> int:
    """CLI entry point for cell-targeted prompt synchronization."""
    parser = argparse.ArgumentParser(
        description="Sync prompt content into a tagged cell in a Jupyter notebook."
    )
    parser.add_argument("notebook_path", help="Path to the target .ipynb file")
    parser.add_argument("target_tag", help="Unique tag identifier in the cell metadata")
    parser.add_argument("prompt_file", help="Path to the file containing the prompt content to sync")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate target tag and preview changes without modifying the notebook"
    )

    args = parser.parse_args(argv)

    prompt_path = Path(args.prompt_file)
    if not prompt_path.is_file():
        print(f"Error: Prompt file '{prompt_path}' not found", file=sys.stderr)
        return 1

    try:
        new_prompt_content = prompt_path.read_text(encoding="utf-8")
    except Exception as err:
        print(f"Error: Failed to read prompt file '{prompt_path}': {err}", file=sys.stderr)
        return 1

    code, message = update_targeted_cell(
        notebook_path=Path(args.notebook_path),
        target_tag=args.target_tag,
        new_prompt_content=new_prompt_content,
        dry_run=args.dry_run
    )

    if code == 0:
        print(message)
    else:
        print(message, file=sys.stderr)

    return code


if __name__ == "__main__":
    sys.exit(main())
