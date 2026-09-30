import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// morning-ingest.mjs rewrites these on every run with live machine state
// (worktree paths, branches, dirty counts). They must never be published.
const ARTIFACTS = ['.icf-telemetry-latest.json', '.icf-telemetry.prom'];

function git(...args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

for (const artifact of ARTIFACTS) {
  test(`${artifact} is gitignored`, () => {
    assert.doesNotThrow(() => git('check-ignore', '--no-index', '-q', artifact), `${artifact} is not matched by .gitignore`);
  });

  test(`${artifact} is not tracked`, () => {
    assert.equal(git('ls-files', '--', artifact).trim(), '', `${artifact} is still in the index`);
  });
}
