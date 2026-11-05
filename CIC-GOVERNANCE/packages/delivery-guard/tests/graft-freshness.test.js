import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const cliPath = process.env.TRAIL_CLI_JS;

test('real Trail CLI rejects missing and stale graphs and accepts rebuilt graphs', {
  skip: cliPath ? false : 'runs in graft-freshness CI after the pinned CLI installation',
  timeout: 240_000,
}, (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'graft-freshness-regression-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const git = spawnSync('git', ['init', fixture], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(git.status, 0, git.stderr);
  fs.writeFileSync(path.join(fixture, '.gitignore'), 'graft/\n');
  const source = path.join(fixture, 'answer.js');
  fs.writeFileSync(source, 'export function answer() { return 42; }\n');

  const run = (...args) => spawnSync(process.execPath, [cliPath, ...args, fixture], {
    cwd: fixture, encoding: 'utf8', timeout: 60_000,
  });
  const missing = run('build', '--check');
  assert.equal(missing.status, 1, missing.stdout + missing.stderr);
  assert.match(missing.stdout, /NO GRAPH/);
  const build = run('build');
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const fresh = run('build', '--check');
  assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
  assert.match(fresh.stdout, /graph check: OK/);

  fs.writeFileSync(source, 'export function answer() { return 43; }\n');
  const stale = run('build', '--check');
  assert.equal(stale.status, 1, stale.stdout + stale.stderr);
  assert.match(stale.stdout, /STALE/);
  const rebuild = run('build');
  assert.equal(rebuild.status, 0, rebuild.stdout + rebuild.stderr);
  const rebuilt = run('build', '--check');
  assert.equal(rebuilt.status, 0, rebuilt.stdout + rebuilt.stderr);
});
