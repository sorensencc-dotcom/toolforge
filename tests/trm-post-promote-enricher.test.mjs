import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toText, isResearchCard, formatMarkdownComment, persistEnrichmentToTaskDirs } from '../scripts/trm-post-promote-enricher.mjs';

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

test('persistEnrichmentToTaskDirs writes enrichment when card was moved to in-progress', () => {
  const tmpTasks = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-enricher-tasks-'));
  try {
    const inProgDir = path.join(tmpTasks, 'in-progress');
    fs.mkdirSync(inProgDir, { recursive: true });
    const cardFile = path.join(inProgDir, 'act-inprog-01.json');
    fs.writeFileSync(cardFile, JSON.stringify({ id: 'act-inprog-01', target: 'toolforge' }), 'utf8');

    const updated = persistEnrichmentToTaskDirs('act-inprog-01', {
      tier: 'LOCAL_SCAFFOLD',
      rationale: 'Persisted after batch triage move',
      deltaPlan: ['Step 1']
    }, tmpTasks);

    assert.equal(updated.length, 1);
    const saved = JSON.parse(fs.readFileSync(cardFile, 'utf8'));
    assert.equal(saved.enrichment.tier, 'LOCAL_SCAFFOLD');
    assert.deepEqual(saved.enrichment.deltaPlan, ['Step 1']);
  } finally {
    fs.rmSync(tmpTasks, { recursive: true, force: true });
  }
});
