import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('scripts/intercept-grep.js routes broad grep to trail callers / skeleton / map', () => {
  const scriptPath = resolve('scripts/intercept-grep.js');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /trail callers/);
  assert.match(content, /trail skeleton/);
  assert.match(content, /trail map/);
});

test('scripts/scaffold-statechart.mjs scaffolds TLA+ spec and runs statechart checker', () => {
  const scriptPath = resolve('scripts/scaffold-statechart.mjs');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /MODULE \$\{name\}/);
  assert.match(content, /SPECIFICATION Spec/);
  assert.match(content, /Visual translation view/);
  assert.match(content, /statechart\.ts/);
});
