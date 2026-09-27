import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

# Add project root to sys.path to allow importing utilities
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utilities.notebook_prompt_sync import update_targeted_cell, main


class TestNotebookPromptSync(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="nb_sync_test_")
        self.test_dir_path = Path(self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _create_sample_notebook(self, cells: list) -> Path:
        nb_data = {
            "cells": cells,
            "metadata": {
                "language_info": {"name": "python"}
            },
            "nbformat": 4,
            "nbformat_minor": 5
        }
        nb_path = self.test_dir_path / "sample.ipynb"
        with open(nb_path, "w", encoding="utf-8") as f:
            json.dump(nb_data, f, indent=2)
        return nb_path

    def test_update_markdown_cell_success(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["prompt-system"]},
                "source": ["Old system prompt\n", "Second line"]
            },
            {
                "cell_type": "code",
                "metadata": {"tags": []},
                "execution_count": 1,
                "outputs": [{"output_type": "stream", "text": ["hello\n"]}],
                "source": ["print('hello')"]
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        new_content = "New system prompt\nSecond line updated\n"

        code, msg = update_targeted_cell(nb_path, "prompt-system", new_content)
        self.assertEqual(code, 0)
        self.assertIn("Successfully updated", msg)

        with open(nb_path, "r", encoding="utf-8") as f:
            updated_nb = json.load(f)

        target_cell = updated_nb["cells"][0]
        self.assertEqual(target_cell["source"], ["New system prompt\n", "Second line updated\n"])

    def test_update_code_cell_resets_outputs_and_execution_count(self):
        cells = [
            {
                "cell_type": "code",
                "metadata": {"tags": ["prompt-code"]},
                "execution_count": 42,
                "outputs": [{"output_type": "execute_result", "data": {"text/plain": "42"}}],
                "source": ["# Old code prompt\n", "run()"]
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        new_content = "# New code prompt\nrun_v2()"

        code, msg = update_targeted_cell(nb_path, "prompt-code", new_content)
        self.assertEqual(code, 0)

        with open(nb_path, "r", encoding="utf-8") as f:
            updated_nb = json.load(f)

        target_cell = updated_nb["cells"][0]
        self.assertEqual(target_cell["source"], ["# New code prompt\n", "run_v2()"])
        self.assertEqual(target_cell["outputs"], [])
        self.assertIsNone(target_cell["execution_count"])

    def test_noop_identical_content(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["target-tag"]},
                "source": ["Line 1\n", "Line 2"]
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        new_content = "Line 1\nLine 2"

        code, msg = update_targeted_cell(nb_path, "target-tag", new_content)
        self.assertEqual(code, 0)
        self.assertIn("already matches", msg)

    def test_dry_run_does_not_modify_file(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["prompt-tag"]},
                "source": ["Original content"]
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        new_content = "Modified content"

        code, msg = update_targeted_cell(nb_path, "prompt-tag", new_content, dry_run=True)
        self.assertEqual(code, 0)
        self.assertIn("DRY-RUN", msg)

        with open(nb_path, "r", encoding="utf-8") as f:
            nb = json.load(f)
        self.assertEqual(nb["cells"][0]["source"], ["Original content"])

    def test_error_notebook_not_found(self):
        non_existent = self.test_dir_path / "missing.ipynb"
        code, msg = update_targeted_cell(non_existent, "any-tag", "content")
        self.assertEqual(code, 1)
        self.assertIn("not found", msg)

    def test_error_malformed_json(self):
        bad_json_path = self.test_dir_path / "bad.ipynb"
        with open(bad_json_path, "w", encoding="utf-8") as f:
            f.write("{cells: invalid json")

        code, msg = update_targeted_cell(bad_json_path, "any-tag", "content")
        self.assertEqual(code, 1)
        self.assertIn("JSON", msg)

    def test_error_target_tag_not_found(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["tag-a"]},
                "source": ["Content A"]
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        code, msg = update_targeted_cell(nb_path, "tag-b", "content")
        self.assertEqual(code, 1)
        self.assertIn("not found", msg)

    def test_error_target_tag_matches_multiple_cells(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["duplicate-tag"]},
                "source": ["Cell 1"]
            },
            {
                "cell_type": "code",
                "metadata": {"tags": ["duplicate-tag"]},
                "execution_count": None,
                "outputs": [],
                "source": ["Cell 2"]
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        code, msg = update_targeted_cell(nb_path, "duplicate-tag", "content")
        self.assertEqual(code, 1)
        self.assertIn("multiple", msg)

    def test_cli_execution_success_and_dry_run(self):
        cells = [
            {
                "cell_type": "markdown",
                "metadata": {"tags": ["cli-tag"]},
                "source": ["Old CLI Content"]
            }
        ]
        nb_path = self._create_sample_notebook(cells)
        prompt_file = self.test_dir_path / "prompt.txt"
        prompt_file.write_text("New CLI Content\nSecond Line", encoding="utf-8")

        # Test CLI dry run
        cli_result = subprocess.run(
            [sys.executable, "-m", "utilities.notebook_prompt_sync", str(nb_path), "cli-tag", str(prompt_file), "--dry-run"],
            capture_output=True,
            text=True
        )
        self.assertEqual(cli_result.returncode, 0)
        self.assertIn("DRY-RUN", cli_result.stdout)

        # Verify file untouched
        with open(nb_path, "r", encoding="utf-8") as f:
            nb = json.load(f)
        self.assertEqual(nb["cells"][0]["source"], ["Old CLI Content"])

        # Test CLI actual run
        cli_result = subprocess.run(
            [sys.executable, "-m", "utilities.notebook_prompt_sync", str(nb_path), "cli-tag", str(prompt_file)],
            capture_output=True,
            text=True
        )
        self.assertEqual(cli_result.returncode, 0)
        self.assertIn("Successfully updated", cli_result.stdout)

        # Verify file modified
        with open(nb_path, "r", encoding="utf-8") as f:
            nb = json.load(f)
        self.assertEqual(nb["cells"][0]["source"], ["New CLI Content\n", "Second Line"])

    def test_cli_error_missing_prompt_file(self):
        cells = [{"cell_type": "markdown", "metadata": {"tags": ["tag1"]}, "source": []}]
        nb_path = self._create_sample_notebook(cells)
        missing_prompt = self.test_dir_path / "nonexistent.txt"

        cli_result = subprocess.run(
            [sys.executable, "-m", "utilities.notebook_prompt_sync", str(nb_path), "tag1", str(missing_prompt)],
            capture_output=True,
            text=True
        )
        self.assertEqual(cli_result.returncode, 1)
        self.assertIn("Prompt file", cli_result.stderr)

    def test_cli_error_target_not_found(self):
        cells = [{"cell_type": "markdown", "metadata": {"tags": ["tag1"]}, "source": []}]
        nb_path = self._create_sample_notebook(cells)
        prompt_file = self.test_dir_path / "prompt.txt"
        prompt_file.write_text("Hello", encoding="utf-8")

        cli_result = subprocess.run(
            [sys.executable, "-m", "utilities.notebook_prompt_sync", str(nb_path), "wrong-tag", str(prompt_file)],
            capture_output=True,
            text=True
        )
        self.assertEqual(cli_result.returncode, 1)
        self.assertIn("not found", cli_result.stderr)

    def test_malformed_cells_attribute(self):
        nb_path = self.test_dir_path / "invalid_cells.ipynb"
        with open(nb_path, "w", encoding="utf-8") as f:
            json.dump({"cells": "not-a-list"}, f)

        code, msg = update_targeted_cell(nb_path, "tag1", "content")
        self.assertEqual(code, 1)
        self.assertIn("Malformed notebook structure", msg)

    def test_preserves_notebook_metadata_and_other_cells(self):
        cells = [
            {"cell_type": "markdown", "metadata": {"tags": ["keep-me"]}, "source": ["Keep me"]},
            {"cell_type": "markdown", "metadata": {"tags": ["target"]}, "source": ["Update me"]},
            {"cell_type": "code", "metadata": {"tags": []}, "source": ["x = 1"], "execution_count": 5, "outputs": [{"text": "1"}]}
        ]
        nb_path = self._create_sample_notebook(cells)
        code, msg = update_targeted_cell(nb_path, "target", "Updated content")
        self.assertEqual(code, 0)

        with open(nb_path, "r", encoding="utf-8") as f:
            updated_nb = json.load(f)

        self.assertEqual(updated_nb["metadata"]["language_info"]["name"], "python")
        self.assertEqual(updated_nb["cells"][0]["source"], ["Keep me"])
        self.assertEqual(updated_nb["cells"][1]["source"], ["Updated content"])
        # Cell 2 should retain its execution count and outputs untouched
        self.assertEqual(updated_nb["cells"][2]["execution_count"], 5)
        self.assertEqual(len(updated_nb["cells"][2]["outputs"]), 1)


if __name__ == "__main__":
    unittest.main()

