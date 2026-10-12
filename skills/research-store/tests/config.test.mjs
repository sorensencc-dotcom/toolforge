import test from 'node:test';
import assert from 'node:assert/strict';
import { createReaderClient, createEmbeddingProvider } from '../src/config.mjs';
import { startFakeServices } from './fake-services.mjs';

const token = claims => ['header', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'signature'].join('.');

test('reader client requires authenticated unexpired JWT, never writer fallback', () => {
  const base = { SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_ANON_KEY: 'synthetic', SUPABASE_SERVICE_ROLE_KEY: 'unused' };
  assert.throws(() => createReaderClient(base), /SUPABASE_READER_JWT/);
  for (const claims of [
    { role: 'service_role', exp: Date.now() / 1000 + 300 },
    { role: 'authenticated', exp: Date.now() / 1000 - 1 },
    { role: 'authenticated' },
  ]) assert.throws(() => createReaderClient({ ...base, SUPABASE_READER_JWT: token(claims) }));
  assert.throws(() => createReaderClient({ ...base, SUPABASE_READER_JWT: 'malformed' }));
});

test('unsupported embedding configuration rejects before client/network setup', () => {
  for (const config of [{ EMBEDDING_DIMENSION: '384' }, { EMBEDDING_MODEL: 'other' }, { EMBEDDING_PROVIDER: 'local' }]) {
    assert.throws(() => createEmbeddingProvider(config), /Unsupported embedding configuration/);
  }
});

test('reader HTTP adapter preserves signed bearer token and rejects forged signatures', async () => {
  const fake = await startFakeServices();
  try {
    const signed = fake.sign('CIC');
    const valid = createReaderClient({ ...fake.env, SUPABASE_READER_JWT: signed });
    assert.equal((await valid.from('documents').select('*')).error, null);
    assert.equal(fake.state.requests.at(-1).authorization, `Bearer ${signed}`);
    const forged = signed.split('.').slice(0, 2).concat('forged').join('.');
    const invalid = createReaderClient({ ...fake.env, SUPABASE_READER_JWT: forged });
    const result = await invalid.from('documents').select('*');
    assert.ok(result.error);
    assert.equal(result.status, 401);
  } finally { await fake.close(); }
});

test('fake search contract ranks discriminating vectors and honors strict threshold', async () => {
  const fake = await startFakeServices();
  const vector = (first, second) => [first, second, ...Array(1534).fill(0)];
  try {
    fake.state.items = [
      { id: 'low', project: 'CIC', embedding: vector(0.6, 0.8) },
      { id: 'exact', project: 'CIC', embedding: vector(1, 0) },
      { id: 'near', project: 'CIC', embedding: vector(0.8, 0.6) },
    ];
    const reader = createReaderClient({ ...fake.env, SUPABASE_READER_JWT: fake.sign('CIC') });
    const params = { query_embedding: vector(1, 0), match_count: 3, match_threshold: 0.7 };
    const result = await reader.rpc('match_research_items', params);
    assert.equal(result.error, null);
    assert.deepEqual(result.data.map(row => row.id), ['exact', 'near']);
    assert.ok(Math.abs(result.data[1].similarity - 0.8) < 1e-6);
    assert.deepEqual((await reader.rpc('match_research_items', { ...params, match_threshold: 1 })).data, []);
  } finally { await fake.close(); }
});
