import { createBrowserAdapter } from './browser-adapter.mjs';
import { createNeoAdapter } from './neo-adapter.mjs';

export const BACKENDS = ['gstack', 'neo'];
export const DEFAULT_BACKEND = 'gstack';

export function resolveBackendName(env = {}) {
  const raw = String(env.WIKI_QA_BROWSER_BACKEND ?? DEFAULT_BACKEND).trim().toLowerCase();
  if (!BACKENDS.includes(raw)) {
    throw new Error(`WIKI_QA_BROWSER_BACKEND must be one of ${BACKENDS.join(', ')}; received "${raw}"`);
  }
  return raw;
}

// Selects the real browser backend. `gstack` drives the local gstack browse executable (CLI/CI);
// `neo` drives BrowserOS neo through its Streamable-HTTP MCP endpoint. Both return the same
// { backend, checkExecutable, openPage, close } adapter contract the runner consumes.
export function createBackendAdapter(env = {}, options = {}) {
  const name = resolveBackendName(env);
  if (name === 'neo') {
    return createNeoAdapter({
      url: env.WIKI_QA_NEO_MCP_URL || undefined,
      timeoutMs: options.timeoutMs,
    });
  }
  return createBrowserAdapter({ timeoutMs: options.timeoutMs });
}
