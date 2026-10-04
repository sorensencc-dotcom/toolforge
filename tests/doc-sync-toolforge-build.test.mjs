import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findForeignSidebarLinks } from '../scripts/doc-sync/sidebar-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function build() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'toolforge-wiki-build-'));
  execFileSync(process.execPath, ['scripts/sync-github-wiki.mjs', '--build-only', out], { cwd: root, stdio: 'pipe' });
  return out;
}

test('toolforge wiki build links only to pages it publishes', () => {
  const out = build();
  try {
    assert.deepEqual(findForeignSidebarLinks(out), []);

    const home = fs.readFileSync(path.join(out, 'Home.md'), 'utf8');
    const dead = [...home.matchAll(/\]\(([^)#\s]+)/g)]
      .map((m) => m[1])
      .filter((target) => !/^(?:https?:|mailto:)/i.test(target))
      .filter((target) => !fs.existsSync(path.join(out, target)));
    assert.deepEqual(dead, []);
    assert.equal(fs.existsSync(path.join(out, 'wiki')), false);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
