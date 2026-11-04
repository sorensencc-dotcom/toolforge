import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflow = readFileSync(
  fileURLToPath(new URL('../.github/workflows/ci-governance-matrix.yml', import.meta.url)),
  'utf8',
);

test('sigil governance smoke cap leaves headroom over the observed 44-60s suite runtime', () => {
  const match = workflow.match(/smoke: npm run audit:deps && timeout (\d+)s node --test/);
  assert.ok(match, 'sigil smoke command must wrap node --test in timeout');
  assert.ok(Number(match[1]) >= 180, `sigil smoke timeout ${match[1]}s is too close to the suite runtime`);
});
