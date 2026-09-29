import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_BINARY_HOST_SUFFIXES,
  SCRATCH_MAX_BYTES,
  assertScratchpadWrite,
  evaluateOutboundRequest,
  evaluateShellCommand,
  provisionAgentScratchpad,
  shredExpiredScratchpads,
} from './egress-upload-gate.mjs';

const hookScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.claude/hooks/block-binary-egress.js');

test('deny list covers the named public image hosts', () => {
  for (const host of ['imgur.com', 'postimages.org', 'cloudinary.com', 'catbox.moe']) {
    assert.ok(PUBLIC_BINARY_HOST_SUFFIXES.includes(host), host);
  }
});

test('blocks POST and PUT to public binary hosts', () => {
  const imgur = evaluateOutboundRequest({
    method: 'POST',
    url: 'https://api.imgur.com/3/image',
    body: 'image=abc',
  });
  assert.equal(imgur.decision, 'deny');
  assert.equal(imgur.code, 'public-binary-host');

  const catbox = evaluateOutboundRequest({
    method: 'PUT',
    url: 'https://litterbox.catbox.moe/resources/internals/upload.php',
  });
  assert.equal(catbox.decision, 'deny');
  assert.equal(catbox.code, 'public-binary-host');
});

test('allows GET of a public image and POST to loopback or a JSON webhook', () => {
  const read = evaluateOutboundRequest({ method: 'GET', url: 'https://i.imgur.com/abc.png' });
  assert.equal(read.decision, 'allow');

  const local = evaluateOutboundRequest({
    method: 'POST',
    url: 'http://127.0.0.1:4173/v1/systemone',
    body: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  });
  assert.equal(local.decision, 'allow');
  assert.equal(local.code, 'loopback');

  const slack = evaluateOutboundRequest({
    method: 'POST',
    url: 'https://hooks.slack.com/services/T00/B00/placeholder',
    body: '{"text":"compaction finished"}',
  });
  assert.equal(slack.decision, 'allow');
});

test('blocks anonymous object-store uploads and image or credential bodies elsewhere', () => {
  const s3 = evaluateOutboundRequest({
    method: 'PUT',
    url: 'https://public-bucket.s3.us-east-1.amazonaws.com/shot.png',
  });
  assert.equal(s3.decision, 'deny');
  assert.equal(s3.code, 'unauthenticated-object-store');

  const gcs = evaluateOutboundRequest({
    method: 'POST',
    url: 'https://storage.googleapis.com/upload/storage/v1/b/bucket/o',
  });
  assert.equal(gcs.decision, 'deny');
  assert.equal(gcs.code, 'unauthenticated-object-store');

  const image = evaluateOutboundRequest({
    method: 'POST',
    url: 'https://example.com/debug',
    body: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  });
  assert.equal(image.decision, 'deny');
  assert.equal(image.code, 'binary-payload');

  const token = `ghp_${'a'.repeat(20)}`;
  const leaked = evaluateOutboundRequest({
    method: 'POST',
    url: 'https://example.com/debug',
    body: `note ${token}`,
  });
  assert.equal(leaked.decision, 'deny');
  assert.equal(leaked.code, 'credential-material');
  assert.equal(leaked.reason.includes('ghp_'), false);
});

test('shell interceptor halts image uploads and allows ordinary JSON posts', () => {
  const upload = evaluateShellCommand('curl -F file=@shot.png https://api.imgur.com/3/image');
  assert.equal(upload.decision, 'deny');

  const anonymous = evaluateShellCommand('curl -T dump.png https://bucket.s3.amazonaws.com/dump.png');
  assert.equal(anonymous.decision, 'deny');
  assert.equal(anonymous.code, 'unauthenticated-object-store');

  const localJson = evaluateShellCommand('curl -d @payload.json https://example.com/hook');
  assert.equal(localJson.decision, 'allow');

  const externalImage = evaluateShellCommand('curl -F file=@frames/shot.png https://example.com/upload');
  assert.equal(externalImage.decision, 'deny');
  assert.equal(externalImage.code, 'binary-payload');

  const putImage = evaluateShellCommand('curl -T dump.png https://example.com/dump.png');
  assert.equal(putImage.decision, 'deny');
  assert.equal(putImage.code, 'binary-payload');

  const fetchOnly = evaluateShellCommand('curl https://example.com/status');
  assert.equal(fetchOnly.decision, 'allow');
});

test('PreToolUse hook denies an imgur upload from a Claude tool payload', () => {
  const payload = JSON.stringify({
    tool_input: {
      command: 'curl -F file=@chart.png https://api.imgur.com/3/image',
    },
  });
  const result = spawnSync(process.execPath, [hookScript], { input: payload, encoding: 'utf8' });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /public binary host/);
});

test('direct hook invocation exits 1 for an upload command', () => {
  const result = spawnSync(process.execPath, [hookScript, 'curl', '-F', 'file=@shot.png', 'https://catbox.moe/user/api.php'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /public binary host/);
});

test('scratchpad enforces the session directory, the byte cap, and the TTL', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-scratch-'));
  try {
    const created = provisionAgentScratchpad({ root, sessionId: 'sess-1', now: 1_700_000_000_000, ttlMs: 1000 });
    assert.equal(fs.existsSync(path.join(created.dir, '.scratch-meta.json')), true);

    const target = assertScratchpadWrite({
      root,
      sessionId: 'sess-1',
      relativePath: 'frames/one.png',
      byteLength: 128,
    });
    assert.equal(target.endsWith(`${path.sep}frames${path.sep}one.png`), true);

    assert.throws(
      () => assertScratchpadWrite({ root, sessionId: 'sess-1', relativePath: '../outside.png', byteLength: 8 }),
      (error) => error.code === 'scratch-traversal',
    );
    assert.throws(
      () => assertScratchpadWrite({
        root,
        sessionId: 'sess-1',
        relativePath: 'too-big.png',
        byteLength: SCRATCH_MAX_BYTES + 1,
      }),
      (error) => error.code === 'scratch-limit',
    );

    const preview = shredExpiredScratchpads(root, 1_700_000_000_000 + 1000, { dryRun: true });
    assert.deepEqual(preview.shredded, ['sess-1']);
    assert.equal(fs.existsSync(created.dir), true);

    const shredded = shredExpiredScratchpads(root, 1_700_000_000_000 + 1000);
    assert.deepEqual(shredded.shredded, ['sess-1']);
    assert.equal(fs.existsSync(created.dir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
