import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('semantic validator runs successfully', () => {
  const res = spawnSync(process.execPath, ['scripts/validate-trm-semantics.mjs'], { encoding: 'utf8' });
  assert.equal(res.status, 0, `Validation script failed: ${res.stderr}`);
  assert.ok(res.stdout.includes('validation passed'));
});

test('multi-notebook dispatcher dry-run runs successfully', () => {
  const res = spawnSync(process.execPath, ['scripts/notebooklm/dispatch-multi-notebook.mjs', '--dry-run'], { encoding: 'utf8' });
  assert.equal(res.status, 0, `Dry run failed: ${res.stderr}`);
  assert.ok(res.stdout.includes('completed successfully'));
});
