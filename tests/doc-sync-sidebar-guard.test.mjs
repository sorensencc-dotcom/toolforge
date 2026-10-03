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

test('image and asset links pass when the file exists, fail when it does not', () => {
  const dir = tree({
    'Home.md': 'h',
    'assets/logo.png': 'png',
    '_Sidebar.md': '![logo](assets/logo.png)\n- [Diagram](arch.svg)\n![gone](missing.png)',
  });
  assert.deepEqual(findForeignSidebarLinks(dir), ['arch.svg', 'missing.png']);
});

test('spaces in a link target resolve to the hyphenated page, like GitHub wikis', () => {
  const dir = tree({
    'Page-Name.md': 'p',
    '_Sidebar.md': '- [[Page Name]]\n- [Text](Page%20Name)\n- [[Label|Page Name]]\n- [[No Such Page]]',
  });
  assert.deepEqual(findForeignSidebarLinks(dir), ['No Such Page']);
});
