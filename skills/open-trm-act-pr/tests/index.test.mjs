import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, branchName, commitSubject, prBody } from '../src/index.mjs';

test('branchName prefixes the issue once', () => {
  assert.equal(branchName('Link Scrubber Resilience', 218), 'trm/act-218-link-scrubber-resilience');
  assert.equal(branchName('218-link-scrubber', 218), 'trm/act-218-link-scrubber');
  assert.equal(branchName('toolforge ci fix'), 'trm/act-toolforge-ci-fix');
  assert.throws(() => branchName('!!!'), /slug/);
});

test('slugify trims separators', () => {
  assert.equal(slugify('  A__B  '), 'a-b');
});

test('commitSubject appends the closing keyword', () => {
  assert.equal(
    commitSubject({ type: 'chore', scope: 'icf', summary: 'add bridge tests', issue: 215 }),
    'chore(icf): add bridge tests (closes #215)',
  );
  assert.equal(commitSubject({ type: 'test', summary: 'cover x' }), 'test: cover x');
});

test('prBody emits the five sections in order and rejects blanks', () => {
  const body = prBody({ why: 'w', scope: ['a', 'b'], tradeoffs: 't', blastRadius: 'r', tests: 'timeout 60 npm test: pass' });
  const order = ['## Why', '## Scope', '## Tradeoffs', '## Blast Radius', '## Tests'].map((h) => body.indexOf(h));
  assert.deepEqual(order, [...order].sort((x, y) => x - y));
  assert.ok(order.every((i) => i >= 0));
  assert.throws(() => prBody({ why: 'w' }), /tradeoffs/);
});
