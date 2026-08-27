import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AdapterConfigError,
  validateAdapterConfig,
} from '../src/config.js';
import repositoryAdapter from '../../../delivery-guard.config.js';

const validConfig = {
  repository: {
    id: 'cic-governance',
    root: '.',
  },
  generatedPaths: ['.ijfw/**', 'dist/**'],
  automationPaths: ['.github/workflows/**', 'scripts/**'],
  testCommands: ['npm test', 'python -m unittest discover -s tests -v'],
  trustedExemptionAuthorities: ['tier-1'],
  hookInstaller: {
    command: 'node scripts/setup-git-hook.mjs',
    installedPath: '.git/hooks/pre-commit',
  },
};

test('accepts a complete adapter configuration', () => {
  assert.deepEqual(validateAdapterConfig(validConfig), validConfig);
});

test('rejects missing repository identity', () => {
  const config = structuredClone(validConfig);
  delete config.repository;

  assert.throws(
    () => validateAdapterConfig(config),
    (error) => error instanceof AdapterConfigError
      && error.issues.some((issue) => issue.path === 'repository'),
  );
});

test('rejects absolute or parent-traversing paths', () => {
  const config = structuredClone(validConfig);
  config.generatedPaths = ['C:/generated/**', '../outside/**'];

  assert.throws(
    () => validateAdapterConfig(config),
    (error) => error instanceof AdapterConfigError
      && error.issues.filter((issue) => issue.path === 'generatedPaths').length === 2,
  );
});

for (const [label, path] of [
  ['rooted backslash paths', '\\generated\\**'],
  ['UNC paths', '\\\\server\\share\\**'],
  ['drive-qualified Windows paths', 'C:\\generated\\**'],
]) {
  test(`rejects ${label}`, () => {
    const config = structuredClone(validConfig);
    config.generatedPaths = [path];

    assert.throws(
      () => validateAdapterConfig(config),
      (error) => error instanceof AdapterConfigError
        && error.issues.some((issue) => issue.path === 'generatedPaths'),
    );
  });
}
test('rejects empty automation paths and test commands', () => {
  const config = structuredClone(validConfig);
  config.automationPaths = [];
  config.testCommands = ['   '];

  assert.throws(
    () => validateAdapterConfig(config),
    (error) => error instanceof AdapterConfigError
      && error.issues.some((issue) => issue.path === 'automationPaths')
      && error.issues.some((issue) => issue.path === 'testCommands'),
  );
});

test('rejects incomplete hook installer configuration', () => {
  const config = structuredClone(validConfig);
  config.hookInstaller = { command: 'node install-hook.mjs' };

  assert.throws(
    () => validateAdapterConfig(config),
    (error) => error instanceof AdapterConfigError
      && error.issues.some((issue) => issue.path === 'hookInstaller.installedPath'),
  );
});

test('repository adapter covers every delivery-guard automation entry point', () => {
  const requiredPaths = [
    '.github/workflows/**',
    'scripts/**',
    'CIC-GOVERNANCE/scripts/**',
    'CIC-GOVERNANCE/packages/delivery-guard/src/**',
    'CIC-GOVERNANCE/packages/delivery-guard/scripts/evaluate-automation-policy.mjs',
    'CIC-GOVERNANCE/delivery-guard.config.js',
    'setup-git-hooks.ps1',
    'ci-pipeline.ps1',
  ];

  assert.deepEqual(repositoryAdapter.automationPaths, requiredPaths);
});

test('rejects missing trusted exemption authorities', () => {
  const config = structuredClone(validConfig);
  delete config.trustedExemptionAuthorities;

  assert.throws(
    () => validateAdapterConfig(config),
    (error) => error instanceof AdapterConfigError
      && error.issues.some((issue) => issue.path === 'trustedExemptionAuthorities'),
  );
});
