import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

const packageRoot = path.resolve(import.meta.dirname, '..');
const cicRoot = path.resolve(packageRoot, '..', '..');
const wrapperPath = path.join(packageRoot, 'scripts', 'evaluate-automation-policy.mjs');

function signExemption(version, exemption, key) {
  const payload = [
    version,
    exemption.commitSha,
    exemption.authority,
    exemption.approver,
    exemption.reason,
    exemption.approvalRef,
  ].join('\n');
  return createHmac('sha256', key).update(payload).digest('hex');
}

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

test('CI wrapper rejects the unaudited exemption-reason argument', () => {
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

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /trusted-exemptions-file|Usage/);
});

test('CI wrapper accepts an auditable exemption file outside the repository', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-trusted-exemption-'));
  const pathsFile = path.join(tempDir, 'paths.json');
  const exemptionFile = path.join(tempDir, 'exemptions.json');
  fs.writeFileSync(pathsFile, JSON.stringify([
    { path: 'CIC-GOVERNANCE/scripts/setup-git-hook.mjs', status: 'modified' },
  ]));
  const version = 1;
  const key = 'test-only-protected-key';
  const exemption = {
    commitSha: 'paths-file',
    authority: 'tier-1',
    approver: 'Chris',
    reason: 'No executable behavior changed.',
    approvalRef: 'approval:123',
  };
  fs.writeFileSync(exemptionFile, JSON.stringify({
    version,
    exemptions: [{
      ...exemption,
      signature: signExemption(version, exemption, key),
    }],
  }));

  const result = spawnSync(process.execPath, [
    wrapperPath,
    '--paths-file', pathsFile,
    '--trusted-exemptions-file', exemptionFile,
  ], {
    cwd: cicRoot,
    encoding: 'utf8',
    env: { ...process.env, DELIVERY_GUARD_EXEMPTION_HMAC_KEY: key },
  });

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  const record = JSON.parse(result.stdout);
  assert.equal(record.commitResults[0].policy.exemption.approvalRef, 'approval:123');
});

test('CI wrapper rejects an unsigned exemption file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-unsigned-exemption-'));
  const pathsFile = path.join(tempDir, 'paths.json');
  const exemptionFile = path.join(tempDir, 'exemptions.json');
  fs.writeFileSync(pathsFile, JSON.stringify([
    { path: 'CIC-GOVERNANCE/scripts/setup-git-hook.mjs', status: 'modified' },
  ]));
  fs.writeFileSync(exemptionFile, JSON.stringify({
    version: 1,
    exemptions: [{
      commitSha: 'paths-file',
      authority: 'tier-1',
      approver: 'Chris',
      reason: 'No executable behavior changed.',
      approvalRef: 'approval:unsigned',
    }],
  }));

  const result = spawnSync(process.execPath, [
    wrapperPath,
    '--paths-file', pathsFile,
    '--trusted-exemptions-file', exemptionFile,
  ], {
    cwd: cicRoot,
    encoding: 'utf8',
    env: { ...process.env, DELIVERY_GUARD_EXEMPTION_HMAC_KEY: 'test-only-protected-key' },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /signature/i);
});

test('CI wrapper handles an all-zero base as a root diff', () => {
  const result = spawnSync(process.execPath, [
    wrapperPath,
    '--base', '0000000000000000000000000000000000000000',
    '--head', 'HEAD',
  ], {
    cwd: cicRoot,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 128, result.stderr);
  const record = JSON.parse(result.stdout);
  assert.equal(record.source, 'root-diff');
});
