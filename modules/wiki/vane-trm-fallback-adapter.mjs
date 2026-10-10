import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { TRMSourceResolver } from './trm-source-resolver.mjs';
import { validateLoopbackUrl, CircuitBreaker } from './vane-infra.mjs';

const sha256 = (val) => `sha256:${crypto.createHash('sha256').update(val, 'utf8').digest('hex')}`;

export class VaneTRMFallbackAdapter {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://127.0.0.1:3000';
    this.stagingRoot = options.stagingRoot ? path.resolve(options.stagingRoot) : path.resolve('_kb-sync-staging');
    this.timeoutMs = options.timeoutMs || 35000;
    this.breaker = options.breaker || new CircuitBreaker();
    validateLoopbackUrl(this.baseUrl);

    this.sourcesMap = new Map();
    this.resolver = options.resolver || new TRMSourceResolver(this.stagingRoot, {
      resolveSource: async (id) => this.sourcesMap.get(id) || null
    });
    this.cachedModels = null;
  }

  async resolveActiveModels(signal) {
    if (this.cachedModels) return this.cachedModels;

    const res = await fetch(`${this.baseUrl}/api/providers`, { signal });
    if (!res.ok) throw new Error(`HTTP_${res.status}: Failed to fetch providers`);
    const data = await res.json();
    const providers = data.providers || [];
    if (providers.length === 0) {
      const err = new Error('NO_ACTIVE_PROVIDERS: Vane has no active model providers configured');
      err.isContractError = true;
      throw err;
    }

    // Dynamic provider discovery, prioritizing Ollama
    const provider = providers.find(p => p.name?.toLowerCase().includes('ollama')) || providers[0];
    const chatModel = provider.chatModels?.[0]?.key || 'default';
    const embeddingModel = provider.embeddingModels?.[0]?.key || 'default';

    this.cachedModels = {
      chatModel: { providerId: provider.id, key: chatModel },
      embeddingModel: { providerId: provider.id, key: embeddingModel }
    };
    return this.cachedModels;
  }

  async resolveGapWithVane(query, context = {}) {
    if (typeof query !== 'string' || !query.trim()) {
      throw new Error('CONTRACT_ERROR: query must be a non-empty string');
    }

    if (!this.breaker.canExecute()) {
      return {
        ok: false,
        source: 'vane-fallback-circuit-break',
        error: 'CIRCUIT_BREAKER_OPEN: Service unavailable, fast-failing to preserve pipeline.',
        fallback_recommended: true
      };
    }

    const batchId = context.batchId || `batch-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`;
    const mode = context.mode || 'balanced';
    const isApproved = context.approved === true; // Strict approval trust boundary

    const stagingRoot = context.stagingRoot ? path.resolve(context.stagingRoot) : this.stagingRoot;
    const resolver = (context.stagingRoot && stagingRoot !== this.stagingRoot)
      ? new TRMSourceResolver(stagingRoot, {
          resolveSource: async (id) => this.sourcesMap.get(id) || null
        })
      : this.resolver;

    const timeoutMs = context.timeoutMs || this.timeoutMs;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let isTransportError = false;

    try {
      isTransportError = true;
      const models = await this.resolveActiveModels(controller.signal);

      const requestPayload = {
        chatModel: models.chatModel,
        embeddingModel: models.embeddingModel,
        optimizationMode: mode,
        sources: ['web'],
        query: query.trim(),
        history: [],
        stream: false
      };

      const response = await fetch(`${this.baseUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-TRM-Source': 'closed-loop-v2'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Vane HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonResult = await response.json();
      this.breaker.recordSuccess();
      isTransportError = false; // Downstream is now data processing / resolver boundary

      const answer = jsonResult.message || '';
      const rawSources = jsonResult.sources || [];

      // Format sources and populate resolver
      const findings = [];
      rawSources.forEach((s, idx) => {
        const sourceId = `SRC-${101 + idx}`;
        const rawContent = String(s.content || '').trim();
        const text = rawContent.length > 0 ? rawContent : `Source reference content for ${sourceId}`;
        const revision = sha256(text);
        const metadata = s.metadata || {};

        // Accurate span calculation
        const spanEnd = Math.max(1, Math.min(25, text.length));
        const sourceSpan = {
          start: 0,
          end: spanEnd,
          span_hash: sha256(text.slice(0, spanEnd))
        };

        this.sourcesMap.set(sourceId, {
          title: metadata.title || `Vane Result ${idx + 1}`,
          url: metadata.url || 'http://127.0.0.1:3000/local-search',
          retrieved_at: new Date().toISOString(),
          text,
          revision
        });

        findings.push({
          type: 'observation',
          source_id: sourceId,
          source_revision: revision,
          source_span: sourceSpan,
          confidence: 0.9,
          rationale: 'Retrieved via Vane search snippet.'
        });
      });

      const researchResult = {
        schema: 'research.result.v1',
        task_id: `TASK-${query.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}`,
        run_id: `RUN-${Date.now()}`,
        status: 'completed',
        producer: { engine: 'vane', provider: 'local', model: 'ollama', prompt_version: 'v1' },
        requires_approval: true,
        payload: {
          target_claim_ids: ['CLAIM-VANE-1'],
          findings
        }
      };

      // Governed materialization: passes caller approval contract
      const resolvedOutput = await resolver.resolveAndMaterialize(researchResult, batchId, { approved: isApproved });

      return {
        ok: true,
        source: 'vane-local',
        answer,
        batch_id: batchId,
        mappings: resolvedOutput.mappings,
        manifest: resolvedOutput.manifest,
        payload: resolvedOutput.payload
      };
    } catch (err) {
      if (err.isContractError) {
        throw err;
      }
      if (isTransportError) {
        this.breaker.recordFailure(true);
        return {
          ok: false,
          source: 'vane-fallback-circuit-break',
          error: err.message,
          fallback_recommended: true
        };
      }
      // Re-throw contract/approval errors
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
