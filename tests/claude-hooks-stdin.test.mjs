import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.claude', 'hooks');

function runHook(name, envelope, { env = {}, cwd } = {}) {
  return spawnSync(process.execPath, [path.join(hooksDir, name)], {
    input: JSON.stringify(envelope),
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...env },
    timeout: 20000,
  });
}

test('block-lockfile-edit denies lock files via JSON and exits 0', () => {
  const r = runHook('block-lockfile-edit.js', { tool_input: { file_path: 'C:/x/package-lock.json' } });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('block-lockfile-edit allows other files silently', () => {
  const r = runHook('block-lockfile-edit.js', { tool_input: { file_path: 'C:/x/a.js' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

test('block-lockfile-edit tolerates malformed stdin', () => {
  const r = spawnSync(process.execPath, [path.join(hooksDir, 'block-lockfile-edit.js')], {
    input: 'not json',
    encoding: 'utf8',
  });
  assert.equal(r.status, 0);
});

test('token-budget-gate denies via JSON and exits 0 when thresholds hit without a plan', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-gate-'));
  try {
    const r = runHook('token-budget-gate.js', {}, { cwd, env: { LOC_THRESHOLD: '-1', COMMIT_THRESHOLD: '-1' } });
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('lint-on-edit and e2e-snapshots exit 0 for ignorable paths', () => {
  for (const name of ['lint-on-edit.js', 'e2e-snapshots.js']) {
    const r = runHook(name, { tool_input: { file_path: 'C:/x/notes.md' } });
    assert.equal(r.status, 0, name);
  }
});

test('lint-on-edit and e2e-snapshots exit 0 with no file path', () => {
  for (const name of ['lint-on-edit.js', 'e2e-snapshots.js']) {
    const r = runHook(name, {});
    assert.equal(r.status, 0, name);
  }
});
