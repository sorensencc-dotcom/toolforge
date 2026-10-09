import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODELS, FRONTIER_PRICING_BASELINE_V1 } from '../scripts/whichllm-router.mjs';

test('whichllm-router exports valid model tiers and pricing baseline', () => {
  assert.equal(typeof DEFAULT_MODELS, 'object');
  assert.ok(DEFAULT_MODELS.tier_0_local);
  assert.ok(DEFAULT_MODELS.tier_1_muscle);
  assert.ok(DEFAULT_MODELS.tier_2_frontier);
  assert.equal(FRONTIER_PRICING_BASELINE_V1.inputCostPer1M, 3.00);
});
