import assert from 'node:assert/strict';
import test from 'node:test';
import { wikiPushRequested } from '../scripts/sync-github-wiki.mjs';

test('wiki publish does not push unless asked', () => {
  assert.equal(wikiPushRequested([]), false);
  assert.equal(wikiPushRequested(['--build-only', 'out']), false);
  assert.equal(wikiPushRequested(['--push']), true);
  assert.equal(wikiPushRequested([], { AUTO_PUSH: 'true' }), true);
  assert.equal(wikiPushRequested([], { AUTO_PUSH: 'false' }), false);
});
