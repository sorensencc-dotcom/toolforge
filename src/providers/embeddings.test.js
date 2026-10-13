import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalEmbeddingProvider } from './index.js';
import { startFakeServices, syntheticEmbedding } from '../../skills/research-store/tests/fake-services.mjs';

test('shared local embedding route needs no OpenAI key and pins Ollama model revision', async () => {
  const fake = await startFakeServices();
  try {
    const embed = createLocalEmbeddingProvider({ model: 'synthetic-embedding', baseUrl: fake.env.SUPABASE_URL });
    assert.deepEqual(await embed(['First.', 'Second.']), ['First.', 'Second.'].map(syntheticEmbedding));
    assert.match(embed.identity, /^ollama:synthetic-embedding@a{64}:1536$/);
    const requests = fake.state.requests.filter(request => request.path === '/api/embed');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].authorization, undefined);
    assert.equal(requests[0].input.truncate, false);
    fake.state.embeddingDigest = 'b'.repeat(64);
    await assert.rejects(embed(['Third.']), /embedding/i);
    assert.equal(fake.state.requests.filter(request => request.path === '/api/embed').length, 1);
  } finally { await fake.close(); }
});

test('shared embedding routing rejects cloud destinations, automatic models, and unsupported dimensions', () => {
  for (const baseUrl of ['https://api.openai.com/v1', 'http://127.attacker.example', 'ftp://localhost', 'http://key@localhost']) {
    assert.throws(() => createLocalEmbeddingProvider({ model: 'm', baseUrl }));
  }
  for (const config of [{ provider: 'openai', model: 'm' }, { model: 'freellm/auto' }, { model: 'm', dimensions: 384 }, { model: '' }]) {
    assert.throws(() => createLocalEmbeddingProvider(config));
  }
});

test('FreeLLM lane uses router credential and validates response identity without fallback', async () => {
  const fake = await startFakeServices();
  try {
    const embed = createLocalEmbeddingProvider({ provider: 'freellm', model: 'synthetic-embedding',
      baseUrl: `${fake.env.SUPABASE_URL}/v1`, apiKey: fake.env.FREELLM_API_KEY });
    assert.deepEqual(await embed(['First.']), [syntheticEmbedding('First.')]);
    assert.equal(embed.identity, 'freellm:synthetic-embedding:1536');
    assert.equal(fake.state.requests.at(-1).authorization, `Bearer ${fake.env.FREELLM_API_KEY}`);
    fake.state.embeddingEcho = 'wrong-model';
    await assert.rejects(embed(['Second.']), /embedding/i);
    fake.state.embeddingEcho = null;
    fake.state.embeddingFailure = true;
    const before = fake.state.requests.length;
    await assert.rejects(embed(['Third.']), /embedding/i);
    assert.equal(fake.state.requests.length, before + 1, 'failure must not retry or select another provider');
  } finally { await fake.close(); }
});

test('local embedding transport refuses redirects and wrong vector dimensions', async () => {
  const fake = await startFakeServices();
  try {
    const embed = createLocalEmbeddingProvider({ model: 'synthetic-embedding', baseUrl: fake.env.SUPABASE_URL });
    fake.state.embeddingDimensions = 384;
    await assert.rejects(embed(['First.']), /embedding/i);
    fake.state.embeddingDimensions = 1536;
    fake.state.embeddingRedirect = true;
    await assert.rejects(embed(['Second.']), /embedding/i);
  } finally { await fake.close(); }
});
