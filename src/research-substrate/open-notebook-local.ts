import type { ResearchRequest, ResearchResult } from './types.js';
import { validatePolicy } from './policy.js';

export interface OpenNotebookAdapterOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  maxResponseBytes?: number;
  healthTimeoutMs?: number;
}

export class OpenNotebookAdapterError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'OpenNotebookAdapterError';
  }
}

function loopbackUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new OpenNotebookAdapterError('INVALID_URL', 'baseUrl must be a valid URL'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) {
    throw new OpenNotebookAdapterError('NON_LOOPBACK_URL', 'Open Notebook adapter permits loopback HTTP URLs only');
  }
  return url;
}

function result(request: ResearchRequest, outcome: ResearchResult['outcome'], draft = '', workflowId = 'open-notebook-chat-execute'): ResearchResult {
  return { correlation_id: request.correlation_id, draft_output: draft, source_references: request.source_references, model: request.provider_opt_in.model, provider: request.provider_opt_in.provider, workflow_id: workflowId, outcome };
}

async function boundedJson(response: Response, limit: number): Promise<Record<string, unknown>> {
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > limit) throw new OpenNotebookAdapterError('OUTPUT_LIMIT', 'response exceeds max output bytes');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > limit) throw new OpenNotebookAdapterError('OUTPUT_LIMIT', 'response exceeds max output bytes');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new OpenNotebookAdapterError('MALFORMED_RESPONSE', 'response is not valid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new OpenNotebookAdapterError('MALFORMED_RESPONSE', 'response must be a JSON object');
  return parsed as Record<string, unknown>;
}

export function createOpenNotebookLocalAdapter(options: OpenNotebookAdapterOptions) {
  const base = loopbackUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxResponseBytes ?? 1_048_576;
  return {
    async execute(request: ResearchRequest, selection = request.provider_opt_in): Promise<ResearchResult> {
      const decision = validatePolicy(request, selection);
      if (!decision.allowed) throw new OpenNotebookAdapterError('POLICY_REJECTED', decision.reason ?? 'request rejected');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeout_ms);
      try {
        const health = await fetchImpl(new URL('/health', base), { method: 'GET', signal: controller.signal });
        if (!health.ok) throw new OpenNotebookAdapterError('HEALTH_FAILED', `health returned HTTP ${health.status}`);
        const healthBody = await boundedJson(health, maxBytes);
        if (healthBody.status !== 'healthy') throw new OpenNotebookAdapterError('HEALTH_FAILED', 'health response is not healthy');
        const response = await fetchImpl(new URL('/chat/execute', base), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: request.input }), signal: controller.signal });
        if (!response.ok) throw new OpenNotebookAdapterError('HTTP_ERROR', `chat execution returned HTTP ${response.status}`);
        const body = await boundedJson(response, Math.min(maxBytes, request.max_output_bytes));
        if (Object.keys(body).some((key) => !['content', 'session_id'].includes(key))) throw new OpenNotebookAdapterError('MALFORMED_RESPONSE', 'chat response contains unknown fields');
        if (typeof body.content !== 'string' || typeof body.session_id !== 'string' || !body.content || !body.session_id) throw new OpenNotebookAdapterError('MALFORMED_RESPONSE', 'chat response requires non-empty content and session_id');
        return result(request, 'accepted', body.content, body.session_id);
      } catch (error) {
        if (error instanceof OpenNotebookAdapterError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') return result(request, 'timed_out');
        return result(request, 'indeterminate');
      } finally { clearTimeout(timer); }
    },
    async replay(): Promise<never> { throw new OpenNotebookAdapterError('REPLAY_UNSUPPORTED', 'operator-resolved replay is forbidden'); },
  };
}
