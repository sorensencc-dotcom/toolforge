import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionPackItems, MAX_PACK_BYTES } from '../scripts/consolidate-pack.mjs';

test('partitionPackItems correctly splits 3 items of 200 KB into 3 distinct chunks under 380 KiB limit', () => {
  const dummyLargeContent = 'A'.repeat(200 * 1024);
  const items = [
    { relPath: 'doc1.md', content: dummyLargeContent, sha256: 'h1', frontmatter: {}, sourceType: 'md' },
    { relPath: 'doc2.md', content: dummyLargeContent, sha256: 'h2', frontmatter: {}, sourceType: 'md' },
    { relPath: 'doc3.md', content: dummyLargeContent, sha256: 'h3', frontmatter: {}, sourceType: 'md' }
  ];

  assert.equal(MAX_PACK_BYTES, 380 * 1024);
  assert.equal(partitionPackItems(items, MAX_PACK_BYTES).length, 3);
});

test('partitionPackItems throws fail-closed error if a single item exceeds MAX_PACK_BYTES', () => {
  const items = [{ relPath: 'oversized.md', content: 'A'.repeat(400 * 1024), sha256: 'h1', frontmatter: {}, sourceType: 'md' }];
  assert.throws(() => partitionPackItems(items, MAX_PACK_BYTES), /ITEM_EXCEEDS_BUDGET/);
});
