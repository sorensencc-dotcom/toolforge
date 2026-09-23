import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTargetNotebook, resolvePackFile } from '../notebooklm-uploader.js';

test('resolveTargetNotebook resolves registered category to notebook ID from canonical config', () => {
  assert.equal(resolveTargetNotebook(['--category=cuba-claims']), 'c8360946-dbee-4a2c-b622-7f89b05695b0');
});

test('resolveTargetNotebook throws fail-closed error on unknown category', () => {
  assert.throws(() => resolveTargetNotebook(['--category=unknown-nonexistent-category']), /CATEGORY_NOT_FOUND/);
});

test('resolvePackFile derives pack name from canonical category', () => {
  assert.match(resolvePackFile('c8360946-dbee-4a2c-b622-7f89b05695b0', []), /pack_cuba_claims\.txt$/);
});
