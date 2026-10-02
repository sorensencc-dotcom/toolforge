// tests/doc-sync-stage-mirror.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageMirror } from '../scripts/doc-sync/stage-mirror.mjs';

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docsync-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

function list(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath ?? e.path, e.name)).replace(/\\/g, '/'))
    .filter((f) => !f.startsWith('.git/'))
    .sort();
}

test('replaces clone contents with source, keeps .git, removes stale pages', () => {
  const src = tree({ 'Home.md': 'new home', 'sub/Page.md': 'p', 'img/a.png': 'x' });
  const clone = tree({ '.git/HEAD': 'ref', 'Home.md': 'old', 'Stale.md': 'gone' });
  stageMirror({ sourceDir: src, cloneDir: clone });
  assert.deepEqual(list(clone), ['Home.md', 'img/a.png', 'sub/Page.md']);
  assert.equal(fs.readFileSync(path.join(clone, 'Home.md'), 'utf8'), 'new home');
  assert.equal(fs.readFileSync(path.join(clone, '.git/HEAD'), 'utf8'), 'ref');
});

test('homeFrom renames the given file to Home.md', () => {
  const src = tree({ 'README.md': 'landing', 'Other.md': 'o' });
  const clone = tree({ '.git/HEAD': 'ref' });
  stageMirror({ sourceDir: src, cloneDir: clone, homeFrom: 'README.md' });
  assert.deepEqual(list(clone), ['Home.md', 'Other.md']);
  assert.equal(fs.readFileSync(path.join(clone, 'Home.md'), 'utf8'), 'landing');
});

test('throws when the source is missing, empty, or has no landing page, and leaves the clone alone', () => {
  const clone = tree({ '.git/HEAD': 'ref', 'Keep.md': 'k' });
  assert.throws(() => stageMirror({ sourceDir: path.join(clone, 'nope'), cloneDir: clone }), /STAGE_SOURCE_MISSING/);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'docsync-empty-'));
  assert.throws(() => stageMirror({ sourceDir: empty, cloneDir: clone }), /STAGE_SOURCE_EMPTY/);
  const onlyDirs = fs.mkdtempSync(path.join(os.tmpdir(), 'docsync-dirs-'));
  fs.mkdirSync(path.join(onlyDirs, 'a', 'b'), { recursive: true });
  assert.throws(() => stageMirror({ sourceDir: onlyDirs, cloneDir: clone }), /STAGE_SOURCE_EMPTY/);
  assert.throws(() => stageMirror({ sourceDir: tree({ 'Other.md': 'o' }), cloneDir: clone }), /STAGE_NO_HOME/);
  assert.throws(() => stageMirror({ sourceDir: tree({ 'Home.md': 'h' }), cloneDir: clone, homeFrom: 'README.md' }), /STAGE_HOME_FROM_MISSING/);
  assert.throws(() => stageMirror({ sourceDir: tree({ 'README.md': 'r', 'Home.md': 'h' }), cloneDir: clone, homeFrom: 'README.md' }), /STAGE_HOME_COLLISION/);
  assert.deepEqual(list(clone), ['Keep.md']);
});
