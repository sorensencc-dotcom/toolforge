import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

for (const name of ['phase-gate-git-guard.ps1', 'startup-checklist.ps1']) {
  test(`${name} lives in scripts/ and no longer references .ijfw`, () => {
    const file = path.join(dir, name);
    assert.ok(existsSync(file));
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\.ijfw/);
  });
}

test('phase-gate guard logs to logs/phase-gates', () => {
  const src = readFileSync(path.join(dir, 'phase-gate-git-guard.ps1'), 'utf8');
  assert.match(src, /logs\/phase-gates/);
});
