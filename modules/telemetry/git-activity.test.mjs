import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { discoverRepos, collectCommitsByDay } from './git-activity.mjs';

function git(cwd, args, env = {}) {
  execFileSync('git', args, { cwd, env: { ...process.env, ...env }, stdio: 'pipe' });
}

function commit(repo, author, localTime) {
  const env = { GIT_AUTHOR_DATE: localTime, GIT_COMMITTER_DATE: localTime };
  git(repo, ['-c', `user.name=${author}`, '-c', 'user.email=x@example.com', 'commit', '--allow-empty', '-m', `${author} ${localTime}`], env);
}

describe('git activity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-activity-test-'));
  const alpha = path.join(root, 'alpha');
  const clone = path.join(root, 'alpha-clone');
  const beta = path.join(root, 'beta');

  before(() => {
    for (const repo of [alpha, beta]) {
      fs.mkdirSync(repo);
      git(repo, ['init', '-q']);
    }
    commit(alpha, 'Chris Sorensen', '2026-09-29T10:00:00');
    commit(alpha, 'Iron-Hammer', '2026-09-29T11:00:00');
    commit(alpha, 'Chris Sorensen', '2026-09-30T09:00:00');
    git(root, ['clone', '-q', alpha, clone]);
    commit(beta, 'Chris Sorensen', '2026-09-29T23:30:00');
    fs.mkdirSync(path.join(root, 'not-a-repo'));
  });
  after(() => fs.rmSync(root, { recursive: true, force: true }));

  test('discovers the root and its direct child repos only', () => {
    assert.deepEqual(discoverRepos(root).map((r) => path.basename(r)).sort(), ['alpha', 'alpha-clone', 'beta']);
  });

  test('counts one author per local day across repos, deduping clones', async () => {
    const result = await collectCommitsByDay(discoverRepos(root), { since: '2026-09-29', until: '2026-09-30', author: 'Chris Sorensen' });
    assert.deepEqual(result.days['2026-09-29'], { count: 2, repos: { alpha: 1, beta: 1 } });
    assert.deepEqual(result.days['2026-09-30'], { count: 1, repos: { alpha: 1 } });
    assert.equal(result.total, 3);
  });

  test('excludes days outside the window', async () => {
    const result = await collectCommitsByDay(discoverRepos(root), { since: '2026-09-30', until: '2026-09-30', author: 'Chris Sorensen' });
    assert.deepEqual(Object.keys(result.days), ['2026-09-30']);
  });
});
