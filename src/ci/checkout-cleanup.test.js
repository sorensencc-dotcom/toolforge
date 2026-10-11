import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const workflowDir = path.join(repoRoot, '.github', 'workflows');

test('workflow actions do not target the retired Node 20 runtime', () => {
  const workflows = fs.readdirSync(workflowDir).filter((name) => name.endsWith('.yml'));
  assert.ok(workflows.includes('ci-governance-matrix.yml'));

  for (const name of workflows) {
    const text = fs.readFileSync(path.join(workflowDir, name), 'utf8');
    assert.doesNotMatch(text, /actions\/checkout@v4\b/, name);
    assert.doesNotMatch(text, /actions\/setup-node@v4\b/, name);
    assert.doesNotMatch(text, /actions\/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5/, name);
  }

  const matrix = fs.readFileSync(path.join(workflowDir, 'ci-governance-matrix.yml'), 'utf8');
  assert.match(matrix, /actions\/checkout@v5\b/);
  assert.match(matrix, /actions\/setup-node@v5\b/);
});

test('every gitlink has a .gitmodules URL so checkout cleanup can iterate', () => {
  const listed = execFileSync('git', ['ls-files', '-s'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const gitlinks = listed
    .split(/\r?\n/)
    .filter((line) => line.startsWith('160000 '))
    .map((line) => line.split('\t')[1]);

  if (gitlinks.length === 0) {
    assert.equal(gitlinks.length, 0);
    return;
  }

  const modules = fs.readFileSync(path.join(repoRoot, '.gitmodules'), 'utf8');
  for (const submodulePath of gitlinks) {
    assert.match(modules, new RegExp(`^path = ${submodulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});
