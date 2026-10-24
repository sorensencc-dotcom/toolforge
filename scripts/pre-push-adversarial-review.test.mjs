import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pre-push-adversarial-review.sh');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function repo({ withDiff = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-review-hook-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  if (withDiff) {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'two\n');
    git(dir, 'commit', '-qam', 'change');
  }
  return dir;
}

// A fake review command: records that it ran, then exits with the given code.
function fakeReview(dir, exitCode) {
  const marker = path.join(dir, 'review-ran');
  const cmd = path.join(dir, 'fake-review.sh');
  fs.writeFileSync(cmd, `#!/usr/bin/env bash\ntouch "${marker.replace(/\\/g, '/')}"\nexit ${exitCode}\n`);
  return { cmd: `bash ${cmd.replace(/\\/g, '/')}`, ran: () => fs.existsSync(marker) };
}

function run(dir, env) {
  return spawnSync('bash', [SCRIPT], { cwd: dir, encoding: 'utf8', env: { ...process.env, TOOLFORGE_ADVERSARIAL_REVIEW: '', ...env } });
}

test('is a no-op unless the opt-in flag is 1', () => {
  const dir = repo();
  const fake = fakeReview(dir, 1);
  const result = run(dir, { TOOLFORGE_REVIEW_CMD: fake.cmd });
  assert.equal(result.status, 0);
  assert.equal(fake.ran(), false);
});

test('passes the push when the review passes', () => {
  const dir = repo();
  const fake = fakeReview(dir, 0);
  const result = run(dir, { TOOLFORGE_ADVERSARIAL_REVIEW: '1', TOOLFORGE_REVIEW_CMD: fake.cmd });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fake.ran(), true);
  assert.match(result.stdout, /Passed/);
});

test('blocks the push on a blocking finding (exit 1)', () => {
  const dir = repo();
  const result = run(dir, { TOOLFORGE_ADVERSARIAL_REVIEW: '1', TOOLFORGE_REVIEW_CMD: fakeReview(dir, 1).cmd });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Blocking finding/);
});

test('blocks the push when the review fails closed (exit 2)', () => {
  const dir = repo();
  const result = run(dir, { TOOLFORGE_ADVERSARIAL_REVIEW: '1', TOOLFORGE_REVIEW_CMD: fakeReview(dir, 2).cmd });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /failed closed \(exit 2\)/);
});

test('skips the review when there is no diff against the base', () => {
  const dir = repo({ withDiff: false });
  const fake = fakeReview(dir, 1);
  const result = run(dir, { TOOLFORGE_ADVERSARIAL_REVIEW: '1', TOOLFORGE_REVIEW_CMD: fake.cmd });
  assert.equal(result.status, 0);
  assert.equal(fake.ran(), false);
});

test('blocks when the base ref is missing instead of skipping silently', () => {
  const dir = repo();
  const fake = fakeReview(dir, 0);
  const result = run(dir, { TOOLFORGE_ADVERSARIAL_REVIEW: '1', TOOLFORGE_REVIEW_BASE: 'origin/nope', TOOLFORGE_REVIEW_CMD: fake.cmd });
  assert.equal(result.status, 1);
  assert.equal(fake.ran(), false);
  assert.match(result.stdout, /Base ref origin\/nope not found/);
});
