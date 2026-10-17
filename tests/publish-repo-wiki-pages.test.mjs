import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  applyRepoPages,
  assertPublishClone,
  changedWikiPaths,
  checkDirtyWiki,
  cleanGitEnv,
  getCurrentBranch,
  publish,
  removeCloneDir,
  runGit,
  wikiPagesFromRepo
} from '../scripts/publish-repo-wiki-pages.mjs';

test('wiki page list keeps repo wiki markdown mappings', () => {
  const pages = wikiPagesFromRepo([
    { src: 'wiki/sync-tools/repo-triage-and-digest.md', dest: 'repo-triage-and-digest.md' },
    { src: 'docs/KB_SYNC_DAG.md', dest: 'KB_SYNC_DAG.md' },
    { src: 'wiki/sync-tools/diagram.png', dest: 'diagram.png' }
  ]);
  assert.deepEqual(pages, [
    { src: 'wiki/sync-tools/repo-triage-and-digest.md', dest: 'repo-triage-and-digest.md' }
  ]);
});

test('ship diff notices repo wiki files and ignores the published clone', () => {
  assert.deepEqual(changedWikiPaths([
    'wiki/sync-tools/repo-triage-and-digest.md',
    'skills/repo-triage-and-digest/src/pipeline.mjs',
    ['C:/dev', 'toolforge-wiki', 'repo-triage-and-digest.md'].join('/')
  ]), ['wiki/sync-tools/repo-triage-and-digest.md']);
});

test('applyRepoPages writes the repo page into a temp clone and refuses the published clone', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-publish-'));
  const clone = path.join(root, 'clone');
  fs.mkdirSync(clone);
  fs.writeFileSync(path.join(clone, '_Sidebar.md'), '#### Skill Library\n- [[TinyFish Search Integration|tinyfish-search]]\n');
  const src = path.join(root, 'page.md');
  fs.writeFileSync(src, '# From the repo\n');
  const written = applyRepoPages(clone, [{ src, dest: 'repo-triage-and-digest.md' }], (file) => fs.readFileSync(file));
  assert.equal(fs.readFileSync(path.join(clone, 'repo-triage-and-digest.md'), 'utf8'), '# From the repo\n');
  assert.match(fs.readFileSync(path.join(clone, '_Sidebar.md'), 'utf8'), /repo-triage-and-digest/);
  assert.ok(written.includes('repo-triage-and-digest.md'));
  assert.doesNotThrow(() => assertPublishClone(path.join(os.tmpdir(), 'toolforge-wiki-publish-abc')));
  assert.throws(() => assertPublishClone(path.join(root, 'toolforge-wiki')), /REFUSING_WIKI_CLONE/);
  assert.throws(() => assertPublishClone(path.join('C:/dev', 'toolforge-wiki', 'nested')), /REFUSING_WIKI_CLONE/);
});

test('wiki git commands ignore the hook GIT_DIR', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-git-env-'));
  const decoy = path.join(base, 'decoy');
  const real = path.join(base, 'real');
  for (const dir of [decoy, real]) {
    fs.mkdirSync(dir);
    execFileSync('git', ['init', '-b', 'master'], { cwd: dir, env: cleanGitEnv() });
    execFileSync('git', ['config', 'user.email', 'wiki-publish@example.com'], { cwd: dir, env: cleanGitEnv() });
    execFileSync('git', ['config', 'user.name', 'Wiki Publish Test'], { cwd: dir, env: cleanGitEnv() });
  }
  fs.writeFileSync(path.join(decoy, 'page.md'), 'decoy\n');
  fs.writeFileSync(path.join(real, 'page.md'), 'real\n');
  execFileSync('git', ['add', '--', 'page.md'], { cwd: decoy, env: cleanGitEnv() });
  execFileSync('git', ['commit', '-m', 'decoy'], { cwd: decoy, env: cleanGitEnv() });
  const hooked = {
    ...process.env,
    GIT_DIR: path.join(decoy, '.git'),
    GIT_WORK_TREE: decoy
  };
  runGit(['add', '--', 'page.md'], real, hooked);
  runGit(['commit', '-m', 'real'], real, hooked);
  const realLog = execFileSync('git', ['log', '-1', '--format=%s'], { cwd: real, encoding: 'utf8', env: cleanGitEnv() });
  const decoyLog = execFileSync('git', ['log', '-1', '--format=%s'], { cwd: decoy, encoding: 'utf8', env: cleanGitEnv() });
  assert.match(realLog, /real/);
  assert.match(decoyLog, /decoy/);
  assert.equal(cleanGitEnv(hooked).GIT_DIR, undefined);
});

test('published pages hide repo frontmatter in an HTML comment', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-publish-'));
  const clone = path.join(root, 'clone');
  fs.mkdirSync(clone);
  const src = path.join(root, 'page.md');
  fs.writeFileSync(src, '---\ntitle: "Repo Triage and Digest"\n---\n\n# From the repo\n');
  applyRepoPages(clone, [{ src, dest: 'repo-triage-and-digest.md' }]);
  const text = fs.readFileSync(path.join(clone, 'repo-triage-and-digest.md'), 'utf8');
  assert.match(text, /^<!--\n---\ntitle: "Repo Triage and Digest"\n---\n-->\n\n# From the repo\n/);
});

test('a failed temp clone removal warns instead of throwing', () => {
  const eperm = Object.assign(new Error('EPERM'), { code: 'EPERM' });
  assert.doesNotThrow(() => removeCloneDir('C:\tmp\clone', () => { throw eperm; }));
});

test('publish: dry-run mode executes without cloning or remote network calls', () => {
  const pages = [{ src: 'wiki/sync-tools/repo-triage-and-digest.md', dest: 'repo-triage-and-digest.md' }];
  assert.doesNotThrow(() => publish(pages, { dryRun: true }));
});

test('getCurrentBranch: extracts a valid git branch name', () => {
  const branch = getCurrentBranch();
  assert.ok(typeof branch === 'string' && branch.length > 0);
});

test('checkDirtyWiki: returns array of uncommitted wiki changes', () => {
  const dirty = checkDirtyWiki();
  assert.ok(Array.isArray(dirty));
});
