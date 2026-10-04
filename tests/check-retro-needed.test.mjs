import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/check-retro-needed.ps1');

function run(retroNames, date) {
  const dir = mkdtempSync(join(tmpdir(), 'retros-'));
  try {
    for (const name of retroNames) writeFileSync(join(dir, name), '{}');
    const result = spawnSync(
      'pwsh',
      ['-NoProfile', '-File', script, '-RetroDir', dir, '-Date', date],
      { encoding: 'utf8', timeout: 30000 },
    );
    return { status: result.status, out: result.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('warns when newest retro is at least 7 days old', () => {
  const { status, out } = run(['2026-09-27-1.json'], '2026-10-04');
  assert.equal(status, 0);
  assert.match(out, /WARN: newest retro 2026-09-27-1\.json is 7 days old/);
  assert.match(out, /PROCEED: no retro filed today yet/);
});

test('stays quiet when newest retro is fresh', () => {
  const { status, out } = run(['2026-10-03-1.json'], '2026-10-04');
  assert.equal(status, 0);
  assert.doesNotMatch(out, /WARN/);
});

test('picks the newest retro by date, not by name order', () => {
  const { out } = run(['2026-09-01-1.json', '2026-10-02-1.json', '2026-09-15-9.json'], '2026-10-04');
  assert.doesNotMatch(out, /WARN/);
});

test('counts the retro window in UTC regardless of local timezone', () => {
  // Uses the host timezone; the regression only reproduces when it is not UTC.
  const repo = mkdtempSync(join(tmpdir(), 'retro-repo-'));
  const retros = mkdtempSync(join(tmpdir(), 'retros-'));
  const env = { ...process.env };
  const git = (args, when) =>
    spawnSync('git', args, {
      cwd: repo,
      env: { ...env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
      encoding: 'utf8',
    });
  try {
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 't@example.com']);
    git(['config', 'user.name', 't']);
    git(['config', 'commit.gpgsign', 'false']);
    // 'pre' falls just before the UTC window start; a local-time read of
    // `since` pulls it in and inflates the count.
    git(['commit', '-q', '--allow-empty', '-m', 'pre'], '2026-09-27T21:00:00 +0000');
    git(['commit', '-q', '--allow-empty', '-m', 'a'], '2026-09-28T02:00:00 +0000');
    git(['commit', '-q', '--allow-empty', '-m', 'b'], '2026-09-29T12:00:00 +0000');
    writeFileSync(
      join(retros, '2026-10-04-1.json'),
      JSON.stringify({
        since: '2026-09-28T00:00:00Z',
        until: '2026-10-05T00:00:00Z',
        base_branch: 'main',
        metrics: { commits: 2 },
      }),
    );
    const result = spawnSync(
      'pwsh',
      ['-NoProfile', '-File', script, '-RetroDir', retros, '-Date', '2026-10-04'],
      { cwd: repo, env, encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /SKIP: no new commits/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(retros, { recursive: true, force: true });
  }
});
