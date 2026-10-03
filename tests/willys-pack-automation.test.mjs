import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const CUBA = { filename: 'pack_cuba_claims.txt', category: 'cuba-claims' };
const WILLYS = { filename: 'pack_willys_overland.txt', category: 'willys-overland' };
const WILLYS_NOTEBOOK_ID = 'fd4ebe29-9440-4f4b-97cf-0184ffbe29a0';

function readRepo(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function packEntries(source) {
  const entries = [];
  const pattern = /filename:\s*'([^']+)'[\s\S]*?category:\s*'([^']+)'/g;
  for (const match of source.matchAll(pattern)) {
    entries.push({ filename: match[1], category: match[2] });
  }
  return entries;
}

function assertWillysBesideCuba(entries, label) {
  const cuba = entries.find((entry) => entry.filename === CUBA.filename && entry.category === CUBA.category);
  const willys = entries.find((entry) => entry.filename === WILLYS.filename && entry.category === WILLYS.category);
  assert.ok(cuba, `${label} must keep ${CUBA.filename} / ${CUBA.category}`);
  assert.ok(willys, `${label} must recognize ${WILLYS.filename} / ${WILLYS.category} the same way as ${CUBA.filename}`);
}

test('closed-loop research lists pack_willys_overland beside pack_cuba_claims', () => {
  const source = readRepo('scripts/run-closed-loop-research.mjs');
  assert.match(source, /const packs = \[/);
  assertWillysBesideCuba(packEntries(source), 'run-closed-loop-research.mjs');
});

test('closed-loop research v2 lists pack_willys_overland beside pack_cuba_claims', () => {
  const source = readRepo('scripts/run-closed-loop-research-v2.mjs');
  assert.match(source, /const packDefs = \[/);
  assertWillysBesideCuba(packEntries(source), 'run-closed-loop-research-v2.mjs');
});

test('consolidate-pack names pack_willys_overland the same way as the cuba pack', () => {
  const source = readRepo('scripts/consolidate-pack.mjs');
  assert.match(source, /\.nlm_pack\/pack_cuban_seizures\.txt/);
  assert.match(source, /\.nlm_pack\/pack_willys_overland\.txt\s+\(Target: CIC - Willys-Overland\)/);
});

test('Willys notebook is registered beside the closed-loop pack name', () => {
  const registry = JSON.parse(readRepo('notebooklm-registry.json'));
  const notebook = registry.notebooks.find((entry) => entry.notebook_id === WILLYS_NOTEBOOK_ID);
  assert.ok(notebook, `registry must include notebook ${WILLYS_NOTEBOOK_ID}`);
  assert.equal(notebook.title, 'CIC - Willys-Overland');
});
