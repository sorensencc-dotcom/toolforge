import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const packageRoot = path.resolve(import.meta.dirname, '..');
const cicRoot = path.resolve(packageRoot, '..', '..');
const wrapperPath = path.join(packageRoot, 'scripts', 'evaluate-automation-policy.mjs');

test('CI wrapper records and blocks an automation change without a regression test', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ci-'));
  const pathsFile = path.join(tempDir, 'paths.json');
  fs.writeFileSync(pathsFile, JSON.stringify([
    { path: 'CIC-GOVERNANCE/scripts/setup-git-hook.mjs', status: 'modified' },
  ]));

  const result = spawnSync(process.execPath, [wrapperPath, '--paths-file', pathsFile], {
    cwd: cicRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  const record = JSON.parse(result.stdout);
  assert.equal(record.check, 'automation-test-policy');
  assert.equal(record.enforcement, 'blocking');
  assert.deepEqual(record.policy.issues, ['automation-regression-test-required']);
});

test('CI wrapper evaluates committed Git diff entries', () => {
  const result = spawnSync(process.execPath, [
    wrapperPath,
    '--base', '7986a6bf',
    '--head', 'ad9dfdc8',
  ], {
    cwd: cicRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const record = JSON.parse(result.stdout);
  assert.equal(record.source, 'git-diff');
  assert.equal(record.policy.decision, 'allow');
  assert.deepEqual(
    record.policy.regressionTestPaths,
    ['CIC-GOVERNANCE/packages/delivery-guard/tests/classifier.test.js'],
  );
});

test('CI wrapper keeps local automation policy violations advisory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-advisory-'));
  const pathsFile = path.join(tempDir, 'paths.json');
  fs.writeFileSync(pathsFile, JSON.stringify([
    { path: 'CIC-GOVERNANCE/scripts/setup-git-hook.mjs', status: 'modified' },
  ]));

  const result = spawnSync(process.execPath, [
    wrapperPath,
    '--paths-file', pathsFile,
    '--advisory',
  ], {
    cwd: cicRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const record = JSON.parse(result.stdout);
  assert.equal(record.enforcement, 'advisory');
  assert.equal(record.policy.decision, 'block');
});

test('CI wrapper records an explicit exemption reason', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-exemption-'));
  const pathsFile = path.join(tempDir, 'paths.json');
  fs.writeFileSync(pathsFile, JSON.stringify([
    { path: 'CIC-GOVERNANCE/scripts/setup-git-hook.mjs', status: 'modified' },
  ]));

  const result = spawnSync(process.execPath, [
    wrapperPath,
    '--paths-file', pathsFile,
    '--exemption-reason', 'No executable behavior changed.',
  ], {
    cwd: cicRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const record = JSON.parse(result.stdout);
  assert.deepEqual(record.policy.exemption, { reason: 'No executable behavior changed.' });
});
