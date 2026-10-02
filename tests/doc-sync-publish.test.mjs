// tests/doc-sync-publish.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { publishProduct } from '../scripts/doc-sync/publish.mjs';

const git = (cmd, cwd) => execSync(`git -c user.name=t -c user.email=t@t ${cmd}`, { cwd, encoding: 'utf8' }).trim();

function fakeRemote(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-'));
  const bare = path.join(root, 'r.wiki.git');
  git(`init --bare -q -b master "${bare}"`, root);
  const seed = path.join(root, 'seed');
  git(`clone -q "${bare}" "${seed}"`, root);
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(seed, rel), body);
  git('add -A', seed);
  git('commit -qm seed', seed);
  git('push -q origin HEAD', seed);
  return bare;
}

const remoteFiles = (bare) => git('ls-tree -r --name-only HEAD', bare).split('\n').filter(Boolean).sort();

function repoWithWiki(files) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  fs.mkdirSync(path.join(repo, 'wiki'));
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(repo, 'wiki', rel), body);
  return repo;
}

const product = (repoPath, remote, extra = {}) => ({ name: 'p', repoPath, remote, sourceDir: 'wiki', ingest: true, enabled: true, ...extra });

test('sourceDir: publishes and deletes stale remote pages, then calls onPublished', async () => {
  const bare = fakeRemote({ 'Home.md': 'old', 'Stale.md': 's' });
  const repo = repoWithWiki({ 'Home.md': 'new', 'Page.md': 'p' });
  let seen = null;
  const r = await publishProduct(product(repo, bare), { onPublished: (dir) => { seen = fs.readdirSync(dir).filter((n) => n !== '.git').sort(); } });
  assert.equal(r.status, 'SYNCHRONIZED', r.error);
  assert.deepEqual(r.deleted, ['Stale.md']);
  assert.equal(r.pages, 2);
  assert.match(r.remoteHead, /^[0-9a-f]{40}$/);
  assert.deepEqual(remoteFiles(bare), ['Home.md', 'Page.md']);
  assert.deepEqual(seen, ['Home.md', 'Page.md']);
});

test('a second run after a real publish is UP_TO_DATE and still calls onPublished', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'new', 'Page.md': 'p' });
  assert.equal((await publishProduct(product(repo, bare))).status, 'SYNCHRONIZED');
  const headBefore = git('rev-parse HEAD', bare);
  let called = 0;
  const r = await publishProduct(product(repo, bare), { onPublished: () => { called++; } });
  assert.equal(r.status, 'UP_TO_DATE');
  assert.equal(called, 1);
  assert.equal(git('rev-parse HEAD', bare), headBefore);
});

test('a failing build command fails the product and leaves the remote alone', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'build-fail-'));
  const r = await publishProduct(product(repo, bare, { sourceDir: undefined, buildCommand: 'node -e "process.exit(4)" "{out}"' }));
  assert.equal(r.status, 'FAILED');
  assert.match(r.error, /BUILD_FAILED/);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
});

test('dry run reports changes, pushes nothing, skips onPublished', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'new', 'Add.md': 'a' });
  let called = 0;
  const r = await publishProduct(product(repo, bare), { dryRun: true, onPublished: () => { called++; } });
  assert.equal(r.status, 'DRY_RUN');
  assert.deepEqual(r.changed.sort(), ['Add.md', 'Home.md']);
  assert.deepEqual(r.deleted, []);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
  assert.equal(called, 0);
});

test('buildCommand output is what gets published', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'build-'));
  fs.writeFileSync(path.join(repo, 'build.mjs'), "import fs from 'node:fs'; import path from 'node:path'; const out = process.argv[2]; fs.writeFileSync(path.join(out, 'Home.md'), 'built'); fs.writeFileSync(path.join(out, 'Guide.md'), 'g');");
  const r = await publishProduct(product(repo, bare, { sourceDir: undefined, buildCommand: 'node build.mjs "{out}"' }));
  assert.equal(r.status, 'SYNCHRONIZED', r.error);
  assert.deepEqual(remoteFiles(bare), ['Guide.md', 'Home.md']);
});

test('a build that writes nothing fails without touching the remote', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'build-empty-'));
  const r = await publishProduct(product(repo, bare, { sourceDir: undefined, buildCommand: 'node -e "" "{out}"' }));
  assert.equal(r.status, 'FAILED');
  assert.match(r.error, /STAGE_SOURCE_EMPTY/);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
});

test('foreign sidebar link fails before push', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'h', '_Sidebar.md': '- [[Other-Product-Page]]' });
  const r = await publishProduct(product(repo, bare));
  assert.equal(r.status, 'FAILED');
  assert.match(r.error, /SIDEBAR_FOREIGN_LINKS: Other-Product-Page/);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
});

test('failing preValidate stops publish', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'new' });
  const r = await publishProduct(product(repo, bare, { preValidate: 'node -e "process.exit(3)"' }));
  assert.equal(r.status, 'FAILED');
  assert.match(r.error, /PREVALIDATE_FAILED/);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
});
