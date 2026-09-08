import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModelSelection, validateProviderEcho } from './model-selection.js';
import OllamaProvider from './ollama-provider.js';

test('loads the ratified local-only Ollama selection', () => {
  const selection = loadModelSelection();
  assert.deepEqual({ provider: selection.provider, model: selection.model, routing: selection.routing_state }, { provider: 'ollama', model: 'llama3.1:8b', routing: 'local-only' });
  assert.equal(selection.cloud_routing_enabled, false);
});

test('echo mismatch fails closed with receipt and TRM event', () => {
  assert.throws(() => validateProviderEcho({ requestedProvider: 'ollama', requestedModel: 'm', echoedProvider: 'openai', echoedModel: 'm' }), (error) => error.receipt.retry === false && error.receipt.fallback === false && error.trmEvent.event_type === 'trm_provider_validation_failed' && error.receipt.event_type === 'provider_echo_mismatch');
});

test('validated execution rejects cloud requests without retry or fallback', async () => {
  const provider = new OllamaProvider({ selection: loadModelSelection() });
  await assert.rejects(provider.execute({ provider: 'openai', model: 'cloud-model', prompt: 'x' }), (error) => error.receipt.retry === false && error.receipt.fallback === false);
});

test('echoed model mismatch emits a TRM validation event', async () => {
  const selection = loadModelSelection();
  const provider = new OllamaProvider({ selection });
  provider.generate = async () => ({ provider: 'ollama', model: 'wrong-model', content: 'x' });
  const events = [];
  await assert.rejects(provider.execute({ prompt: 'x', onEvent: (event) => events.push(event) }), /PROVIDER_ECHO_MISMATCH/);
  assert.equal(events[0].event_type, 'trm_provider_validation_failed');
});
