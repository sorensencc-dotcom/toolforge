import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

function isRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

/**
 * The root (if it is a repo) plus every direct child directory that is a repo.
 * @param {string} root - Workspace directory, e.g. C:\dev.
 * @returns {string[]} Absolute repo paths.
 */
export function discoverRepos(root) {
  const children = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter(isRepo);
  return isRepo(root) ? [root, ...children] : children;
}

function localDay(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localMidnight(day, deltaDays = 0) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + deltaDays).toISOString();
}

async function readLog(repo, since, until, author) {
  try {
    const { stdout } = await run('git', ['-C', repo, 'log', '--all', `--since=${since}`, `--until=${until}`,
      `--author=${author}`, '--format=%H %ct'], { maxBuffer: 16 * 1024 * 1024 });
    return stdout.split('\n').filter(Boolean).map((line) => line.split(' '));
  } catch {
    return [];
  }
}

/**
 * Commits by one author per local day across repos, counting each commit hash once
 * (nested clones of the same origin share hashes).
 * @param {string[]} repos - Repo paths.
 * @param {{ since: string, until: string, author: string }} window - Inclusive local days, YYYY-MM-DD.
 * @returns {Promise<{ days: Record<string, { count: number, repos: Record<string, number> }>, total: number }>}
 */
export async function collectCommitsByDay(repos, { since, until, author }) {
  const start = localMidnight(since);
  const end = localMidnight(until, 1);
  const logs = await Promise.all(repos.map((repo) => readLog(repo, start, end, author)));

  const seen = new Set();
  const days = {};
  let total = 0;
  logs.forEach((entries, i) => {
    const name = path.basename(repos[i]);
    for (const [hash, committedAt] of entries) {
      const day = localDay(Number(committedAt));
      if (seen.has(hash) || day < since || day > until) continue;
      seen.add(hash);
      days[day] ??= { count: 0, repos: {} };
      days[day].count += 1;
      days[day].repos[name] = (days[day].repos[name] || 0) + 1;
      total += 1;
    }
  });
  return { days, total };
}
