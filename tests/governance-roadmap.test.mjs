import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('governance workflow includes roadmap location policy', () => {
  const workflowPath = resolve('.github/workflows/governance.yml');
  assert.equal(existsSync(workflowPath), true);
  const content = readFileSync(workflowPath, 'utf8');
  assert.match(content, /Roadmap location policy/);
});
