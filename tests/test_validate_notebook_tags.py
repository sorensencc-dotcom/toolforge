import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

# Add project root to sys.path to allow importing scripts
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.validate_notebook_tags import validate_notebook_directory, main


class TestValidateNotebookTags(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="nb_tag_val_test_")
        self.dir_path = Path(self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _write_nb(self, filename: str, cells: list, raw_content: str = None) -> Path:
        p = self.dir_path / filename
        p.parent.mkdir(parents=True, exist_ok=True)
        if raw_content is not None:
            p.write_text(raw_content, encoding="utf-8")
        else:
            nb_data = {"cells": cells, "metadata": {}, "nbformat": 4, "nbformat_minor": 2}
            p.write_text(json.dumps(nb_data, indent=2), encoding="utf-8")
        return p

    def test_clean_directory_passes(self):
        self._write_nb("nb1.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p1"]}, "source": "a"},
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p2"]}, "source": "b"},
        ])
        self._write_nb("sub/nb2.ipynb", [
            {"cell_type": "code", "metadata": {"tags": ["kb-sync:target:p3"]}, "source": "c"},
        ])
        code, errors = validate_notebook_directory(self.dir_path)
        self.assertEqual(code, 0)
        self.assertEqual(len(errors), 0)

    def test_duplicate_tags_fail(self):
        self._write_nb("nb_dup.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p1"]}, "source": "a"},
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p1"]}, "source": "b"},
        ])
        code, errors = validate_notebook_directory(self.dir_path)
        self.assertEqual(code, 1)
        self.assertTrue(any("Duplicate tag" in e for e in errors))
        self.assertTrue(any("kb-sync:target:p1" in e for e in errors))

    def test_malformed_json_notebook_fails(self):
        self._write_nb("corrupt.ipynb", cells=[], raw_content="INVALID_JSON{")
        code, errors = validate_notebook_directory(self.dir_path)
        self.assertEqual(code, 1)
        self.assertTrue(any("Failed to parse JSON" in e for e in errors))

    def test_checkpoints_and_tmp_files_ignored(self):
        # Create duplicate tags and corrupted JSON in checkpoints and tmp files
        self._write_nb(".ipynb_checkpoints/nb1-checkpoint.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p1"]}, "source": "a"},
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:p1"]}, "source": "b"},
        ])
        self._write_nb("test.tmp.ipynb", cells=[], raw_content="MALFORMED_TEMP_JSON")
        # Valid notebook in main dir
        self._write_nb("clean.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:valid"]}, "source": "a"},
        ])

        code, errors = validate_notebook_directory(self.dir_path)
        self.assertEqual(code, 0)
        self.assertEqual(len(errors), 0)

    def test_custom_prefix_filtering(self):
        # Duplicate tags on untracked prefix should not trigger error if prefix is specified
        self._write_nb("custom_prefix.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["custom:p1", "untracked:dup"]}, "source": "a"},
            {"cell_type": "markdown", "metadata": {"tags": ["custom:p2", "untracked:dup"]}, "source": "b"},
        ])
        # Default prefix kb-sync:target: -> no matches, clean
        code, errors = validate_notebook_directory(self.dir_path, prefix="kb-sync:target:")
        self.assertEqual(code, 0)
        self.assertEqual(len(errors), 0)

        # Custom prefix "custom:" -> clean
        code, errors = validate_notebook_directory(self.dir_path, prefix="custom:")
        self.assertEqual(code, 0)
        self.assertEqual(len(errors), 0)

        # Custom prefix "untracked:" -> duplicate detected
        code, errors = validate_notebook_directory(self.dir_path, prefix="untracked:")
        self.assertEqual(code, 1)
        self.assertTrue(any("Duplicate tag 'untracked:dup'" in e for e in errors))

    def test_empty_directory_passes(self):
        code, errors = validate_notebook_directory(self.dir_path)
        self.assertEqual(code, 0)
        self.assertEqual(len(errors), 0)

    def test_cli_clean_directory_subprocess(self):
        self._write_nb("nb_clean.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:c1"]}, "source": "a"}
        ])
        script_path = Path(__file__).resolve().parent.parent / "scripts" / "validate_notebook_tags.py"
        result = subprocess.run(
            [sys.executable, str(script_path), str(self.dir_path)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("All notebook cell tags are valid and unique", result.stdout)

    def test_cli_error_directory_subprocess(self):
        self._write_nb("nb_error.ipynb", [
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:c1"]}, "source": "a"},
            {"cell_type": "markdown", "metadata": {"tags": ["kb-sync:target:c1"]}, "source": "b"},
        ])
        script_path = Path(__file__).resolve().parent.parent / "scripts" / "validate_notebook_tags.py"
        result = subprocess.run(
            [sys.executable, str(script_path), str(self.dir_path)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("Notebook Tag Validation Failed", result.stderr)
        self.assertIn("Duplicate tag 'kb-sync:target:c1'", result.stderr)

    def test_cli_nonexistent_directory(self):
        script_path = Path(__file__).resolve().parent.parent / "scripts" / "validate_notebook_tags.py"
        non_existent = self.dir_path / "does_not_exist"
        result = subprocess.run(
            [sys.executable, str(script_path), str(non_existent)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("Directory not found", result.stderr)


if __name__ == "__main__":
    unittest.main()
