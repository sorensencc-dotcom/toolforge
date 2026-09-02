import crypto from 'node:crypto';
import { TORQUE_DEFAULTS, TORQUE_ERROR_CODES, TorqueQueryError } from './types.js';

/**
 * Seeded PRNG based on SHA-256 for strict determinism.
 */
function createDeterministicRng(seedStr) {
  let counter = 0;
  return function nextFloat() {
    counter++;
    const hash = crypto.createHash('sha256').update(`${seedStr}:${counter}`).digest();
    const uint32 = hash.readUInt32BE(0);
    return uint32 / 0xffffffff;
  };
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new TorqueQueryError(
      TORQUE_ERROR_CODES.BAD_REQUEST,
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalize embedding to unit length.
 */
export function normalizeVector(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec.slice();
  return vec.map((v) => v / norm);
}

/**
 * Compute deterministic simulated embedding for text.
 */
export function computeEmbedding(text, dim = TORQUE_DEFAULTS.EMBEDDING_DIM) {
  const rng = createDeterministicRng(text);
  const vec = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    vec[i] = rng() * 2 - 1;
  }
  return normalizeVector(Array.from(vec));
}

/**
 * In-Memory Reference TorqueQuery Engine
 */
export class TorqueQueryEngine {
  /**
   * @param {Object} [options]
   * @param {Array<{id: string, text: string, metadata?: Record<string, any>, embedding?: number[]}>} [options.corpus]
   * @param {string} [options.backingStore]
   */
  constructor(options = {}) {
    this.corpus = [];
    this.backingStore = options.backingStore || 'in-memory-conformance';
    if (options.corpus) {
      this.loadCorpus(options.corpus);
    }
  }

  loadCorpus(items) {
    this.corpus = items.map((item) => {
      const embedding = item.embedding || computeEmbedding(item.text);
      return {
        id: item.id,
        text: item.text,
        metadata: item.metadata || {},
        embedding: normalizeVector(embedding),
      };
    });
  }

  addItem(item) {
    const embedding = item.embedding || computeEmbedding(item.text);
    this.corpus.push({
      id: item.id,
      text: item.text,
      metadata: item.metadata || {},
      embedding: normalizeVector(embedding),
    });
  }

  health() {
    return {
      status: 'ok',
      version: TORQUE_DEFAULTS.VERSION,
      service: TORQUE_DEFAULTS.SERVICE_NAME,
      service_description: 'TorqueQuery reference memory and drift semantic search service',
      backing_store: this.backingStore,
      embedding_backend: 'sha256-deterministic-seed',
      corpus_size: this.corpus.length,
      determinism: {
        hash_seed_pinned: true,
        fast_path_deterministic: true,
        note: 'Seeded via sha256 byte digest on query text and normalized embeddings',
      },
    };
  }

  /**
   * Matches metadata against structured filters.
   */
  matchesFilter(metadata, filters) {
    if (!filters || Object.keys(filters).length === 0) return true;
    for (const [key, expected] of Object.entries(filters)) {
      const actual = metadata[key];
      if (typeof expected === 'object' && expected !== null) {
        if (Array.isArray(expected.$in)) {
          if (!expected.$in.includes(actual)) return false;
        } else if (typeof expected.$prefix === 'string') {
          if (typeof actual !== 'string' || !actual.startsWith(expected.$prefix)) return false;
        }
      } else {
        if (actual !== expected) return false;
      }
    }
    return true;
  }

  /**
   * Execute search request according to TorqueQuery conformance specification.
   */
  search(request) {
    const startTime = Date.now();
    if (!request || typeof request !== 'object') {
      throw new TorqueQueryError(TORQUE_ERROR_CODES.BAD_REQUEST, 'Request must be an object');
    }

    if (request.query === undefined || request.query === null) {
      throw new TorqueQueryError(TORQUE_ERROR_CODES.BAD_REQUEST, 'Query parameter is required');
    }

    if (typeof request.query !== 'string' || request.query.trim().length === 0) {
      throw new TorqueQueryError(TORQUE_ERROR_CODES.EMPTY_QUERY, 'Query string cannot be empty');
    }

    const topK = request.top_k !== undefined ? request.top_k : TORQUE_DEFAULTS.TOP_K;
    if (typeof topK !== 'number' || !Number.isInteger(topK) || topK <= 0 || topK > TORQUE_DEFAULTS.MAX_TOP_K) {
      throw new TorqueQueryError(
        TORQUE_ERROR_CODES.BAD_LIMIT,
        `top_k must be an integer between 1 and ${TORQUE_DEFAULTS.MAX_TOP_K}`
      );
    }

    const candidatePool = request.candidate_pool || TORQUE_DEFAULTS.CANDIDATE_POOL;
    const fastPathRequested = Boolean(request.fast_path);
    const skipMmr = Boolean(request.skip_mmr);
    const hasNormalizedEmbedding = Array.isArray(request.normalized_embedding);

    // Fast-path eligibility criteria: fast_path requested, skip_mmr is true, and normalized embedding supplied
    const isFastPath = fastPathRequested && skipMmr && hasNormalizedEmbedding;

    // Vector to use for query
    let queryVector;
    if (hasNormalizedEmbedding) {
      queryVector = normalizeVector(request.normalized_embedding);
    } else {
      queryVector = computeEmbedding(request.query);
    }

    // Filter candidate pool
    const filtered = this.corpus.filter((doc) => this.matchesFilter(doc.metadata, request.filters));

    // Score candidates
    const scoredCandidates = filtered.map((doc) => ({
      id: doc.id,
      score: cosineSimilarity(queryVector, doc.embedding),
      metadata: doc.metadata,
      embedding: doc.embedding,
    }));

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);
    const candidates = scoredCandidates.slice(0, candidatePool);

    let finalResults;
    if (isFastPath || skipMmr) {
      // Pure top-k ranking
      finalResults = candidates.slice(0, topK);
    } else {
      // Maximal Marginal Relevance (MMR) re-ranking
      finalResults = this.applyMmr(queryVector, candidates, topK, 0.7);
    }

    const response = {
      results: finalResults.map((r) => ({
        id: r.id,
        score: Number(r.score.toFixed(6)),
        metadata: r.metadata,
      })),
      fast_path_used: isFastPath,
      query: request.query,
      candidate_pool: candidates.length,
    };

    if (request.explain) {
      response.plan = {
        execution_ms: Date.now() - startTime,
        corpus_total: this.corpus.length,
        filtered_count: filtered.length,
        is_fast_path: isFastPath,
        embedding_type: hasNormalizedEmbedding ? 'caller_supplied' : 'server_computed',
      };
    }

    return response;
  }

  /**
   * Maximal Marginal Relevance (MMR) algorithm
   * Selects documents balancing query relevance and intra-result diversity.
   */
  applyMmr(queryVec, candidates, topK, lambda = 0.7) {
    if (candidates.length <= topK) return candidates;

    const selected = [];
    const unselected = candidates.slice();

    while (selected.length < topK && unselected.length > 0) {
      let bestIndex = -1;
      let bestMmrScore = -Infinity;

      for (let i = 0; i < unselected.length; i++) {
        const item = unselected[i];
        const simToQuery = item.score;

        let maxSimToSelected = 0;
        for (const s of selected) {
          const sim = cosineSimilarity(item.embedding, s.embedding);
          if (sim > maxSimToSelected) maxSimToSelected = sim;
        }

        const mmrScore = lambda * simToQuery - (1 - lambda) * maxSimToSelected;
        if (mmrScore > bestMmrScore) {
          bestMmrScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex !== -1) {
        selected.push(unselected[bestIndex]);
        unselected.splice(bestIndex, 1);
      } else {
        break;
      }
    }

    return selected;
  }
}
