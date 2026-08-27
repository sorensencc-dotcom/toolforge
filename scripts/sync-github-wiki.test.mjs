import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenRootPageImages } from './sync-github-wiki.mjs';

test('flattens repository-root wiki image targets on root pages', () => {
  assert.equal(
    flattenRootPageImages('![architecture](wiki/toolforge-architecture-overview.png)'),
    '![architecture](toolforge-architecture-overview.png)',
  );
});

test('does not rewrite links or external image targets', () => {
  const content = [
    '[page](wiki/other-page)',
    '![nested](wiki/assets/diagram.png)',
    '![external](https://example.test/wiki/image.png)',
    '![local](assets/image.png)',
  ].join('\n');
  assert.equal(flattenRootPageImages(content), [
    '[page](wiki/other-page)',
    '![nested](assets/diagram.png)',
    '![external](https://example.test/wiki/image.png)',
    '![local](assets/image.png)',
  ].join('\n'));
});
