import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsCollector, AlertManager, ObservabilityServer } from '../src/index.js';

describe('Observability Node', () => {
  let server;

  afterEach(async () => {
    if (server) await server.close();
  });

  it('collects metrics and quantiles deterministically', () => {
    const collector = new MetricsCollector();
    collector.inc('queries_total', 1, { status: 'success' });
    collector.inc('queries_total', 2, { status: 'success' });
    collector.observe('cic_query_latency_ms', 100);
    collector.observe('cic_query_latency_ms', 200);

    const m = collector.getMetrics();
    assert.equal(m['queries_total{status="success"}'], 3);
    const q = collector.getQuantiles('cic_query_latency_ms');
    assert.equal(q.count, 2);
    assert.equal(q.p50, 100);
  });

  it('records and filters alerts', () => {
    const alerts = new AlertManager();
    alerts.recordAlert('critical', 'GC-03-INJECT', 'Prompt injection detected');
    alerts.recordAlert('warning', 'GC-01-WARN', 'Harvester amendment mismatch');

    assert.equal(alerts.getAlerts().length, 2);
    assert.equal(alerts.getAlerts('critical').length, 1);
  });

  it('serves /health and /metrics over HTTP', async () => {
    server = new ObservabilityServer();
    server.metrics.inc('queries_total', 5);
    await server.listen(9876);

    const healthRes = await fetch('http://localhost:9876/health');
    const health = await healthRes.json();
    assert.equal(health.status, 'healthy');

    const metricsRes = await fetch('http://localhost:9876/metrics');
    const metricsText = await metricsRes.text();
    assert.match(metricsText, /queries_total 5/);
  });
});
