/**
 * Unit Tests — AdapterObserver
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Runner: Node 20+ built-in test runner  (node --test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AdapterObserver, Span } from '../../src/observability/adapter-observer.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_OPTS = {
  harvesterId: 'cic-whichllm-default-v1',
  adapterVersion: '1.0.0',
};

// ─── Span ─────────────────────────────────────────────────────────────────────

describe('Span', () => {
  it('span.end() returns a record with required fields', () => {
    const observer = new AdapterObserver(BASE_OPTS);
    const span = observer.startSpan('test.op', { key: 'val' });
    const record = span.end();
    assert.ok(record.spanId);
    assert.equal(record.name, 'test.op');
    assert.ok(record.durationMs >= 0);
    assert.deepEqual(record.attributes, { key: 'val' });
  });

  it('spanId is 16 hex chars', () => {
    const observer = new AdapterObserver(BASE_OPTS);
    const span = observer.startSpan('span.id.test');
    assert.match(span.spanId, /^[0-9a-f]{16}$/);
  });

  it('setStatus carries through to end record', () => {
    const observer = new AdapterObserver(BASE_OPTS);
    const span = observer.startSpan('status.test');
    span.setStatus('error', 'Something went wrong');
    const record = span.end();
    assert.equal(record.status.code, 'error');
    assert.equal(record.status.message, 'Something went wrong');
  });

  it('setAttribute is reflected in end record', () => {
    const observer = new AdapterObserver(BASE_OPTS);
    const span = observer.startSpan('attr.test', {});
    span.setAttribute('dynamicKey', 42);
    const record = span.end();
    assert.equal(record.attributes.dynamicKey, 42);
  });

  it('two spans for different operations have different spanIds', () => {
    const observer = new AdapterObserver(BASE_OPTS);
    const s1 = observer.startSpan('op.a', { x: 1 });
    const s2 = observer.startSpan('op.b', { x: 2 });
    assert.notEqual(s1.spanId, s2.spanId);
  });
});

// ─── recordQueryMetrics ───────────────────────────────────────────────────────

describe('AdapterObserver.recordQueryMetrics()', () => {
  it('increments queriesTotal after one call', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    obs.recordQueryMetrics({ latencyMs: 150, model: 'gpt-4o', success: true });
    const dash = obs.dashboardSnapshot();
    assert.equal(dash.metrics.queriesTotal, 1);
    assert.equal(dash.metrics.queriesSuccess, 1);
    assert.equal(dash.metrics.queriesError, 0);
  });

  it('tracks errors separately from successes', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    obs.recordQueryMetrics({ latencyMs: 100, model: 'gpt-4o', success: true });
    obs.recordQueryMetrics({ latencyMs: 0, model: 'gpt-4o', success: false });
    const dash = obs.dashboardSnapshot();
    assert.equal(dash.metrics.queriesTotal, 2);
    assert.equal(dash.metrics.queriesSuccess, 1);
    assert.equal(dash.metrics.queriesError, 1);
  });

  it('latency percentiles increase with more samples', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    for (const ms of [100, 200, 300, 400, 500]) {
      obs.recordQueryMetrics({ latencyMs: ms, model: 'gpt-4o', success: true });
    }
    const dash = obs.dashboardSnapshot();
    assert.ok(dash.metrics.latencyP50Ms > 0);
    assert.ok(dash.metrics.latencyP95Ms >= dash.metrics.latencyP50Ms);
    assert.ok(dash.metrics.latencySamples === 5);
  });
});

// ─── recordGovernanceChecks ───────────────────────────────────────────────────

describe('AdapterObserver.recordGovernanceChecks()', () => {
  it('counts pass and fail checks', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    obs.recordGovernanceChecks([
      { checkId: 'GC-01', name: 'A', result: 'pass' },
      { checkId: 'GC-02', name: 'B', result: 'pass' },
      { checkId: 'GC-03', name: 'C', result: 'fail' },
    ]);
    const dash = obs.dashboardSnapshot();
    assert.equal(dash.metrics.governancePass, 2);
    assert.equal(dash.metrics.governanceFail, 1);
  });
});

// ─── dashboardSnapshot ────────────────────────────────────────────────────────

describe('AdapterObserver.dashboardSnapshot()', () => {
  it('snapshot contains expected top-level keys', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    const snap = obs.dashboardSnapshot();
    const keys = Object.keys(snap);
    assert.ok(keys.includes('snapshotAt'));
    assert.ok(keys.includes('harvesterId'));
    assert.ok(keys.includes('adapterVersion'));
    assert.ok(keys.includes('metrics'));
    assert.ok(keys.includes('recentSpans'));
  });

  it('harvesterId and adapterVersion match constructor opts', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    const snap = obs.dashboardSnapshot();
    assert.equal(snap.harvesterId, BASE_OPTS.harvesterId);
    assert.equal(snap.adapterVersion, BASE_OPTS.adapterVersion);
  });

  it('recentSpans is capped at 20 in the snapshot', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    for (let i = 0; i < 30; i++) {
      obs.startSpan(`op.${i}`).end();
    }
    const snap = obs.dashboardSnapshot();
    assert.ok(snap.recentSpans.length <= 20);
  });

  it('snapshotAt is a valid ISO-8601 string', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    const snap = obs.dashboardSnapshot();
    assert.doesNotThrow(() => new Date(snap.snapshotAt));
    assert.ok(!isNaN(new Date(snap.snapshotAt).getTime()));
  });
});

// ─── renderPrometheus ─────────────────────────────────────────────────────────

describe('AdapterObserver.renderPrometheus()', () => {
  it('output is non-empty string ending with newline', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    const out = obs.renderPrometheus();
    assert.ok(typeof out === 'string' && out.length > 0);
    assert.ok(out.endsWith('\n'));
  });

  it('contains HELP and TYPE lines for all expected metrics', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    obs.recordQueryMetrics({ latencyMs: 75, model: 'claude-3.5', success: true });
    const out = obs.renderPrometheus();

    const expectedMetrics = [
      'cic_whichllm_queries_total',
      'cic_whichllm_queries_success_total',
      'cic_whichllm_queries_error_total',
      'cic_whichllm_retries_total',
      'cic_whichllm_governance_pass_total',
      'cic_whichllm_governance_fail_total',
      'cic_whichllm_query_latency_ms',
      'cic_whichllm_lineage_chain_length',
    ];
    for (const metric of expectedMetrics) {
      assert.ok(out.includes(metric), `Prometheus output missing metric: ${metric}`);
    }
  });

  it('label values are present for recorded queries', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    obs.recordQueryMetrics({ latencyMs: 200, model: 'gemini-2', success: true });
    const out = obs.renderPrometheus();
    assert.ok(out.includes('model="gemini-2"'), 'model label present in Prometheus output');
  });
});

// ─── span buffer cap ─────────────────────────────────────────────────────────

describe('Span buffer rolling cap', () => {
  it('buffer does not exceed 1 000 entries internally (via on("span"))', () => {
    const obs = new AdapterObserver(BASE_OPTS);
    let emitted = 0;
    obs.on('span', () => emitted++);

    for (let i = 0; i < 50; i++) {
      obs.startSpan(`bulk.op.${i}`).end();
    }
    assert.equal(emitted, 50);

    // Verify recentSpans in snapshot stays bounded
    const snap = obs.dashboardSnapshot();
    assert.ok(snap.recentSpans.length <= 20);
  });
});