import { normalizeVector } from './engine.js';
import { TORQUE_DEFAULTS, TORQUE_ERROR_CODES, TorqueQueryError } from './types.js';

/**
 * TorqueQuery Client Adapter v2.1
 * Features:
 * - Query rewrite/normalization layer
 * - Structured error taxonomy mapping
 * - Fast-path pre-normalization
 * - Explain mode
 */
export class TorqueQueryClient {
  /**
   * @param {Object} [config]
   * @param {import('./engine.js').TorqueQueryEngine} [config.engine]
   * @param {string} [config.url]
   * @param {number} [config.timeout]
   */
  constructor(config = {}) {
    this.engine = config.engine || null;
    this.url = config.url || 'http://localhost:8000';
    this.timeout = config.timeout || 5000;
  }

  /**
   * Query normalization layer:
   * Trims whitespace, collapses consecutive spaces, strips illegal control characters.
   */
  normalizeQuery(query) {
    if (typeof query !== 'string') return '';
    /* eslint-disable no-control-regex */
    return query
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    /* eslint-enable no-control-regex */
  }

  /**
   * Search TorqueQuery.
   * @param {Object} request
   * @param {string} request.query
   * @param {number[]} [request.embedding]
   * @param {number[]} [request.normalized_embedding]
   * @param {number} [request.top_k]
   * @param {boolean} [request.fast_path]
   * @param {boolean} [request.skip_mmr]
   * @param {number} [request.candidate_pool]
   * @param {Record<string, any>} [request.filters]
   * @param {boolean} [request.explain]
   */
  async search(request) {
    if (!request || typeof request !== 'object') {
      throw new TorqueQueryError(TORQUE_ERROR_CODES.BAD_REQUEST, 'Search request must be an object');
    }

    const cleanQuery = this.normalizeQuery(request.query);
    if (!cleanQuery) {
      throw new TorqueQueryError(TORQUE_ERROR_CODES.EMPTY_QUERY, 'Query string is empty after normalization');
    }

    const topK = request.top_k !== undefined ? request.top_k : TORQUE_DEFAULTS.TOP_K;
    if (typeof topK !== 'number' || !Number.isInteger(topK) || topK <= 0 || topK > TORQUE_DEFAULTS.MAX_TOP_K) {
      throw new TorqueQueryError(
        TORQUE_ERROR_CODES.BAD_LIMIT,
        `top_k must be an integer between 1 and ${TORQUE_DEFAULTS.MAX_TOP_K}, got ${topK}`
      );
    }

    let normalizedEmbedding = request.normalized_embedding;
    if (!normalizedEmbedding && Array.isArray(request.embedding)) {
      normalizedEmbedding = normalizeVector(request.embedding);
    }

    const payload = {
      query: cleanQuery,
      top_k: topK,
      fast_path: request.fast_path !== undefined ? request.fast_path : false,
      skip_mmr: request.skip_mmr !== undefined ? request.skip_mmr : false,
      candidate_pool: request.candidate_pool || TORQUE_DEFAULTS.CANDIDATE_POOL,
      filters: request.filters || undefined,
      normalized_embedding: normalizedEmbedding,
      explain: Boolean(request.explain),
    };

    if (this.engine) {
      return this.engine.search(payload);
    }

    // Remote HTTP execution with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.url}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new TorqueQueryError(
          TORQUE_ERROR_CODES.SERVICE_UNAVAILABLE,
          `TorqueQuery remote search failed with HTTP ${res.status}`
        );
      }

      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new TorqueQueryError(
          TORQUE_ERROR_CODES.TIMEOUT,
          `TorqueQuery request timed out after ${this.timeout}ms`
        );
      }
      if (err instanceof TorqueQueryError) throw err;
      throw new TorqueQueryError(
        TORQUE_ERROR_CODES.SERVICE_UNAVAILABLE,
        `Network failure connecting to TorqueQuery at ${this.url}: ${err.message}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async health() {
    if (this.engine) {
      return this.engine.health();
    }
    const res = await fetch(`${this.url}/health`);
    if (!res.ok) {
      throw new TorqueQueryError(
        TORQUE_ERROR_CODES.SERVICE_UNAVAILABLE,
        `Health check failed with HTTP ${res.status}`
      );
    }
    return await res.json();
  }
}
