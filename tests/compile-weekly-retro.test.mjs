import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { summarizeBacklog } from '../scripts/backlog-summary.mjs';

test('compile-weekly-retro script exists and declares CLI flags', () => {
  const scriptPath = resolve('scripts/compile-weekly-retro.mjs');
  assert.equal(existsSync(scriptPath), true);
  const content = readFileSync(scriptPath, 'utf8');
  assert.match(content, /--dry-run/);
  assert.match(content, /--date/);
});

test('summarizeBacklog counts open items by priority and period from TODOS.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backlog-'));
  const file = join(dir, 'TODOS.md');
  writeFileSync(file, [
    '- [ ] **[P1] a** (created 2026-10-14) text',
    '- [ ] **[P2] b** (created 2026-09-01) text',
    '- [ ] **[P2] c** (created 2026-10-16) text',
    '- [x] **[P1] d** (resolved 2026-10-15) text',
    '- [x] **[P2] e** (resolved 2026-08-01) text',
    '| ⏳ `[ ]` | **P2** | table rows are not counted |'
  ].join('\n'));
  try {
    const got = summarizeBacklog(file, '2026-10-12', '2026-10-18');
    assert.deepEqual(got, { total_open: 3, p0_p1: 1, p2: 2, completed_this_period: 1, added_this_period: 2 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('summarizeBacklog reports null when TODOS.md is absent', () => {
  const got = summarizeBacklog(join(tmpdir(), 'no-such-dir', 'TODOS.md'), '2026-10-12', '2026-10-18');
  assert.deepEqual(got, { total_open: null, p0_p1: null, p2: null, completed_this_period: null, added_this_period: null });
});

test('compile script carries no hardcoded focus_score constant', () => {
  const content = readFileSync(resolve('scripts/compile-weekly-retro.mjs'), 'utf8');
  assert.doesNotMatch(content, /focus_score:\s*[0-9.]+/);
});
