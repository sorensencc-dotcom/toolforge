// tests/doc-sync-sidebar-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findForeignSidebarLinks } from '../scripts/doc-sync/sidebar-guard.mjs';

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidebar-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

test('no sidebar means no findings', () => {
  assert.deepEqual(findForeignSidebarLinks(tree({ 'Home.md': 'h' })), []);
});

test('flags wiki links and markdown links with no matching page', () => {
  const dir = tree({
    'Home.md': 'h',
    'docs/Architecture.md': 'a',
    '_Sidebar.md': [
      '- [[Home]]',
      '- [Arch](Architecture)',
      '- [[KB-Sync-Pipeline]]',
      '- [Foreign](TRM-Ingest.md)',
      '- [Ext](https://example.com/x)',
      '- [Anchor](#top)',
    ].join('\n'),
  });
  assert.deepEqual(findForeignSidebarLinks(dir), ['KB-Sync-Pipeline', 'TRM-Ingest']);
});

test('wiki link with a label uses the page part', () => {
  const dir = tree({ 'Real-Page.md': 'r', '_Sidebar.md': '- [[Label|Real-Page]]\n- [[Other|Missing-Page]]' });
  assert.deepEqual(findForeignSidebarLinks(dir), ['Missing-Page']);
});
