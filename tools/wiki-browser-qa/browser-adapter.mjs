import { spawn as nodeSpawn } from 'node:child_process';

const DEFAULT_SETUP_COMMAND = 'cd ~/.agents/skills/gstack/browse && ./setup';

function adapterError(kind, message, details = {}) {
  const error = new Error(message);
  error.kind = kind;
  Object.assign(error, details);
  return error;
}

function versionFrom(text) {
  return text.match(/gstack\s+browse\s+(?:v)?([0-9]+\.[0-9]+\.[0-9]+)/i)?.[1] ?? null;
}

function normalizeObservation(raw, requestedUrl) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    url: value.url ?? requestedUrl,
    title: value.title ?? '',
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
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw adapterError('malformed-output', 'gstack browser JSON-line response must be an object');
  }
  return normalizeObservation(response, requestedUrl);
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
    if (error.code === 'ENOENT') throw adapterError('missing-executable', `gstack executable not found: ${command}`, { cause: error });
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
      if (error.code === 'ENOENT') throw adapterError('missing-executable', `gstack executable not found: ${command}`, { cause: error });
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

  async function checkExecutable() {
    let result;
    try {
      result = await runProcess(spawn, executable, [...executableArgs, '--help'], defaultTimeoutMs, children);
    } catch (error) {
      if (error.kind === 'missing-executable') {
        return { available: false, kind: error.kind, version: null, diagnostics: `${error.message}; setup command: ${setupCommand}; version: unavailable` };
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
    if (typeof url !== 'string' || !url) throw new TypeError('url must be a non-empty string');
    const timeoutMs = openOptions.timeoutMs ?? defaultTimeoutMs;
    const result = await runProcess(spawn, executable, [...executableArgs, 'goto', url], timeoutMs, children);
    if (result.status !== 0) {
      throw adapterError('browser-failure', `gstack browser navigation failed for ${url}`, { status: result.status, stderr: result.stderr });
    }
    return parseJsonLines(result.stdout ?? '', url);
  }

  async function close() {
    for (const child of children) child.kill?.();
    children.clear();
  }

  return { checkExecutable, openPage, close };
}
