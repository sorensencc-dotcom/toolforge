import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT_WIKI_PAGE_MAPPINGS } from '../tools/wiki-browser-qa/wiki-page-rules.mjs';
import { addFrontmatterTitle, ensureSkillLibrary } from './sync-github-wiki.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIKI_REMOTE = 'git@github.com:sorensencc-dotcom/toolforge.wiki.git';
const GIT = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Git\\cmd\\git.exe')
  ? 'C:\\Program Files\\Git\\cmd\\git.exe'
  : 'git';
const PUBLISHED_CLONE = path.resolve('C:/dev', 'toolforge-wiki').toLowerCase();

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
  const insidePublished = lower === PUBLISHED_CLONE || lower.startsWith(`${PUBLISHED_CLONE}${path.sep}`);
  if (path.basename(resolved).toLowerCase() === 'toolforge-wiki' || insidePublished) {
    throw new Error('REFUSING_WIKI_CLONE: publish into a temp clone. The repo wiki/ tree is the source.');
  }
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

export function runGit(args, cwd, baseEnv = process.env) {
  return execFileSync(GIT, args, { cwd, encoding: 'utf8', env: cleanGitEnv(baseEnv) }).trim();
}

function git(args, cwd) {
  return runGit(args, cwd);
}

function changedFilesAgainstUpstream() {
  let range = 'origin/main...HEAD';
  try {
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], root);
    if (upstream) range = `${upstream}...HEAD`;
  } catch {
    range = 'origin/main...HEAD';
  }
  return git(['diff', '--name-only', range], root).split(/\r?\n/).filter(Boolean);
}

function publish(pages) {
  const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolforge-wiki-publish-'));
  try {
    assertPublishClone(cloneDir);
    execFileSync(GIT, ['-c', 'core.autocrlf=false', 'clone', '--depth', '1', WIKI_REMOTE, cloneDir], {
      stdio: 'inherit',
      env: cleanGitEnv()
    });
    git(['config', 'core.autocrlf', 'false'], cloneDir);
    const repoPages = pages.map((page) => ({ ...page, src: path.join(root, page.src) }));
    applyRepoPages(cloneDir, repoPages);
    const addPaths = repoPages.map((page) => page.dest);
    if (fs.existsSync(path.join(cloneDir, '_Sidebar.md'))) addPaths.push('_Sidebar.md');
    git(['add', '--', ...addPaths], cloneDir);
    const dirty = git(['diff', '--cached', '--name-only'], cloneDir);
    if (!dirty) {
      console.log('Repo wiki pages already match the published wiki.');
      return;
    }
    git(['-c', 'core.hooksPath=.git/no-hooks', 'commit', '-m', 'docs(wiki): publish repo wiki pages'], cloneDir);
    git(['-c', 'core.hooksPath=.git/no-hooks', 'push', 'origin', 'HEAD'], cloneDir);
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
  const pages = wikiPagesFromRepo();
  if (ifChanged && changedWikiPaths(changedFilesAgainstUpstream()).length === 0) {
    console.log('No repo wiki files in this push. Skipping wiki publish.');
    return;
  }
  publish(pages);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
