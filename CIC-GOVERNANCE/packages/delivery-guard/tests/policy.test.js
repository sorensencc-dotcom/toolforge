import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAutomationTestPolicy } from '../src/policy.js';

const adapter = {
  automationPaths: ['.github/workflows/**', 'scripts/**'],
  trustedExemptionAuthorities: ['tier-1'],
};

test('blocks an automation change without a paired regression test', () => {
  const result = evaluateAutomationTestPolicy([
    { path: '.github/workflows/governance.yml', status: 'modified' },
  ], adapter);

  assert.equal(result.decision, 'block');
  assert.deepEqual(result.issues, ['automation-regression-test-required']);
  assert.deepEqual(result.automationPaths, ['.github/workflows/governance.yml']);
  assert.deepEqual(result.regressionTestPaths, []);
});

test('allows an automation change paired with a regression test', () => {
  const result = evaluateAutomationTestPolicy([
    { path: 'scripts/validate-policy.mjs', status: 'modified' },
    { path: 'tests/validate-policy.test.mjs', status: 'added' },
  ], adapter);

  assert.equal(result.decision, 'allow');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.automationPaths, ['scripts/validate-policy.mjs']);
  assert.deepEqual(result.regressionTestPaths, ['tests/validate-policy.test.mjs']);
});

test('does not count a deleted regression test as paired coverage', () => {
  const result = evaluateAutomationTestPolicy([
    { path: 'scripts/validate-policy.mjs', status: 'modified' },
    { path: 'tests/validate-policy.test.mjs', status: 'deleted' },
  ], adapter);

  assert.equal(result.decision, 'block');
  assert.deepEqual(result.regressionTestPaths, []);
});

test('does not count a test renamed into documentation as paired coverage', () => {
  const result = evaluateAutomationTestPolicy([
    { path: 'scripts/validate-policy.mjs', status: 'modified' },
    {
      oldPath: 'tests/validate-policy.test.mjs',
      path: 'docs/validate-policy.md',
      status: 'renamed',
    },
  ], adapter);

  assert.equal(result.decision, 'block');
  assert.deepEqual(result.regressionTestPaths, []);
});

test('counts a renamed test destination as paired coverage', () => {
  const result = evaluateAutomationTestPolicy([
    { path: 'scripts/validate-policy.mjs', status: 'modified' },
    {
      oldPath: 'docs/validate-policy.md',
      path: 'tests/validate-policy.test.mjs',
      status: 'renamed',
    },
  ], adapter);

  assert.equal(result.decision, 'allow');
  assert.deepEqual(result.regressionTestPaths, ['tests/validate-policy.test.mjs']);
});

test('blocks an explicit automation exemption without a recorded reason', () => {
  const result = evaluateAutomationTestPolicy([
    { path: '.github/workflows/governance.yml', status: 'modified' },
  ], adapter, {
    exemption: {
      version: 1,
      commitSha: 'abc123',
      authority: 'tier-1',
      approver: 'Chris',
      reason: '   ',
      approvalRef: 'approval:123',
    },
  });

  assert.equal(result.decision, 'block');
  assert.deepEqual(result.issues, [
    'automation-regression-test-required',
    'automation-exemption-reason-required',
  ]);
  assert.equal(result.exemption, null);
});

test('allows an explicit automation exemption with its recorded reason', () => {
  const exemption = {
    version: 1,
    commitSha: 'abc123',
    authority: 'tier-1',
    approver: 'Chris',
    reason: 'No executable behavior changed.',
    approvalRef: 'approval:123',
  };
  const result = evaluateAutomationTestPolicy([
    { path: '.github/workflows/governance.yml', status: 'modified' },
  ], adapter, { exemption });

  assert.equal(result.decision, 'allow');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.exemption, exemption);
});

test('rejects an exemption from an untrusted authority', () => {
  const result = evaluateAutomationTestPolicy([
    { path: '.github/workflows/governance.yml', status: 'modified' },
  ], adapter, {
    exemption: {
      version: 1,
      commitSha: 'abc123',
      authority: 'tier-2',
      approver: 'Automation',
      reason: 'No executable behavior changed.',
      approvalRef: 'approval:untrusted',
    },
  });

  assert.equal(result.decision, 'block');
  assert.deepEqual(result.issues, [
    'automation-regression-test-required',
    'automation-exemption-authority-not-trusted',
  ]);
});
