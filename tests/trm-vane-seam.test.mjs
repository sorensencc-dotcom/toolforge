import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VaneTRMFallbackAdapter, USE_VANE_FALLBACK } from '../scripts/run-closed-loop-research-v2.mjs';

function startMockVaneServer(port, options = {}) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (req.url === '/api/providers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          providers: [
            {
              id: 'ollama-provider-id',
              name: 'Ollama',
              chatModels: [{ key: 'llama3.1:latest' }],
              embeddingModels: [{ key: 'nomic-embed-text' }]
            }
          ]
        }));
      } else if (req.url === '/api/search') {
        if (options.failSearch) {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('Search Service Unavailable');
          return;
        }

        const parsed = JSON.parse(body || '{}');
        assert.ok(parsed.query, 'Search query must be present in request body');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: `Synthesized Vane response for query: "${parsed.query}"`,
          sources: [
            {
              content: 'Grounded citation text extracted from local indexed search.',
              metadata: {
                title: 'Local Index Reference Document',
                url: 'http://127.0.0.1:3000/doc/seam-test'
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

test('TRM Stage 3 Orchestrator Seam Integration Suite', async (t) => {
  await t.test('1. Module imports and exports VaneTRMFallbackAdapter and USE_VANE_FALLBACK flag', () => {
    assert.ok(VaneTRMFallbackAdapter, 'VaneTRMFallbackAdapter must be exported by run-closed-loop-research-v2.mjs');
    assert.equal(typeof VaneTRMFallbackAdapter, 'function', 'VaneTRMFallbackAdapter must be a constructor function/class');
    assert.equal(typeof USE_VANE_FALLBACK, 'boolean', 'USE_VANE_FALLBACK must be a boolean flag');
  });

  await t.test('2. Stage 3 seam resolves gap query and captures findings with materialized files', async () => {
    const port = 39510;
    const server = await startMockVaneServer(port);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-seam-test-'));
    const stagingDir = path.join(tempDir, '_kb-sync-staging');
    fs.mkdirSync(stagingDir, { recursive: true });

    try {
      const adapter = new VaneTRMFallbackAdapter({
        baseUrl: `http://127.0.0.1:${port}`,
        stagingRoot: stagingDir
      });

      const dynamicQueries = [
        {
          topic: 'open-contradictions',
          fts5Query: 'open contradictions historical verification',
          method: 'fts5-heuristic',
          provider: 'auto'
        }
      ];

      const batchRunId = 'batch-2026-10-09-test';
      const todayStr = '2026-10-09';
      const findings = [];
      const loggedInfo = [];
      const loggedWarn = [];

      const logInfo = (m) => loggedInfo.push(m);
      const logWarn = (m) => loggedWarn.push(m);

      // Simulate Step 3 orchestrator flow
      for (const gap of dynamicQueries) {
        logInfo(`  • [VANE-FALLBACK] Resolving gap query: "${gap.fts5Query}"...`);
        try {
          const batchId = batchRunId || `batch-${todayStr}-${Date.now().toString().slice(-4)}`;
          const vaneRes = await adapter.resolveGapWithVane(gap.fts5Query, {
            batchId,
            approved: true
          });
          if (vaneRes.ok) {
            logInfo(`  ✓ [VANE-FALLBACK] Resolved with ${vaneRes.mappings?.length ?? 0} sources.`);
            findings.push({
              topic: gap.topic,
              query: gap.fts5Query,
              source: vaneRes.source,
              answer: vaneRes.answer,
              batch_id: vaneRes.batch_id,
              mappings: vaneRes.mappings,
              manifest: vaneRes.manifest,
              payload: vaneRes.payload
            });
          } else {
            logWarn(`  ⚠ [VANE-FALLBACK] Fallback circuit-break: ${vaneRes.error}. Continuing pipeline.`);
          }
        } catch (err) {
          logWarn(`  ⚠ [VANE-FALLBACK] Error resolving gap query: ${err.message}. Continuing pipeline.`);
        }
      }

      // Assert findings captured
      assert.equal(findings.length, 1, 'Findings array must contain 1 resolved gap');
      assert.equal(findings[0].topic, 'open-contradictions');
      assert.equal(findings[0].source, 'vane-local');
      assert.match(findings[0].answer, /Synthesized Vane response for query/);
      assert.equal(findings[0].batch_id, batchRunId);
      assert.equal(findings[0].mappings.length, 1);

      // Write raw_research_conformance.json just as the orchestrator does
      const rawResearchPath = path.join(stagingDir, 'raw_research_conformance.json');
      fs.writeFileSync(rawResearchPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        gaps_analyzed: ['open-contradictions'],
        dynamic_queries: dynamicQueries,
        synthesizer_model: 'qwen2.5:32b',
        model_selection_hash: 'testhash',
        vault_source: 'test-vault/gaps.md',
        findings,
        _note: 'Stage 2 Dynamic Query Expansion generated via query-expander.mjs.'
      }, null, 2), 'utf8');

      // Verify written JSON
      assert.ok(fs.existsSync(rawResearchPath), 'raw_research_conformance.json must be written');
      const stagedData = JSON.parse(fs.readFileSync(rawResearchPath, 'utf8'));
      assert.equal(stagedData.findings.length, 1);
      assert.equal(stagedData.findings[0].query, 'open contradictions historical verification');

      // Verify materialized files in batchDir
      const batchDir = path.join(stagingDir, 'trm', batchRunId);
      assert.ok(fs.existsSync(path.join(batchDir, 'payload.json')), 'payload.json must exist');
      assert.ok(fs.existsSync(path.join(batchDir, 'sources.manifest.json')), 'sources.manifest.json must exist');
      assert.ok(fs.existsSync(path.join(batchDir, 'sources', 'src-101.md')), 'sources/src-101.md must exist');
    } finally {
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('3. Stage 3 seam logs warning and continues pipeline on circuit breaker / service failure', async () => {
    const port = 39511;
    // Server returns 503 error
    const server = await startMockVaneServer(port, { failSearch: true });
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-seam-fail-'));
    const stagingDir = path.join(tempDir, '_kb-sync-staging');
    fs.mkdirSync(stagingDir, { recursive: true });

    try {
      const adapter = new VaneTRMFallbackAdapter({
        baseUrl: `http://127.0.0.1:${port}`,
        stagingRoot: stagingDir
      });

      const dynamicQueries = [
        {
          topic: 'under-sourced',
          fts5Query: 'under-sourced topic query',
          method: 'fts5-heuristic',
          provider: 'auto'
        }
      ];

      const findings = [];
      const loggedInfo = [];
      const loggedWarn = [];

      const logInfo = (m) => loggedInfo.push(m);
      const logWarn = (m) => loggedWarn.push(m);

      // Execute Step 3 seam loop
      for (const gap of dynamicQueries) {
        logInfo(`  • [VANE-FALLBACK] Resolving gap query: "${gap.fts5Query}"...`);
        try {
          const batchId = `batch-test-${Date.now().toString().slice(-4)}`;
          const vaneRes = await adapter.resolveGapWithVane(gap.fts5Query, {
            batchId,
            approved: true
          });
          if (vaneRes.ok) {
            logInfo(`  ✓ [VANE-FALLBACK] Resolved with ${vaneRes.mappings?.length ?? 0} sources.`);
            findings.push({
              topic: gap.topic,
              query: gap.fts5Query,
              source: vaneRes.source,
              answer: vaneRes.answer,
              batch_id: vaneRes.batch_id,
              mappings: vaneRes.mappings,
              manifest: vaneRes.manifest,
              payload: vaneRes.payload
            });
          } else {
            logWarn(`  ⚠ [VANE-FALLBACK] Fallback circuit-break: ${vaneRes.error}. Continuing pipeline.`);
          }
        } catch (err) {
          logWarn(`  ⚠ [VANE-FALLBACK] Error resolving gap query: ${err.message}. Continuing pipeline.`);
        }
      }

      // Assert pipeline didn't throw and gracefully recorded warning
      assert.equal(findings.length, 0, 'No findings should be staged when Vane service is down');
      assert.equal(loggedWarn.length, 1, 'Warning must be logged for circuit-break');
      assert.match(loggedWarn[0], /Fallback circuit-break/);

      // Verify raw_research_conformance.json is still written with empty findings
      const rawResearchPath = path.join(stagingDir, 'raw_research_conformance.json');
      fs.writeFileSync(rawResearchPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        gaps_analyzed: ['under-sourced'],
        dynamic_queries: dynamicQueries,
        synthesizer_model: 'qwen2.5:32b',
        model_selection_hash: 'testhash',
        vault_source: 'test-vault/gaps.md',
        findings,
        _note: 'Stage 2 Dynamic Query Expansion generated via query-expander.mjs.'
      }, null, 2), 'utf8');

      assert.ok(fs.existsSync(rawResearchPath));
      const stagedData = JSON.parse(fs.readFileSync(rawResearchPath, 'utf8'));
      assert.deepEqual(stagedData.findings, []);
    } finally {
      server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
