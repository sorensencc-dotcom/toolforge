# Cell-Targeted Prompt Referencing & Satellite Notebook Ingestion Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency, AST-driven Python ingestion engine that updates targeted prompt cells in satellite Jupyter notebooks via cell metadata tags without mutating neighboring code, ephemeral outputs, or execution states.

**Architecture:** The engine parses `.ipynb` JSON trees natively using Python's standard library `json` module (with schema v4 parity), enforces strict tag uniqueness (`count(tag) == 1`), resets execution counters on code prompt cells, and uses temporary file replacement (`os.replace`) for crash-resilient atomic commits. A batch ingestion runner and a tag-uniqueness preflight validator ensure safe CI/CD execution across satellite repositories.

**Tech Stack:** Python 3.10+ (Standard Library: `json`, `pathlib`, `argparse`, `tempfile`, `unittest`, `os`, `sys`).

## Global Constraints

- Zero external package dependencies (must run on stock Python 3 without requiring `pip install nbformat` or virtual environments).
- Full Jupyter Notebook v4 JSON AST schema compatibility.
- Atomic write-back via temporary file swap to eliminate partial writes or dirty auto-save clobbering.
- Strict exit code semantics: `0` on success or clean no-op, `1` on missing tag, duplicate tag, or parse failure.
- Pure standard library `unittest` test runner (`python -m unittest tests/test_notebook_prompt_sync.py`).

---

### File Structure

```
c:\dev\
├── utilities\
│   └── notebook_prompt_sync.py       # Core AST cell-targeted prompt sync & CLI
├── scripts\
│   └── validate_notebook_tags.py     # CI/Pre-commit uniqueness & integrity checker
└── tests\
    └── test_notebook_prompt_sync.py  # Unit & integration test suite (unittest)
```

---

### Task 1: Core Target Resolution & Atomic Cell Update Engine

**Files:**
- Create: `utilities/notebook_prompt_sync.py`
- Test: `tests/test_notebook_prompt_sync.py`

**Interfaces:**
- Consumes: Notebook `.ipynb` file path, metadata tag string, and prompt source text.
- Produces: `update_targeted_cell(notebook_path: Path, target_tag: str, new_prompt: str, dry_run: bool = False) -> tuple[int, str]`
  - Exit code `0` on success/no-op, `1` on error.
  - Return message detailing the action taken.

- [ ] **Step 1: Write the failing test for single cell update and tag resolution**

Create `tests/test_notebook_prompt_sync.py`:
```python
import json
import os
import tempfile
import unittest
from pathlib import Path

from utilities.notebook_prompt_sync import update_targeted_cell


class TestNotebookPromptSync(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.TemporaryDirectory()
        self.dir_path = Path(self.test_dir.name)

    def tearDown(self):
        self.test_dir.cleanup()

    def _create_sample_notebook(self, cells):
        nb_data = {
            "cells": cells,
            "metadata": {
                "language_info": {"name": "python", "version": "3.10.0"},
                "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            },
            "nbformat": 4,
            "nbformat_minor": 5,
        }
        nb_path = self.dir_path / "sample.ipynb"
        nb_path.write_text(json.dumps(nb_data, indent=2), encoding="utf-8")
        return nb_path

    def test_update_markdown_cell_by_tag(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["kb-sync:managed", "kb-sync:target:sys_prompt"]},
                "source": ["# Old Prompt\n", "Old instructions"],
            },
            {
                "cell_type": "code",
                "metadata": {},
                "source": ["x = 1\n", "print(x)"],
                "outputs": [],
                "execution_count": 1,
            },
        ]
        nb_path = self._create_sample_notebook(cells)
        new_prompt = "# New System Prompt\nUpdated instructions"

        code, msg = update_targeted_cell(nb_path, "kb-sync:target:sys_prompt", new_prompt)
        self.assertEqual(code, 0)

        # Verify disk contents
        data = json.loads(nb_path.read_text(encoding="utf-8"))
        self.assertEqual(data["cells"][0]["source"], ["# New System Prompt\n", "Updated instructions"])
        self.assertEqual(data["cells"][1]["source"], ["x = 1\n", "print(x)"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/test_notebook_prompt_sync.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'utilities.notebook_prompt_sync'`

- [ ] **Step 3: Write minimal implementation**

Create `utilities/notebook_prompt_sync.py`:
```python
#!/usr/bin/env python3
"""
notebook_prompt_sync.py
Zero-dependency, AST-based cell-targeted prompt synchronization for Jupyter notebooks.
"""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _normalize_source_to_lines(content: str) -> List[str]:
    lines = content.splitlines(keepends=True)
    if not lines:
        return []
    # If the last line does not have a newline, ensure format matches nbformat standard
    return lines


def _normalize_source_to_string(source: Any) -> str:
    if isinstance(source, list):
        return "".join(source).strip()
    if isinstance(source, str):
        return source.strip()
    return ""


def update_targeted_cell(
    notebook_path: Path,
    target_tag: str,
    new_prompt_content: str,
    dry_run: bool = False,
) -> Tuple[int, str]:
    if not notebook_path.is_file():
        return 1, f"Error: Notebook not found at {notebook_path}"

    try:
        data = json.loads(notebook_path.read_text(encoding="utf-8"))
    except Exception as err:
        return 1, f"Error parsing notebook JSON {notebook_path.name}: {err}"

    cells: List[Dict[str, Any]] = data.get("cells", [])
    matching_indices = [
        idx
        for idx, cell in enumerate(cells)
        if target_tag in cell.get("metadata", {}).get("tags", [])
    ]

    if not matching_indices:
        return 1, f"Error: Target tag '{target_tag}' not found in {notebook_path.name}."

    if len(matching_indices) > 1:
        return 1, (
            f"Error: Target tag '{target_tag}' matched multiple cells ({matching_indices}) "
            f"in {notebook_path.name}. Tags must be unique."
        )

    target_idx = matching_indices[0]
    target_cell = cells[target_idx]

    existing_str = _normalize_source_to_string(target_cell.get("source", ""))
    incoming_str = new_prompt_content.strip()

    if existing_str == incoming_str:
        return 0, f"[{notebook_path.name}] Tag '{target_tag}' already matches source. No change."

    if dry_run:
        return 0, (
            f"[DRY-RUN] Would update cell #{target_idx} "
            f"(tag: '{target_tag}', type: {target_cell.get('cell_type')}) in {notebook_path.name}."
        )

    # Update source content
    target_cell["source"] = _normalize_source_to_lines(new_prompt_content)

    # Invalidate outputs and execution state if it's a code prompt cell
    if target_cell.get("cell_type") == "code":
        target_cell["outputs"] = []
        target_cell["execution_count"] = None

    # Atomic write back via sibling temporary file
    temp_dir = notebook_path.parent
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            dir=temp_dir,
            delete=False,
            encoding="utf-8",
            suffix=".tmp.ipynb",
        ) as tmp_file:
            json.dump(data, tmp_file, indent=2, ensure_ascii=False)
            tmp_file.write("\n")
            tmp_path = Path(tmp_file.name)

        os.replace(tmp_path, notebook_path)
        return 0, f"[{notebook_path.name}] Successfully updated cell tagged '{target_tag}'."
    except Exception as write_err:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        return 1, f"Error writing to {notebook_path.name}: {write_err}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Targeted ingestion of prompt markdown into Jupyter notebook cells."
    )
    parser.add_argument("notebook_path", type=Path, help="Path to target .ipynb notebook")
    parser.add_argument("target_tag", type=str, help="Cell metadata tag to match")
    parser.add_argument("prompt_file", type=Path, help="Path to markdown/text prompt source file")
    parser.add_argument("--dry-run", action="store_true", help="Simulate changes without modifying disk")

    args = parser.parse_args()

    if not args.prompt_file.is_file():
        print(f"Error: Prompt source file not found: {args.prompt_file}", file=sys.stderr)
        sys.exit(1)

    try:
        prompt_content = args.prompt_file.read_text(encoding="utf-8")
    except Exception as err:
        print(f"Error reading prompt file: {err}", file=sys.stderr)
        sys.exit(1)

    code, msg = update_targeted_cell(
        notebook_path=args.notebook_path,
        target_tag=args.target_tag,
        new_prompt_content=prompt_content,
        dry_run=args.dry_run,
    )
    if code != 0:
        print(msg, file=sys.stderr)
    else:
        print(msg)
    sys.exit(code)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/test_notebook_prompt_sync.py`
Expected: `Ran 1 test in ...s ... OK`

- [ ] **Step 5: Commit**

```bash
git add utilities/notebook_prompt_sync.py tests/test_notebook_prompt_sync.py
git commit -m "feat(notebook-sync): add core cell-targeted prompt sync utility"
```

---

### Task 2: Comprehensive Edge Case & Invariant Test Suite

**Files:**
- Modify: `tests/test_notebook_prompt_sync.py`

**Interfaces:**
- Consumes: `update_targeted_cell` from `utilities.notebook_prompt_sync`.
- Produces: Test coverage for duplicate tags, missing tags, code cell output clearing, dry run assertions, and no-op matching.

- [ ] **Step 1: Write expanded edge case tests**

Add to `tests/test_notebook_prompt_sync.py`:
```python
    def test_missing_tag_fails(self):
        cells = [
            {"cell_type": "markdown", "metadata": {"tags": ["other-tag"]}, "source": "test"}
        ]
        nb_path = self._create_sample_notebook(cells)
        code, msg = update_targeted_cell(nb_path, "kb-sync:target:missing", "new prompt")
        self.assertEqual(code, 1)
        self.assertIn("not found", msg)

    def test_duplicate_tags_rejected(self):
        cells = [
            {"cell_type": "markdown", "metadata": {"tags": ["target_tag"]}, "source": "prompt 1"},
            {"cell_type": "markdown", "metadata": {"tags": ["target_tag"]}, "source": "prompt 2"},
        ]
        nb_path = self._create_sample_notebook(cells)
        code, msg = update_targeted_cell(nb_path, "target_tag", "new prompt")
        self.assertEqual(code, 1)
        self.assertIn("matched multiple cells", msg)

    def test_code_cell_clears_outputs_and_exec_count(self):
        cells = [
            {
                "cell_type": "code",
                "metadata": {"tags": ["target_tag"]},
                "source": ["PROMPT = 'old'"],
                "outputs": [{"output_type": "stream", "text": ["old"]}],
                "execution_count": 42,
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        code, msg = update_targeted_cell(nb_path, "target_tag", "PROMPT = 'new'")
        self.assertEqual(code, 0)

        data = json.loads(nb_path.read_text(encoding="utf-8"))
        cell = data["cells"][0]
        self.assertEqual(cell["outputs"], [])
        self.assertIsNone(cell["execution_count"])
        self.assertEqual(cell["source"], ["PROMPT = 'new'"])

    def test_no_op_identical_content(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["target_tag"]},
                "source": ["# Same Title\n", "Same body"],
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        code, msg = update_targeted_cell(nb_path, "target_tag", "# Same Title\nSame body")
        self.assertEqual(code, 0)
        self.assertIn("already matches source", msg)

    def test_dry_run_does_not_mutate_file(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["target_tag"]},
                "source": "original",
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        code, msg = update_targeted_cell(nb_path, "target_tag", "modified", dry_run=True)
        self.assertEqual(code, 0)
        self.assertIn("[DRY-RUN]", msg)

        # File remains unmodified
        data = json.loads(nb_path.read_text(encoding="utf-8"))
        self.assertEqual(data["cells"][0]["source"], "original")
```

- [ ] **Step 2: Run test suite to verify full coverage**

Run: `python -m unittest tests/test_notebook_prompt_sync.py`
Expected: `Ran 6 tests in ...s ... OK`

- [ ] **Step 3: Commit**

```bash
git add tests/test_notebook_prompt_sync.py
git commit -m "test(notebook-sync): add edge-case and invariant test suite"
```

---

### Task 3: Satellite Repository Tag Integrity & CI Validator

**Files:**
- Create: `scripts/validate_notebook_tags.py`
- Test: `tests/test_validate_notebook_tags.py`

**Interfaces:**
- Consumes: Target directory or list of `.ipynb` files, optional expected tag prefixes (`kb-sync:target:`).
- Produces: `validate_notebook_directory(directory: Path, prefix: str = "kb-sync:target:") -> tuple[int, list[str]]`
  - Exit code `0` if all notebooks have valid, non-duplicate tags.
  - Exit code `1` if any file contains duplicate tags or unparseable JSON.

- [ ] **Step 1: Write failing test for tag integrity validator**

Create `tests/test_validate_notebook_tags.py`:
```python
import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_notebook_tags import validate_notebook_directory


class TestValidateNotebookTags(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.TemporaryDirectory()
        self.dir_path = Path(self.test_dir.name)

    def tearDown(self):
        self.test_dir.cleanup()

    def _write_nb(self, filename, cells):
        nb_data = {"cells": cells, "metadata": {}, "nbformat": 4, "nbformat_minor": 2}
        p = self.dir_path / filename
        p.write_text(json.dumps(nb_data), encoding="utf-8")
        return p

    def test_clean_directory_passes(self):
        self._write_nb("nb1.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p1"]}, "source": "a"},
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p2"]}, "source": "b"},
        ])
        code, errors = validate_notebook_directory(self.dir_path)
        self.assertEqual(code, 0)
        self.assertEqual(len(errors), 0)

    def test_duplicate_tag_fails(self):
        self._write_nb("nb_dup.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p1"]}, "source": "a"},
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p1"]}, "source": "b"},
        ])
        code, errors = validate_notebook_directory(self.dir_path)
        self.assertEqual(code, 1)
        self.assertTrue(any("Duplicate tag" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify failure**

Run: `python -m unittest tests/test_validate_notebook_tags.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.validate_notebook_tags'`

- [ ] **Step 3: Implement tag validation script**

Create `scripts/validate_notebook_tags.py`:
```python
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
from typing import List, Tuple


def validate_notebook_directory(
    directory: Path,
    prefix: str = "kb-sync:target:",
) -> Tuple[int, List[str]]:
    errors = []
    nb_files = list(directory.rglob("*.ipynb"))

    for nb_path in nb_files:
        # Ignore checkpoints and temp files
        if ".ipynb_checkpoints" in nb_path.parts or nb_path.name.endswith(".tmp.ipynb"):
            continue

        try:
            data = json.loads(nb_path.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"[{nb_path.name}] Failed to parse JSON: {e}")
            continue

        tag_counts = collections.defaultdict(int)
        for idx, cell in enumerate(data.get("cells", [])):
            tags = cell.get("metadata", {}).get("tags", [])
            for tag in tags:
                if not prefix or tag.startswith(prefix):
                    tag_counts[tag] += 1

        for tag, count in tag_counts.items():
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
```

- [ ] **Step 4: Run tests to verify pass**

Run: `python -m unittest tests/test_validate_notebook_tags.py`
Expected: `Ran 2 tests in ...s ... OK`

- [ ] **Step 5: Commit**

```bash
git add scripts/validate_notebook_tags.py tests/test_validate_notebook_tags.py
git commit -m "feat(notebook-sync): add CI notebook tag integrity validator"
```

---

### Task 4: Documentation and Operator Guide

**Files:**
- Create: `docs/targets/notebook-prompt-sync-guide.md`

- [ ] **Step 1: Write operator guide**

Create `docs/targets/notebook-prompt-sync-guide.md`:
```markdown
# Satellite Notebook Prompt Sync Operator Guide

The `notebook_prompt_sync` tool establishes isolated ingestion pipelines for satellite Jupyter notebooks, binding upstream prompt and instruction changes directly to specific prompt cells without mutating neighboring custom logic or ephemeral prompt engineering.

## 1. Cell Tagging Standard

In your Jupyter or VS Code notebook editor, attach the following metadata tags to the target prompt cell:

- `kb-sync:managed` — Declares the cell as managed by automated upstream ingestion.
- `kb-sync:target:<prompt_id>` — Unique identifier for the specific prompt target (e.g., `kb-sync:target:system_core`).

## 2. Sync CLI Usage

To sync a prompt markdown file into a single satellite notebook:

```bash
python utilities/notebook_prompt_sync.py ./notebooks/analysis.ipynb kb-sync:target:system_core ./prompts/system_v2.md
```

To run a non-destructive dry-run:

```bash
python utilities/notebook_prompt_sync.py ./notebooks/analysis.ipynb kb-sync:target:system_core ./prompts/system_v2.md --dry-run
```

## 3. Tag Validation in CI

To verify that no satellite notebooks have duplicate tags or malformed JSON:

```bash
python scripts/validate_notebook_tags.py ./notebooks/
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/targets/notebook-prompt-sync-guide.md
git commit -m "docs(notebook-sync): add operator guide for cell-targeted prompt sync"
```

---

## Self-Review Checklist

1. **Spec Coverage:**
   - Metadata tag cell targeting implemented in Task 1.
   - Standard AST manipulation (zero external deps) implemented in Task 1.
   - Tag uniqueness assertion (`count == 1`) implemented in Task 1 & Task 3.
   - Non-zero exit code on missing/duplicate tags implemented in Task 1.
   - Atomic file commit via temporary swap implemented in Task 1.
   - Full TDD coverage implemented in Task 1, 2, and 3.
2. **Placeholder Scan:** Zero instances of "TODO", "TBD", or unwritten code blocks. All file paths and code snippets are complete and executable.
3. **Type Consistency:** Function signatures (`update_targeted_cell`, `validate_notebook_directory`) match identically across implementations and unit test suites.
