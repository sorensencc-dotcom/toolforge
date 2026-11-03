import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_ROOT, normalizeCard, classifyCardLane, getPendingCards, processBatchTriage } from '../scripts/trm-batch-triage.mjs';

test('scripts/trm-batch-triage.mjs exports expected functions and parses without error', () => {
  assert.ok(DEV_ROOT, 'DEV_ROOT should be exported');
  assert.equal(typeof normalizeCard, 'function', 'normalizeCard should be a function');
  assert.equal(typeof classifyCardLane, 'function', 'classifyCardLane should be a function');
  assert.equal(typeof getPendingCards, 'function', 'getPendingCards should be a function');
  assert.equal(typeof processBatchTriage, 'function', 'processBatchTriage should be a function');

  // Test classifyCardLane logic
  const spikeCard = { category: 'RESEARCH', title: 'Investigate memory footprint' };
  assert.equal(classifyCardLane(spikeCard), 'LANE_A_SPIKE', 'RESEARCH category should classify as LANE_A_SPIKE');

  const cicResearchCard = { target: 'cic', category: 'RESEARCH', direction: 'IMPLEMENT', title: 'Archival research audit' };
  assert.equal(classifyCardLane(cicResearchCard), 'LANE_A_SPIKE', 'target: cic should classify as LANE_A_SPIKE even with direction: IMPLEMENT');

  const cicKbCard = { target: 'cic-kb', direction: 'REFACTOR', title: 'Knowledge base audit' };
  assert.equal(classifyCardLane(cicKbCard), 'LANE_A_SPIKE', 'target: cic-kb should classify as LANE_A_SPIKE');

  const codingCard = { target: 'toolforge', category: 'IMPLEMENT', direction: 'FEATURE', title: 'Implement adapter' };
  assert.equal(classifyCardLane(codingCard), 'LANE_B_CODING', 'IMPLEMENT category on toolforge should classify as LANE_B_CODING');
});
