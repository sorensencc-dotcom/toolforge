import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { SpanHashValidationError, TRMSourceResolver } from './trm-source-resolver.mjs';

console.log('🧪 Testing trm-source-resolver.mjs...');

const testTempDir = path.join(os.tmpdir(), `trm-resolver-test-${Date.now()}`);
fs.mkdirSync(testTempDir, { recursive: true });

const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
const sha256Bytes = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;

try {
  // Test 1: ID Normalization
  {
    const resolver = new TRMSourceResolver(testTempDir, { resolveSource: async () => {} });
    assert.strictEqual(resolver.normalizeSourceId('SRC-101'), 'src-101');
    assert.strictEqual(resolver.normalizeSourceId('RFC_6455_PROT'), 'src-rfc-6455-prot');
    assert.strictEqual(resolver.normalizeSourceId('random-name'), 'src-random-name');
  }

  // Test 2: Source Resolution & Materialization
  {
    const sampleText1 = 'Service Workers or Page Visibility API trigger WebSocket pings.';
    const span1Start = 0;
    const span1End = sampleText1.length;
    const span1Hash = sha256(sampleText1.slice(span1Start, span1End));

    const sampleText2 = 'Maintain a local SQLite database of revoked fingerprints.';
    const span2Start = 0;
    const span2End = sampleText2.length;
    const span2Hash = sha256(sampleText2.slice(span2Start, span2End));

    const sourceStore = {
      'SRC-101': {
        title: 'Mobile Browser Timer Throttling',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API',
        revision: 'rev-1',
        retrieved_at: new Date().toISOString(),
        text: sampleText1
      },
      'RFC_6455_PROT': {
        title: 'Historical Revocation Checks',
        url: 'https://sigil.org/spec/revocation-proof',
        revision: 'rev-1',
        retrieved_at: new Date().toISOString(),
        text: sampleText2
      }
    };

    const resolver = new TRMSourceResolver(testTempDir, {
      resolveSource: async (id) => sourceStore[id]
    });

    const result = {
      schema: 'research.result.v1',
      task_id: 'trm-task-001',
      status: 'completed',
      payload: {
        findings: [
          {
            source_id: 'SRC-101',
            source_revision: 'rev-1',
            source_span: { start: span1Start, end: span1End, span_hash: span1Hash }
          },
          {
            source_id: 'RFC_6455_PROT',
            source_revision: 'rev-1',
            source_span: { start: span2Start, end: span2End, span_hash: span2Hash }
          }
        ]
      }
    };

    const batchId = `batch-${Date.now()}`;
    const output = await resolver.resolveAndMaterialize(result, batchId, { approved: true });

    assert.strictEqual(output.batch_id, batchId);
    assert.strictEqual(output.mappings.length, 2);
    assert.strictEqual(output.mappings[0].resolved_id, 'src-101');
    assert.strictEqual(output.mappings[1].resolved_id, 'src-rfc-6455-prot');

    const stagedSource1 = path.join(testTempDir, 'trm', batchId, 'sources', 'src-101.md');
    assert.ok(fs.existsSync(stagedSource1), 'Staged markdown file 1 must exist');
    const content1 = fs.readFileSync(stagedSource1, 'utf8');
    assert.ok(content1.includes('Mobile Browser Timer Throttling'));

    const manifestPath = path.join(testTempDir, 'trm', batchId, 'sources.manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'Manifest file must exist');
  }

  // Test 3: UTF-8 byte offsets and row-level fail-closed errors
  {
    const sourceStore = {
      'UNICODE': {
        title: 'Unicode bytes', url: 'https://example.test/unicode', revision: 'rev-1',
        retrieved_at: '2026-11-01T00:00:00.000Z', text: 'A🙂B'
      }
    };
    const resolver = new TRMSourceResolver(testTempDir, { resolveSource: async (id) => sourceStore[id] });
    const bytes = Buffer.from(sourceStore.UNICODE.text, 'utf8');
    const valid = {
      source_id: 'UNICODE', source_revision: 'rev-1',
      source_span: { start: 1, end: 5, span_hash: sha256Bytes(bytes.subarray(1, 5)) }
    };
    await resolver.resolveAndMaterialize({ schema: 'research.result.v1', task_id: 'unicode', status: 'completed', payload: { findings: [valid] } }, 'unicode-batch', { approved: true });

    await assert.rejects(
      resolver.resolveAndMaterialize({ schema: 'research.result.v1', task_id: 'bad-hash', status: 'completed', payload: { findings: [{ ...valid, source_span: { ...valid.source_span, span_hash: 'sha256:not-hex' } }] } }, 'bad-hash-batch', { approved: true }),
      (error) => error instanceof SpanHashValidationError
        && error.row.identity === '0:UNICODE'
        && error.row.expected_hash === 'sha256:not-hex'
        && error.row.observed_hash === null
    );
  }

  // Test 4: changed bytes, invalid ranges, and mixed batches never publish output
  {
    const sourceStore = {
      'ROW-1': { title: 'One', url: 'https://example.test/one', revision: 'rev-1', retrieved_at: '2026-11-01T00:00:00.000Z', text: 'stable bytes' },
      'ROW-2': { title: 'Two', url: 'https://example.test/two', revision: 'rev-1', retrieved_at: '2026-11-01T00:00:00.000Z', text: 'changed bytes' }
    };
    const resolver = new TRMSourceResolver(testTempDir, { resolveSource: async (id) => sourceStore[id] });
    const row = (source_id, text, end = text.length) => ({ source_id, source_revision: 'rev-1', source_span: { start: 0, end, span_hash: sha256(text) } });
    const mixedBatch = 'mixed-batch';
    await assert.rejects(
      resolver.resolveAndMaterialize({ schema: 'research.result.v1', task_id: 'mixed', status: 'completed', payload: { findings: [row('ROW-1', sourceStore['ROW-1'].text), row('ROW-2', 'wrong bytes')] } }, mixedBatch, { approved: true }),
      (error) => error instanceof SpanHashValidationError
        && error.row.identity === '1:ROW-2'
        && error.row.expected_hash === sha256('wrong bytes')
        && error.row.observed_hash === sha256(sourceStore['ROW-2'].text.slice(0, 'wrong bytes'.length))
    );
    assert.ok(!fs.existsSync(path.join(testTempDir, 'trm', mixedBatch)), 'Mixed-validity batches must not publish partial output');

    await assert.rejects(
      resolver.resolveAndMaterialize({ schema: 'research.result.v1', task_id: 'range', status: 'completed', payload: { findings: [row('ROW-1', sourceStore['ROW-1'].text, 1000)] } }, 'bad-range-batch', { approved: true }),
      (error) => error instanceof SpanHashValidationError && error.row.identity === '0:ROW-1' && error.row.observed_hash === null
    );
  }

  console.log('✔ All trm-source-resolver tests passed successfully!');
} finally {
  fs.rmSync(testTempDir, { recursive: true, force: true });
}
