import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateCiAutomationPolicy } from '../src/ci.js';

const adapter = {
  automationPaths: ['.github/workflows/**', 'scripts/**'],
};

test('turns an automation policy violation into a blocking CI result', () => {
  const result = evaluateCiAutomationPolicy([
    { path: 'scripts/publish.mjs', status: 'modified' },
  ], adapter);

  assert.equal(result.exitCode, 1);
  assert.equal(result.enforcement, 'blocking');
  assert.equal(result.policy.decision, 'block');
});

test('keeps an automation policy violation advisory for local hooks', () => {
  const result = evaluateCiAutomationPolicy([
    { path: 'scripts/publish.mjs', status: 'modified' },
  ], adapter, { advisory: true });

  assert.equal(result.exitCode, 0);
  assert.equal(result.enforcement, 'advisory');
  assert.equal(result.policy.decision, 'block');
});
