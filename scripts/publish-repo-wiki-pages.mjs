// Publishes the repo wiki/ pages to the GitHub wiki (toolforge.wiki.git).
//
//   node scripts/publish-repo-wiki-pages.mjs [--if-changed] [--dry-run]
//
// Real runs only happen from main, with a clean wiki/ tree, and never for pull
// request events. Anything else exits 1 (REFUSING_WIKI_PUBLISH*). --dry-run
// never publishes, exits 0, and reports which guard a real run would hit.
//
// Auth (first match wins): WIKI_PUSH_TOKEN, then GITHUB_TOKEN, both over HTTPS.
// Locally with neither set, it falls back to SSH. In CI with neither, it fails
// with WIKI_TOKEN_MISSING. The token is passed to git only through environment
// variables (GIT_CONFIG_COUNT/KEY/VALUE), never argv, a URL, or a file. GITHUB_TOKEN
// can push to the wiki only if the wiki is enabled and initialised and the
// job has contents: write; otherwise set a WIKI_PUSH_TOKEN secret.
//
// CI diff inputs: WIKI_DIFF_BASE (github.event.before) and WIKI_DIFF_HEAD
// (github.sha). A zero or unknown base falls back to HEAD~1..HEAD.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT_WIKI_PAGE_MAPPINGS } from '../tools/wiki-browser-qa/wiki-page-rules.mjs';
import { addFrontmatterTitle, ensureSkillLibrary } from './sync-github-wiki.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Live publishes use HTTPS with a token passed through the environment. SSH is
// only the local fallback when no token is set and we are not running in CI.
const WIKI_HTTPS_URL = 'https://github.com/sorensencc-dotcom/toolforge.wiki.git';
const WIKI_SSH_URL = 'git@github.com:sorensencc-dotcom/toolforge.wiki.git';
const ZERO_SHA = /^0+$/;
const GIT = process.env.GIT_BIN || (process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Git\\cmd\\git.exe')
  ? 'C:\\Program Files\\Git\\cmd\\git.exe'
  : 'git');
const PUBLISHED_CLONE = path.resolve(process.env.TOOLFORGE_WIKI_DIR || path.join(root, '..', 'toolforge-wiki')).toLowerCase();

export function wikiPagesFromRepo(mappings = ROOT_WIKI_PAGE_MAPPINGS) {
  return mappings.filter((mapping) => mapping.src.startsWith('wiki/') && mapping.dest.toLowerCase().endsWith('.md'));
}

export function changedWikiPaths(files) {
  return files.filter((file) => file.startsWith('wiki/')
    || file === 'tools/wiki-browser-qa/wiki-page-rules.mjs'
    || file === 'scripts/publish-repo-wiki-pages.mjs'
    || file === 'scripts/sync-github-wiki.mjs'
    || file === 'setup-git-hooks.ps1');
}

export function assertPublishClone(dir) {
  const resolved = path.resolve(dir);
  const lower = resolved.toLowerCase();
  const insidePublished = lower === PUBLISHED_CLONE
    || lower.startsWith(`${PUBLISHED_CLONE}${path.sep}`);
  const hasWikiSegment = resolved.split(/[/\\]/).some((p) => p.toLowerCase() === 'toolforge-wiki');
  if (hasWikiSegment || insidePublished) {
    throw new Error('REFUSING_WIKI_CLONE: publish into a temp clone. The repo wiki/ tree is the source.');
  }
}

export function getCurrentBranch(cwd = root) {
  try {
    return runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  } catch {
    return 'unknown';
  }
}

// In Actions the checked-out ref can be detached or a PR merge ref, so trust the
// event ref over `git rev-parse`. Anything that is not refs/heads/* is reported
// as "ref:<ref>" so it can never equal 'main'.
export function resolveBranch(env = process.env, gitBranch = getCurrentBranch) {
  if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_REF) {
    return env.GITHUB_REF.startsWith('refs/heads/')
      ? env.GITHUB_REF.slice('refs/heads/'.length)
      : `ref:${env.GITHUB_REF}`;
  }
  return gitBranch();
}

// Fails closed: if git cannot tell us whether wiki/ is clean, nobody publishes.
export function checkDirtyWiki(cwd = root) {
  const dirty = runGit(['status', '--porcelain', '--', 'wiki/'], cwd);
  return dirty.split(/\r?\n/).filter(Boolean);
}

/**
 * Guards that stop a real publish. Order matters: the dirty-tree check comes
 * first so it is reachable even on a feature branch.
 */
export function evaluatePublishGuards({ branch, dirty = [], env = process.env } = {}) {
  const guards = [];
  if (dirty.length > 0) {
    guards.push({
      code: 'REFUSING_WIKI_PUBLISH',
      message: `uncommitted modifications detected in wiki/ working tree: ${dirty.join('; ')}`
    });
  }
  if (branch !== 'main') {
    guards.push({
      code: 'REFUSING_WIKI_PUBLISH_BRANCH',
      message: `live wiki publish runs only from main (current ref: '${branch}')`
    });
  }
  if (env.GITHUB_ACTIONS === 'true' && String(env.GITHUB_EVENT_NAME || '').startsWith('pull_request')) {
    guards.push({
      code: 'REFUSING_WIKI_PUBLISH_EVENT',
      message: `pull request events never publish (event: ${env.GITHUB_EVENT_NAME})`
    });
  }
  return guards;
}

/**
 * Pick how to authenticate to the wiki remote. WIKI_PUSH_TOKEN wins over
 * GITHUB_TOKEN. Without either, CI has no way to authenticate (mode 'none');
 * a local run falls back to SSH.
 */
export function resolveWikiAuth(env = process.env) {
  const wikiToken = String(env.WIKI_PUSH_TOKEN || '').trim();
  if (wikiToken) return { mode: 'https-token', source: 'WIKI_PUSH_TOKEN', token: wikiToken, url: WIKI_HTTPS_URL };
  const ghToken = String(env.GITHUB_TOKEN || '').trim();
  if (ghToken) return { mode: 'https-token', source: 'GITHUB_TOKEN', token: ghToken, url: WIKI_HTTPS_URL };
  if (env.GITHUB_ACTIONS === 'true') return { mode: 'none', source: null, token: null, url: WIKI_HTTPS_URL };
  return { mode: 'ssh', source: 'local ssh', token: null, url: WIKI_SSH_URL };
}

/**
 * Child-process env for authenticated git. The token only ever lives in the
 * environment (GIT_CONFIG_COUNT/KEY/VALUE), never in argv, a URL, or a config
 * file, so it cannot show up in a process listing, logs, or .git/config.
 */
export function gitAuthEnv(auth) {
  const env = { GIT_TERMINAL_PROMPT: '0' };
  if (auth?.token) {
    const basic = Buffer.from(`x-access-token:${auth.token}`).toString('base64');
    Object.assign(env, {
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`,
      GIT_CONFIG_KEY_1: 'credential.helper',
      GIT_CONFIG_VALUE_1: ''
    });
  }
  return env;
}

export function redactSecrets(text, auth) {
  let out = String(text ?? '');
  if (auth?.token) {
    const basic = Buffer.from(`x-access-token:${auth.token}`).toString('base64');
    for (const secret of [basic, auth.token]) out = out.split(secret).join('***');
  }
  return out;
}
export function applyRepoPages(cloneDir, pages, readFile = (file) => fs.readFileSync(file)) {
  assertPublishClone(cloneDir);
  const written = [];
  for (const page of pages) {
    const dest = path.join(cloneDir, page.dest);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const raw = readFile(page.src);
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
    fs.writeFileSync(dest, addFrontmatterTitle(text));
    written.push(page.dest);
  }
  const sidebarPath = path.join(cloneDir, '_Sidebar.md');
  if (fs.existsSync(sidebarPath)) {
    fs.writeFileSync(sidebarPath, ensureSkillLibrary(fs.readFileSync(sidebarPath, 'utf8')));
    written.push('_Sidebar.md');
  }
  return written;
}

export function cleanGitEnv(base = process.env) {
  const env = { ...base };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_')) delete env[key];
  }
  return env;
}

// extraEnv is applied after GIT_* is stripped, so callers opt in to exactly the
// GIT_* variables a command needs. Raw tokens are never passed to the child.
export function runGit(args, cwd, baseEnv = process.env, extraEnv = {}) {
  const env = cleanGitEnv(baseEnv);
  delete env.WIKI_PUSH_TOKEN;
  delete env.GITHUB_TOKEN;
  return execFileSync(GIT, args, { cwd, encoding: 'utf8', env: { ...env, ...extraEnv } }).trim();
}

function git(args, cwd) {
  return runGit(args, cwd);
}

/**
 * Ordered diff ranges to try. The first range that git accepts is used, even if
 * it is empty, so the first candidate must be the right one for the context:
 *   push:         <before>..<sha> from the event, then HEAD~1..HEAD
 *   pull request: origin/<base>...HEAD, then HEAD~1..HEAD
 *   local:        <upstream>...HEAD, origin/main...HEAD (never on main, where
 *                 it is empty by definition), then HEAD~1..HEAD
 * 'ROOT' means "the root commit's own files".
 */
export function diffRangeCandidates({ env = process.env, upstream = '', branch = '' } = {}) {
  const ranges = [];
  const before = String(env.WIKI_DIFF_BASE || '').trim();
  const after = String(env.WIKI_DIFF_HEAD || env.GITHUB_SHA || '').trim();
  if (env.GITHUB_EVENT_NAME === 'push' || before) {
    if (before && !ZERO_SHA.test(before) && after) ranges.push(`${before}..${after}`);
  } else if (env.GITHUB_BASE_REF) {
    ranges.push(`origin/${env.GITHUB_BASE_REF}...HEAD`);
  } else {
    if (upstream) ranges.push(`${upstream}...HEAD`);
    if (branch !== 'main') ranges.push('origin/main...HEAD');
  }
  ranges.push('HEAD~1..HEAD');
  ranges.push('ROOT');
  return ranges;
}

/** Returns changed file names, or null when no candidate range could be evaluated. */
export function changedFilesFromRanges(ranges, run = git, cwd = root) {
  for (const range of ranges) {
    try {
      const out = range === 'ROOT'
        ? run(['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', 'HEAD'], cwd)
        : run(['diff', '--name-only', range], cwd);
      return out.split(/\r?\n/).filter(Boolean);
    } catch {
      // unknown commit (force push, shallow clone) or no parent: try the next range
    }
  }
  return null;
}

function changedFilesAgainstUpstream(env = process.env) {
  let upstream = '';
  try {
    upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], root);
  } catch {
    // no upstream configured
  }
  const ranges = diffRangeCandidates({ env, upstream, branch: resolveBranch(env) });
  return changedFilesFromRanges(ranges);
}

export function commitIdentityEnv(env = process.env) {
  const name = env.WIKI_COMMIT_AUTHOR_NAME || (env.GITHUB_ACTIONS === 'true' ? 'github-actions[bot]' : '');
  const email = env.WIKI_COMMIT_AUTHOR_EMAIL || (env.GITHUB_ACTIONS === 'true' ? '41898282+github-actions[bot]@users.noreply.github.com' : '');
  if (!name || !email) return {};
  return {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email
  };
}

export function publish(pages, { dryRun = false, auth = resolveWikiAuth(), env = process.env } = {}) {
  if (dryRun) {
    console.log(`WIKI_PUBLISH_DRY_RUN: verified ${pages.length} repo wiki page mappings cleanly.`);
    return;
  }
  if (auth.mode === 'none') {
    throw new Error('WIKI_TOKEN_MISSING: set WIKI_PUSH_TOKEN (or pass GITHUB_TOKEN with contents: write) to publish the wiki from CI.');
  }
  const authEnv = gitAuthEnv(auth);
  const run = (args, cwd, extra = {}) => runGit(args, cwd, env, { ...authEnv, ...extra });
  const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolforge-wiki-publish-'));
  try {
    assertPublishClone(cloneDir);
    try {
      run(['-c', 'core.autocrlf=false', 'clone', '--depth', '1', auth.url, cloneDir], root);
    } catch (error) {
      const hint = auth.mode === 'https-token'
        ? ' Check that the wiki is enabled and initialised and that the token can push to it (contents: write).'
        : '';
      throw new Error(`WIKI_CLONE_FAILED (${auth.mode}${auth.source ? `, ${auth.source}` : ''}): ${redactSecrets(error.stderr || error.message, auth).trim()}${hint}`);
    }
    run(['config', 'core.autocrlf', 'false'], cloneDir);
    const repoPages = pages.map((page) => ({ ...page, src: path.join(root, page.src) }));
    applyRepoPages(cloneDir, repoPages);
    const addPaths = repoPages.map((page) => page.dest);
    if (fs.existsSync(path.join(cloneDir, '_Sidebar.md'))) addPaths.push('_Sidebar.md');
    run(['add', '--', ...addPaths], cloneDir);
    const dirty = run(['diff', '--cached', '--name-only'], cloneDir);
    if (!dirty) {
      console.log('Repo wiki pages already match the published wiki.');
      return;
    }
    const identity = commitIdentityEnv(env);
    run(['-c', 'core.hooksPath=.git/no-hooks', 'commit', '-m', 'docs(wiki): publish repo wiki pages'], cloneDir, identity);
    try {
      run(['-c', 'core.hooksPath=.git/no-hooks', 'push', 'origin', 'HEAD'], cloneDir);
    } catch (error) {
      throw new Error(`WIKI_PUSH_FAILED (${auth.mode}${auth.source ? `, ${auth.source}` : ''}): ${redactSecrets(error.stderr || error.message, auth).trim()}`);
    }
    console.log(`Published ${dirty.split(/\r?\n/).filter(Boolean).join(', ')}`);
  } finally {
    removeCloneDir(cloneDir);
  }
}
// Windows can hold handles on the clone's .git files (EPERM) after a publish
// that already succeeded; leaking a temp dir must not fail the caller.
export function removeCloneDir(dir, rm = fs.rmSync) {
  try {
    rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(`Could not remove temporary wiki clone ${dir}: ${error.code ?? error.message}`);
  }
}

function main() {
  const ifChanged = process.argv.includes('--if-changed');
  const dryRun = process.argv.includes('--dry-run');
  const pages = wikiPagesFromRepo();
  if (ifChanged) {
    const files = changedFilesAgainstUpstream();
    if (files === null) {
      console.warn('WIKI_PUBLISH_WARNING: could not determine the changed files for this push; treating wiki as changed (publishing is idempotent).');
    } else if (changedWikiPaths(files).length === 0) {
      console.log('No repo wiki files in this push. Skipping wiki publish.');
      return;
    }
  }
  const branch = resolveBranch();
  const guards = evaluatePublishGuards({ branch, dirty: checkDirtyWiki() });
  if (dryRun) {
    if (guards.length === 0) {
      console.log('WIKI_PUBLISH_GUARDS: none would trigger; a real run from this ref would publish.');
    } else {
      for (const guard of guards) console.log(`WIKI_PUBLISH_GUARD: a real run would refuse (${guard.code}): ${guard.message}`);
    }
    const auth = resolveWikiAuth();
    console.log(`WIKI_PUBLISH_AUTH: ${auth.mode}${auth.source ? ` via ${auth.source}` : ''}`);
    publish(pages, { dryRun: true });
    return;
  }
  if (guards.length > 0) {
    for (const guard of guards) console.error(`${guard.code}: ${guard.message}`);
    process.exit(1);
  }
  try {
    publish(pages);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();