import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const packageRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..', '..');
const workflowPath = path.join(repositoryRoot, '.github', 'workflows', 'governance.yml');
const hookInstallerPath = path.join(repositoryRoot, 'CIC-GOVERNANCE', 'scripts', 'setup-git-hook.mjs');
const powershellHookInstallerPath = path.join(repositoryRoot, 'setup-git-hooks.ps1');
const canonicalShimPath = path.join(repositoryRoot, 'CIC-GOVERNANCE', 'scripts', 'pre-commit-shim.sh');
const readmePath = path.join(packageRoot, 'README.md');

test('governance CI invokes the automation policy wrapper in blocking mode', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /name: Delivery guard automation policy/);
  assert.match(
    workflow,
    /node CIC-GOVERNANCE\/packages\/delivery-guard\/scripts\/evaluate-automation-policy\.mjs --base/,
  );
  assert.match(workflow, /--run-tests/);
  assert.doesNotMatch(workflow, /evaluate-automation-policy\.mjs[^\n]*--advisory/);
});

test('local hook invokes the automation policy wrapper in advisory staged mode', () => {
  const hookShim = fs.readFileSync(canonicalShimPath, 'utf8');

  assert.match(
    hookShim,
    /evaluate-automation-policy\.mjs"? --staged --advisory/,
  );
  assert.match(hookShim, /automation policy is advisory/);
});

test('both hook installers install the same canonical delivery-guard shim', () => {
  const nodeInstaller = fs.readFileSync(hookInstallerPath, 'utf8');
  const powershellInstaller = fs.readFileSync(powershellHookInstallerPath, 'utf8');

  assert.match(nodeInstaller, /pre-commit-shim\.sh/);
  assert.match(powershellInstaller, /pre-commit-shim\.sh/);

  const shim = fs.readFileSync(canonicalShimPath, 'utf8');
  assert.match(shim, /evaluate-automation-policy\.mjs --staged --advisory/);
  assert.match(shim, /automation policy is advisory/);
});

test('README documents the complete public API and enforcement contracts', () => {
  const readme = fs.readFileSync(readmePath, 'utf8');

  for (const publicExport of [
    'validateAdapterConfig',
    'classifyDiff',
    'evaluateAutomationTestPolicy',
    'evaluateCiAutomationPolicy',
    'evaluateCiCommitPolicies',
    'runConfiguredTestCommands',
    'parsePushManifest',
    'sanitizeReceiptData',
    'getDefaultReceiptStoragePath',
    'writePushReceipt',
    'executePushWithReceipt',
  ]) {
    assert.match(readme, new RegExp(`\\b${publicExport}\\b`));
  }
  assert.match(readme, /same commit/i);
  assert.match(readme, /trusted exemption/i);
  assert.match(readme, /all-zero/i);
  assert.match(readme, /push receipt/i);
});
