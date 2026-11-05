import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toText, isResearchCard, formatMarkdownComment } from '../scripts/trm-post-promote-enricher.mjs';

test('toText renders objects as JSON, never [object Object]', () => {
  assert.equal(toText('abc'), 'abc');
  assert.equal(toText(null), '');
  assert.equal(toText({ a: 1 }), '{\n  "a": 1\n}');
  assert.ok(!toText({}).includes('[object Object]'));
});

test('isResearchCard flags research category and cic targets', () => {
  assert.equal(isResearchCard({ category: 'RESEARCH' }), true);
  assert.equal(isResearchCard({ target: 'cic' }), true);
  assert.equal(isResearchCard({ target: 'cic-kb' }), true);
  assert.equal(isResearchCard({ target: 'toolforge', category: 'FEATURE' }), false);
});

test('formatMarkdownComment stringifies object testStub, cliContract, and plan steps', () => {
  const md = formatMarkdownComment(
    { id: 'act-x', target: 'core' },
    [],
    [],
    [],
    {
      tier: 'LOCAL_SCAFFOLD',
      rationale: 'r',
      priorArtSummary: 'p',
      deltaPlan: [{ step: 'one' }, 'two'],
      cliContract: { cmd: 'x' },
      testStub: { name: 'contract', body: 'assert.ok(true)' }
    }
  );
  assert.ok(!md.includes('[object Object]'));
  assert.ok(md.includes('"body": "assert.ok(true)"'));
});
