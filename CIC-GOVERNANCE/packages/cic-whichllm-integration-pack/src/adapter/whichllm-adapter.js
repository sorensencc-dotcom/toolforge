/**
 * CIC-WHICHLLM Deterministic Adapter
 * Spec: CIC v2.4.0 | Amendment §2/S3-A1
 * Pack: CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Determinism contract:
 *   - No Date.now() / Math.random() / crypto.randomUUID() inside hot paths.
 *   - All IDs derived from content hash (SHA-256) via deriveId().
 *   - Retry/back-off uses deterministic exponential schedule seeded from attempt index.
 *   - Request serialisation is canonical (keys sorted, whitespace stripped).
 */

import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { LineageContract } from '../lineage/lineage-contract.js';
import { GovernanceWrapper } from '../governance/governance-wrapper.js';
import { AdapterObserver } from '../observability/adapter-observer.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const ADAPTER_VERSION = '1.0.0';
export const CIC_SPEC_VERSION = '2.4.0';
export const AMENDMENT_REF = '§2/S3-A1';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500; // deterministic: attempt^2 * BASE

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AdapterConfig
 * @property {string}   apiEndpoint      - WHICHLLM API base URL
 * @property {string}   apiKey           - Bearer token (injected at runtime, never logged)
 * @property {string}   harvesterId      - Registered harvester ID from registry
 * @property {string}   [tenantId]       - CIC tenant identifier
 * @property {number}   [timeoutMs]      - Per-request timeout (default 30 000 ms)
 * @property {number}   [maxRetries]     - Max retry attempts (default 3)
 * @property {boolean}  [strictMode]     - Reject non-compliant payloads (default true)
 * @property {object}   [governanceOpts] - Forwarded to GovernanceWrapper
 */

/**
 * @typedef {Object} WhichLLMQuery
 * @property {string}   queryId      - Caller-supplied stable ID (used in lineage)
 * @property {string}   prompt       - Raw prompt text
 * @property {string[]} [modelHints] - Preferred model families
 * @property {object}   [meta]       - Arbitrary caller metadata (schema-validated)
 */

/**
 * @typedef {Object} WhichLLMResult
 * @property {string}   resultId      - Derived content hash ID
 * @property {string}   queryId       - Echo of input queryId
 * @property {string}   model         - Model selected by WHICHLLM
 * @property {string}   response      - Model response text
 * @property {number}   latencyMs     - Observed round-trip latency
 * @property {string}   lineageHash   - Lineage chain hash (see LineageContract)
 * @property {object}   governance    - Governance attestation envelope
 * @property {string}   cicSpecVer    - CIC spec version tag
 * @property {string}   amendmentRef  - Amendment reference tag
 */

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Derive a stable ID from arbitrary content.
 * MUST be used for all IDs; never use random UUIDs in hot paths.
 *
 * @param   {unknown} content  - Any JSON-serialisable value
 * @returns {string}           - hex SHA-256 of canonical JSON
 */
export function deriveId(content) {
  const canonical = canonicalJson(content);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Produce deterministic, canonical JSON (keys sorted, no extra whitespace).
 *
 * @param   {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(val) {
  if (Array.isArray(val)) return val.map(sortKeys);
  if (val !== null && typeof val === 'object') {
    return Object.keys(val)
      .sort()
      .reduce((acc, k) => { acc[k] = sortKeys(val[k]); return acc; }, {});
  }
  return val;
}

/**
 * Deterministic exponential back-off (no jitter to preserve replay fidelity).
 * @param {number} attempt - Zero-based attempt index
 * @returns {number}       - Milliseconds to wait
 */
export function backoffMs(attempt) {
  return Math.min(BASE_BACKOFF_MS * (attempt + 1) ** 2, 10_000);
}

/** Sleep without referencing wall-clock entropy sources. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class WhichLLMAdapter extends EventEmitter {
  /** @type {AdapterConfig} */
  #config;
  /** @type {LineageContract} */
  #lineage;
  /** @type {GovernanceWrapper} */
  #governance;
  /** @type {AdapterObserver} */
  #observer;

  /**
   * @param {AdapterConfig} config
   */
  constructor(config) {
    super();
    this.#validateConfig(config);
    this.#config = {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
      strictMode: true,
      ...config,
    };
    this.#lineage = new LineageContract({
      harvesterId: this.#config.harvesterId,
      tenantId: this.#config.tenantId,
    });
    this.#governance = new GovernanceWrapper({
      harvesterId: this.#config.harvesterId,
      specVersion: CIC_SPEC_VERSION,
      amendmentRef: AMENDMENT_REF,
      strictMode: this.#config.strictMode,
      ...this.#config.governanceOpts,
    });
    this.#observer = new AdapterObserver({
      harvesterId: this.#config.harvesterId,
      adapterVersion: ADAPTER_VERSION,
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Execute a WHICHLLM query with full CIC governance + lineage wrapping.
   *
   * @param   {WhichLLMQuery} query
   * @returns {Promise<WhichLLMResult>}
   */
  async query(query) {
    this.#validateQuery(query);

    const span = this.#observer.startSpan('adapter.query', { queryId: query.queryId });

    try {
      // 1. Pre-flight governance check
      await this.#governance.preCheck(query);

      // 2. Build canonical request payload
      const requestPayload = this.#buildRequestPayload(query);

      // 3. Execute with retry
      const { rawResponse, latencyMs } = await this.#executeWithRetry(requestPayload);

      // 4. Parse & validate response
      const parsed = this.#parseResponse(rawResponse, query.queryId);

      // 5. Stamp lineage
      const lineageHash = await this.#lineage.stamp({
        queryId: query.queryId,
        requestHash: deriveId(requestPayload),
        responseHash: deriveId(parsed),
        model: parsed.model,
      });

      // 6. Post-flight governance attestation
      const governanceAttestation = await this.#governance.attest({
        query,
        result: parsed,
        lineageHash,
      });

      // 7. Assemble result
      const result = {
        resultId: deriveId({ queryId: query.queryId, lineageHash }),
        queryId: query.queryId,
        model: parsed.model,
        response: parsed.response,
        latencyMs,
        lineageHash,
        governance: governanceAttestation,
        cicSpecVer: CIC_SPEC_VERSION,
        amendmentRef: AMENDMENT_REF,
      };

      span.setStatus('ok');
      this.#observer.recordQueryMetrics({ latencyMs, model: parsed.model, success: true });
      this.emit('result', result);
      return result;

    } catch (err) {
      span.setStatus('error', err.message);
      this.#observer.recordQueryMetrics({ latencyMs: 0, model: 'unknown', success: false });
      this.emit('error', err);
      throw err;
    } finally {
      span.end();
    }
  }

  /**
   * Batch query — processes items serially to preserve lineage ordering.
   * @param {WhichLLMQuery[]} queries
   * @returns {Promise<WhichLLMResult[]>}
   */
  async queryBatch(queries) {
    const results = [];
    for (const q of queries) {
      results.push(await this.query(q));
    }
    return results;
  }

  /** Return current lineage chain snapshot. */
  async getLineageSnapshot() {
    return this.#lineage.snapshot();
  }

  /** Health-check: verifies connectivity + governance readiness. */
  async healthCheck() {
    const lineageOk = await this.#lineage.verify();
    const govOk = await this.#governance.isReady();
    return {
      adapter: ADAPTER_VERSION,
      cicSpecVer: CIC_SPEC_VERSION,
      amendmentRef: AMENDMENT_REF,
      lineage: lineageOk ? 'ok' : 'degraded',
      governance: govOk ? 'ok' : 'degraded',
      harvesterId: this.#config.harvesterId,
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #validateConfig(config) {
    const required = ['apiEndpoint', 'apiKey', 'harvesterId'];
    for (const key of required) {
      if (!config[key]) throw new Error(`AdapterConfig missing required field: ${key}`);
    }
    if (!/^https?:\/\//i.test(config.apiEndpoint)) {
      throw new Error(`AdapterConfig.apiEndpoint must be an absolute URL`);
    }
  }

  #validateQuery(query) {
    if (!query?.queryId) throw new Error('WhichLLMQuery.queryId is required');
    if (typeof query.prompt !== 'string' || query.prompt.trim() === '') {
      throw new Error('WhichLLMQuery.prompt must be a non-empty string');
    }
  }

  #buildRequestPayload(query) {
    // Canonical key ordering is critical for deterministic request hashing
    return canonicalJson({
      harvesterId: this.#config.harvesterId,
      meta: query.meta ?? {},
      modelHints: query.modelHints ?? [],
      prompt: query.prompt,
      queryId: query.queryId,
      specVersion: CIC_SPEC_VERSION,
      tenantId: this.#config.tenantId ?? null,
    });
  }

  async #executeWithRetry(payload) {
    let lastErr;
    for (let attempt = 0; attempt < this.#config.maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(backoffMs(attempt - 1));
      }
      try {
        const t0 = performance.now();
        const raw = await this.#fetchOnce(payload);
        const latencyMs = Math.round(performance.now() - t0);
        return { rawResponse: raw, latencyMs };
      } catch (err) {
        lastErr = err;
        if (attempt + 1 < this.#config.maxRetries) {
          this.emit('retry', { attempt: attempt + 1, error: err.message });
        }
      }
    }
    throw new Error(`WHICHLLM request failed after ${this.#config.maxRetries} attempts: ${lastErr?.message}`);
  }

  async #fetchOnce(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#config.timeoutMs);
    try {
      const res = await fetch(this.#config.apiEndpoint + '/v1/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.#config.apiKey}`,
          'Content-Type': 'application/json',
          'X-CIC-Spec-Version': CIC_SPEC_VERSION,
          'X-CIC-Amendment': AMENDMENT_REF,
          'X-Harvester-Id': this.#config.harvesterId,
        },
        body: payload,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  #parseResponse(raw, queryId) {
    if (typeof raw?.model !== 'string') {
      throw new Error(`WHICHLLM response missing 'model' field (queryId=${queryId})`);
    }
    if (typeof raw?.response !== 'string') {
      throw new Error(`WHICHLLM response missing 'response' field (queryId=${queryId})`);
    }
    return { model: raw.model, response: raw.response, rawMeta: raw.meta ?? {} };
  }
}

export default WhichLLMAdapter;
