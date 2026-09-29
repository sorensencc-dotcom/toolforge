/**
 * scripts/whichllm-router.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { routeTask } from './whichllm-router.mjs';

const TEST_ANCHORS = {
  frontier: 'claude-3-5-sonnet-20241022',
  local: 'qwen2.5:7b',
};

test('Fast-path routes simple tasks to Tier 2 Muscle', async () => {
  const result = await routeTask('format json output in utils.js', { modelAnchors: TEST_ANCHORS });
  assert.equal(result.tier, 'Tier 2 (Muscle)');
  assert.equal(result.targetModel, TEST_ANCHORS.local);
});

test('Fast-path routes architecture tasks to Tier 1 Judgment', async () => {
  const result = await routeTask('system design for multi-agent consensus', { modelAnchors: TEST_ANCHORS });
  assert.equal(result.tier, 'Tier 1 (Judgment)');
  assert.equal(result.targetModel, TEST_ANCHORS.frontier);
});

test('Jev Choice routes moderate task to Tier 2 Muscle when classified with confidence', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        routing_tier: {
          choice: 'TIER_2_MUSCLE',
          confidence: 0.88,
        },
      },
    }),
  });

  const result = await routeTask('Add unit test verifying user input validation in form.js', {
    fetchImpl: mockFetch,
    modelAnchors: TEST_ANCHORS,
  });

  assert.equal(result.tier, 'Tier 2 (Muscle)');
  assert.equal(result.targetModel, TEST_ANCHORS.local);
  assert.equal(result.confidence, 0.88);
});

test('Jev Choice escalates to Tier 1 Judgment when confidence is low', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        routing_tier: {
          choice: 'TIER_2_MUSCLE',
          confidence: 0.52, // Below 0.65 threshold
        },
      },
    }),
  });

  const result = await routeTask('Evaluate potential race conditions in order processing', {
    fetchImpl: mockFetch,
    modelAnchors: TEST_ANCHORS,
  });

  assert.equal(result.tier, 'Tier 1 (Judgment)');
  assert.equal(result.targetModel, TEST_ANCHORS.frontier);
});

test('Fail-safe escalates to Tier 1 Judgment when local Jev is offline', async () => {
  const mockFetchFail = async () => {
    throw new Error('ECONNREFUSED');
  };

  const result = await routeTask('Complex unknown task specification', {
    fetchImpl: mockFetchFail,
    modelAnchors: TEST_ANCHORS,
  });

  assert.equal(result.tier, 'Tier 1 (Judgment)');
  assert.equal(result.targetModel, TEST_ANCHORS.frontier);
});
