import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../scripts/run-closed-loop-research-v2.mjs', import.meta.url),
  'utf8',
);

test('Step 0 reads the cached WhichLLM model selection record', () => {
  assert.match(source, /export function loadModelSelection\(repoRoot\)/);
  assert.match(source, /path\.join\(repoRoot, '_integration', 'model_selection\.json'\)/);
  assert.match(source, /JSON\.parse\(fs\.readFileSync\(outputPath, 'utf8'\)\)/);
});

test('Step 1 remains the trm mine-notebooklm seam and Step 2 builds the configured NotebookLM command', () => {
  assert.match(source, /mine-notebooklm \$\{gapsNotebookId\}/);
  assert.match(source, /export function buildNotebookLmUploadCommand/);
  assert.match(source, /buildNotebookLmUploadCommand\(\{[\s\S]*?cli: NLM_CLI/);
  assert.match(source, /source upload --notebook-id="\$\{notebookId\}"/);
});

test('dry-run prevents live NotebookLM upload', () => {
  assert.match(source, /export function shouldExecuteNotebookLmUpload\(dryRun\)/);
  assert.match(source, /if \(!shouldExecuteNotebookLmUpload\(BFCL_DRY_RUN\)\)/);
  assert.match(source, /\[DRY RUN\] Would execute/);
});
