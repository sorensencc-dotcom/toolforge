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
    links: (item) => typeof item.text === 'string' && typeof item.href === 'string',
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
  return {};
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
    return { available: true, kind: null, version, diagnostics: combined || 'gstack executable is available' };
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
    for (const args of [['text'], ['links'], ['console', '--errors'], ['network'], ['accessibility'], ['viewport', '1280x720'], ['viewport', '375x812']]) {
      const result = await invoke(args, timeoutMs);
      if (result.status !== 0) throw adapterError('browser-failure', `gstack browser command failed: ${args[0]}`, { status: result.status, stderr: result.stderr });
      const response = parseCommandOutput(args[0], result.stdout ?? '');
      if (args[0] === 'viewport') {
        const name = args[1] === '375x812' ? 'mobile' : 'desktop';
        observation.viewport = { ...(observation.viewport ?? {}), [name]: response.viewport ?? response };
      } else Object.assign(observation, response);
    }
    return normalizeBrowserObservation(observation, parsed.href);
  }

  function openPage(url, openOptions = {}) {
    const operation = collectPage(url, openOptions);
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
