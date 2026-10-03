import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/types.js';

test('DEFAULT_CONFIG exports valid rubric defaults', () => {
  assert.equal(DEFAULT_CONFIG.minBodyWordCount, 20);
  assert.ok(DEFAULT_CONFIG.knownDomains.includes('engine'));
  assert.ok(DEFAULT_CONFIG.knownDomains.includes('governance'));
  assert.equal(DEFAULT_CONFIG.urgencyKeywords.critical, 12);
  assert.equal(DEFAULT_CONFIG.urgencyKeywords.panic, 15);
  assert.equal(DEFAULT_CONFIG.urgencyKeywords.corrupt, 15);
  assert.ok(DEFAULT_CONFIG.overrideP0Keywords.includes('panic'));
  assert.ok(DEFAULT_CONFIG.overrideP0Keywords.includes('regression'));
  assert.equal(DEFAULT_CONFIG.scoreThresholds.p0, 80);
  assert.equal(DEFAULT_CONFIG.scoreThresholds.p1, 60);
  assert.equal(DEFAULT_CONFIG.scoreThresholds.p2, 35);
});
