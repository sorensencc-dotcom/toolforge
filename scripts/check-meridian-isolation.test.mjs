import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkMeridianIsolation } from './check-meridian-isolation.mjs';

function makeDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-iso-'));
  const meridianDir = path.join(root, '.meridian');
  const claudeProjectDir = path.join(root, 'claude-project');
  fs.mkdirSync(meridianDir, { recursive: true });
  fs.mkdirSync(claudeProjectDir, { recursive: true });
  return { root, meridianDir, claudeProjectDir };
}

function writeSettings(meridianDir, settings) {
  fs.mkdirSync(path.join(meridianDir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(meridianDir, '.claude', 'settings.json'), JSON.stringify(settings));
}

test('reports every leak in the 2026-09-30 state', () => {
  const dirs = makeDirs();
  fs.mkdirSync(path.join(dirs.meridianDir, 'graft', '.cache', 'session'), { recursive: true });
  fs.writeFileSync(path.join(dirs.meridianDir, 'graft', '.cache', 'session', 'a.json'), '{"lastQuery":"x"}');
  fs.mkdirSync(path.join(dirs.claudeProjectDir, 'memory'));
  fs.writeFileSync(path.join(dirs.claudeProjectDir, 'memory', 'leak.md'), 'x');

  const codes = checkMeridianIsolation(dirs).map((v) => v.code).sort();

  assert.deepEqual(codes, ['auto-memory-written', 'graft-cache-present', 'settings-missing']);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('flags settings that leave hooks or auto-memory on', () => {
  const dirs = makeDirs();
  writeSettings(dirs.meridianDir, { disableAllHooks: true, autoMemoryEnabled: true });

  assert.deepEqual(checkMeridianIsolation(dirs).map((v) => v.code), ['auto-memory-enabled']);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('treats an empty memory dir as clean', () => {
  const dirs = makeDirs();
  writeSettings(dirs.meridianDir, { disableAllHooks: true, autoMemoryEnabled: false });
  fs.mkdirSync(path.join(dirs.claudeProjectDir, 'memory'));

  assert.deepEqual(checkMeridianIsolation(dirs), []);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});
