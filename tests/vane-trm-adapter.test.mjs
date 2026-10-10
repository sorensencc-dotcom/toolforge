import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VaneTRMFallbackAdapter } from '../modules/wiki/vane-trm-fallback-adapter.mjs';
import { CircuitBreaker } from '../modules/wiki/vane-infra.mjs';
import { validateTrmPayloadSemantics } from '../modules/wiki/validate-trm-semantics.mjs';

function startMockVaneServer(port, options = {}) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (req.url === '/api/providers') {
        if (options.providersStatus) {
          res.writeHead(options.providersStatus);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          providers: options.providers || [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              name: 'Ollama',
              chatModels: [{ key: 'llama3.1:latest', name: 'Llama 3.1' }],
              embeddingModels: [{ key: 'nomic-embed-text', name: 'Nomic Embed' }]
            }
          ]
        }));
      } else if (req.url === '/api/search') {
        if (options.delayMs) {
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              message: 'Delayed answer',
              sources: []
            }));
          }, options.delayMs);
          return;
        }

        if (options.searchStatus) {
          res.writeHead(options.searchStatus);
          res.end(options.searchBody || '');
          return;
        }

        const parsed = JSON.parse(body || '{}');
        assert.ok(parsed.chatModel?.providerId);
        assert.ok(parsed.embeddingModel?.providerId);
        assert.deepEqual(parsed.sources, ['web']);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Vane synthesized grounded response regarding research topic.',
          sources: [
            {
              content: 'Full document snippet content retrieved by SearXNG search engine.',
              metadata: {
                title: 'Canonical TRM Architecture Paper',
                url: 'http://127.0.0.1:3000/doc/1'
              }
            },
            {
              content: 'Secondary source content detailing local loopback boundaries.',
              metadata: {
                title: 'Loopback Boundary Specification',
                url: 'http://127.0.0.1:3000/doc/2'
              }
            }
          ]
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

test('VaneTRMFallbackAdapter Suite', async (t) => {
  await t.test('1. Unapproved calls throw approval error and write zero files', async () => {
    const port = 39401;
    const server = await startMockVaneServer(port);
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-vane-unappr-'));

    try {
      const adapter = new VaneTRMFallbackAdapter({ baseUrl: `http://127.0.0.1:${port}`, stagingRoot });

      // Explicit approved: false
      await assert.rejects(
        () => adapter.resolveGapWithVane('query unapproved', { approved: false, batchId: 'batch-unappr-1' }),
        /approved/
      );
      assert.ok(!fs.existsSync(path.join(stagingRoot, 'trm', 'batch-unappr-1')), 'Zero files written for approved: false');

      // Omitted approved (defaults to false)
      await assert.rejects(
        () => adapter.resolveGapWithVane('query unapproved default', { batchId: 'batch-unappr-2' }),
        /approved/
      );
      assert.ok(!fs.existsSync(path.join(stagingRoot, 'trm', 'batch-unappr-2')), 'Zero files written when approved is omitted');
    } finally {
      server.close();
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
  });

  await t.test('2. Approved calls materialize source stubs, payload.json, sources.manifest.json and pass semantic validation', async () => {
    const port = 39402;
    const server = await startMockVaneServer(port);
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-vane-appr-'));

    try {
      const adapter = new VaneTRMFallbackAdapter({ baseUrl: `http://127.0.0.1:${port}`, stagingRoot });
      const batchId = 'batch-approved-test';

      const res = await adapter.resolveGapWithVane('trm architecture gap', { approved: true, batchId });
      assert.equal(res.ok, true);
      assert.equal(res.batch_id, batchId);
      assert.equal(res.mappings.length, 2);

      const batchDir = path.join(stagingRoot, 'trm', batchId);
      const sourcesDir = path.join(batchDir, 'sources');

      // Verify files exist on disk
      assert.ok(fs.existsSync(path.join(sourcesDir, 'src-101.md')), 'Source stub src-101.md must exist');
      assert.ok(fs.existsSync(path.join(sourcesDir, 'src-102.md')), 'Source stub src-102.md must exist');
      assert.ok(fs.existsSync(path.join(batchDir, 'payload.json')), 'payload.json must exist');
      assert.ok(fs.existsSync(path.join(batchDir, 'sources.manifest.json')), 'sources.manifest.json must exist');
      assert.ok(fs.existsSync(path.join(batchDir, 'FILES.manifest.txt')), 'FILES.manifest.txt must exist');

      // Verify source contents contain metadata and text
      const src101Content = fs.readFileSync(path.join(sourcesDir, 'src-101.md'), 'utf8');
      assert.ok(src101Content.includes('Canonical TRM Architecture Paper'));
      assert.ok(src101Content.includes('Full document snippet content retrieved by SearXNG search engine.'));

      // Semantic validation pass
      const validation = await validateTrmPayloadSemantics(batchDir, res.payload, res.manifest);
      assert.equal(validation.valid, true, `Semantic validation failed: ${JSON.stringify(validation.errors)}`);
      assert.equal(validation.errors.length, 0);
    } finally {
      server.close();
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
  });

  await t.test('3. Dynamic provider discovery prioritizes Ollama over other providers', async () => {
    const port = 39403;
    const customProviders = [
      {
        id: 'openai-prov-id',
        name: 'OpenAI Remote Mock',
        chatModels: [{ key: 'gpt-4o' }],
        embeddingModels: [{ key: 'text-embedding-3-small' }]
      },
      {
        id: 'ollama-prov-id',
        name: 'Local Ollama Instance',
        chatModels: [{ key: 'qwen2.5:7b' }],
        embeddingModels: [{ key: 'nomic-embed-text' }]
      }
    ];

    let capturedSearchBody = null;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        if (req.url === '/api/providers') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ providers: customProviders }));
        } else if (req.url === '/api/search') {
          capturedSearchBody = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Answer from prioritized provider',
            sources: []
          }));
        }
      });
    });

    await new Promise(r => server.listen(port, '127.0.0.1', r));
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-vane-ollama-'));

    try {
      const adapter = new VaneTRMFallbackAdapter({ baseUrl: `http://127.0.0.1:${port}`, stagingRoot });
      const res = await adapter.resolveGapWithVane('prioritize provider query', { approved: true });
      assert.equal(res.ok, true);

      // Verify that Ollama provider was prioritized over OpenAI provider
      assert.equal(capturedSearchBody.chatModel.providerId, 'ollama-prov-id');
      assert.equal(capturedSearchBody.chatModel.key, 'qwen2.5:7b');
      assert.equal(capturedSearchBody.embeddingModel.providerId, 'ollama-prov-id');
      assert.equal(capturedSearchBody.embeddingModel.key, 'nomic-embed-text');
    } finally {
      server.close();
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
  });

  await t.test('4. CircuitBreaker error isolation: transport failures trip breaker; contract errors throw immediately', async () => {
    const port = 39404;
    // Server returns HTTP 503 Service Unavailable (transport failure)
    const server = await startMockVaneServer(port, { searchStatus: 503, searchBody: 'Search backend down' });
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-vane-breaker-'));

    try {
      const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
      const adapter = new VaneTRMFallbackAdapter({ baseUrl: `http://127.0.0.1:${port}`, stagingRoot, breaker });

      // Call 1: Transport failure (HTTP 503) returns circuit-break fallback and increments failure count
      const res1 = await adapter.resolveGapWithVane('query 1', { approved: true });
      assert.equal(res1.ok, false);
      assert.equal(res1.source, 'vane-fallback-circuit-break');
      assert.equal(breaker.failureCount, 1);
      assert.equal(breaker.state, 'CLOSED');

      // Contract error: Bad empty query should throw immediately and NOT increment transport failure count
      await assert.rejects(
        () => adapter.resolveGapWithVane('', { approved: true }),
        /CONTRACT_ERROR/
      );
      assert.equal(breaker.failureCount, 1, 'Contract error must NOT increment transport failure count');

      // Call 2: Second transport failure trips breaker to OPEN
      const res2 = await adapter.resolveGapWithVane('query 2', { approved: true });
      assert.equal(res2.ok, false);
      assert.equal(breaker.failureCount, 2);
      assert.equal(breaker.state, 'OPEN');

      // Call 3: Fast-fail via OPEN circuit breaker without attempting network
      const res3 = await adapter.resolveGapWithVane('query 3', { approved: true });
      assert.equal(res3.ok, false);
      assert.match(res3.error, /CIRCUIT_BREAKER_OPEN/);
      assert.equal(res3.fallback_recommended, true);
    } finally {
      server.close();
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
  });

  await t.test('5. Abort timeout terminates hanging requests and trips breaker', async () => {
    const port = 39405;
    // Server delays search response for 500ms
    const server = await startMockVaneServer(port, { delayMs: 500 });
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-vane-timeout-'));

    try {
      const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
      const adapter = new VaneTRMFallbackAdapter({
        baseUrl: `http://127.0.0.1:${port}`,
        stagingRoot,
        timeoutMs: 50, // Short 50ms timeout
        breaker
      });

      const res = await adapter.resolveGapWithVane('timeout query', { approved: true });
      assert.equal(res.ok, false);
      assert.equal(res.source, 'vane-fallback-circuit-break');
      assert.equal(breaker.failureCount, 1, 'Abort timeout must count as transport failure');
    } finally {
      server.close();
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
  });

  await t.test('6. Loopback security boundary rejects external endpoints', () => {
    assert.throws(
      () => new VaneTRMFallbackAdapter({ baseUrl: 'http://192.168.1.100:3000' }),
      /SECURITY_BOUNDARY_VIOLATION/
    );
    assert.throws(
      () => new VaneTRMFallbackAdapter({ baseUrl: 'http://external-api.com' }),
      /SECURITY_BOUNDARY_VIOLATION/
    );
  });
});
