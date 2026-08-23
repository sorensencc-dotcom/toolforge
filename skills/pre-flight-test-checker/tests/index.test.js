import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkEslintConfig, checkExternalFixtures, checkPlatformCompliance, runPreflight } from '../src/index.js';

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-'));
  return dir;
}

test('checkEslintConfig', async (t) => {
  await t.test('errors when .eslintignore is missing', () => {
    const repo = makeRepo();
    const result = checkEslintConfig(repo);
    assert.strictEqual(result.level, 'error');
  });

  await t.test('errors when required entries are missing', () => {
    const repo = makeRepo();
    fs.writeFileSync(path.join(repo, '.eslintignore'), 'node_modules/\n');
    const result = checkEslintConfig(repo);
    assert.strictEqual(result.level, 'error');
    assert.match(result.message, /dist\//);
  });

  await t.test('passes when all required entries present', () => {
    const repo = makeRepo();
    fs.writeFileSync(path.join(repo, '.eslintignore'), 'dist/\nbuild/\nnode_modules/\n');
    const result = checkEslintConfig(repo);
    assert.strictEqual(result.level, 'pass');
  });
});

test('checkExternalFixtures', async (t) => {
  await t.test('warns (not errors) when only an optional fixture is missing', () => {
    const repo = makeRepo();
    const result = checkExternalFixtures(repo, [{ name: 'optional-thing', optional: true }]);
    assert.strictEqual(result.level, 'warning');
  });

  await t.test('errors when a required fixture is missing', () => {
    const repo = makeRepo();
    const result = checkExternalFixtures(repo, [{ name: 'required-thing', optional: false }]);
    assert.strictEqual(result.level, 'error');
  });

  await t.test('passes when required fixture is present', () => {
    const repo = makeRepo();
    fs.mkdirSync(path.join(path.dirname(repo), 'present-fixture'), { recursive: true });
    const result = checkExternalFixtures(repo, [{ name: 'present-fixture', optional: false }]);
    assert.strictEqual(result.level, 'pass');
  });
});

test('checkPlatformCompliance', async (t) => {
  await t.test('passes with no test directory', () => {
    const repo = makeRepo();
    const result = checkPlatformCompliance(repo);
    assert.strictEqual(result.level, 'pass');
  });

  await t.test('flags hardcoded /tmp/ paths in test files', () => {
    const repo = makeRepo();
    const testDir = path.join(repo, 'tests');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'a.test.js'), "const p = '/tmp/foo';\n");
    const result = checkPlatformCompliance(repo);
    assert.strictEqual(result.level, 'warning');
    assert.ok(result.details[0].includes('a.test.js'));
  });

  await t.test('passes when no platform-specific patterns present', () => {
    const repo = makeRepo();
    const testDir = path.join(repo, 'tests');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'a.test.js'), "const p = require('path').join('a', 'b');\n");
    const result = checkPlatformCompliance(repo);
    assert.strictEqual(result.level, 'pass');
  });
});

test('runPreflight', async (t) => {
  await t.test('returns GREEN when all checks pass', () => {
    const repo = makeRepo();
    fs.writeFileSync(path.join(repo, '.eslintignore'), 'dist/\nbuild/\nnode_modules/\n');
    const result = runPreflight(repo, []);
    assert.strictEqual(result.verdict, 'GREEN');
    assert.strictEqual(result.readyToTest, true);
  });

  await t.test('returns RED when .eslintignore is missing', () => {
    const repo = makeRepo();
    const result = runPreflight(repo);
    assert.strictEqual(result.verdict, 'RED');
    assert.strictEqual(result.readyToTest, false);
  });
});
