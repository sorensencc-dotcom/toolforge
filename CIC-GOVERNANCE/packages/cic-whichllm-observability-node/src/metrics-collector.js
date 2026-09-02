/**
 * Metrics Collector for CIC-WHICHLLM Observability Node
 */
export class MetricsCollector {
  #counters = new Map();
  #histograms = new Map();

  inc(name, value = 1, labels = {}) {
    const key = this.#serializeKey(name, labels);
    this.#counters.set(key, (this.#counters.get(key) ?? 0) + value);
  }

  observe(name, value, labels = {}) {
    const key = this.#serializeKey(name, labels);
    if (!this.#histograms.has(key)) {
      this.#histograms.set(key, []);
    }
    const arr = this.#histograms.get(key);
    arr.push(value);
    if (arr.length > 2000) arr.shift();
  }

  getMetrics() {
    const out = {};
    for (const [k, v] of this.#counters.entries()) {
      out[k] = v;
    }
    return out;
  }

  getQuantiles(name, labels = {}) {
    const key = this.#serializeKey(name, labels);
    const vals = (this.#histograms.get(key) ?? []).slice().sort((a, b) => a - b);
    if (vals.length === 0) return { p50: 0, p90: 0, p99: 0, count: 0, sum: 0 };
    const sum = vals.reduce((a, b) => a + b, 0);
    const p = (q) => vals[Math.min(Math.floor((vals.length - 1) * q), vals.length - 1)];
    return {
      p50: p(0.5),
      p90: p(0.9),
      p99: p(0.99),
      count: vals.length,
      sum,
    };
  }

  #serializeKey(name, labels) {
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    const labelStr = sorted.map(([k, v]) => `${k}="${v}"`).join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}
