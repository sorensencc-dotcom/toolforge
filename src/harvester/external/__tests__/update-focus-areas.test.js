import test from 'node:test';
import assert from 'node:assert';
import { computeFocusAreas } from '../update-focus-areas.mjs';

test('computeFocusAreas groups by source_type and ranks by weighted confidence', () => {
  const researchQuestions = {
    topic: 'willow-run',
    generated: '2026-07-23T00:00:00Z',
    questions: [
      { id: 'q-0001', source_type: 'gap', fact_id: '78626', status: 'open' },
      { id: 'q-0002', source_type: 'low-confidence', fact_id: '76100', fact_confidence: 0.72, status: 'open' },
      { id: 'q-0003', source_type: 'low-confidence', fact_id: '76200', fact_confidence: 0.60, status: 'escalated' },
      { id: 'q-0004', source_type: 'curator-flagged', fact_id: '76500', status: 'closed' }
    ]
  };

  const result = computeFocusAreas(researchQuestions);

  assert.strictEqual(result.topic, 'willow-run');
  assert.ok(result.updated);

  const byTheme = Object.fromEntries(result.focus_areas.map(f => [f.theme, f]));

  assert.strictEqual(byTheme['Undocumented events (gap)'].open_question_count, 1);
  assert.strictEqual(byTheme['Low-confidence links'].open_question_count, 2);
  assert.strictEqual(byTheme['Low-confidence links'].priority, 'high');
  assert.strictEqual(byTheme['Undocumented events (gap)'].priority, 'medium');

  assert.strictEqual(byTheme['Curator-flagged items'], undefined);
});

test('computeFocusAreas returns an empty array, not omission, when nothing is open', () => {
  const researchQuestions = {
    topic: 'willow-run',
    generated: '2026-07-23T00:00:00Z',
    questions: [
      { id: 'q-0001', source_type: 'gap', fact_id: '78626', status: 'closed' }
    ]
  };

  const result = computeFocusAreas(researchQuestions);
  assert.deepStrictEqual(result.focus_areas, []);
});
