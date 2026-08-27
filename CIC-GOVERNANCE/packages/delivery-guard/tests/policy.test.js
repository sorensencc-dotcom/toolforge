import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAutomationTestPolicy } from '../src/policy.js';

const adapter = {
  automationPaths: ['.github/workflows/**', 'scripts/**'],
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

test('blocks an explicit automation exemption without a recorded reason', () => {
  const result = evaluateAutomationTestPolicy([
    { path: '.github/workflows/governance.yml', status: 'modified' },
  ], adapter, { exemptionReason: '   ' });

  assert.equal(result.decision, 'block');
  assert.deepEqual(result.issues, [
    'automation-regression-test-required',
    'automation-exemption-reason-required',
  ]);
  assert.equal(result.exemption, null);
});

test('allows an explicit automation exemption with its recorded reason', () => {
  const result = evaluateAutomationTestPolicy([
    { path: '.github/workflows/governance.yml', status: 'modified' },
  ], adapter, { exemptionReason: 'No executable behavior changed.' });

  assert.equal(result.decision, 'allow');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.exemption, { reason: 'No executable behavior changed.' });
});
