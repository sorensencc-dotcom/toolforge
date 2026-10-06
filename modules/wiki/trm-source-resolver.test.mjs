import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { TRMSourceResolver } from './trm-source-resolver.mjs';

console.log('🧪 Testing trm-source-resolver.mjs...');

const testTempDir = path.join(os.tmpdir(), `trm-resolver-test-${Date.now()}`);
fs.mkdirSync(testTempDir, { recursive: true });

const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;

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

  console.log('✔ All trm-source-resolver tests passed successfully!');
} finally {
  fs.rmSync(testTempDir, { recursive: true, force: true });
}
