import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('notebooklm-uploader script exists and has node shebang', () => {
  const scriptPath = path.join(repoRoot, 'notebooklm-uploader.js');
  assert.ok(fs.existsSync(scriptPath));
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.match(content, /^#!\/usr\/bin\/env node/);
  assert.ok(content.includes('NotebookLM Headless Uploader'));
});
