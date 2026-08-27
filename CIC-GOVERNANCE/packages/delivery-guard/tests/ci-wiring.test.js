import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const packageRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..', '..');
const workflowPath = path.join(repositoryRoot, '.github', 'workflows', 'governance.yml');
const hookInstallerPath = path.join(repositoryRoot, 'CIC-GOVERNANCE', 'scripts', 'setup-git-hook.mjs');

test('governance CI invokes the automation policy wrapper in blocking mode', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /name: Delivery guard automation policy/);
  assert.match(
    workflow,
    /node CIC-GOVERNANCE\/packages\/delivery-guard\/scripts\/evaluate-automation-policy\.mjs --base/,
  );
  assert.doesNotMatch(workflow, /evaluate-automation-policy\.mjs[^\n]*--advisory/);
});

test('local hook invokes the automation policy wrapper in advisory staged mode', () => {
  const hookInstaller = fs.readFileSync(hookInstallerPath, 'utf8');

  assert.match(
    hookInstaller,
    /evaluate-automation-policy\.mjs"? --staged --advisory/,
  );
  assert.match(hookInstaller, /automation policy is advisory/);
});
