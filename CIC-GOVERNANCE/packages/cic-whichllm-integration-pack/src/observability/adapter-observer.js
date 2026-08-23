/**
 * CIC-WHICHLLM Observability Dashboard Node
 * Spec: CIC v2.4.0 | Amendment §2/S3-A1
 * Pack: CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Provides:
 *   - Structured span tracing (OpenTelemetry-compatible envelope)
 *   - Prometheus-compatible metrics counters / histograms (pull model)
 *   - Structured JSON log emission
 *   - Real-time dashboard snapshot (for sidecar scrapers)
 *
 * Design constraints:
 *   - Zero external runtime dependencies.
 *   - No wall-clock randomness; span IDs derived from content hash.
 *   - Metrics are in-process accumulators; export via MetricsExporter.
 */

import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

// ─── Constants ────────────────────────────────────────────────────────────────

export const OBSERVER_VERSION = '1.0.0';
const NS = 'cic_whichllm'; // Prometheus namespace prefix

// ─── Span ─────────────────────────────────────────────────────────────────────

export class Span {
  #name;
  #attributes;
  #startTime;
  #endTime = null;
  #status = { code: 'unset' };
  #spanId;
  #emitter;

  constructor(name, attributes, emitter) {
    this.#name = name;
    this.#attributes = attributes ?? {};
    this.#startTime = performance.now();
    this.#spanId = createHash('sha256')
      .update(`${name}:${JSON.stringify(attributes)}:${this.#startTime}`, 'utf8')
      .digest('hex')
      .slice(0, 16); // 8-byte span ID (16 hex chars), OTel compatible
    this.#emitter = emitter;
  }

  setStatus(code, message) {
    this.#status = { code, ...(message ? { message } : {}) };
    return this;
  }

  setAttribute(key, value) {
    this.#attributes[key] = value;
    return this;
  }

  end() {
    this.#endTime = performance.now();
    const record = {
      spanId: this.#spanId,
      name: this.#name,
      attributes: this.#attributes,
      startTime: this.#startTime,
      durationMs: Math.round(this.#endTime - this.#startTime),
      status: this.#status,
    };
    this.#emitter.emit('span', record);
    return record;
  }

  get spanId() { return this.#spanId; }
}

// ─── Metrics Store ────────────────────────────────────────────────────────────

class Counter {
  #name; #help; #labels; #value;
  constructor(name, help) {
    this.#name = name; this.#help = help; this.#labels = new Map(); this.#value = 0;
  }
  inc(labels = {}, amount = 1) {
    const key = JSON.stringify(labels);
    this.#labels.set(key, (this.#labels.get(key) ?? 0) + amount);
    this.#value += amount;
  }
  toPrometheus() {
    const lines = [`# HELP ${NS}_${this.#name} ${this.#help}`, `# TYPE ${NS}_${this.#name} counter`];
    for (const [labelJson, val] of this.#labels) {
      const labels = JSON.parse(labelJson);
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
      lines.push(`${NS}_${this.#name}{${labelStr}} ${val}`);
    }
    return lines.join('\n');
  }
  get value() { return this.#value; }
  get name() { return this.#name; }
}

class Histogram {
  #name; #help; #buckets; #observations;
  constructor(name, help, buckets = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]) {
    this.#name = name;
    this.#help = help;
    this.#buckets = buckets.slice().sort((a, b) => a - b);
    this.#observations = [];
  }
  observe(value) { this.#observations.push(value); }
  get count() { return this.#observations.length; }
  get sum() { return this.#observations.reduce((a, b) => a + b, 0); }
  percentile(p) {
    if (!this.#observations.length) return 0;
    const sorted = this.#observations.slice().sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
  toPrometheus() {
    const lines = [`# HELP ${NS}_${this.#name} ${this.#help}`, `# TYPE ${NS}_${this.#name} histogram`];
    for (const b of this.#buckets) {
      const count = this.#observations.filter((v) => v <= b).length;
      lines.push(`${NS}_${this.#name}_bucket{le="${b}"} ${count}`);
    }
    lines.push(`${NS}_${this.#name}_bucket{le="+Inf"} ${this.count}`);
    lines.push(`${NS}_${this.#name}_sum ${this.sum}`);
    lines.push(`${NS}_${this.#name}_count ${this.count}`);
    return lines.join('\n');
  }
  get name() { return this.#name; }
}

// ─── AdapterObserver ──────────────────────────────────────────────────────────

export class AdapterObserver extends EventEmitter {
  #harvesterId;
  #adapterVersion;

  // Counters
  #queryTotal;
  #querySuccess;
  #queryError;
  #retryTotal;
  #governancePass;
  #governanceFail;

  // Histograms
  #queryLatency;
  #chainLength;

  // Span buffer (rolling, capped at 1 000 entries)
  #spans = [];
  static #SPAN_BUFFER_MAX = 1_000;

  constructor({ harvesterId, adapterVersion }) {
    super();
    this.#harvesterId = harvesterId;
    this.#adapterVersion = adapterVersion;

    this.#queryTotal    = new Counter('queries_total',            'Total WHICHLLM queries dispatched');
    this.#querySuccess  = new Counter('queries_success_total',    'Total successful WHICHLLM queries');
    this.#queryError    = new Counter('queries_error_total',      'Total failed WHICHLLM queries');
    this.#retryTotal    = new Counter('retries_total',            'Total retry attempts across all queries');
    this.#governancePass = new Counter('governance_pass_total',   'Governance checks that passed');
    this.#governanceFail = new Counter('governance_fail_total',   'Governance checks that failed');
    this.#queryLatency  = new Histogram('query_latency_ms',       'WHICHLLM query round-trip latency in ms');
    this.#chainLength   = new Histogram('lineage_chain_length',   'Lineage chain length at time of stamp', [1,5,10,50,100,500,1000]);

    // Self-subscribe span events to fill buffer
    this.on('span', (record) => {
      if (this.#spans.length >= AdapterObserver.#SPAN_BUFFER_MAX) {
        this.#spans.shift();
      }
      this.#spans.push(record);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start a named span. Call .end() on the returned Span when done.
   * @param {string} name
   * @param {object} [attributes]
   * @returns {Span}
   */
  startSpan(name, attributes) {
    return new Span(name, attributes, this);
  }

  /**
   * Record a completed query's metrics.
   * @param {object} opts
   * @param {number}  opts.latencyMs
   * @param {string}  opts.model
   * @param {boolean} opts.success
   * @param {number}  [opts.retries=0]
   */
  recordQueryMetrics({ latencyMs, model, success, retries = 0 }) {
    const labels = { harvester_id: this.#harvesterId, model };
    this.#queryTotal.inc(labels);
    if (success) {
      this.#querySuccess.inc(labels);
      this.#queryLatency.observe(latencyMs);
    } else {
      this.#queryError.inc(labels);
    }
    if (retries > 0) this.#retryTotal.inc(labels, retries);
    this.#log('info', 'query.metrics', { latencyMs, model, success, retries });
  }

  /**
   * Record governance check results.
   * @param {object[]} checks - Array of GovernanceCheck results
   */
  recordGovernanceChecks(checks) {
    for (const c of checks) {
      if (c.result === 'pass') {
        this.#governancePass.inc({ check_id: c.checkId });
      } else if (c.result === 'fail') {
        this.#governanceFail.inc({ check_id: c.checkId });
      }
    }
  }

  /**
   * Record current lineage chain length.
   * @param {number} length
   */
  recordChainLength(length) {
    this.#chainLength.observe(length);
  }

  /**
   * Emit a structured log line (to stdout; operators pipe to their log sink).
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} event
   * @param {object} [data]
   */
  log(level, event, data) {
    this.#log(level, event, data);
  }

  /**
   * Render all metrics in Prometheus exposition format.
   * Mount this under GET /metrics for Prometheus scraping.
   * @returns {string}
   */
  renderPrometheus() {
    return [
      this.#queryTotal,
      this.#querySuccess,
      this.#queryError,
      this.#retryTotal,
      this.#governancePass,
      this.#governanceFail,
      this.#queryLatency,
      this.#chainLength,
    ]
      .map((m) => m.toPrometheus())
      .join('\n\n') + '\n';
  }

  /**
   * Return a dashboard snapshot object — suitable for JSON serialisation
   * and consumption by any sidecar dashboard (Grafana, custom UI, etc.).
   */
  dashboardSnapshot() {
    return {
      snapshotAt: new Date().toISOString(),
      harvesterId: this.#harvesterId,
      adapterVersion: this.#adapterVersion,
      metrics: {
        queriesTotal: this.#queryTotal.value,
        queriesSuccess: this.#querySuccess.value,
        queriesError: this.#queryError.value,
        retriesTotal: this.#retryTotal.value,
        governancePass: this.#governancePass.value,
        governanceFail: this.#governanceFail.value,
        latencyP50Ms: this.#queryLatency.percentile(50),
        latencyP95Ms: this.#queryLatency.percentile(95),
        latencyP99Ms: this.#queryLatency.percentile(99),
        latencySamples: this.#queryLatency.count,
      },
      recentSpans: this.#spans.slice(-20),
    };
  }

  /**
   * Start a minimal HTTP server to expose /metrics and /dashboard.
   * Returns the Node http.Server instance.
   *
   * @param {number} [port=9090]
   * @returns {Promise<import('node:http').Server>}
   */
  async listenHttp(port = 9090) {
    const { createServer } = await import('node:http');
    const server = createServer((req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405).end('Method Not Allowed');
        return;
      }
      if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(this.renderPrometheus());
      } else if (req.url === '/dashboard') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.dashboardSnapshot(), null, 2));
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', harvesterId: this.#harvesterId }));
      } else {
        res.writeHead(404).end('Not Found');
      }
    });
    await new Promise((resolve, reject) => {
      server.listen(port, '0.0.0.0', resolve);
      server.once('error', reject);
    });
    this.#log('info', 'observer.http.started', { port });
    return server;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #log(level, event, data = {}) {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      harvesterId: this.#harvesterId,
      adapterVersion: this.#adapterVersion,
      ...data,
    });
    if (level === 'error' || level === 'warn') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}

export default AdapterObserver;
