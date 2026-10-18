import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createSandbox, withSandbox, withSandboxSync } from './helpers/sandbox.mjs';

test('createSandbox creates a directory under os.tmpdir and cleans up', () => {
  const sandbox = createSandbox('test-sb-basic-');
  assert.ok(fs.existsSync(sandbox.dir), 'Sandbox directory should exist');
  assert.ok(sandbox.dir.startsWith(os.tmpdir()), 'Sandbox directory should be under os.tmpdir()');

  const subDir = sandbox.mkdir('nested', 'deep');
  assert.ok(fs.existsSync(subDir), 'Nested directory should exist');

  const filePath = sandbox.writeFile(path.join('nested', 'deep', 'sample.txt'), 'hello world');
  assert.ok(fs.existsSync(filePath), 'Written file should exist');
  assert.equal(sandbox.readFile(path.join('nested', 'deep', 'sample.txt')), 'hello world');

  sandbox.cleanup();
  assert.equal(fs.existsSync(sandbox.dir), false, 'Sandbox directory should be deleted after cleanup');
});

test('withSandbox cleans up on completion', async () => {
  let createdDir = null;
  await withSandbox('test-sb-async-', async (sandbox) => {
    createdDir = sandbox.dir;
    assert.ok(fs.existsSync(createdDir));
    sandbox.writeFile('file.txt', 'async test');
  });
  assert.ok(createdDir);
  assert.equal(fs.existsSync(createdDir), false, 'Sandbox directory should be cleaned up after withSandbox');
});

test('withSandbox cleans up on error', async () => {
  let createdDir = null;
  await assert.rejects(async () => {
    await withSandbox('test-sb-err-', async (sandbox) => {
      createdDir = sandbox.dir;
      assert.ok(fs.existsSync(createdDir));
      throw new Error('intentional error');
    });
  }, { message: 'intentional error' });

  assert.ok(createdDir);
  assert.equal(fs.existsSync(createdDir), false, 'Sandbox directory should be cleaned up even if error thrown');
});

test('withSandboxSync cleans up on completion and error', () => {
  let createdDir = null;
  const result = withSandboxSync('test-sb-sync-', (sandbox) => {
    createdDir = sandbox.dir;
    sandbox.writeFile('sync.txt', 'ok');
    return 'success';
  });
  assert.equal(result, 'success');
  assert.equal(fs.existsSync(createdDir), false, 'Sandbox directory should be cleaned up after withSandboxSync');

  let errDir = null;
  assert.throws(() => {
    withSandboxSync('test-sb-sync-err-', (sandbox) => {
      errDir = sandbox.dir;
      throw new Error('sync failure');
    });
  }, { message: 'sync failure' });
  assert.equal(fs.existsSync(errDir), false, 'Sandbox directory should be cleaned up on sync error');
});
