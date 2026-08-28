import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { addFrontmatterTitle, copyRecursive, validateMarkdownImages } from './sync-github-wiki.mjs';

test('moves frontmatter title into a level-one heading and removes metadata', () => {
  const input = '---\ntitle: "A human page"\nlayout: wiki\n---\n\nBody';
  assert.equal(addFrontmatterTitle(input), '# A human page\n\nBody');
});

test('preserves an existing heading while removing frontmatter', () => {
  const input = '---\ntitle: A human page\n---\n\n# Existing heading\n\nBody';
  assert.equal(addFrontmatterTitle(input), '# Existing heading\n\nBody');
});

test('reports missing local markdown image targets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wiki-sync-test-'));
  try {
    await writeFile(path.join(root, 'Page.md'), '![missing](assets/missing.png)');
    assert.throws(() => validateMarkdownImages(root), /Page\.md -> assets[\\/]missing\.png/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('passes validation when local markdown image target exists', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wiki-sync-test-'));
  try {
    await mkdir(path.join(root, 'assets'), { recursive: true });
    await writeFile(path.join(root, 'assets', 'diagram.png'), 'fake-png-data');
    await writeFile(path.join(root, 'Page.md'), '![diagram](assets/diagram.png)');
    assert.doesNotThrow(() => validateMarkdownImages(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('copies supported wiki files and skips generated dependency trees', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wiki-sync-test-'));
  const destination = await mkdtemp(path.join(tmpdir(), 'wiki-sync-dest-'));
  try {
    await mkdir(path.join(root, 'nested'), { recursive: true });
    await mkdir(path.join(root, 'node_modules'), { recursive: true });
    await writeFile(path.join(root, 'nested', 'page.md'), '---\ntitle: Page\n---');
    await writeFile(path.join(root, 'nested', 'ignored.txt'), 'ignored');
    await writeFile(path.join(root, 'node_modules', 'ignored.md'), 'ignored');
    assert.equal(copyRecursive(root, destination), 1);
    assert.equal(await (await import('node:fs/promises')).readFile(path.join(destination, 'nested', 'page.md'), 'utf8'), '# Page\n\n');
    await assert.rejects((await import('node:fs/promises')).access(path.join(destination, 'node_modules', 'ignored.md')));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(destination, { recursive: true, force: true });
  }
});
