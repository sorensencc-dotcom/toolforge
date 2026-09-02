import assert from 'node:assert/strict';
import test from 'node:test';

import { validateInventory } from './validate-docs-publishing.mjs';

const valid = {
  version: 1,
  entries: [{
    id: 'home',
    source: 'docs/DOCS_INDEX.md',
    owner: 'docs-team',
    classification: 'public',
    mkdocs: 'index.md',
    wiki: 'Home.md',
    reviewIntervalDays: 90,
  }],
};

test('accepts a complete publication inventory', () => {
  assert.deepEqual(validateInventory(valid), []);
});

test('rejects missing source, owner, and invalid classification', () => {
  const errors = validateInventory({
    version: 1,
    entries: [{ id: 'broken', source: 'docs/missing.md', classification: 'secret' }],
  });
  assert.deepEqual(errors, [
    'entries[0].owner is required',
    'entries[0].classification must be public, internal, or archive',
    'entries[0].reviewIntervalDays must be a positive integer',
  ]);
});

test('rejects duplicate destinations', () => {
  const errors = validateInventory({
    version: 1,
    entries: [
      { ...valid.entries[0], id: 'one' },
      { ...valid.entries[0], id: 'two', source: 'docs/ROLLBACK_RUNBOOK.md' },
    ],
  });
  assert.deepEqual(errors, [
    'duplicate mkdocs destination: index.md',
    'duplicate wiki destination: Home.md',
  ]);
});
