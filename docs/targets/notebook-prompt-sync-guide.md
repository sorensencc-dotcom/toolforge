# Notebook prompt synchronization guide

This guide details the operator workflow for synchronizing system and task prompts from centralized knowledge bases into satellite Jupyter notebooks (`.ipynb`).

## Metadata tagging standards

Cell-targeted synchronization uses Jupyter notebook cell metadata tags. Each synchronized cell must define structured metadata tags within its `metadata.tags` list.

### Required tag conventions

1. `kb-sync:managed`: Marks the cell as externally synchronized by the `kb-sync` pipeline.
2. `kb-sync:target:<prompt_id>`: Uniquely identifies the cell for prompt injection matching `<prompt_id>`.

For example, to tag a cell for system prompt injection with ID `research_system_prompt`, configure the cell metadata as follows:

```json
{
 "cell_type": "code",
 "execution_count": null,
 "metadata": {
  "tags": [
   "kb-sync:managed",
   "kb-sync:target:research_system_prompt"
  ]
 },
 "outputs": [],
 "source": [
  "# System prompt placeholder\n"
 ]
}
```

### Tagging rules

- Every prompt cell must include exactly one `kb-sync:target:<prompt_id>` tag.
- Prompt tag IDs must be unique within each notebook.
- Prompt tag IDs must use lowercase alphanumeric characters, underscores, and hyphens.

## CLI execution and synchronization

The synchronization engine is located at `utilities/notebook_prompt_sync.py`. It updates targeted notebook cells without external dependencies.

### Command syntax

```bash
python utilities/notebook_prompt_sync.py <notebook_path> <target_tag> <prompt_file> [--dry-run]
```

### Parameter reference

- `notebook_path`: Path to the target `.ipynb` file.
- `target_tag`: Unique tag string in cell metadata (for example, `kb-sync:target:research_system_prompt`).
- `prompt_file`: Path to the file containing the prompt content to sync.
- `--dry-run`: Validates tag resolution and previews changes without modifying the target notebook on disk.

### Exit code semantics

| Exit code | Status | Description |
|---|---|---|
| `0` | Success / No-op | Target cell updated successfully, content already up to date, or dry-run validation passed. |
| `1` | Error | Notebook or prompt file missing, malformed JSON AST, target tag not found, duplicate tags detected, or atomic disk write failed. |

### Engine operational behavior

When `utilities/notebook_prompt_sync.py` executes:

1. It parses the target `.ipynb` file into an abstract syntax tree (AST).
2. It scans all cells for matching tags in `cell.metadata.tags`.
3. If identical content is already present, it exits immediately with code `0` as a no-op.
4. If `--dry-run` is active, it reports the target cell index and exits with code `0` without writing to disk.
5. If the target is a code cell, it clears stale `outputs` and sets `execution_count` to `null`.
6. It writes changes to a temporary `.tmp` file in the parent directory and replaces the destination notebook using `os.replace` to ensure atomic updates.

### Usage examples

To test prompt synchronization without writing changes:

```bash
python utilities/notebook_prompt_sync.py notebooks/analysis.ipynb kb-sync:target:research_system_prompt prompts/system.txt --dry-run
```

To synchronize prompt content directly to the target notebook:

```bash
python utilities/notebook_prompt_sync.py notebooks/analysis.ipynb kb-sync:target:research_system_prompt prompts/system.txt
```

## CI and pre-commit tag validation

The validation script at `scripts/validate_notebook_tags.py` verifies tag uniqueness across all notebooks in a directory tree.

### Command syntax

```bash
python scripts/validate_notebook_tags.py [directory] [--prefix <prefix>]
```

### Options

- `directory`: Root directory to scan recursively. Defaults to `.`.
- `--prefix`: Tag prefix to validate for uniqueness. Defaults to `kb-sync:target:`.

### Validation behavior

1. It scans all `.ipynb` files recursively.
2. It excludes `.ipynb_checkpoints` directories, temporary `.tmp.ipynb` swap files, and intermediate artifacts.
3. It counts occurrences of each tag matching the specified prefix per notebook.
4. It exits with code `0` if all matching tags are unique within their respective notebooks.
5. It prints failure diagnostics to `stderr` and exits with code `1` if duplicate tags or unparseable JSON files exist.

### Pre-commit integration

To integrate notebook tag validation into `.git/hooks/pre-commit` or CI pipelines, add the following step:

```bash
python scripts/validate_notebook_tags.py . --prefix "kb-sync:target:"
```

## Failure modes and remediation patterns

The following table summarizes known failure modes, error messages, and their step-by-step remediation procedures.

| Failure mode | Error message | Root cause | Remediation procedure |
|---|---|---|---|
| Duplicate target tags | `Error: Target tag '<tag>' matches multiple cells (<count>) in notebook '<path>'` | Two or more cells in the notebook share the same `kb-sync:target:<prompt_id>` tag. | 1. Open the notebook in your editor.<br>2. Inspect cell metadata tags.<br>3. Remove the duplicate tag from unmanaged cells, or assign unique prompt IDs. |
| Missing target tag | `Error: Target tag '<tag>' not found in notebook '<path>'` | No cell in the notebook contains the specified target tag. | 1. Identify the intended destination cell.<br>2. Add `kb-sync:managed` and `kb-sync:target:<prompt_id>` to the cell's `metadata.tags` list.<br>3. Re-run synchronization. |
| Dirty editor buffer | No error returned by CLI, but synced content reverts after editor save | JupyterLab, VS Code, or another editor holds an in-memory dirty buffer and overwrites the disk state. | 1. To avoid overwriting synchronized files, close the notebook editor before running sync.<br>2. If the file is open, reload the notebook from disk without saving from the editor. |
| Malformed notebook JSON | `Error: Notebook '<path>' is not valid JSON` | The notebook file contains invalid JSON syntax or truncated data. | 1. Validate the file syntax using `python -m json.tool <notebook_path>`.<br>2. Restore the file from version control if corruption occurred. |
| Missing prompt source file | `Error: Prompt file '<path>' not found` | The source prompt path supplied to the CLI does not exist. | 1. Verify the prompt file path.<br>2. Ensure upstream prompt generation completed before invoking the sync script. |
