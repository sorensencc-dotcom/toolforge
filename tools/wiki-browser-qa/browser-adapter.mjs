import { spawn as nodeSpawn } from 'node:child_process';

const DEFAULT_SETUP_COMMAND = process.platform === 'win32'
  ? '& "$env:USERPROFILE\\.agents\\skills\\gstack\\browse\\dist\\browse.exe" --help'
  : 'cd ~/.agents/skills/gstack/browse && ./setup';
const DEFAULT_SETUP_HINT = 'expected layout: $env:USERPROFILE\\.agents\\skills\\gstack\\browse\\dist\\browse.exe; reinstall or rebuild gstack browse if that executable is absent';

function adapterError(kind, message, details = {}) {
  const error = new Error(message);
  error.kind = kind;
  Object.assign(error, details);
  return error;
}

function versionFrom(text) {
  return text.match(/gstack\s+browse\s+(?:v)?([0-9]+\.[0-9]+\.[0-9]+)/i)?.[1] ?? null;
}

function setupDiagnostic(setupCommand) {
  return process.platform === 'win32'
    ? `PowerShell command: ${setupCommand}; ${DEFAULT_SETUP_HINT}`
    : `setup command: ${setupCommand}`;
}

function validateResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw adapterError('malformed-output', 'browser response must be an object');
  const arrayFields = {
    console: (item) => typeof item.level === 'string' && typeof item.text === 'string',
    consoleErrors: (item) => typeof item.level === 'string' && typeof item.text === 'string',
    network: (item) => typeof item.url === 'string' && (typeof item.status === 'number' || typeof item.status === 'string'),
    failedRequests: (item) => typeof item.url === 'string' && (typeof item.status === 'number' || typeof item.status === 'string'),
    dom: (item) => typeof item.text === 'string' || typeof item.role === 'string',
    domAssertions: (item) => typeof item.text === 'string' || typeof item.role === 'string',
    images: (item) => typeof item.src === 'string' && typeof item.alt === 'string' && (!('naturalWidth' in item) || Number.isFinite(item.naturalWidth)) && (!('naturalHeight' in item) || Number.isFinite(item.naturalHeight)) && (!('loaded' in item) || typeof item.loaded === 'boolean'),
    links: (item) => typeof item.text === 'string' && typeof item.href === 'string'
      && (!('inScope' in item) || typeof item.inScope === 'boolean')
      && (!('ok' in item) || typeof item.ok === 'boolean')
      && (!('status' in item) || item.status === null || Number.isInteger(item.status)),
    diagrams: (item) => typeof item.selector === 'string' && typeof item.visible === 'boolean' && typeof item.loaded === 'boolean' && typeof item.sourceAsset === 'string',
  };
  for (const [field, predicate] of Object.entries(arrayFields)) {
    if (field in value && (!Array.isArray(value[field]) || value[field].some((item) => !item || typeof item !== 'object' || Array.isArray(item) || !predicate(item)))) {
      throw adapterError('malformed-output', `response.${field} contains an invalid item`);
    }
  }
  for (const field of ['title', 'text', 'url']) if (field in value && typeof value[field] !== 'string') throw adapterError('malformed-output', `response.${field} must be a string`);
  if ('accessibility' in value && typeof value.accessibility !== 'string') throw adapterError('malformed-output', 'response.accessibility must be a string');
  if ('heading' in value && value.heading !== null && (!value.heading || typeof value.heading !== 'object' || Array.isArray(value.heading) || !Number.isInteger(value.heading.level) || typeof value.heading.text !== 'string')) throw adapterError('malformed-output', 'response.heading must contain integer level and string text or be null');
  if ('viewport' in value) {
    const viewport = value.viewport;
    const singleViewport = viewport && typeof viewport === 'object' && !Array.isArray(viewport) && ('width' in viewport || 'height' in viewport || 'overflow' in viewport);
    const validViewport = (item) => item && typeof item === 'object' && !Array.isArray(item) && Number.isFinite(item.width) && Number.isFinite(item.height) && (!('overflow' in item) || typeof item.overflow === 'boolean');
    const nestedViewports = Object.values(viewport);
    if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport) || (singleViewport ? !validViewport(viewport) : nestedViewports.length === 0 || nestedViewports.some((item) => !validViewport(item)))) throw adapterError('malformed-output', 'response.viewport must contain numeric dimensions and boolean overflow');
  }
  return value;
}

export function normalizeBrowserObservation(raw, requestedUrl) {
  const value = validateResponse(raw);
  return {
    url: value.url ?? requestedUrl,
    title: value.title ?? value.heading?.text ?? '',
    text: value.text ?? '',
    heading: value.heading ?? null,
    consoleErrors: value.consoleErrors ?? value.console ?? [],
    failedRequests: value.failedRequests ?? value.network ?? [],
    domAssertions: value.domAssertions ?? value.dom ?? [],
    accessibility: value.accessibility ?? '',
    viewport: value.viewport ?? {},
    images: value.images ?? [],
    links: value.links ?? [],
    diagrams: value.diagrams ?? [],
  };
}

function parseCommandOutput(command, stdout) {
  const output = stdout.trim();
  if (command === 'text') return { text: stdout.trimEnd() };
  if (command === 'links') {
    if (!output || output === '(no links)') return { links: [] };
    const links = output.split(/\r?\n/).map((line) => {
      const match = line.match(/^(.+?)\s+→\s+(\S+)$/);
      if (!match) throw adapterError('malformed-output', 'gstack links output contains an invalid line');
      return { text: match[1], href: match[2] };
    });
    return { links };
  }
  if (command === 'console') {
    if (!output || output === '(no console errors)') return { consoleErrors: [] };
    const consoleErrors = output.split(/\r?\n/).map((line) => {
      const match = line.match(/^\[[^\]]+\]\s+\[(error|warning)\]\s+(.*)$/);
      if (!match) throw adapterError('malformed-output', 'gstack console output contains an invalid line');
      return { level: match[1], text: match[2] };
    });
    return { consoleErrors };
  }
  if (command === 'network') {
    if (!output || output === '(no network requests)') return { failedRequests: [] };
    const requests = output.split(/\r?\n/).map((line) => {
      const match = line.match(/^\S+\s+(\S+)\s+→\s+(\d+|pending)\s+\(([^)]*)\)$/);
      if (!match) throw adapterError('malformed-output', 'gstack network output contains an invalid line');
      return { url: match[1], status: match[2] === 'pending' ? 'pending' : Number(match[2]), details: match[3] };
    });
    return { failedRequests: requests.filter((request) => request.status === 'pending' || request.status >= 400) };
  }
  if (command === 'accessibility') {
    if (!output || output === '(no accessible elements found)') return { domAssertions: [] };
    const headings = [...output.matchAll(/^\s*(?:-\s*)?heading\s+"([^"]+)"\s+\[level=(\d+)\]/gmi)].map((match) => ({ role: 'heading', text: match[1], level: Number(match[2]) }));
    return { accessibility: output, heading: headings.find((heading) => heading.level === 1) ?? null, domAssertions: headings };
  }
  if (command === 'viewport') {
    const match = output.match(/^Viewport set to (\d+)x(\d+)$/);
    if (!match) throw adapterError('malformed-output', 'gstack viewport output is invalid');
    return { viewport: { width: Number(match[1]), height: Number(match[2]) } };
  }
  if (command === 'js') {
    let evidence;
    try { evidence = JSON.parse(output); } catch { throw adapterError('malformed-output', 'gstack evidence output is invalid JSON'); }
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
      || !Array.isArray(evidence.images) || !Array.isArray(evidence.diagrams)) {
      throw adapterError('malformed-output', 'gstack evidence output must include image and diagram arrays');
    }
    return evidence;
  }
  return {};
}

function pageEvidenceExpression(diagramRules = []) {
  const rules = diagramRules.map((rule) => ({
    selector: String(rule?.selector ?? ''),
    sourceAsset: String(rule?.sourceAsset ?? ''),
    assetPattern: String(rule?.assetPattern ?? ''),
  })).filter((rule) => rule.selector);
  return `(async () => {
    const safeUrl = (value) => {
      try {
        const url = new URL(value, document.location.href);
        url.username = ''; url.password = ''; url.search = ''; url.hash = '';
        return url.href;
      } catch { return ''; }
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
    };
    const captionFor = (element) => {
      const container = element.closest('figure, .diagram-container, [data-diagram]') || element.parentElement;
      const caption = container?.querySelector('figcaption, .caption, [data-caption]')?.textContent;
      const heading = container?.previousElementSibling?.matches?.('h1,h2,h3,h4,h5,h6') ? container.previousElementSibling.textContent : '';
      return (caption || heading || '').trim();
    };
    const imageFor = (image) => ({
      src: safeUrl(image.currentSrc || image.src || ''), alt: image.alt || '', naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight, complete: image.complete, loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
    });
    const links = await Promise.all([...document.querySelectorAll('a[href]')].map(async (anchor) => {
      const text = (anchor.textContent || '').trim().slice(0, 120);
      const href = safeUrl(anchor.href);
      if (!text || !href) return null;
      const url = new URL(href);
      const inScope = url.origin === document.location.origin;
      if (!inScope) return { text, href, inScope, ok: false, status: null };
      try {
        const response = await fetch(url.href, { credentials: 'omit', redirect: 'follow' });
        return { text, href, inScope, ok: response.ok, status: response.status };
      } catch {
        return { text, href, inScope, ok: false, status: null };
      }
    }));
    const diagrams = ${JSON.stringify(rules)}.flatMap((rule) => {
      let elements;
      try { elements = [...document.querySelectorAll(rule.selector)]; } catch { return []; }
      return elements.map((element) => {
        const image = element.matches('img') ? element : element.querySelector('img');
        const src = safeUrl(image?.currentSrc || image?.src || element.getAttribute('src') || document.location.href);
        let sourceBacked = Boolean(rule.sourceAsset);
        if (sourceBacked && rule.assetPattern) {
          try { sourceBacked = new RegExp(rule.assetPattern).test(src); } catch { sourceBacked = false; }
        }
        const rect = element.getBoundingClientRect();
        return {
          selector: rule.selector, src, sourceAsset: rule.sourceAsset, visible: visible(element),
          loaded: image ? image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 : true,
          sourceBacked, alt: image?.alt || element.getAttribute('aria-label') || element.querySelector('title')?.textContent?.trim() || '',
          caption: captionFor(element), fencedAscii: Boolean(element.closest('pre, code')),
          viewport: { visible: visible(element), overflow: element.scrollWidth > element.clientWidth + 1 || rect.right > window.innerWidth + 1 },
        };
      });
    });
    const root = document.documentElement;
    return JSON.stringify({
      images: [...document.images].map(imageFor),
      diagrams,
      links: links.filter(Boolean),
      viewport: {
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        overflow: root.scrollWidth > root.clientWidth + 1,
      },
    });
  })()`;
}

function mergeEvidence(observation, evidence, viewportName) {
  if (!observation.images) observation.images = evidence.images;
  if (Array.isArray(evidence.links)) observation.links = evidence.links;
  if (evidence.viewport && typeof evidence.viewport === 'object' && !Array.isArray(evidence.viewport)) {
    observation.viewport ??= {};
    observation.viewport[viewportName] = { ...(observation.viewport[viewportName] ?? {}), ...evidence.viewport };
  }
  observation.diagrams ??= [];
  for (const diagram of evidence.diagrams) {
    const key = `${diagram.selector}\u0000${diagram.sourceAsset}\u0000${diagram.src ?? ''}`;
    let stored = observation.diagrams.find((candidate) => `${candidate.selector}\u0000${candidate.sourceAsset}\u0000${candidate.src ?? ''}` === key);
    if (!stored) {
      stored = { ...diagram, viewports: {} };
      delete stored.viewport;
      observation.diagrams.push(stored);
    }
    stored.viewports[viewportName] = diagram.viewport ?? { visible: diagram.visible, overflow: false };
  }
}

function collectChild(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status, signal) => resolve({ status: status ?? 1, signal, stdout, stderr }));
  });
}

async function runProcess(spawn, command, args, timeoutMs, children) {
  let result;
  try {
    result = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (error.code === 'ENOENT') throw adapterError('setup-failure', `gstack executable unavailable: ${command}`, { cause: error });
    throw error;
  }
  if (result && typeof result.then === 'function') {
    let timer;
    try {
      return await Promise.race([
        result,
        new Promise((_, reject) => { timer = setTimeout(() => reject(adapterError('timeout', `gstack browser timed out after ${timeoutMs}ms`)), timeoutMs); }),
      ]);
    } catch (error) {
      if (error.code === 'ENOENT') throw adapterError('setup-failure', 'gstack executable unavailable', { cause: error });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  if (result && typeof result.stdout === 'string' && typeof result.stderr === 'string' && typeof result.status === 'number') return result;
  children.add(result);
  const pending = collectChild(result);
  let timer;
  try {
    return await Promise.race([
      pending,
      new Promise((_, reject) => { timer = setTimeout(() => { result.kill?.(); reject(adapterError('timeout', `gstack browser timed out after ${timeoutMs}ms`)); }, timeoutMs); }),
    ]);
  } catch (error) {
    if (error.code === 'ENOENT') throw adapterError('setup-failure', 'gstack executable unavailable', { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    children.delete(result);
  }
}

export function createBrowserAdapter(options = {}) {
  const executable = options.executable ?? process.env.GSTACK_BROWSER_EXECUTABLE ?? (process.platform === 'win32' ? 'browse.exe' : 'browse');
  const executableArgs = [...(options.executableArgs ?? [])];
  const spawn = options.spawn ?? nodeSpawn;
  const setupCommand = options.setupCommand ?? DEFAULT_SETUP_COMMAND;
  const defaultTimeoutMs = options.timeoutMs ?? 30_000;
  const children = new Set();
  const inFlight = new Set();
  let started = false;
  let closed = false;
  let closing = false;
  let closePromise;
  let pageQueue = Promise.resolve();

  async function invoke(args, timeoutMs) {
    const operation = runProcess(spawn, executable, [...executableArgs, ...args], timeoutMs, children);
    inFlight.add(operation);
    try { return await operation; } finally { inFlight.delete(operation); }
  }

  async function checkExecutable() {
    let result;
    try {
      result = await invoke(['--help'], defaultTimeoutMs);
    } catch (error) {
      if (error.kind === 'missing-executable' || error.kind === 'setup-failure') {
        return { available: false, kind: 'setup-failure', version: null, diagnostics: `${error.message}; ${setupDiagnostic(setupCommand)}; version: unavailable` };
      }
      if (error.kind === 'timeout') {
        return { available: false, kind: 'setup-failure', version: null, diagnostics: `${error.message}; ${setupDiagnostic(setupCommand)}; version: unavailable` };
      }
      throw error;
    }
    const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    const version = versionFrom(combined);
    if (result.status !== 0) {
      return { available: false, kind: 'setup-failure', version, diagnostics: `${combined || 'gstack executable failed'}; ${setupDiagnostic(setupCommand)}` };
    }
    let health;
    try {
      health = await invoke(['status'], defaultTimeoutMs);
    } catch (error) {
      const message = error?.message ?? 'gstack browser health check failed';
      return { available: false, kind: 'setup-failure', version, diagnostics: `browser server health check failed: ${message}; ${setupDiagnostic(setupCommand)}` };
    }
    const healthOutput = `${health.stdout ?? ''}\n${health.stderr ?? ''}`.trim();
    if (health.status !== 0) {
      return { available: false, kind: 'setup-failure', version, diagnostics: `browser server health check failed: ${healthOutput || 'gstack status exited non-zero'}; ${setupDiagnostic(setupCommand)}` };
    }
    return { available: true, kind: null, version, diagnostics: healthOutput || combined || 'gstack executable and browser server are healthy' };
  }

  async function collectPage(url, openOptions = {}) {
    if (closed || closing) throw adapterError('lifecycle', 'browser adapter is closed');
    let parsed;
    try { parsed = new URL(url); } catch { throw adapterError('invalid-url', 'browser URL is invalid or contains credentials'); }
    if (parsed.username || parsed.password) throw adapterError('invalid-url', 'browser URL is invalid or contains credentials');
    const timeoutMs = openOptions.timeoutMs ?? defaultTimeoutMs;
    const observation = {};
    const goto = await invoke(['goto', parsed.href], timeoutMs);
    if (goto.status !== 0) throw adapterError('browser-failure', 'gstack browser navigation failed', { status: goto.status, stderr: goto.stderr });
    started = true;
    for (const args of [['text'], ['links'], ['console', '--errors'], ['network'], ['accessibility']]) {
      const result = await invoke(args, timeoutMs);
      if (result.status !== 0) throw adapterError('browser-failure', `gstack browser command failed: ${args[0]}`, { status: result.status, stderr: result.stderr });
      const response = parseCommandOutput(args[0], result.stdout ?? '');
      Object.assign(observation, response);
    }
    for (const [name, size] of [['desktop', '1280x720'], ['mobile', '375x812']]) {
      const viewportResult = await invoke(['viewport', size], timeoutMs);
      if (viewportResult.status !== 0) throw adapterError('browser-failure', 'gstack browser command failed: viewport', { status: viewportResult.status, stderr: viewportResult.stderr });
      const viewportResponse = parseCommandOutput('viewport', viewportResult.stdout ?? '');
      observation.viewport = { ...(observation.viewport ?? {}), [name]: viewportResponse.viewport };
      const evidenceResult = await invoke(['js', pageEvidenceExpression(openOptions.diagramRules)], timeoutMs);
      if (evidenceResult.status !== 0) throw adapterError('browser-failure', 'gstack browser command failed: js', { status: evidenceResult.status, stderr: evidenceResult.stderr });
      mergeEvidence(observation, parseCommandOutput('js', evidenceResult.stdout ?? ''), name);
    }
    return normalizeBrowserObservation(observation, parsed.href);
  }

  function openPage(url, openOptions = {}) {
    const operation = pageQueue.then(() => collectPage(url, openOptions));
    pageQueue = operation.catch(() => {});
    inFlight.add(operation);
    return operation.finally(() => inFlight.delete(operation));
  }

  async function close() {
    if (closePromise) return closePromise;
    closing = true;
    closePromise = (async () => {
      await Promise.allSettled([...inFlight]);
      if (started) {
        try { await invoke(['stop'], defaultTimeoutMs); } catch { /* best-effort shutdown */ }
      }
      closed = true;
    })();
    return closePromise;
  }

  return { checkExecutable, openPage, close };
}
