import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VaneResearchSkill } from '../src/index.mjs';
import { GPULock } from '../../../modules/wiki/vane-infra.mjs';

test('VaneResearchSkill enforces loopback security boundary', () => {
  // Allowed loopback addresses
  assert.doesNotThrow(() => new VaneResearchSkill({ baseUrl: 'http://127.0.0.1:3000' }));
  assert.doesNotThrow(() => new VaneResearchSkill({ baseUrl: 'http://localhost:3000' }));
  assert.doesNotThrow(() => new VaneResearchSkill({ baseUrl: 'http://[::1]:3000' }));

  // Prohibited external / non-loopback addresses
  assert.throws(
    () => new VaneResearchSkill({ baseUrl: 'http://192.168.1.1:3000' }),
    /SECURITY_BOUNDARY_VIOLATION/
  );
  assert.throws(
    () => new VaneResearchSkill({ baseUrl: 'http://0.0.0.0:3000' }),
    /SECURITY_BOUNDARY_VIOLATION/
  );
  assert.throws(
    () => new VaneResearchSkill({ baseUrl: 'http://example.com:3000' }),
    /SECURITY_BOUNDARY_VIOLATION/
  );
});

test('VaneResearchSkill validates input query', async () => {
  const skill = new VaneResearchSkill({ baseUrl: 'http://127.0.0.1:3000' });

  // Missing query
  const resEmpty = await skill.execute({});
  assert.equal(resEmpty.success, false);
  assert.equal(resEmpty.error.code, 'INVALID_INPUT');

  // Query too short (< 3 chars)
  const resShort = await skill.execute({ query: 'ab' });
  assert.equal(resShort.success, false);
  assert.equal(resShort.error.code, 'INVALID_INPUT');
});

test('VaneResearchSkill handles GPU concurrency saturation', async () => {
  const lockPath = path.join(os.tmpdir(), `test-vane-gpu-sat-${Date.now()}.lock`);
  const externalLock = new GPULock(lockPath);
  assert.equal(externalLock.acquire(), true);

  try {
    const skill = new VaneResearchSkill({
      baseUrl: 'http://127.0.0.1:3000',
      lockPath
    });
    const res = await skill.execute({ query: 'Concurrency test query' });
    assert.equal(res.success, false);
    assert.equal(res.error.code, 'VRAM_CONCURRENCY_SATURATED');
    assert.equal(res.error.fallback_recommended, true);
  } finally {
    externalLock.release();
  }
});

test('VaneResearchSkill executes with live schema against mock Vane server', async () => {
  let searchRequestBody = null;

  const server = http.createServer((req, res) => {
    if (req.url === '/api/providers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        providers: [
          {
            id: 'openai-prov',
            name: 'OpenAI',
            chatModels: [{ key: 'gpt-4o' }],
            embeddingModels: [{ key: 'text-embedding-3-small' }]
          },
          {
            id: 'ollama-prov',
            name: 'Ollama (Local)',
            chatModels: [{ key: 'llama3.1:latest' }],
            embeddingModels: [{ key: 'nomic-embed-text' }]
          }
        ]
      }));
    } else if (req.url === '/api/search' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        searchRequestBody = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Synthesized research answer for gap',
          sources: [
            {
              content: 'Primary evidence snippet detailing autonomous feedback loops.',
              metadata: { title: 'Ground Truth Source 1', url: 'http://127.0.0.1:3000/docs/1' }
            },
            {
              content: 'Secondary evidence snippet corroborating failure recovery.',
              metadata: { title: 'Ground Truth Source 2', url: 'http://127.0.0.1:3000/docs/2' }
            }
          ]
        }));
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  const testPort = 39401;
  await new Promise(resolve => server.listen(testPort, '127.0.0.1', resolve));

  const lockPath = path.join(os.tmpdir(), `test-vane-gpu-exec-${Date.now()}.lock`);

  try {
    const skill = new VaneResearchSkill({
      baseUrl: `http://127.0.0.1:${testPort}`,
      lockPath
    });

    const res = await skill.execute({
      query: 'Explain autonomous gap closing',
      mode: 'balanced',
      max_sources: 5
    });

    // Verify response structure
    assert.equal(res.success, true);
    assert.equal(res.type, 'READ_ONLY');
    assert.equal(res.data.query, 'Explain autonomous gap closing');
    assert.equal(res.data.answer, 'Synthesized research answer for gap');
    assert.equal(res.data.mode, 'balanced');
    assert.equal(res.data.sources.length, 2);
    assert.equal(res.data.sources[0].source_id, 'SRC-101');
    assert.equal(res.data.sources[0].title, 'Ground Truth Source 1');
    assert.match(res.data.content_hash, /^[a-f0-9]{64}$/);

    // Verify telemetry
    assert.ok(res.telemetry);
    assert.equal(typeof res.telemetry.duration_ms, 'number');
    assert.ok(res.telemetry.timestamp);
    assert.match(res.telemetry.worker_id, /^worker-vane-/);

    // Verify request payload matched live Vane schema and prioritized Ollama
    assert.ok(searchRequestBody);
    assert.equal(searchRequestBody.chatModel.providerId, 'ollama-prov');
    assert.equal(searchRequestBody.chatModel.key, 'llama3.1:latest');
    assert.equal(searchRequestBody.embeddingModel.providerId, 'ollama-prov');
    assert.equal(searchRequestBody.embeddingModel.key, 'nomic-embed-text');
    assert.equal(searchRequestBody.optimizationMode, 'balanced');
    assert.deepEqual(searchRequestBody.sources, ['web']);
    assert.equal(searchRequestBody.query, 'Explain autonomous gap closing');
    assert.deepEqual(searchRequestBody.history, []);
    assert.equal(searchRequestBody.stream, false);

    // Verify content hash determinism
    const hash1 = skill.computeContentHash(res.data.answer, res.data.sources);
    assert.equal(hash1, res.data.content_hash);
    // Reverse sources order - computeContentHash sorts by source_id so result should be identical
    const reversedSources = [...res.data.sources].reverse();
    const hash2 = skill.computeContentHash(res.data.answer, reversedSources);
    assert.equal(hash1, hash2);
  } finally {
    server.close();
    try { fs.unlinkSync(lockPath); } catch (_) {}
  }
});

test('VaneResearchSkill handles upstream connection errors gracefully', async () => {
  // Use a port where no server is listening
  const deadPort = 39499;
  const lockPath = path.join(os.tmpdir(), `test-vane-gpu-err-${Date.now()}.lock`);

  const skill = new VaneResearchSkill({
    baseUrl: `http://127.0.0.1:${deadPort}`,
    lockPath
  });

  const res = await skill.execute({ query: 'Testing network failure handling' });
  assert.equal(res.success, false);
  assert.equal(res.type, 'READ_ONLY');
  assert.ok(['VANE_SERVICE_UNAVAILABLE', 'UPSTREAM_SEARCH_ERROR'].includes(res.error.code));
  assert.equal(res.error.fallback_recommended, true);
  assert.ok(res.telemetry);
});
