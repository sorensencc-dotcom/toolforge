import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { scanGaps } from '../scan-gaps.mjs';

function fixtureDecisions() {
  return {
    batch_id: 'willow-run-001',
    decisions: [
      { photo_id: '75904', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.92, verified: true },
      { photo_id: '76100', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.72, verified: true },
      { photo_id: '78626', decision: 'new-fact', topics: ['willow-run'], confidence: 0.55, verified: false },
      { photo_id: '76500', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.95, verified: true, flagged_for_research: true }
    ],
    attribution: { source: 'Michigan Flight Museum' }
  };
}

test('scanGaps classifies gap, low-confidence, and curator-flagged decisions', () => {
  const result = scanGaps(fixtureDecisions(), 'willow-run');

  assert.strictEqual(result.topic, 'willow-run');
  assert.ok(result.generated);
  assert.strictEqual(result.questions.length, 3);

  const bySourceType = Object.fromEntries(result.questions.map(q => [q.source_type, q]));

  assert.ok(bySourceType['gap']);
  assert.strictEqual(bySourceType['gap'].fact_id, '78626');
  assert.strictEqual(bySourceType['gap'].status, 'open');

  assert.ok(bySourceType['low-confidence']);
  assert.strictEqual(bySourceType['low-confidence'].fact_id, '76100');
  assert.strictEqual(bySourceType['low-confidence'].fact_confidence, 0.72);

  assert.ok(bySourceType['curator-flagged']);
  assert.strictEqual(bySourceType['curator-flagged'].fact_id, '76500');
});

test('scanGaps skips high-confidence unflagged links and rejects', () => {
  const decisions = {
    batch_id: 'willow-run-001',
    decisions: [
      { photo_id: '75904', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.92, verified: true },
      { photo_id: '76001', decision: 'reject', topics: [], confidence: 0.10, verified: false }
    ]
  };
  const result = scanGaps(decisions, 'willow-run');
  assert.strictEqual(result.questions.length, 0);
});

test('scanGaps produces a stable question_origin_hash for identical input', () => {
  const decisions = fixtureDecisions();
  const first = scanGaps(decisions, 'willow-run');
  const second = scanGaps(decisions, 'willow-run');
  assert.strictEqual(first.questions[0].question_origin_hash, second.questions[0].question_origin_hash);
});

test('scanGaps changes question_origin_hash when the underlying decision changes', () => {
  const decisions = fixtureDecisions();
  const before = scanGaps(decisions, 'willow-run');

  decisions.decisions[1].confidence = 0.60;
  const after = scanGaps(decisions, 'willow-run');

  const beforeHash = before.questions.find(q => q.fact_id === '76100').question_origin_hash;
  const afterHash = after.questions.find(q => q.fact_id === '76100').question_origin_hash;
  assert.notStrictEqual(beforeHash, afterHash);
});
