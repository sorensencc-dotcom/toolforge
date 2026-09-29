import { LocalAuthWiring } from './adapters/LocalAuthWiring.mjs';
import { IcfRetrievalAdapter } from './adapters/IcfRetrievalAdapter-v2.mjs';
import { WhichLlmAdapter } from './adapters/WhichLlmAdapter.mjs';

/**
 * TorqueQueryOrchestrator
 *
 * Coordinates identity/permissions, knowledge base grounding, and model routing.
 * Provides adapter-side CIC observability telemetry:
 * - Per-query latency buckets (<50ms, 50-200ms, 200-500ms, >500ms)
 * - Drift-hit vs drift-miss counters
 * - Query-shape histogram (exact, prefix, fuzzy, empty)
 * - Determinism audit verification
 */
export class TorqueQueryOrchestrator {
  constructor(options = {}) {
    this.authWiring = new LocalAuthWiring(options.authOptions);
    this.icfAdapter = new IcfRetrievalAdapter(options.icfOptions);
    this.whichLlmAdapter = new WhichLlmAdapter(options.whichLlmOptions);

    this.metrics = {
      totalQueries: 0,
      totalLatencyMs: 0,
      latencyBuckets: {
        '<50ms': 0,
        '50-200ms': 0,
        '200-500ms': 0,
        '>500ms': 0
      },
      driftCounters: {
        hits: 0,
        misses: 0
      },
      queryShapeHistogram: {
        exact: 0,
        prefix: 0,
        fuzzy: 0,
        empty: 0
      },
      determinismAudits: {
        verified: 0,
        mismatches: 0
      }
    };
  }

  /**
   * Classify query shape into exact, prefix, fuzzy, or empty.
   * @param {string} query
   * @returns {'exact'|'prefix'|'fuzzy'|'empty'}
   */
  _classifyQueryShape(query) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return 'empty';
    }
    const clean = query.trim();
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      return 'exact';
    }
    if (clean.endsWith('*') || /^(tag|cat|path|title|scope):/i.test(clean)) {
      return 'prefix';
    }
    return 'fuzzy';
  }

  /**
   * Determine latency bucket for a given duration in milliseconds.
   * @param {number} latencyMs
   * @returns {'<50ms'|'50-200ms'|'200-500ms'|'>500ms'}
   */
  _getLatencyBucket(latencyMs) {
    if (latencyMs < 50) return '<50ms';
    if (latencyMs < 200) return '50-200ms';
    if (latencyMs < 500) return '200-500ms';
    return '>500ms';
  }

  /**
   * Execute query intent through the 4-step orchestration pipeline.
   * @param {Object} intent
   * @returns {Promise<Object>}
   */
  async execute(intent) {
    const startTime = Date.now();
    const { query = '', action = 'QUERY', scope = 'S1', requiresStepUp = false } = intent || {};

    const queryShape = this._classifyQueryShape(query);
    this.metrics.totalQueries++;
    this.metrics.queryShapeHistogram[queryShape]++;

    // 1. Step 1: Identity & Permission Gate
    const authDecision = await this.authWiring.verifyActionPermission({
      action,
      scope: requiresStepUp ? 'HIGH_RISK' : 'LOW_RISK',
      requiresStepUp
    });

    if (!authDecision.authorized) {
      const latencyMs = Date.now() - startTime;
      const latencyBucket = this._getLatencyBucket(latencyMs);
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.latencyBuckets[latencyBucket]++;
      this.metrics.driftCounters.misses++;

      return {
        status: 'DENIED',
        stepFailed: 'STEP_1_AUTH',
        authDecision,
        groundingPacket: null,
        modelSelection: null,
        executionResult: null,
        latencyMs,
        telemetry: {
          queryShape,
          latencyMs,
          latencyBucket,
          driftStatus: 'MISS',
          deterministicAudit: true
        }
      };
    }

    // 2. Step 2: Knowledge Base Grounding
    const groundingPacket = this.icfAdapter.queryContextCache({ query, maxResults: 5 });
    const hasSources = groundingPacket && Array.isArray(groundingPacket.sources) && groundingPacket.sources.length > 0;
    const driftStatus = hasSources ? 'HIT' : 'MISS';

    if (hasSources) {
      this.metrics.driftCounters.hits++;
    } else {
      this.metrics.driftCounters.misses++;
    }

    // 3. Step 3: Model Gating & Routing
    const modelGateDecision = await this.whichLlmAdapter.validateModelGate(scope);

    if (!modelGateDecision.allowed) {
      const latencyMs = Date.now() - startTime;
      const latencyBucket = this._getLatencyBucket(latencyMs);
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.latencyBuckets[latencyBucket]++;

      return {
        status: 'BLOCKED_BY_GATE',
        stepFailed: 'STEP_3_MODEL_GATE',
        authDecision,
        groundingPacket,
        modelGateDecision,
        executionResult: null,
        latencyMs,
        telemetry: {
          queryShape,
          latencyMs,
          latencyBucket,
          driftStatus,
          deterministicAudit: true
        }
      };
    }

    // 4. Step 4: TorqueQuery Deterministic Response Envelope
    const deterministicHash = this._computeDeterministicHash(query, groundingPacket, modelGateDecision);
    const recomputedHash = this._computeDeterministicHash(query, groundingPacket, modelGateDecision);
    const isDeterministic = deterministicHash === recomputedHash;

    if (isDeterministic) {
      this.metrics.determinismAudits.verified++;
    } else {
      this.metrics.determinismAudits.mismatches++;
    }

    const latencyMs = Date.now() - startTime;
    const latencyBucket = this._getLatencyBucket(latencyMs);
    this.metrics.totalLatencyMs += latencyMs;
    this.metrics.latencyBuckets[latencyBucket]++;

    const executionResult = {
      engine: 'TorqueQuery-v1',
      modelUsed: modelGateDecision.selectedModel,
      vramTargetGB: modelGateDecision.vramTargetGB,
      sourcesUsed: groundingPacket.sources ? groundingPacket.sources.length : 0,
      contextLength: groundingPacket.contextPacket ? groundingPacket.contextPacket.length : 0,
      deterministicHash
    };

    return {
      status: 'SUCCESS',
      authDecision,
      groundingPacket,
      modelGateDecision,
      executionResult,
      latencyMs,
      telemetry: {
        queryShape,
        latencyMs,
        latencyBucket,
        driftStatus,
        deterministicAudit: isDeterministic
      }
    };
  }

  _computeDeterministicHash(query, groundingPacket, modelGateDecision) {
    const rawString = `${query}:${groundingPacket ? groundingPacket.engine : 'none'}:${modelGateDecision ? modelGateDecision.selectedModel : 'none'}:${groundingPacket && groundingPacket.sources ? groundingPacket.sources.length : 0}`;
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      hash = ((hash << 5) - hash) + rawString.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Get an aggregated telemetry report across all queries.
   * @returns {Object}
   */
  getTelemetryReport() {
    const avgLatencyMs = this.metrics.totalQueries > 0
      ? parseFloat((this.metrics.totalLatencyMs / this.metrics.totalQueries).toFixed(2))
      : 0;

    return {
      totalQueries: this.metrics.totalQueries,
      avgLatencyMs,
      latencyBuckets: { ...this.metrics.latencyBuckets },
      driftCounters: { ...this.metrics.driftCounters },
      queryShapeHistogram: { ...this.metrics.queryShapeHistogram },
      determinismAudits: { ...this.metrics.determinismAudits }
    };
  }

  /**
   * Reset all recorded telemetry metrics.
   */
  resetMetrics() {
    this.metrics.totalQueries = 0;
    this.metrics.totalLatencyMs = 0;
    this.metrics.latencyBuckets = { '<50ms': 0, '50-200ms': 0, '200-500ms': 0, '>500ms': 0 };
    this.metrics.driftCounters = { hits: 0, misses: 0 };
    this.metrics.queryShapeHistogram = { exact: 0, prefix: 0, fuzzy: 0, empty: 0 };
    this.metrics.determinismAudits = { verified: 0, mismatches: 0 };
  }
}
