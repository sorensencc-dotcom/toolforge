#!/usr/bin/env node
/**
 * Observability HTTP Server Bootstrap
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Starts an AdapterObserver HTTP server exposing:
 *   GET /metrics    — Prometheus exposition format
 *   GET /dashboard  — JSON dashboard snapshot
 *   GET /health     — Service health ping
 *
 * Usage:
 *   node scripts/start-observer.js [--port=9090]
 *
 * Environment variables:
 *   CIC_OBSERVER_PORT        HTTP port (default: 9090)
 *   CIC_HARVESTER_ID         Harvester ID to tag metrics with
 */

import { AdapterObserver } from '../src/observability/adapter-observer.js';
import { ADAPTER_VERSION } from '../src/adapter/whichllm-adapter.js';

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);

const port = parseInt(args.port ?? process.env.CIC_OBSERVER_PORT ?? '9090', 10);
const harvesterId = process.env.CIC_HARVESTER_ID ?? 'cic-whichllm-default-v1';

const observer = new AdapterObserver({ harvesterId, adapterVersion: ADAPTER_VERSION });

// Seed a synthetic metric so Prometheus scrape returns non-empty data immediately
observer.recordQueryMetrics({ latencyMs: 0, model: 'none', success: true });

try {
  const server = await observer.listenHttp(port);
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    event: 'observer.started',
    port,
    harvesterId,
    endpoints: {
      metrics: `http://0.0.0.0:${port}/metrics`,
      dashboard: `http://0.0.0.0:${port}/dashboard`,
      health: `http://0.0.0.0:${port}/health`,
    },
  }));

  // Graceful shutdown
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: `observer.${sig.toLowerCase()}` }));
      server.close(() => process.exit(0));
    });
  }
} catch (err) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'observer.start.failed', message: err.message }));
  process.exit(1);
}
