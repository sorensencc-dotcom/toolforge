import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  installPrePushHookInDir,
  getHookTargetDirs,
} from '../scripts/install-all-prepush-wiki-hooks.mjs';

test('installPrePushHookInDir creates a new pre-push hook in an empty directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-new-'));
  try {
    const res = installPrePushHookInDir(tmp);
    assert.equal(res.status, 'created');
    const content = fs.readFileSync(path.join(tmp, 'pre-push'), 'utf8');
    assert.match(content, /publish-repo-wiki-pages\.mjs/);
    assert.match(content, /--if-changed --dry-run/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('installPrePushHookInDir appends cleanly to an existing pre-push hook', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-append-'));
  try {
    const existingScript = '#!/bin/sh\necho "existing checks"\nexit 0\n';
    fs.writeFileSync(path.join(tmp, 'pre-push'), existingScript, 'utf8');

    const res = installPrePushHookInDir(tmp);
    assert.equal(res.status, 'appended');
    const content = fs.readFileSync(path.join(tmp, 'pre-push'), 'utf8');
    assert.match(content, /echo "existing checks"/);
    assert.match(content, /publish-repo-wiki-pages\.mjs/);
    assert.ok(content.trimEnd().endsWith('exit 0'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('installPrePushHookInDir is idempotent when already present', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-idempotent-'));
  try {
    const first = installPrePushHookInDir(tmp);
    assert.equal(first.status, 'created');
    const second = installPrePushHookInDir(tmp);
    assert.equal(second.status, 'already-present');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('getHookTargetDirs detects standard .git/hooks directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-repo-'));
  try {
    const gitDir = path.join(tmp, '.git');
    fs.mkdirSync(path.join(gitDir, 'hooks'), { recursive: true });
    const targetDirs = getHookTargetDirs(tmp);
    assert.ok(targetDirs.some((d) => d.includes(path.join('.git', 'hooks'))));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
