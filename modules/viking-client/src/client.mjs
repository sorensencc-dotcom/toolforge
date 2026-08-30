import { isVikingError, normalizeRpcError } from './errors.mjs';
import { parseVikingUri } from './uri.mjs';
import { VikingTelemetryTracker } from './telemetry.mjs';

const SEVERE = new Set(['P0', 'P1']);

function countTokens(content, tokenCounter) {
  if (!tokenCounter || typeof content !== 'string') return 0;
  const count = tokenCounter(content);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export class VikingClient {
  #transport;
  #telemetry;
  #tokenCounter;
  #connected = false;

  constructor({ transport, telemetry = new VikingTelemetryTracker(), tokenCounter } = {}) {
    if (!transport || typeof transport.request !== 'function') throw new TypeError('transport.request is required');
    this.#transport = transport;
    this.#telemetry = telemetry;
    this.#tokenCounter = tokenCounter;
  }

  get telemetry() { return this.#telemetry; }

  async #request(method, params, metadata = {}) {
    const started = performance.now();
    const requestBytes = Buffer.byteLength(JSON.stringify({ method, params }), 'utf8');
    try {
      const result = await this.#transport.request(method, params);
      const responseBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
      this.#telemetry.record({ event: 'viking.rpc', method, latency_ms: performance.now() - started, request_bytes: requestBytes, response_bytes: responseBytes, ...metadata });
      return result;
    } catch (error) {
      const normalized = normalizeRpcError(error);
      this.#telemetry.record({ event: 'viking.rpc', method, latency_ms: performance.now() - started, request_bytes: requestBytes, response_bytes: 0, error_code: normalized.vikingCode, ...metadata });
      throw normalized;
    }
  }

  async connect() {
    if (this.#connected) return;
    await this.#request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: '@toolforge/viking-client', version: '0.1.0' } });
    this.#connected = true;
  }

  async list(uri, { offset = 0, limit = 100 } = {}) {
    const canonical = parseVikingUri(uri).uri;
    return this.#request('viking/list', { uri: canonical, offset, limit }, { uri: canonical });
  }

  async listResources({ cursor } = {}) { return this.#request('resources/list', cursor === undefined ? {} : { cursor }); }

  async stat(uri) {
    const canonical = parseVikingUri(uri).uri;
    return this.#request('viking/stat', { uri: canonical }, { uri: canonical });
  }

  async read(uri, tier = 'L1') {
    const canonical = parseVikingUri(uri).uri;
    const result = await this.#request('viking/read', { uri: canonical, resolution_tier: tier }, { uri: canonical, tier, resource_read_count: 1, l2_read_count: tier === 'L2' ? 1 : 0 });
    const contentTokens = countTokens(result.content, this.#tokenCounter);
    if (contentTokens > 0) this.#telemetry.record({ event: 'viking.content', method: 'viking/read', uri: canonical, tier: result.resolution_tier, content_tokens: contentTokens });
    return result;
  }

  async batchRead(items, { maxTotalBytes } = {}) {
    if (!Array.isArray(items) || items.length === 0) throw new TypeError('items must be a non-empty array');
    const canonicalItems = items.map((item) => ({ uri: parseVikingUri(item.uri).uri, resolution_tier: item.tier ?? item.resolution_tier ?? 'L1' }));
    const l2Count = canonicalItems.filter((item) => item.resolution_tier === 'L2').length;
    const params = { items: canonicalItems, ...(maxTotalBytes === undefined ? {} : { max_total_bytes: maxTotalBytes }) };
    const value = await this.#request('viking/readBatch', params, { resource_read_count: canonicalItems.length, l2_read_count: l2Count });
    return { ...value, results: value.results.map((item) => item.error ? { uri: item.uri, ok: false, error: { code: item.error.code, message: item.error.message, vikingCode: item.error.data?.viking_code ?? 'INTERNAL_ERROR', data: item.error.data ?? {} } } : { uri: item.uri, ok: true, value: item.result }) };
  }

  async readWithPolicy(uri, { preferredTier = 'L1', severity = 'P2', fallbackOnUnavailable = true } = {}) {
    const canonical = parseVikingUri(uri).uri;
    try {
      const preferred = await this.read(canonical, preferredTier);
      if (preferredTier !== 'L2' && preferred.stale && SEVERE.has(severity)) {
        const fallback = await this.read(canonical, 'L2');
        return { ...fallback, requestedTier: preferredTier, resolvedTier: 'L2', fallbackTier: 'L2', fallbackReason: 'STALE_HIGH_SEVERITY', escalated: true, warnings: [] };
      }
      const warnings = preferred.stale ? [{ code: 'STALE_TIER', severity, uri: canonical, tier: preferredTier }] : [];
      return { ...preferred, requestedTier: preferredTier, resolvedTier: preferred.resolution_tier, fallbackTier: null, fallbackReason: null, escalated: false, warnings };
    } catch (error) {
      if (preferredTier !== 'L2' && fallbackOnUnavailable && isVikingError(error, 'TIER_UNAVAILABLE')) {
        const fallback = await this.read(canonical, 'L2');
        return { ...fallback, requestedTier: preferredTier, resolvedTier: 'L2', fallbackTier: 'L2', fallbackReason: 'TIER_UNAVAILABLE', escalated: true, warnings: [] };
      }
      throw normalizeRpcError(error);
    }
  }

  async close() { this.#connected = false; await this.#transport.close?.(); }
}

