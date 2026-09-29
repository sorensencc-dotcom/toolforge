/**
 * scripts/worktree-safety-gate.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCommandSafety } from './worktree-safety-gate.mjs';

test('Fast-path allows safe read commands immediately', async () => {
  const result = await evaluateCommandSafety('git status');
  assert.equal(result.verdict, 'ALLOWED');
  assert.equal(result.classification, 'SAFE_READ');
});

test('Fast-path blocks static dangerous commands immediately', async () => {
  const result1 = await evaluateCommandSafety('rm -rf /');
  assert.equal(result1.verdict, 'BLOCKED');
  assert.equal(result1.classification, 'DANGEROUS_UNSANDBOXED');

  const result2 = await evaluateCommandSafety('git reset --hard HEAD~1');
  assert.equal(result2.verdict, 'BLOCKED');
  assert.equal(result2.classification, 'DANGEROUS_UNSANDBOXED');

  const result3 = await evaluateCommandSafety('git clean -fdx');
  assert.equal(result3.verdict, 'BLOCKED');
  assert.equal(result3.classification, 'DANGEROUS_UNSANDBOXED');
});

test('Jev Choice allows valid LOCAL_MUTATION with high confidence', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        safety_class: {
          choice: 'LOCAL_MUTATION',
          confidence: 0.92,
        },
      },
    }),
  });

  const result = await evaluateCommandSafety('npm run build', { fetchImpl: mockFetch });
  assert.equal(result.verdict, 'ALLOWED');
  assert.equal(result.classification, 'LOCAL_MUTATION');
});

test('Jev Choice blocks commands with low confidence (< 0.70)', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        safety_class: {
          choice: 'LOCAL_MUTATION',
          confidence: 0.55,
        },
      },
    }),
  });

  const result = await evaluateCommandSafety('custom-script.sh', { fetchImpl: mockFetch });
  assert.equal(result.verdict, 'BLOCKED');
  assert.match(result.reason, /Confidence .* below required threshold/);
});

test('Safety gate fails safe (BLOCKED) when Jev is offline', async () => {
  const mockFetchFail = async () => {
    throw new Error('ECONNREFUSED');
  };

  const result = await evaluateCommandSafety('custom-mutation.sh', { fetchImpl: mockFetchFail });
  assert.equal(result.verdict, 'BLOCKED');
  assert.equal(result.classification, 'UNAVAILABLE');
});
