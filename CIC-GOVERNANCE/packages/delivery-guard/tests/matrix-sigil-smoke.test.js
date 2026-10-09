import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const workflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/ci-governance-matrix.yml'), 'utf8');
const smoke = workflow.match(/- repository: sigil[\s\S]*?^\s+smoke: ([^\r\n]+)/m)[1];
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-sigil-smoke-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    type: 'module',
    scripts: { test: 'node --test --test-timeout=10000', 'audit:deps': 'node audit.mjs' },
  }));
  fs.writeFileSync(path.join(root, 'audit.mjs'), 'console.log("DEPENDENCY_AUDIT_RAN");\n');
  for (const [file, label] of [
    ['index.test.mjs', 'root suite'],
    ['sigil/relay/nested.test.mjs', 'nested Sigil suite'],
    ['tests/dlq-reaper.test.mjs', 'top-level tests suite'],
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), `import test from 'node:test'; test('${label}', () => {});\n`);
  }
  const foreign = path.join(root, 'CIC-GOVERNANCE/packages/delivery-guard/tests/foreign.test.js');
  fs.mkdirSync(path.dirname(foreign), { recursive: true });
  fs.writeFileSync(foreign, 'throw new Error("FOREIGN_TOOLFORGE_SUITE_RAN");\n');
  return root;
}

function run(root) {
  const { NODE_TEST_CONTEXT: _parentRunner, ...env } = process.env;
  return spawnSync(bash, ['-c', smoke], { cwd: root, encoding: 'utf8', timeout: 30_000, env });
}

test('Sigil matrix smoke keeps all owned test locations and excludes copied governance tests', (t) => {
  const result = run(fixture(t));
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /DEPENDENCY_AUDIT_RAN/);
  for (const label of ['root suite', 'nested Sigil suite', 'top-level tests suite']) {
    assert.ok(result.stdout.includes(label), `must run ${label}`);
  }
  assert.doesNotMatch(result.stdout + result.stderr, /FOREIGN_TOOLFORGE_SUITE_RAN/);
  assert.match(smoke, /timeout 60s node --test --test-timeout=30000/);
});

test('Sigil matrix smoke still fails when an owned test fails', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'sigil/relay/nested.test.mjs'), 'throw new Error("OWNED_SIGIL_FAILURE");\n');
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /OWNED_SIGIL_FAILURE/);
  assert.doesNotMatch(result.stdout + result.stderr, /FOREIGN_TOOLFORGE_SUITE_RAN/);
});
