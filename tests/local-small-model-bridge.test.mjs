import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOllamaEndpoint, PREFERRED_MODELS, isLoopbackHostname } from '../scripts/local-small-model-bridge.mjs';

test('local-small-model-bridge prioritizes validated local model and resolves loopback endpoint', () => {
  assert.equal(PREFERRED_MODELS[0], 'qwen2.5:7b');
  assert.equal(PREFERRED_MODELS[1], 'qwen2.5:3b');
  assert.equal(PREFERRED_MODELS[2], 'qwen2.5:1.5b');
  assert.ok(isLoopbackHostname('127.0.0.1'));
  assert.ok(isLoopbackHostname('localhost'));
  assert.ok(!isLoopbackHostname('example.com'));
  assert.ok(typeof resolveOllamaEndpoint(), 'string');
});
