import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  detectAgent,
  persistClaudeHookPayload,
  readClaudeUsage,
  scanForUsageFile,
  readCodexUsage,
  readGrokUsage,
  checkUsage,
} from '../src/index.js';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('detectAgent', async (t) => {
  await t.test('honors an explicit forced agent over env', () => {
    const result = detectAgent({ CLAUDECODE: '1' }, 'codex');
    assert.strictEqual(result.agent, 'codex');
    assert.strictEqual(result.method, 'forced');
  });

  await t.test('detects Claude Code via env', () => {
    const result = detectAgent({ CLAUDECODE: '1' });
    assert.strictEqual(result.agent, 'claude-code');
  });

  await t.test('detects Codex via CODEX_HOME', () => {
    const result = detectAgent({ CODEX_HOME: '/home/x/.codex' });
    assert.strictEqual(result.agent, 'codex');
  });

  await t.test('detects Grok via GROK_CLI_HOME', () => {
    const result = detectAgent({ GROK_CLI_HOME: '/home/x/.grok' });
    assert.strictEqual(result.agent, 'grok');
  });

  await t.test('returns unknown with empty env and nothing on PATH', () => {
    // PATH left empty so `which`/`where` cannot resolve any of the binaries.
    const result = detectAgent({ PATH: '' });
    assert.strictEqual(result.agent, 'unknown');
    assert.strictEqual(result.confidence, 'none');
  });
});

test('Claude Code adapter', async (t) => {
  await t.test('persists a valid hook payload and extracts rate_limits', () => {
    const dir = tmpDir('usagecheck-claude-');
    const cachePath = path.join(dir, 'limits.json');
    const payload = JSON.stringify({ rate_limits: { requests_remaining: 42 } });

    const result = persistClaudeHookPayload(payload, cachePath);

    assert.strictEqual(result.available, true);
    assert.deepStrictEqual(result.rateLimits, { requests_remaining: 42 });
    assert.ok(fs.existsSync(cachePath));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(cachePath, 'utf8')).rate_limits, {
      requests_remaining: 42,
    });
  });

  await t.test('reports "no limit data" when rate_limits is absent, matching the original script', () => {
    const dir = tmpDir('usagecheck-claude-');
    const cachePath = path.join(dir, 'limits.json');
    const result = persistClaudeHookPayload(JSON.stringify({ session_id: 'abc' }), cachePath);

    assert.strictEqual(result.available, false);
    assert.strictEqual(result.rateLimits, null);
  });

  await t.test('handles invalid JSON on stdin without throwing', () => {
    const dir = tmpDir('usagecheck-claude-');
    const cachePath = path.join(dir, 'limits.json');
    const result = persistClaudeHookPayload('not json', cachePath);

    assert.strictEqual(result.available, false);
    assert.match(result.message, /not valid JSON/);
    assert.ok(!fs.existsSync(cachePath));
  });

  await t.test('readClaudeUsage falls back to cache when no stdin is given', () => {
    const dir = tmpDir('usagecheck-claude-');
    const cachePath = path.join(dir, 'limits.json');
    fs.writeFileSync(cachePath, JSON.stringify({ rate_limits: { tokens_remaining: 7 } }));

    const result = readClaudeUsage({ cachePath });
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.source, 'cache');
    assert.deepStrictEqual(result.rateLimits, { tokens_remaining: 7 });
  });

  await t.test('readClaudeUsage reports none when there is no stdin and no cache', () => {
    const dir = tmpDir('usagecheck-claude-');
    const cachePath = path.join(dir, 'missing.json');

    const result = readClaudeUsage({ cachePath });
    assert.strictEqual(result.available, false);
    assert.strictEqual(result.source, 'none');
  });
});

test('heuristic scan adapter (Codex / Grok)', async (t) => {
  await t.test('finds a usage-shaped JSON file in the scanned directory', () => {
    const dir = tmpDir('usagecheck-scan-');
    fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ foo: 'bar' }));
    fs.writeFileSync(path.join(dir, 'quota.json'), JSON.stringify({ quota_remaining: 10 }));

    const result = scanForUsageFile(dir);
    assert.strictEqual(result.found, true);
    assert.match(result.file, /quota\.json$/);
  });

  await t.test('reports not-found without fabricating data when nothing matches', () => {
    const dir = tmpDir('usagecheck-scan-');
    fs.writeFileSync(path.join(dir, 'unrelated.json'), JSON.stringify({ foo: 'bar' }));

    const result = scanForUsageFile(dir);
    assert.strictEqual(result.found, false);
  });

  await t.test('reports not-found for a missing directory instead of throwing', () => {
    const result = scanForUsageFile('/definitely/not/a/real/path/xyz');
    assert.strictEqual(result.found, false);
    assert.match(result.message, /directory not found/);
  });

  await t.test('readCodexUsage uses a configured command result when provided', () => {
    const result = readCodexUsage({
      env: {},
      config: { codex: { command: 'node -e process.stdout.write(JSON.stringify({usage:1}))' } },
    });
    assert.strictEqual(result.available, true);
    assert.deepStrictEqual(result.raw, { usage: 1 });
    assert.strictEqual(result.source, 'configured-command');
  });

  await t.test('readGrokUsage falls back to heuristic scan and stays honest when nothing is found', () => {
    const dir = tmpDir('usagecheck-grok-');
    const result = readGrokUsage({ env: {}, config: { grok: { homeDir: dir } } });
    assert.strictEqual(result.available, false);
    assert.match(result.message, /no confirmed usage-reporting mechanism/);
  });
});

test('checkUsage end-to-end', async (t) => {
  await t.test('returns a success report shape for a forced unknown-adjacent agent', async () => {
    const report = await checkUsage({ agent: 'codex', env: { CODEX_HOME: '/nonexistent' } });
    assert.strictEqual(report.status, 'success');
    assert.strictEqual(report.agent, 'codex');
    assert.strictEqual(report.available, false);
    assert.ok(report.timestamp);
  });

  await t.test('returns available Claude Code usage from a stdin payload', async () => {
    const report = await checkUsage({
      agent: 'claude-code',
      stdinText: JSON.stringify({ rate_limits: { requests_remaining: 5 } }),
    });
    assert.strictEqual(report.available, true);
    assert.deepStrictEqual(report.usage, { requests_remaining: 5 });
  });

  await t.test('reports unknown agent with a clear, actionable message', async () => {
    const report = await checkUsage({ env: { PATH: '' } });
    assert.strictEqual(report.agent, 'unknown');
    assert.match(report.message, /pass agent explicitly/);
  });
});
