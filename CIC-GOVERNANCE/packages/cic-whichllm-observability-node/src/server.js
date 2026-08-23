/**
 * HTTP Server for Observability Node
 */
import http from 'node:http';
import { MetricsCollector } from './metrics-collector.js';
import { LineageMonitor } from './lineage-monitor.js';
import { AlertManager } from './alert-manager.js';

export class ObservabilityServer {
  #server;
  #metrics;
  #lineage;
  #alerts;
  #harvesterId;

  constructor(opts = {}) {
    this.#harvesterId = opts.harvesterId ?? 'cic-whichllm-default-v1';
    this.#metrics = new MetricsCollector();
    this.#lineage = new LineageMonitor(this.#harvesterId);
    this.#alerts = new AlertManager();
  }

  get metrics() { return this.#metrics; }
  get lineage() { return this.#lineage; }
  get alerts() { return this.#alerts; }

  listen(port = 9091) {
    return new Promise((resolve, reject) => {
      this.#server = http.createServer((req, res) => this.#handleRequest(req, res));
      this.#server.listen(port, () => resolve(this.#server));
      this.#server.on('error', reject);
    });
  }

  close() {
    return new Promise((resolve) => {
      if (!this.#server) return resolve();
      this.#server.close(resolve);
    });
  }

  async #handleRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      const raw = this.#metrics.getMetrics();
      const q = this.#metrics.getQuantiles('cic_query_latency_ms');
      let body = '# HELP cic_whichllm_queries_total Total queries executed\n# TYPE cic_whichllm_queries_total counter\n';
      for (const [k, v] of Object.entries(raw)) {
        body += `${k} ${v}\n`;
      }
      body += `cic_whichllm_latency_p50 ${q.p50}\ncic_whichllm_latency_p90 ${q.p90}\ncic_whichllm_latency_p99 ${q.p99}\n`;
      return res.end(body);
    }

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'healthy',
        harvesterId: this.#harvesterId,
        alertsCount: this.#alerts.getAlerts().length,
        timestamp: new Date().toISOString(),
      }));
    }

    if (url.pathname === '/alerts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(this.#alerts.getAlerts()));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
}
