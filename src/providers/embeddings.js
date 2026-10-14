import { fileURLToPath } from 'node:url';
import { loadModelSelection } from './model-selection.js';
import { routeTask } from '../../scripts/whichllm-router.mjs';
import { validateLoopbackUrl } from '../../modules/wiki/vane-infra.mjs';

export function createLocalEmbeddingProvider({ provider = 'ollama', model, dimensions = 1536,
  baseUrl = provider === 'freellm' ? 'http://127.0.0.1:3001/v1' : 'http://127.0.0.1:11434',
  apiKey, repoRoot = fileURLToPath(new URL('../../', import.meta.url)) } = {}) {
  if (!['ollama', 'freellm'].includes(provider) || dimensions !== 1536 || typeof model !== 'string' ||
      !model.trim() || model !== model.trim() || /(?:^|[/:])(?:auto|cloud)$/i.test(model)) {
    throw new Error('Unsupported local embedding configuration');
  }
  validateLoopbackUrl(baseUrl);
  const url = new URL(baseUrl);
  if (url.username || url.password || url.search || url.hash || !['/', '/v1', '/v1/'].includes(url.pathname)) {
    throw new Error('Unsupported local embedding endpoint');
  }
  if (provider === 'freellm' && (typeof apiKey !== 'string' || !apiKey.trim())) throw new Error('FREELLM_API_KEY required');
  loadModelSelection(repoRoot);
  let identity;
  const request = async (path, body) => {
    const response = await fetch(new URL(path, url), {
      ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      headers: { 'Content-Type': 'application/json', ...(provider === 'freellm' ? { Authorization: `Bearer ${apiKey}` } : {}) },
      redirect: 'error', signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error('Local embedding service unavailable');
    return response.json();
  };
  const installedModel = async () => {
    const catalog = await request('/api/tags');
    const entry = catalog.models?.find(item => item.name === model);
    if (!entry || !/^[a-f0-9]{64}$/.test(entry.digest) || entry.remote_host || entry.remote_model) {
      throw new Error('Requested local embedding model is not installed');
    }
    return entry;
  };
  const embed = async texts => {
    if (!Array.isArray(texts) || !texts.length || texts.length > 16 || texts.some(text => typeof text !== 'string' || !text.trim() || text.length > 8000)) {
      throw new Error('Invalid local embedding input');
    }
    try {
      const route = await routeTask('embed research', { taskType: 'embedding',
        forceTier: provider === 'freellm' ? 'tier_0_5_freellmapi' : 'tier_0_local', modelAnchors: { embedding: model } });
      const installed = provider === 'ollama' ? await installedModel() : null;
      const nextIdentity = `${provider}:${route.targetModel}${installed ? `@${installed.digest}` : ''}:${dimensions}`;
      if (identity && identity !== nextIdentity) throw new Error('Embedding model revision changed; restart and reindex explicitly');
      const data = await request(provider === 'ollama' ? '/api/embed' : '/v1/embeddings', {
        model: route.targetModel, input: texts, dimensions,
        ...(provider === 'ollama' ? { truncate: false } : { encoding_format: 'float' }),
      });
      if (data.model !== model) throw new Error('Embedding model echo mismatch');
      let vectors = data.embeddings;
      if (provider === 'freellm') {
        if (!Array.isArray(data.data) || data.data.length !== texts.length || new Set(data.data.map(row => row.index)).size !== texts.length ||
            data.data.some(row => !Number.isInteger(row.index) || row.index < 0 || row.index >= texts.length)) {
          throw new Error('Invalid FreeLLM embedding response');
        }
        vectors = [...data.data].sort((a, b) => a.index - b.index).map(row => row.embedding);
      }
      if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some(vector =>
        !Array.isArray(vector) || vector.length !== dimensions || !vector.every(Number.isFinite) || !vector.some(value => value !== 0))) {
        throw new Error('Invalid local embedding response');
      }
      if (installed && (await installedModel()).digest !== installed.digest) throw new Error('Embedding model changed during request');
      identity = nextIdentity;
      return vectors;
    } catch { throw new Error('Local embeddings unavailable: check pinned model, dimensions, route, and service availability'); }
  };
  Object.defineProperty(embed, 'identity', { get: () => identity });
  return embed;
}
