import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePushManifest,
  ManifestError,
  sanitizeReceiptData,
  writePushReceipt,
  executePushWithReceipt,
  getDefaultReceiptStoragePath,
} from '../src/index.js';

const packageRoot = path.resolve(import.meta.dirname, '..');
const pushScript = path.join(packageRoot, 'scripts', 'push-with-receipt.mjs');

function mockSecret(prefix, body) {
  return `${prefix}_${body}`;
}

function mockAuthUrl(user, pass, hostPath) {
  const scheme = 'https:';
  const creds = `${user}:${pass}`;
  return `${scheme}//${creds}@${hostPath}`;
}

test('parsePushManifest returns default repository when manifest is omitted', () => {
  const manifest = parsePushManifest(null, {
    defaultRepoRoot: '/custom/repo',
    defaultRepoId: 'my-repo',
    defaultPushArgs: ['origin', 'main'],
  });

  assert.equal(manifest.version, 1);
  assert.equal(manifest.source, 'default');
  assert.equal(manifest.repositories.length, 1);
  assert.equal(manifest.repositories[0].id, 'my-repo');
  assert.equal(manifest.repositories[0].path, path.resolve('/custom/repo'));
  assert.deepEqual(manifest.repositories[0].pushArgs, ['origin', 'main']);
});

test('parsePushManifest parses manifest from array or object', () => {
  const fromArray = parsePushManifest([
    { id: 'repo-1', path: './repo-1', pushArgs: ['origin', 'main'] },
    { id: 'repo-2', path: './repo-2' },
  ], { defaultRepoRoot: '/base' });

  assert.equal(fromArray.repositories.length, 2);
  assert.equal(fromArray.repositories[0].id, 'repo-1');
  assert.equal(fromArray.repositories[1].id, 'repo-2');
  assert.deepEqual(fromArray.repositories[1].pushArgs, []);

  const fromObject = parsePushManifest({
    version: 1,
    repositories: [{ id: 'repo-obj', path: '/abs/path' }],
  });

  assert.equal(fromObject.repositories[0].id, 'repo-obj');
  assert.equal(fromObject.repositories[0].path, path.normalize('/abs/path'));
});

test('parsePushManifest reads from JSON file path', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-manifest-'));
  try {
    const manifestFile = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(manifestFile, JSON.stringify({
      version: 1,
      repositories: [
        { id: 'sub-repo', path: './sub', pushArgs: ['origin', 'feat'] },
      ],
    }));

    const manifest = parsePushManifest(manifestFile, { defaultRepoRoot: tempDir });
    assert.equal(manifest.repositories.length, 1);
    assert.equal(manifest.repositories[0].id, 'sub-repo');
    assert.equal(manifest.repositories[0].path, path.resolve(tempDir, 'sub'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('parsePushManifest rejects invalid inputs', () => {
  assert.throws(() => parsePushManifest([]), ManifestError);
  assert.throws(() => parsePushManifest({ version: 2, repositories: [] }), ManifestError);
  assert.throws(() => parsePushManifest({ repositories: [] }), ManifestError);
  assert.throws(() => parsePushManifest('non-existent-manifest.json'), ManifestError);
});

test('sanitizeReceiptData redacts tokens, basic auth credentials, and strips prompts', () => {
  const sampleToken = mockSecret('ghp', 'ABC123456789012345678901234567890');
  const sampleApiKey = `sk-${'samplekey12345678901234567890'}`;
  const sampleNested = mockSecret('ghp', '999999999999999999999999999999');
  const sampleUrl = mockAuthUrl('sampleuser', 'secretpass123', 'github.com/org/repo.git');
  const expectedRedactedUrl = mockAuthUrl('***', '***', 'github.com/org/repo.git');

  const input = {
    repository: 'toolforge',
    url: sampleUrl,
    token: sampleToken,
    apiKey: sampleApiKey,
    prompt: 'This is a sensitive user prompt that must not appear in receipts',
    prompts: ['prompt1', 'prompt2'],
    messages: [{ role: 'user', content: 'hello' }],
    nested: {
      authHeader: `Bearer ${'mock-jwt-token-payload-xyz'}`,
      githubToken: sampleNested,
      normalField: 'all-good',
    },
  };

  const sanitized = sanitizeReceiptData(input);

  assert.equal(sanitized.repository, 'toolforge');
  assert.equal(sanitized.url, expectedRedactedUrl);
  assert.equal(sanitized.token, undefined);
  assert.equal(sanitized.apiKey, undefined);
  assert.equal(sanitized.prompt, undefined);
  assert.equal(sanitized.prompts, undefined);
  assert.equal(sanitized.messages, undefined);
  assert.equal(sanitized.nested.authHeader, '[REDACTED]');
  assert.equal(sanitized.nested.githubToken, '[REDACTED]');
  assert.equal(sanitized.nested.normalField, 'all-good');
});

test('writePushReceipt writes sanitized JSONL outside repo checkout', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-receipts-'));
  try {
    const storagePath = path.join(tempDir, 'user-receipts.jsonl');
    const receipt1 = {
      receiptType: 'push-receipt',
      overallStatus: 'success',
      token: mockSecret('ghp', 'secrettoken12345678901234567890'),
      prompt: 'Do not log me',
      repositories: [{ id: 'repo-1', branch: 'main', pushResult: 'success' }],
    };

    const write1 = writePushReceipt(receipt1, { storagePath });
    assert.equal(write1.receiptPath, storagePath);
    assert.ok(fs.existsSync(storagePath));

    const receipt2 = {
      receiptType: 'push-receipt',
      overallStatus: 'failed',
      repositories: [{ id: 'repo-2', branch: 'dev', pushResult: 'failed' }],
    };
    writePushReceipt(receipt2, { storagePath });

    const lines = fs.readFileSync(storagePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].overallStatus, 'success');
    assert.equal(lines[0].token, undefined);
    assert.equal(lines[0].prompt, undefined);
    assert.ok(lines[0].receiptId);
    assert.ok(lines[0].timestamp);
    assert.equal(lines[1].overallStatus, 'failed');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('executePushWithReceipt executes single repository push and captures post-push status', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-push-exec-'));
  const storagePath = path.join(tempDir, 'receipts.jsonl');
  try {
    const mockGitCalls = [];
    const runGit = (cmd, args, cwd) => {
      mockGitCalls.push({ cmd, args, cwd });
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: 'feat/test-branch\n', stderr: '' };
      }
      if (args[0] === 'push') {
        return { status: 0, stdout: 'Push successful\n', stderr: '' };
      }
      if (args[0] === 'status') {
        return { status: 0, stdout: '## feat/test-branch...origin/feat/test-branch\n', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    };

    const result = executePushWithReceipt({
      pushArgs: ['origin', 'feat/test-branch'],
    }, {
      storagePath,
      defaultRepoRoot: '/mock/repo',
      defaultRepoId: 'mock-repo',
      runGit,
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.receipt.overallStatus, 'success');
    assert.equal(result.receipt.repositoryCount, 1);
    assert.equal(result.receipt.repositories[0].id, 'mock-repo');
    assert.equal(result.receipt.repositories[0].branch, 'feat/test-branch');
    assert.equal(result.receipt.repositories[0].pushResult, 'success');
    assert.equal(result.receipt.repositories[0].gitStatus, '## feat/test-branch...origin/feat/test-branch');

    const written = JSON.parse(fs.readFileSync(storagePath, 'utf8').trim());
    assert.equal(written.overallStatus, 'success');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('executePushWithReceipt handles push failure and status capture failure', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-push-fail-'));
  const storagePath = path.join(tempDir, 'receipts.jsonl');
  try {
    const runGit = (cmd, args) => {
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: 'main\n', stderr: '' };
      }
      if (args[0] === 'push') {
        return { status: 1, stdout: '', stderr: 'error: failed to push some refs' };
      }
      if (args[0] === 'status') {
        return { status: 128, stdout: '', stderr: 'fatal: not a git repository' };
      }
      return { status: 0, stdout: '', stderr: '' };
    };

    const result = executePushWithReceipt({
      pushArgs: ['origin', 'main'],
    }, {
      storagePath,
      runGit,
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.receipt.overallStatus, 'failed');
    assert.equal(result.receipt.repositories[0].pushResult, 'failed');
    assert.equal(result.receipt.repositories[0].statusCaptured, false);
    assert.match(result.receipt.repositories[0].gitStatus, /FAILED TO CAPTURE STATUS/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('executePushWithReceipt multi-repository manifest execution', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-push-multi-'));
  const storagePath = path.join(tempDir, 'receipts.jsonl');
  try {
    const runGit = (cmd, args, cwd) => {
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: cwd.includes('repo-1') ? 'branch-1\n' : 'branch-2\n', stderr: '' };
      }
      if (args[0] === 'push') {
        return { status: 0, stdout: `Pushed ${cwd}`, stderr: '' };
      }
      if (args[0] === 'status') {
        return { status: 0, stdout: `## status for ${cwd}`, stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    };

    const result = executePushWithReceipt({
      manifest: [
        { id: 'repo-1', path: '/path/repo-1', pushArgs: ['origin', 'branch-1'] },
        { id: 'repo-2', path: '/path/repo-2', pushArgs: ['origin', 'branch-2'] },
      ],
    }, {
      storagePath,
      runGit,
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.receipt.overallStatus, 'success');
    assert.equal(result.receipt.repositoryCount, 2);
    assert.equal(result.receipt.repositories[0].id, 'repo-1');
    assert.equal(result.receipt.repositories[0].branch, 'branch-1');
    assert.equal(result.receipt.repositories[1].id, 'repo-2');
    assert.equal(result.receipt.repositories[1].branch, 'branch-2');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('push-with-receipt CLI supports --dry-run and writes receipt', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-cli-'));
  const storagePath = path.join(tempDir, 'receipts.jsonl');
  try {
    const result = spawnSync(process.execPath, [
      pushScript,
      '--storage-path', storagePath,
      '--dry-run',
      'origin', 'main',
    ], {
      cwd: packageRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.check, 'push-receipt');
    assert.equal(parsed.exitCode, 0);
    assert.equal(parsed.receipt.overallStatus, 'success');

    assert.ok(fs.existsSync(storagePath));
    const lines = fs.readFileSync(storagePath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
