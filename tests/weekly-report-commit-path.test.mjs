import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = readFileSync(resolve('scripts/weekly-report-agent.ps1'), 'utf8');
const start = script.indexOf('function Commit-WeeklyReport');
const end = script.indexOf('# ====', start);
const fn = script.slice(start, end);

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

test('Commit-WeeklyReport commits only the report, not other staged files', () => {
  assert.notEqual(start, -1, 'Commit-WeeklyReport missing');
  const repo = mkdtempSync(join(tmpdir(), 'weekly-report-'));
  try {
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 't@example.com');
    git(repo, 'config', 'user.name', 'T');
    git(repo, 'config', 'commit.gpgsign', 'false');
    writeFileSync(join(repo, 'seed.txt'), 'seed');
    git(repo, 'add', 'seed.txt');
    git(repo, 'commit', '-q', '-m', 'seed');

    writeFileSync(join(repo, 'unrelated.txt'), 'staged by someone else');
    git(repo, 'add', 'unrelated.txt');

    mkdirSync(join(repo, 'docs', 'reports', 'weekly'), { recursive: true });
    const reportPath = join(repo, 'docs', 'reports', 'weekly', '2026-W41.md');
    const driver = `${fn}\nCommit-WeeklyReport -repoRoot '${repo}' -reportPath '${reportPath}' -reportContent 'body' -reportWeek '2026-W41' | Out-Null`;
    execFileSync('pwsh', ['-NoProfile', '-Command', driver], { encoding: 'utf8' });

    const files = git(repo, 'show', '--name-only', '--pretty=format:', 'HEAD').trim().split(/\r?\n/);
    assert.deepEqual(files, ['docs/reports/weekly/2026-W41.md']);
    assert.match(git(repo, 'status', '--short'), /^A\s+unrelated\.txt/m);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
