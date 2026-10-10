import * as crypto from 'node:crypto';
import { validateLoopbackUrl, GPULock } from '../../../modules/wiki/vane-infra.mjs';

export class VaneResearchSkill {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:3000';
    this.enforceLoopback = config.enforceLoopbackOnly !== false;
    this.gpuLock = new GPULock(config.lockPath);
    if (this.enforceLoopback) {
      validateLoopbackUrl(this.baseUrl);
    }
    this.cachedModels = null;
  }

  static TIMEOUT_MAP = {
    speed: 10_000,
    balanced: 30_000,
    quality: 60_000
  };

  computeContentHash(answer, sources) {
    const canonicalPayload = {
      answer: answer.trim(),
      sources: [...sources].sort((a, b) => a.source_id.localeCompare(b.source_id))
    };
    return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
  }

  normalizeSources(rawSources, maxCount) {
    if (!Array.isArray(rawSources)) return [];

    return rawSources.slice(0, maxCount).map((item, index) => {
      const metadata = item.metadata || {};
      const sourceId = `SRC-${101 + index}`;
      return {
        source_id: sourceId,
        title: String(metadata.title || `Vane Result ${index + 1}`).trim(),
        url: String(metadata.url || 'http://127.0.0.1:3000/local-search'),
        snippet_preview: String(item.content || '').slice(0, 500).trim()
      };
    });
  }

  async resolveActiveModels(signal) {
    if (this.cachedModels) return this.cachedModels;

    const res = await fetch(`${this.baseUrl}/api/providers`, { signal });
    if (!res.ok) throw new Error(`HTTP_${res.status}: Failed to fetch providers`);
    const data = await res.json();
    const providers = data.providers || [];
    if (providers.length === 0) throw new Error('NO_ACTIVE_PROVIDERS: Vane has no active model providers configured');

    const provider = providers.find(p => p.name?.toLowerCase().includes('ollama')) || providers[0];
    const chatModel = provider.chatModels?.[0]?.key;
    const embeddingModel = provider.embeddingModels?.[0]?.key;

    if (!chatModel || !embeddingModel) {
      throw new Error('PROVIDER_MODELS_INCOMPLETE: Missing chat or embedding models on provider');
    }

    this.cachedModels = {
      chatModel: { providerId: provider.id, key: chatModel },
      embeddingModel: { providerId: provider.id, key: embeddingModel }
    };
    return this.cachedModels;
  }

  async execute(input) {
    const executionId = `exec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();
    const mode = input?.mode || 'balanced';
    const timeoutMs = VaneResearchSkill.TIMEOUT_MAP[mode] || 30_000;
    const workerId = `worker-vane-${process.pid}`;

    // 1. Input Validation
    if (!input || !input.query || typeof input.query !== 'string' || input.query.trim().length < 3) {
      return {
        execution_id: executionId,
        success: false,
        type: 'READ_ONLY',
        error: {
          code: 'INVALID_INPUT',
          message: 'Query parameter must be a string with at least 3 characters.',
          fallback_recommended: false
        },
        telemetry: {
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          worker_id: workerId
        }
      };
    }

    // 2. Cross-Process GPU Concurrency Lock
    const acquired = this.gpuLock.acquire();
    if (!acquired) {
      return {
        execution_id: executionId,
        success: false,
        type: 'READ_ONLY',
        error: {
          code: 'VRAM_CONCURRENCY_SATURATED',
          message: 'Active Vane GPU lock held by another process. Halting to protect VRAM.',
          fallback_recommended: true
        },
        telemetry: {
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          worker_id: workerId
        }
      };
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const models = await this.resolveActiveModels(controller.signal);

      // Live Vane request contract
      const requestPayload = {
        chatModel: models.chatModel,
        embeddingModel: models.embeddingModel,
        optimizationMode: mode,
        sources: ['web'],
        query: input.query.trim(),
        history: [],
        stream: false
      };

      const response = await fetch(`${this.baseUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Client-Agent': 'Toolforge-VaneSkill/2.0.0'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}: ${response.statusText}`);
      }

      const jsonResult = await response.json();
      const answer = jsonResult.message || 'No answer synthesized by upstream model.';
      const rawSources = jsonResult.sources || [];
      const normalizedSources = this.normalizeSources(rawSources, input.max_sources || 8);
      const contentHash = this.computeContentHash(answer, normalizedSources);
      const durationMs = Date.now() - startTime;

      return {
        execution_id: executionId,
        success: true,
        type: 'READ_ONLY',
        data: {
          query: input.query.trim(),
          answer,
          sources: normalizedSources,
          mode,
          timing_ms: durationMs,
          content_hash: contentHash
        },
        telemetry: {
          duration_ms: durationMs,
          timestamp: new Date().toISOString(),
          worker_id: workerId
        }
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const isAbort = err.name === 'AbortError';
      const isConnRefused = err.cause?.code === 'ECONNREFUSED' || String(err.message).includes('ECONNREFUSED');

      return {
        execution_id: executionId,
        success: false,
        type: 'READ_ONLY',
        error: {
          code: isAbort ? 'EXECUTION_TIMEOUT' : isConnRefused ? 'VANE_SERVICE_UNAVAILABLE' : 'UPSTREAM_SEARCH_ERROR',
          message: isAbort
            ? `Execution timed out after ${timeoutMs}ms in '${mode}' mode.`
            : `Failed contacting Vane at ${this.baseUrl}: ${err.message}`,
          fallback_recommended: true
        },
        telemetry: {
          duration_ms: durationMs,
          timestamp: new Date().toISOString(),
          worker_id: workerId
        }
      };
    } finally {
      clearTimeout(timeoutHandle);
      this.gpuLock.release();
    }
  }
}
