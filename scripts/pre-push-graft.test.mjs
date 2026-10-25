import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const NODE_MODULES = [
  path.resolve(SCRIPTS, '..', 'node_modules'),
  path.resolve(SCRIPTS, '..', '..', '..', 'node_modules'),
].find((p) => fs.existsSync(p));

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const hasGraft = spawnSync('graft', ['--version'], { shell: true }).status === 0;

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graft-prepush-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, 'scripts'));
  for (const f of ['pre-push-graft.sh', 'run-sibling-check-v2.mjs', 'sibling-checker-v2.mjs']) {
    fs.copyFileSync(path.join(SCRIPTS, f), path.join(dir, 'scripts', f));
  }
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\ngraft\n');
  fs.symlinkSync(NODE_MODULES, path.join(dir, 'node_modules'), 'junction');
  fs.writeFileSync(path.join(dir, 'lib.mjs'), 'export function foo(a){return a}\n');
  fs.writeFileSync(path.join(dir, 'consumer.mjs'), 'import {foo} from "./lib.mjs"; export function use(){return foo(1)}\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  const base = git(dir, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(dir, 'lib.mjs'), 'export function foo(a,b){return a+b}\n');
  git(dir, 'commit', '-qam', 'change signature');
  execFileSync('graft', ['build'], { cwd: dir, shell: true, stdio: 'ignore' });
  return { dir, base };
}

function push(dir, base, env = {}) {
  const head = git(dir, 'rev-parse', 'HEAD');
  return spawnSync('bash', ['scripts/pre-push-graft.sh'], {
    cwd: dir,
    input: `refs/heads/main ${head} refs/heads/main ${base}\n`,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('blocks a push that changes an export without updating its consumer', { skip: !hasGraft }, () => {
  const { dir, base } = fixture();
  const res = push(dir, base);
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout, /consumer\.mjs/);
});

test('passes when the consumer changes in the same push', { skip: !hasGraft }, () => {
  const { dir, base } = fixture();
  fs.appendFileSync(path.join(dir, 'consumer.mjs'), '// updated\n');
  git(dir, 'commit', '-qam', 'update consumer');
  const res = push(dir, base);
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

test('checks every pushed ref, not only the first', { skip: !hasGraft }, () => {
  const { dir, base } = fixture();
  const head = git(dir, 'rev-parse', 'HEAD');
  const res = spawnSync('bash', ['scripts/pre-push-graft.sh'], {
    cwd: dir,
    input: `refs/heads/a ${base} refs/heads/a ${base}\nrefs/heads/main ${head} refs/heads/main ${base}\n`,
    encoding: 'utf8',
  });
  assert.equal(res.status, 1, res.stdout + res.stderr);
});
