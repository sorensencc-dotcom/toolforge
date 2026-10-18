import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IDENTITY = { GIT_AUTHOR_NAME: 'Hooks Test', GIT_AUTHOR_EMAIL: 'hooks-test@example.com', GIT_COMMITTER_NAME: 'Hooks Test', GIT_COMMITTER_EMAIL: 'hooks-test@example.com' };

function git(args, cwd) {
  const env = { ...process.env, ...IDENTITY };
  for (const key of Object.keys(env)) if (key === 'GIT_DIR' || key === 'GIT_WORK_TREE' || key === 'GIT_INDEX_FILE') delete env[key];
  return execFileSync('git', args, { cwd, encoding: 'utf8', env }).trim();
}

function indexEntries(cwd, dir = '.githooks') {
  return git(['ls-files', '-s', '--', dir], cwd).split(/\r?\n/).filter(Boolean).map((line) => {
    const [meta, file] = line.split('\t');
    return { mode: meta.split(' ')[0], file };
  });
}

test('every tracked file in .githooks is mode 100755 (git on Linux/macOS ignores non-executable hooks)', () => {
  const entries = indexEntries(REPO);
  assert.ok(entries.length >= 6, `expected the six hook files, found ${entries.length}`);
  for (const { mode, file } of entries) assert.equal(mode, '100755', `${file} must be 100755 in git ls-files -s`);
  const tracked = new Set(entries.map((e) => path.basename(e.file)));
  for (const name of fs.readdirSync(path.join(REPO, '.githooks'))) {
    assert.ok(tracked.has(name), `.githooks/${name} exists on disk but is not tracked`);
  }
});

function hasPwsh() {
  return spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' }).status === 0;
}

test('setup-git-hooks.ps1 Install is idempotent: no diff on a clean checkout, modes kept, config set only in the target repo', { skip: !hasPwsh() && 'pwsh not available' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-installer-'));
  try {
    git(['init', '-q', '-b', 'main'], tmp);
    fs.cpSync(path.join(REPO, '.githooks'), path.join(tmp, '.githooks'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'CIC-GOVERNANCE', 'scripts'), { recursive: true });
    fs.copyFileSync(path.join(REPO, 'CIC-GOVERNANCE', 'scripts', 'pre-commit-shim.sh'), path.join(tmp, 'CIC-GOVERNANCE', 'scripts', 'pre-commit-shim.sh'));
    fs.copyFileSync(path.join(REPO, 'setup-git-hooks.ps1'), path.join(tmp, 'setup-git-hooks.ps1'));
    fs.writeFileSync(path.join(tmp, '.gitignore'), 'logs/\n');
    git(['config', 'core.autocrlf', 'false'], tmp);
    git(['add', '--', '.'], tmp);
    git(['update-index', '--chmod=+x', '--', ...indexEntries(tmp).map((e) => e.file)], tmp);
    git(['commit', '-q', '-m', 'clean checkout'], tmp);
    assert.equal(git(['status', '--porcelain'], tmp), '');

    const install = () => spawnSync('pwsh', ['-NoProfile', '-File', path.join(tmp, 'setup-git-hooks.ps1'), '-Action', 'Install', '-Repo', tmp], { encoding: 'utf8', cwd: os.tmpdir() });
    for (const run of [1, 2]) {
      const res = install();
      assert.equal(res.status, 0, `install run ${run} failed:\n${res.stdout}\n${res.stderr}`);
      assert.equal(git(['status', '--porcelain'], tmp), '', `install run ${run} must not modify tracked hook files:\n${git(['diff'], tmp)}`);
    }
    for (const { mode, file } of indexEntries(tmp)) assert.equal(mode, '100755', `${file} lost its executable bit`);
    assert.equal(git(['config', '--local', 'core.hooksPath'], tmp), '.githooks');
    // Run from os.tmpdir() (not a repo), so nothing here could have written to another repo's config.
    for (const { file } of indexEntries(tmp)) {
      assert.ok(!fs.readFileSync(path.join(tmp, file), 'utf8').includes('\r'), `${file} must use LF line endings`);
    }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* leave temp dir */ }
  }
});