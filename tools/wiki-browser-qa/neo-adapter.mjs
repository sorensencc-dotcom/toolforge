import { readFile } from 'node:fs/promises';

import { mergeEvidence, normalizeBrowserObservation, pageEvidenceExpression } from './browser-adapter.mjs';

const DEFAULT_NEO_MCP_URL = 'http://127.0.0.1:9010/mcp';
const NEO_PROTOCOL_VERSION = '2025-06-18';
const TRANSIENT_KINDS = new Set(['timeout', 'navigation-failure', 'network-failure']);

function neoError(kind, message, details = {}) {
  const error = new Error(message);
  error.kind = kind;
  if (TRANSIENT_KINDS.has(kind)) error.transient = true;
  Object.assign(error, details);
  return error;
}

function setupDiagnostic(url) {
  return `Start BrowserOS neo and confirm the cockpit shows a connected session, or point WIKI_QA_NEO_MCP_URL at the running endpoint (current: ${url}). Wiki QA never falls back to HTTP-only checks.`;
}

// Runs inside the real page via browser.evaluate; returns page metadata the checks need.
const META_CODE = `return (function () {
  const contentRoot = document.querySelector('#wiki-body, .wiki-wrapper .markdown-body, #wiki-content, .markdown-body') || document.body;
  const headings = [...contentRoot.querySelectorAll('h1,h2,h3,h4,h5,h6')].slice(0, 200).map((node) => ({
    role: 'heading',
    level: Number(node.tagName.slice(1)),
    text: (node.textContent || '').trim().slice(0, 200),
  }));
  const h1 = headings.find((heading) => heading.level === 1) || null;
  const failedRequests = [];
  try {
    for (const entry of performance.getEntriesByType('resource')) {
      const status = entry.responseStatus;
      const name = String(entry.name);
      // favicon.ico is browser-initiated chrome, not page content; do not treat as a page defect.
      if (name.indexOf('/favicon.ico') !== -1) continue;
      if (typeof status === 'number' && status >= 400) failedRequests.push({ url: name, status });
    }
  } catch (error) { /* responseStatus unsupported */ }
  // Cap body text: only the top of the document matters for frontmatter detection, and a full
  // innerText dump of a large live page can exceed the MCP evaluate return-size budget.
  const bodyText = contentRoot ? String(contentRoot.innerText || '').slice(0, 6000) : '';
  return {
    title: h1?.text || document.title || '',
    text: bodyText,
    headings,
    heading: h1 ? { level: 1, text: h1.text } : null,
    failedRequests,
  };
})()`;

function parseNeoConsole(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^\[(?:END_)?UNTRUSTED_PAGE_CONTENT\b/i.test(line)) continue;
    if (/^\(no console (?:errors|messages|warnings|errors or warnings)/i.test(line)) continue;
    const level = /\bwarn(?:ing)?\b/i.test(line) ? 'warning' : 'error';
    lines.push({ level, text: line });
  }
  return lines;
}

// Body for the Neo `run` tool. It navigates once, emulates each layout viewport with CDP, and
// captures metadata + per-viewport evidence. Large evaluate results are spilled by the MCP layer
// to a local file; the script forwards the spill path and the Node adapter reads it back, so the
// run's own return value always stays small.
function buildRunScript(href, diagramRules) {
  const evidenceCode = `return await (${pageEvidenceExpression(diagramRules)})`;
  return `
const parseNeoConsole = ${parseNeoConsole.toString()};
const TARGET = ${JSON.stringify(href)};
const META_CODE = ${JSON.stringify(META_CODE)};
const EVIDENCE_CODE = ${JSON.stringify(evidenceCode)};
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
];

const readEval = async (code, label) => {
  let result;
  try {
    result = await browser.evaluate(pageId, { code });
  } catch (error) {
    return { __error: label + ' evaluate threw: ' + ((error && error.message) || String(error)) };
  }
  if (result && typeof result === 'object' && (result.writtenToFile === true || typeof result.path === 'string') && !('value' in result)) {
    return { __spillPath: result.path, __contentLength: result.contentLength };
  }
  if (!result || typeof result !== 'object' || !('value' in result) || result.value === undefined || result.value === null) {
    return { __error: label + ' evaluate returned no value: ' + JSON.stringify(result).slice(0, 200) };
  }
  return { value: result.value };
};

const opened = await browser.pages.newPage('about:blank', { background: true });
const pageId = opened && typeof opened === 'object' ? (opened.id ?? opened.pageId ?? opened.targetId ?? opened) : opened;
try {
  try {
    await browser.nav(pageId).goto(TARGET);
  } catch (error) {
    return { __error: 'navigation failed: ' + ((error && error.message) || String(error)), __kind: 'navigation-failure' };
  }
  await new Promise((resolve) => setTimeout(resolve, 600));

  const meta = await readEval(META_CODE, 'page metadata');
  if (meta.__error) return { __error: meta.__error, __kind: 'navigation-failure' };

  let consoleText = '';
  try { consoleText = await browser.read(pageId, { format: 'console' }); } catch (error) { consoleText = ''; }

  const viewports = [];
  for (const viewport of VIEWPORTS) {
    try {
      // Pure layout-viewport resize (mobile:false) so width-based horizontal-overflow
      // detection stays meaningful; mobile:true triggers Chrome's 980px fallback layout
      // for pages without a viewport meta tag and hides real overflow.
      await browser.cdpJsonForPage(pageId, 'Emulation.setDeviceMetricsOverride', JSON.stringify({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
      }));
    } catch (error) { /* emulation unsupported: fall back to native size */ }
    await new Promise((resolve) => setTimeout(resolve, 150));

    const evidence = await readEval(EVIDENCE_CODE, 'evidence at ' + viewport.name);
    if (evidence.__error) return { __error: evidence.__error, __kind: 'navigation-failure' };
    viewports.push({
      name: viewport.name,
      width: viewport.width,
      height: viewport.height,
      evidence: evidence.__spillPath ? { __spillPath: evidence.__spillPath } : evidence.value,
    });
  }

  try { await browser.cdpJsonForPage(pageId, 'Emulation.clearDeviceMetricsOverride', '{}'); } catch (error) { /* best-effort */ }

  return {
    ok: true,
    url: TARGET,
    meta: meta.__spillPath ? { __spillPath: meta.__spillPath } : meta.value,
    console: parseNeoConsole(String(consoleText || '').slice(0, 8000)),
    viewports,
  };
} finally {
  try { await browser.pages.close(pageId); } catch (error) { /* best-effort tab cleanup */ }
}
`;
}

function stripExtendedPrefix(pathValue) {
  return typeof pathValue === 'string' ? pathValue.replace(/^\\\\\?\\/, '') : pathValue;
}

// Resolves an evaluate result that the MCP layer spilled to a local file back into a value.
async function resolveSpill(value, label) {
  if (!value || typeof value !== 'object' || typeof value.__spillPath !== 'string') return value;
  let raw;
  try {
    raw = await readFile(stripExtendedPrefix(value.__spillPath), 'utf8');
  } catch (error) {
    throw neoError('navigation-failure', `BrowserOS neo: ${label} spilled to ${value.__spillPath} but the file could not be read: ${error?.message ?? error}`);
  }
  // Spill files wrap the payload in [UNTRUSTED_PAGE_CONTENT ...] / [END_UNTRUSTED_PAGE_CONTENT ...] lines.
  const unwrapped = raw
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[(?:END_)?UNTRUSTED_PAGE_CONTENT\b/.test(line))
    .join('\n')
    .trim();
  try {
    return JSON.parse(unwrapped);
  } catch {
    throw neoError('malformed-output', `BrowserOS neo: ${label} spill file was not JSON`);
  }
}

// Trims full link/image inventories to the entries the checks act on, keeping reports compact.
function pruneObservation(observation) {
  observation.text = String(observation.text || '').slice(0, 6000);
  observation.domAssertions = (observation.domAssertions || observation.dom || [])
    .slice(0, 200)
    .map((heading) => ({ role: 'heading', level: heading.level, text: String(heading.text || '').slice(0, 200) }));
  observation.dom = observation.domAssertions;
  observation.links = (observation.links || []).filter((link) => {
    if (link && link.inScope === false) return false;
    const status = Number(link && link.status);
    const ok2xx = Number.isInteger(status) && status >= 200 && status < 300;
    return !(link && link.ok === true) && !ok2xx;
  }).slice(0, 200);
  observation.images = (observation.images || []).filter((image) => {
    if (!image) return true;
    return !image.alt || !(Number(image.naturalWidth) > 0) || !(Number(image.naturalHeight) > 0)
      || image.loaded === false || image.complete === false;
  }).slice(0, 200);
  return observation;
}

async function assembleObservation(envelope) {
  const meta = await resolveSpill(envelope.meta, 'page metadata');
  if (!meta || typeof meta !== 'object') {
    throw neoError('navigation-failure', 'BrowserOS neo: page metadata was empty');
  }
  const observation = {
    url: envelope.url,
    title: meta.title ?? '',
    text: meta.text ?? '',
    heading: meta.heading ?? null,
    dom: Array.isArray(meta.headings) ? meta.headings : [],
    accessibility: '',
    console: Array.isArray(envelope.console) ? envelope.console : [],
    network: Array.isArray(meta.failedRequests) ? meta.failedRequests : [],
    links: [],
    diagrams: [],
    viewport: {},
  };
  for (const view of envelope.viewports ?? []) {
    const resolved = await resolveSpill(view.evidence, `evidence at ${view.name}`);
    const evidence = typeof resolved === 'string' ? JSON.parse(resolved) : resolved;
    mergeEvidence(observation, evidence, view.name);
    const raw = (evidence && evidence.viewport) || {};
    observation.viewport[view.name] = {
      width: view.width,
      height: view.height,
      scrollWidth: Number.isFinite(raw.scrollWidth) ? raw.scrollWidth : view.width,
      clientWidth: Number.isFinite(raw.clientWidth) ? raw.clientWidth : view.width,
      overflow: Boolean(raw.overflow),
    };
  }
  return pruneObservation(observation);
}

function textFromContent(result) {
  if (!result || !Array.isArray(result.content)) return '';
  const entry = result.content.find((item) => item && item.type === 'text' && typeof item.text === 'string');
  return entry ? entry.text : '';
}

function extractRunReturn(result) {
  const text = textFromContent(result);
  if (result?.isError) {
    const error = neoError('navigation-failure', `BrowserOS neo run failed: ${text.slice(0, 400) || 'unknown error'}`);
    throw error;
  }
  const marker = text.indexOf('return:');
  if (marker === -1) throw neoError('malformed-output', `BrowserOS neo run produced no return value: ${text.slice(0, 200)}`);
  let payload = text.slice(marker + 'return:'.length).trim();
  let value;
  try {
    value = JSON.parse(payload);
    if (typeof value === 'string') value = JSON.parse(value);
  } catch {
    throw neoError('malformed-output', 'BrowserOS neo run return value was not JSON');
  }
  if (value && typeof value === 'object' && typeof value.__error === 'string') {
    throw neoError(value.__kind === 'navigation-failure' ? 'navigation-failure' : 'browser-failure', `BrowserOS neo: ${value.__error}`);
  }
  return value;
}

// Parses a Streamable-HTTP MCP response body (JSON or SSE) into the JSON-RPC message with the given id.
function parseMcpBody(contentType, body, id) {
  if ((contentType || '').includes('text/event-stream')) {
    const payloads = [];
    for (const line of body.split(/\r?\n/)) {
      const match = /^data:\s?(.*)$/.exec(line);
      if (match && match[1]) payloads.push(match[1]);
    }
    let fallback = null;
    for (const payload of payloads) {
      try {
        const message = JSON.parse(payload);
        if (message && message.id === id) return message;
        if (message && 'result' in message) fallback = message;
      } catch { /* skip keep-alive frames */ }
    }
    if (fallback) return fallback;
    throw neoError('malformed-output', 'BrowserOS neo MCP stream carried no JSON-RPC result');
  }
  try {
    return JSON.parse(body);
  } catch {
    throw neoError('malformed-output', 'BrowserOS neo MCP response was not JSON');
  }
}

function createHttpTransport({ url, fetchImpl, defaultTimeoutMs }) {
  let sessionId = null;
  let serverInfo = null;
  let handshake = null;
  let nextId = 1;

  function headers() {
    const base = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (sessionId) base['mcp-session-id'] = sessionId;
    return base;
  }

  async function rpc(method, params, timeoutMs) {
    const id = nextId++;
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: AbortSignal.timeout(timeoutMs ?? defaultTimeoutMs),
      });
    } catch (error) {
      const kind = error?.name === 'TimeoutError' ? 'timeout' : 'setup-failure';
      throw neoError(kind, `BrowserOS neo MCP endpoint unreachable at ${url}: ${error?.message ?? error}`, { cause: error });
    }
    const sid = response.headers.get('mcp-session-id');
    if (sid) sessionId = sid;
    const bodyText = await response.text();
    if (!response.ok) {
      throw neoError('setup-failure', `BrowserOS neo MCP endpoint returned HTTP ${response.status} at ${url}`);
    }
    const message = parseMcpBody(response.headers.get('content-type'), bodyText, id);
    if (message.error) {
      throw neoError('browser-failure', `BrowserOS neo MCP error ${message.error.code ?? ''}: ${message.error.message ?? 'unknown'}`.trim(), { data: message.error });
    }
    return message.result;
  }

  async function notify(method, params) {
    try {
      await fetchImpl(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ jsonrpc: '2.0', method, params }),
        signal: AbortSignal.timeout(defaultTimeoutMs),
      });
    } catch { /* notifications are best-effort */ }
  }

  function ensureHandshake(timeoutMs) {
    handshake ??= (async () => {
      const result = await rpc('initialize', {
        protocolVersion: NEO_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'wiki-browser-qa', version: '1.0.0' },
      }, timeoutMs);
      serverInfo = result?.serverInfo ?? null;
      await notify('notifications/initialized', {});
      return result;
    })().catch((error) => {
      handshake = null;
      throw error;
    });
    return handshake;
  }

  return {
    async listTools(timeoutMs) {
      await ensureHandshake(timeoutMs);
      return rpc('tools/list', {}, timeoutMs);
    },
    async callTool(name, args, timeoutMs) {
      await ensureHandshake(timeoutMs);
      return rpc('tools/call', { name, arguments: args }, timeoutMs);
    },
    serverInfo() {
      return serverInfo;
    },
    async close() {
      if (!sessionId) return;
      try {
        await fetchImpl(url, { method: 'DELETE', headers: { 'mcp-session-id': sessionId }, signal: AbortSignal.timeout(defaultTimeoutMs) });
      } catch { /* best-effort session teardown */ }
    },
  };
}

export function createNeoAdapter(options = {}) {
  const url = options.url || process.env.WIKI_QA_NEO_MCP_URL || DEFAULT_NEO_MCP_URL;
  const defaultTimeoutMs = options.timeoutMs ?? 30_000;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('createNeoAdapter requires a global fetch (Node 18+) or an injected fetch implementation');
  }
  const transport = options.transport ?? createHttpTransport({ url, fetchImpl, defaultTimeoutMs });
  let pageQueue = Promise.resolve();
  let closed = false;

  async function checkExecutable() {
    try {
      const listing = await transport.listTools(defaultTimeoutMs);
      const toolNames = new Set((listing?.tools ?? []).map((tool) => tool.name));
      for (const required of ['run', 'navigate', 'evaluate']) {
        if (!toolNames.has(required)) {
          return {
            available: false,
            kind: 'setup-failure',
            version: transport.serverInfo?.()?.version ?? null,
            diagnostics: `BrowserOS neo MCP at ${url} does not expose the "${required}" tool. ${setupDiagnostic(url)}`,
          };
        }
      }
      const probe = await transport.callTool('run', { code: 'return "wiki-qa-neo-live"', timeout: 15_000 }, defaultTimeoutMs);
      const probeText = textFromContent(probe);
      if (probe?.isError || !probeText.includes('wiki-qa-neo-live')) {
        return {
          available: false,
          kind: 'setup-failure',
          version: transport.serverInfo?.()?.version ?? null,
          diagnostics: `BrowserOS neo browser session is not connected at ${url}. ${setupDiagnostic(url)} Detail: ${probeText.slice(0, 200) || 'run tool returned no output'}`,
        };
      }
      const version = transport.serverInfo?.()?.version ?? null;
      return {
        available: true,
        kind: null,
        version,
        diagnostics: `BrowserOS neo MCP healthy at ${url}${version ? ` (server ${version})` : ''}`,
      };
    } catch (error) {
      return {
        available: false,
        kind: 'setup-failure',
        version: null,
        diagnostics: `BrowserOS neo MCP is unavailable at ${url}: ${error?.message ?? error}. ${setupDiagnostic(url)}`,
      };
    }
  }

  async function collectPage(target, openOptions = {}) {
    if (closed) throw neoError('lifecycle', 'Neo browser adapter is closed');
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      throw neoError('invalid-url', 'browser URL is invalid or contains credentials');
    }
    if (parsed.username || parsed.password) throw neoError('invalid-url', 'browser URL is invalid or contains credentials');
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw neoError('invalid-url', 'browser URL must be http or https');

    const runTimeout = Math.max(20_000, openOptions.timeoutMs ?? defaultTimeoutMs);
    const script = buildRunScript(parsed.href, openOptions.diagramRules ?? []);
    let result;
    try {
      result = await transport.callTool('run', { code: script, timeout: runTimeout }, runTimeout + 15_000);
    } catch (error) {
      if (error?.kind === 'setup-failure') throw error;
      if (error?.kind === 'timeout') throw error;
      throw neoError('navigation-failure', `BrowserOS neo run invocation failed: ${error?.message ?? error}`);
    }
    let envelope = extractRunReturn(result);
    // The run's own return value can also be spilled to a file by the MCP layer.
    if (envelope && typeof envelope === 'object' && envelope.writtenToFile === true && typeof envelope.path === 'string') {
      envelope = await resolveSpill({ __spillPath: envelope.path }, 'run result');
    }
    if (envelope && typeof envelope === 'object' && typeof envelope.__error === 'string') {
      throw neoError(envelope.__kind === 'navigation-failure' ? 'navigation-failure' : 'browser-failure', `BrowserOS neo: ${envelope.__error}`);
    }
    const observation = await assembleObservation(envelope);
    return normalizeBrowserObservation(observation, parsed.href);
  }

  function openPage(target, openOptions = {}) {
    const operation = pageQueue.then(() => collectPage(target, openOptions));
    pageQueue = operation.catch(() => {});
    return operation;
  }

  async function close() {
    closed = true;
    try { await pageQueue; } catch { /* drain */ }
    await transport.close?.();
  }

  return { backend: 'neo', url, checkExecutable, openPage, close };
}
