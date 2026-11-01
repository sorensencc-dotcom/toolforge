import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { evaluateCommandSafety } from '../../scripts/worktree-safety-gate.mjs';

const MANIFEST_VERSION = 1;
const MAX_DIAGNOSTIC_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;
const TRAIL_TIMEOUT_MS = 15_000;
const TRAIL_CACHE_NAMES = ['.trail/cache', '.graft/cache'];

export const DEFAULT_WORKTREE_ROOT = join(homedir(), '.toolforge', 'worktrees');

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  }).trim();
}

function atomicJsonWrite(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temp, file);
}

function pathInside(root, target) {
  const rel = relative(resolve(root), resolve(target));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function assertSafeName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) {
    throw new Error('WORKTREE_NAME_INVALID: use 1-64 letters, digits, dot, underscore, or hyphen');
  }
}

function resolveRoot(root = process.env.TOOLFORGE_WORKTREE_ROOT || DEFAULT_WORKTREE_ROOT) {
  if (!isAbsolute(root)) throw new Error('WORKTREE_ROOT_INVALID: root must be absolute');
  return resolve(root);
}

function resolveRepo(repo) {
  if (!isAbsolute(repo)) throw new Error('REPOSITORY_PATH_INVALID: repository path must be absolute');
  const root = resolve(git(['rev-parse', '--show-toplevel'], repo));
  const gitCommonDir = resolve(root, git(['rev-parse', '--git-common-dir'], root));
  return { root, gitCommonDir };
}

function managedPaths(root, name) {
  const entry = join(root, name);
  return { entry, worktree: join(entry, 'worktree'), manifest: join(entry, 'manifest.json'), diagnostics: join(entry, 'diagnostics.log') };
}

function assertManagedRoot(root, repoRoot) {
  if (pathInside(repoRoot, root)) {
    throw new Error('WORKTREE_ROOT_UNSAFE: root must be outside the source repository');
  }
}

function readManifest(paths, repoRoot) {
  if (!existsSync(paths.manifest)) throw new Error('WORKTREE_NOT_FOUND: managed worktree manifest is missing');
  const manifest = JSON.parse(readFileSync(paths.manifest, 'utf8'));
  if (manifest.version !== MANIFEST_VERSION) throw new Error('WORKTREE_MANIFEST_UNSUPPORTED: unsupported manifest version');
  if (resolve(manifest.repoRoot) !== resolve(repoRoot)) throw new Error('WORKTREE_MANIFEST_INVALID: repository mismatch');
  if (resolve(manifest.worktreePath) !== resolve(paths.worktree)) throw new Error('WORKTREE_MANIFEST_INVALID: path mismatch');
  return manifest;
}

function graphCandidates(repoRoot) {
  const configured = process.env.TOOLFORGE_TRAIL_ROOT ? [resolve(process.env.TOOLFORGE_TRAIL_ROOT)] : [];
  const candidates = [...configured];
  let current = resolve(repoRoot);
  for (;;) {
    candidates.push(current, ...TRAIL_CACHE_NAMES.map((name) => join(current, name)));
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return [...new Set(candidates)];
}

function findTrailGraph(repoRoot) {
  for (const candidate of graphCandidates(repoRoot)) {
    const cache = candidate.endsWith('cache') ? candidate : join(candidate, 'cache');
    const manifest = join(cache, 'manifest.json');
    if (existsSync(manifest)) {
      const stat = statSync(manifest);
      return {
        root: dirname(cache),
        cache,
        manifest,
        revision: createHash('sha256').update(readFileSync(manifest)).digest('hex'),
        updatedAt: stat.mtime.toISOString(),
      };
    }
  }
  return null;
}

function runFile(file, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(file, args, { ...options, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

function trailInvocation() {
  const configured = process.env.TOOLFORGE_TRAIL_BIN;
  if (configured) return { file: configured, prefix: [] };
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    const trailJs = appData && join(appData, 'npm', 'node_modules', '@trailhq', 'trail-code', 'dist', 'bin', 'trail.js');
    if (trailJs && existsSync(trailJs)) return { file: process.execPath, prefix: [trailJs] };
  }
  return { file: 'trail', prefix: [] };
}

async function runTrail(args, cwd, timeoutMs = TRAIL_TIMEOUT_MS) {
  const invocation = trailInvocation();
  return runFile(invocation.file, [...invocation.prefix, ...args], { cwd, timeout: timeoutMs });
}

function graphIsStale(graph, repoRoot) {
  const headTime = Number(git(['show', '-s', '--format=%ct', 'HEAD'], repoRoot)) * 1000;
  return Number.isFinite(headTime) && new Date(graph.updatedAt).getTime() < headTime;
}

export async function trailPreflight({ repoRoot, query, file, trail = runTrail, now = () => new Date() }) {
  let graph = findTrailGraph(repoRoot);
  if (!graph || graphIsStale(graph, repoRoot)) {
    try {
      await trail(['build'], repoRoot);
    } catch (error) {
      throw new Error(`TRAIL_PREFLIGHT_FAILED: unable to build Trail graph (${error.message})`);
    }
    graph = findTrailGraph(repoRoot);
  }
  if (!graph) throw new Error('TRAIL_PREFLIGHT_FAILED: no usable Trail graph found');
  if (!query && !file) throw new Error('TRAIL_PREFLIGHT_FAILED: code runs require --trail-query or --trail-file');

  const args = file ? ['skeleton', file, '--no-refresh'] : ['ask', query, '--source', '--no-refresh'];
  try {
    const result = await trail(args, repoRoot);
    if (!result || !String(result.stdout || '').trim()) throw new Error('Trail returned no context');
  } catch (error) {
    throw new Error(`TRAIL_PREFLIGHT_FAILED: ${error.message}`);
  }
  return { graphRoot: graph.root, graphCache: graph.cache, graphRevision: graph.revision, query: query || null, file: file || null, completedAt: now().toISOString() };
}

function classifyCodeTask(command, explicit) {
  if (explicit === true || explicit === false) return explicit;
  return !['echo', 'printf', 'ver', 'whoami', 'hostname', 'date'].includes(String(command[0]).toLowerCase());
}

function appendDiagnostic(file, chunk) {
  const current = existsSync(file) ? readFileSync(file) : Buffer.alloc(0);
  const next = Buffer.concat([current, Buffer.from(chunk)]);
  writeFileSync(file, next.subarray(Math.max(0, next.length - MAX_DIAGNOSTIC_BYTES)));
}

function runChild(command, cwd, timeoutMs, diagnosticsPath) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd, shell: false, windowsHide: true });
    let settled = false;
    let timer;
    const finish = (result, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolvePromise(result);
    };
    child.stdout.on('data', (data) => appendDiagnostic(diagnosticsPath, data));
    child.stderr.on('data', (data) => appendDiagnostic(diagnosticsPath, data));
    child.on('error', (error) => finish(null, error));
    child.on('close', (code, signal) => finish({ code: code ?? 1, signal }));
    timer = setTimeout(() => {
      child.kill();
      finish({ code: 124, signal: 'SIGTERM', timedOut: true });
    }, timeoutMs);
  });
}

export function createManagedWorktree({ repo, name, base, worktreeRoot } = {}) {
  assertSafeName(name);
  const { root: repoRoot, gitCommonDir } = resolveRepo(repo);
  const root = resolveRoot(worktreeRoot);
  assertManagedRoot(root, repoRoot);
  const paths = managedPaths(root, name);
  if (existsSync(paths.manifest) || existsSync(paths.worktree)) throw new Error('WORKTREE_EXISTS: managed name already exists');
  if (!base && git(['status', '--porcelain'], repoRoot)) throw new Error('REPOSITORY_DIRTY: provide --base explicitly to create from a dirty repository');
  const baseRevision = git(['rev-parse', base || 'HEAD'], repoRoot);
  mkdirSync(dirname(paths.worktree), { recursive: true });
  try {
    execFileSync('git', ['worktree', 'add', '--detach', paths.worktree, baseRevision], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch (error) {
    throw new Error(`WORKTREE_CREATE_FAILED: ${error.message}`);
  }
  const manifest = { version: MANIFEST_VERSION, name, repoRoot, gitCommonDir, baseRevision, worktreePath: paths.worktree, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), state: 'created', ownerRunId: null, diagnosticsPath: paths.diagnostics };
  atomicJsonWrite(paths.manifest, manifest);
  return manifest;
}

export function getManagedWorktree({ repo, name, worktreeRoot } = {}) {
  assertSafeName(name);
  const { root: repoRoot } = resolveRepo(repo);
  const root = resolveRoot(worktreeRoot);
  assertManagedRoot(root, repoRoot);
  return { root, paths: managedPaths(root, name), manifest: readManifest(managedPaths(root, name), repoRoot) };
}

export async function runManagedWorktree({ repo, name, command, worktreeRoot, code, nonCode, trailQuery, trailFile, runId = randomUUID(), timeoutMs = DEFAULT_TIMEOUT_MS, safety = evaluateCommandSafety, trail = runTrail } = {}) {
  if (!Array.isArray(command) || command.length === 0) throw new Error('COMMAND_REQUIRED: provide a command after --');
  const managed = getManagedWorktree({ repo, name, worktreeRoot });
  const { manifest, paths } = managed;
  if (!existsSync(paths.worktree)) throw new Error('WORKTREE_MISSING: managed worktree path does not exist');
  const codeTask = classifyCodeTask(command, nonCode ? false : code);
  const gate = await safety(command.join(' '), { worktreeRoot: paths.worktree });
  if (gate.verdict !== 'ALLOWED') throw new Error(`SAFETY_GATE_BLOCKED: ${gate.reason}`);

  const provenance = codeTask ? await trailPreflight({ repoRoot: manifest.repoRoot, query: trailQuery, file: trailFile, trail }) : { exempt: true, reason: 'explicit non-code run', completedAt: new Date().toISOString() };
  const running = { ...manifest, ownerRunId: runId, state: 'running', updatedAt: new Date().toISOString(), trail: provenance };
  atomicJsonWrite(paths.manifest, running);
  try {
    const result = await runChild(command, paths.worktree, timeoutMs, paths.diagnostics);
    const state = result.timedOut ? 'abandoned' : result.code === 0 ? 'succeeded' : 'failed';
    atomicJsonWrite(paths.manifest, { ...running, state, exitCode: result.code, signal: result.signal || null, updatedAt: new Date().toISOString() });
    return { ...result, state, runId, trail: provenance };
  } catch (error) {
    atomicJsonWrite(paths.manifest, { ...running, state: 'abandoned', error: error.message, updatedAt: new Date().toISOString() });
    throw error;
  }
}

export function statusManagedWorktree({ repo, name, worktreeRoot } = {}) {
  const managed = getManagedWorktree({ repo, name, worktreeRoot });
  return { ...managed.manifest, pathExists: existsSync(managed.paths.worktree), manifestPath: managed.paths.manifest };
}

export function removeManagedWorktree({ repo, name, worktreeRoot, force = false, runId, cleanup = false } = {}) {
  const managed = getManagedWorktree({ repo, name, worktreeRoot });
  const { manifest, paths } = managed;
  if (!cleanup && manifest.ownerRunId && manifest.ownerRunId !== runId) throw new Error('WORKTREE_OWNER_MISMATCH: cleanup is not owned by this run');
  if (existsSync(paths.worktree) && !force && git(['status', '--porcelain'], paths.worktree)) throw new Error('WORKTREE_DIRTY: use --force to discard uncommitted changes');
  execFileSync('git', ['worktree', 'remove', ...(force ? ['--force'] : []), paths.worktree], { cwd: manifest.repoRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  return { ...manifest, state: 'removed', removedAt: new Date().toISOString() };
}
