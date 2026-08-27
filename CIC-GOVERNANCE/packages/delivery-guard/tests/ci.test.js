import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateCiAutomationPolicy,
  evaluateCiCommitPolicies,
  runConfiguredTestCommands,
} from '../src/ci.js';

const adapter = {
  automationPaths: ['.github/workflows/**', 'scripts/**'],
  testCommands: ['npm test'],
  trustedExemptionAuthorities: ['tier-1'],
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

test('enforces regression-test pairing within each commit', () => {
  const result = evaluateCiCommitPolicies([
    {
      commitSha: 'automation-only',
      entries: [{ path: 'scripts/publish.mjs', status: 'modified' }],
    },
    {
      commitSha: 'test-only',
      entries: [{ path: 'tests/publish.test.mjs', status: 'added' }],
    },
  ], adapter);

  assert.equal(result.exitCode, 1);
  assert.equal(result.commitResults[0].policy.decision, 'block');
  assert.equal(result.commitResults[1].policy.decision, 'allow');
});

test('allows automation and regression-test changes in the same commit', () => {
  const result = evaluateCiCommitPolicies([
    {
      commitSha: 'paired',
      entries: [
        { path: 'scripts/publish.mjs', status: 'modified' },
        { path: 'tests/publish.test.mjs', status: 'added' },
      ],
    },
  ], adapter);

  assert.equal(result.exitCode, 0);
  assert.equal(result.commitResults[0].policy.decision, 'allow');
});

test('executes every configured focused test command and records results', () => {
  const calls = [];
  const result = runConfiguredTestCommands({
    ...adapter,
    testCommands: ['npm test', 'node --test focused.test.js'],
  }, {
    cwd: '/repo',
    run(command, options) {
      calls.push({ command, options });
      return { status: 0, signal: null };
    },
  });

  assert.deepEqual(calls.map(({ command }) => command), [
    'npm test',
    'node --test focused.test.js',
  ]);
  assert.ok(calls.every(({ options }) => options.cwd === '/repo' && options.shell === true));
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.commands.map(({ status }) => status), ['passed', 'passed']);
});

test('blocks CI when a configured focused test command fails', () => {
  const result = runConfiguredTestCommands(adapter, {
    run() {
      return { status: 7, signal: null };
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.commands[0].exitCode, 7);
  assert.equal(result.commands[0].status, 'failed');
});
