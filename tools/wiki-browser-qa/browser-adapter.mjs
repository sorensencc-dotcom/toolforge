import { spawn as nodeSpawn } from 'node:child_process';

const DEFAULT_SETUP_COMMAND = process.platform === 'win32'
  ? 'cd /d "%USERPROFILE%\\.agents\\skills\\gstack\\browse" && setup'
  : 'cd ~/.agents/skills/gstack/browse && ./setup';

function adapterError(kind, message, details = {}) {
  const error = new Error(message);
  error.kind = kind;
  Object.assign(error, details);
  return error;
}

function versionFrom(text) {
  return text.match(/gstack\s+browse\s+(?:v)?([0-9]+\.[0-9]+\.[0-9]+)/i)?.[1] ?? null;
}

function validateResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw adapterError('malformed-output', 'browser response must be an object');
  for (const field of ['console', 'consoleErrors', 'network', 'failedRequests', 'dom', 'domAssertions', 'images', 'links']) {
    if (field in value && (!Array.isArray(value[field]) || value[field].some((item) => !item || typeof item !== 'object' || Array.isArray(item)))) {
      throw adapterError('malformed-output', `response.${field} must be an array of objects`);
    }
  }
  for (const field of ['title', 'text', 'url']) if (field in value && typeof value[field] !== 'string') throw adapterError('malformed-output', `response.${field} must be a string`);
  if ('heading' in value && (!value.heading || typeof value.heading !== 'object' || Array.isArray(value.heading) || !Number.isInteger(value.heading.level) || typeof value.heading.text !== 'string')) throw adapterError('malformed-output', 'response.heading must contain integer level and string text');
  if ('viewport' in value) {
    const viewport = value.viewport;
    const singleViewport = viewport && typeof viewport === 'object' && !Array.isArray(viewport) && ('width' in viewport || 'height' in viewport || 'overflow' in viewport);
    if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport) || (!singleViewport && Object.values(viewport).some((item) => !item || typeof item !== 'object' || Array.isArray(item)))) throw adapterError('malformed-output', 'response.viewport must be an object of viewport observations');
  }
  return value;
}

function normalizeObservation(raw, requestedUrl) {
  const value = validateResponse(raw);
  return {
    url: value.url ?? requestedUrl,
    title: value.title ?? '',
    text: value.text ?? '',
    heading: value.heading ?? null,
    consoleErrors: value.consoleErrors ?? value.console ?? [],
    failedRequests: value.failedRequests ?? value.network ?? [],
    domAssertions: value.domAssertions ?? value.dom ?? [],
    viewport: value.viewport ?? {},
    images: value.images ?? [],
    links: value.links ?? [],
  };
}

function parseJsonLines(stdout, requestedUrl) {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    throw adapterError('malformed-output', 'gstack browser returned no JSON-line response');
  }
  let response;
  try {
  response = lines.map((line) => JSON.parse(line)).at(-1);
  } catch (cause) {
    throw adapterError('malformed-output', `gstack browser returned malformed JSON: ${cause.message}`, { cause });
  }
  return validateResponse(response);
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
  } finally {
    clearTimeout(timer);
    children.delete(result);
  }
}

export function createBrowserAdapter(options = {}) {
  const executable = options.executable ?? process.env.GSTACK_BROWSER_EXECUTABLE ?? 'browse';
  const executableArgs = [...(options.executableArgs ?? [])];
  const spawn = options.spawn ?? nodeSpawn;
  const setupCommand = options.setupCommand ?? DEFAULT_SETUP_COMMAND;
  const defaultTimeoutMs = options.timeoutMs ?? 30_000;
  const children = new Set();
  const inFlight = new Set();
  let started = false;
  let closed = false;

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
        return { available: false, kind: 'setup-failure', version: null, diagnostics: `${error.message}; setup command: ${setupCommand}; version: unavailable` };
      }
      if (error.kind === 'timeout') {
        return { available: false, kind: 'setup-failure', version: null, diagnostics: `${error.message}; setup command: ${setupCommand}; version: unavailable` };
      }
      throw error;
    }
    const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    const version = versionFrom(combined);
    if (result.status !== 0) {
      return { available: false, kind: 'setup-failure', version, diagnostics: `${combined || 'gstack executable failed'}; setup command: ${setupCommand}` };
    }
    return { available: true, kind: null, version, diagnostics: combined || 'gstack executable is available' };
  }

  async function openPage(url, openOptions = {}) {
    if (closed) throw adapterError('lifecycle', 'browser adapter is closed');
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
      const response = parseJsonLines(result.stdout ?? '');
      if (args[0] === 'viewport') {
        const name = args[1] === '375x812' ? 'mobile' : 'desktop';
        observation.viewport = { ...(observation.viewport ?? {}), [name]: response.viewport ?? response };
      } else Object.assign(observation, response);
    }
    return normalizeObservation(observation, parsed.href);
  }

  async function close() {
    if (closed) return;
    await Promise.allSettled([...inFlight]);
    if (started) {
      try { await invoke(['stop'], defaultTimeoutMs); } catch { /* best-effort shutdown */ }
    }
    closed = true;
  }

  return { checkExecutable, openPage, close };
}
