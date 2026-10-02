import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendToWikiLog, appendToWikiLogAsync, appendToLogFile } from './wiki-log-append.mjs';

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-log-append-'));
  fs.mkdirSync(path.join(root, 'wiki'), { recursive: true });
  return root;
}

test('appendToWikiLog appends without rotating when under the size threshold', () => {
  const root = makeRepo();
  const logPath = path.join(root, 'wiki', 'Log.md');
  fs.writeFileSync(logPath, '# Log\n');

  appendToWikiLog(root, '\n- entry one\n');

  const content = fs.readFileSync(logPath, 'utf8');
  assert.match(content, /entry one/);
  assert.equal(fs.existsSync(path.join(root, 'wiki', 'archive')), false);

  fs.rmSync(root, { recursive: true });
});

test('appendToWikiLog rotates the oversized file to wiki/archive/ before appending', () => {
  const root = makeRepo();
  const logPath = path.join(root, 'wiki', 'Log.md');
  fs.writeFileSync(logPath, 'x'.repeat(600 * 1024));

  appendToWikiLog(root, '\n- new entry\n');

  const archiveDir = path.join(root, 'wiki', 'archive');
  const archived = fs.readdirSync(archiveDir);
  assert.equal(archived.length, 1);
  assert.match(archived[0], /^Log-\d{4}-\d{2}-\d{2}\.md$/);

  // the oversized content moved into the archive, not the live file
  const archivedContent = fs.readFileSync(path.join(archiveDir, archived[0]), 'utf8');
  assert.equal(archivedContent.length, 600 * 1024);

  const liveContent = fs.readFileSync(logPath, 'utf8');
  assert.ok(liveContent.length < 1024, 'rotated Log.md should be small, not keep growing unbounded');
  assert.match(liveContent, /Rotated \d{4}-\d{2}-\d{2}/);
  assert.match(liveContent, /new entry/);

  fs.rmSync(root, { recursive: true });
});

test('appendToWikiLog avoids archive filename collisions on repeated same-day rotations', () => {
  const root = makeRepo();
  const logPath = path.join(root, 'wiki', 'Log.md');

  fs.writeFileSync(logPath, 'x'.repeat(600 * 1024));
  appendToWikiLog(root, '\n- first rotation\n');

  fs.appendFileSync(logPath, 'y'.repeat(600 * 1024));
  appendToWikiLog(root, '\n- second rotation\n');

  const archived = fs.readdirSync(path.join(root, 'wiki', 'archive'));
  assert.equal(archived.length, 2, 'second same-day rotation must not overwrite the first archive');

  fs.rmSync(root, { recursive: true });
});

test('appendToWikiLogAsync rotates and appends asynchronously', async () => {
  const root = makeRepo();
  const logPath = path.join(root, 'wiki', 'Log.md');
  fs.writeFileSync(logPath, 'x'.repeat(600 * 1024));

  await appendToWikiLogAsync(root, '\n- async entry\n');

  const liveContent = fs.readFileSync(logPath, 'utf8');
  assert.match(liveContent, /async entry/);
  assert.equal(fs.readdirSync(path.join(root, 'wiki', 'archive')).length, 1);

  fs.rmSync(root, { recursive: true });
});

test('appendToLogFile rotates a Log.md at an arbitrary (non-repoRoot/wiki) path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-log-append-vault-'));
  const logPath = path.join(root, 'Log.md');
  fs.writeFileSync(logPath, 'x'.repeat(600 * 1024));

  appendToLogFile(logPath, '\n- vault entry\n');

  const archiveDir = path.join(root, 'archive');
  assert.equal(fs.readdirSync(archiveDir).length, 1);
  const liveContent = fs.readFileSync(logPath, 'utf8');
  assert.match(liveContent, /vault entry/);

  fs.rmSync(root, { recursive: true });
});
