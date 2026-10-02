# Unified doc sync implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate wiki publish paths with one registry-driven command, `npm run docs:sync`, that publishes every product's in-repo docs to its own GitHub wiki and then refreshes the kb-sync cache.

**Architecture:** A JSON registry (`docs/meta/governance/wiki-sync-registry.json`) lists every product: its repo, its source folder, its wiki remote, and how to publish it. One orchestrator (`scripts/doc-sync/run.mjs`) reads the registry and handles each product in one of two modes. In `mirror` mode the orchestrator clones the wiki, replaces its contents with the source folder, and pushes. In `command` mode it runs the product's existing publish script unchanged. Each run writes only to the remote named in that product's row. kb-sync only reads: it ingests after publishing succeeds and never writes back into a product repo or wiki.

**Tech stack:** Node 20+ ESM (`.mjs`), `node:test`, `node:assert/strict`, `git` CLI, PowerShell for the scheduled-task wrapper. No new npm dependencies.

**Spec:** [wiki-sync-registry.md](../../meta/governance/wiki-sync-registry.md) (draft registry; this plan makes it machine-readable and authoritative) plus [wiki-style-and-structure.md](../../meta/governance/wiki-style-and-structure.md) §10 (sync contract).

## Global constraints

- Direction is fixed: product repo → that product's GitHub wiki. kb-sync and `C:\dev\wiki` are never a source for any wiki.
- One registry row per product. A push to any remote other than the row's `remote` is a bug.
- `C:\dev\wiki`, `_kb-sync-staging`, `dev-sandbox`, `.claude/worktrees`, and `node_modules` are never valid `sourceDir` values.
- Scripts live in `C:\dev\scripts\doc-sync\`. Tests live in `C:\dev\tests\`.
- Run every test under a timeout: `timeout 60 node --test <file>`.
- Commit prefixes: `feat(doc-sync):`, `fix(doc-sync):`, `test(doc-sync):`, `docs(governance):`, `chore(doc-sync):`.
- Work in a worktree off `main`, not on `parkd821-20260908`, which carries unrelated dirty state.
- Before any read, write, or commit in another repo (trm, kb-sync, icf, helix, toolforge-marketplace), run `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path <that repo root>`.
- No real wiki push happens until Task 8. Tasks 1–7 use local bare repos as fake remotes.
- Several files in this workspace use CRLF line endings. Check with `git diff --stat` after editing, and revert any edit that turns a whole file into a diff.

## Out of scope

- kb-sync → `C:\dev\docs`. Under the registry, `C:\dev\docs` is toolforge's own source tree (Task 7 row `toolforge`). mkdocs keeps building it through `.github/workflows/documentation.yml`.
- NotebookLM and Drive egress. Those follow the separate kb-sync pack plan.
- `\toolforge\Daily-Roadmap-Sync` and `\CIC\CIC-Vault-Sync-rl`. They sync roadmaps and vaults, not wikis.
- cic-jev, which stays a stub wiki per Chris.

## File map

| File | Status | Responsibility |
|---|---|---|
| `docs/meta/governance/wiki-sync-registry.json` | Create | Authoritative product list |
| `scripts/doc-sync/registry.mjs` | Create | Load and validate the registry |
| `scripts/doc-sync/stage-mirror.mjs` | Create | Replace a clone's contents with a source folder |
| `scripts/doc-sync/sidebar-guard.mjs` | Create | Fail when `_Sidebar.md` links to pages that aren't in the tree |
| `scripts/doc-sync/publish.mjs` | Create | Publish one product (mirror or command mode) |
| `scripts/doc-sync/run.mjs` | Create | CLI: loop over products, write receipt, run ingest |
| `tests/doc-sync-*.test.mjs` | Create | One test file per module above |
| `scripts/sync-github-wiki.mjs:15` | Modify | Fix the always-push bug |
| `package.json` | Modify | Add `docs:sync` and `test:doc-sync` |
| `docs/meta/governance/wiki-sync-registry.md` | Modify | Point to the JSON, fix stale paths, leave draft |
| `kb-sync/.github/workflows/wiki-drift-and-publish.yml` | Modify | Remove the publish step |
| `kb-sync/scripts/schedule-task-wrapper-KB-Sync-Master.ps1` | Modify | Run doc sync first |
| `kb-sync/package.json` | Modify | Remove `fleet:wiki:reconcile` |
| `trm/package.json`, `trm/scripts/sync-remote-wiki.mjs` | Modify, delete | Point to the orchestrator |

---

### Task 1: Registry loader

**Files:**
- Create: `scripts/doc-sync/registry.mjs`
- Create: `docs/meta/governance/wiki-sync-registry.json` (one disabled placeholder row; real rows come in Task 7)
- Test: `tests/doc-sync-registry.test.mjs`

**Interfaces:**
- Produces: `loadRegistry(filePath: string): Product[]` and `validateRegistry(raw: object): Product[]`. Each throws an `Error` whose message starts with `REGISTRY_INVALID:` on bad input.
- `Product` = `{ name: string, repoPath: string, remote: string, mode: 'mirror' | 'command', sourceDir?: string, homeFrom?: string, preValidate?: string, publishCommand?: string, enabled: boolean }`. `sourceDir` is required for `mirror`; `publishCommand` is required for `command`. `preValidate` runs in `repoPath` before publishing.

- [ ] **Step 1: Write the failing test**

```js
// tests/doc-sync-registry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistry } from '../scripts/doc-sync/registry.mjs';

const base = {
  name: 'trm', repoPath: 'C:\\dev\\trm', remote: 'https://github.com/sorensencc-dotcom/TRM.wiki.git',
  mode: 'mirror', sourceDir: 'wiki', enabled: true,
};

test('accepts a valid mirror product', () => {
  const [p] = validateRegistry({ products: [base] });
  assert.equal(p.name, 'trm');
  assert.equal(p.homeFrom, undefined);
});

test('rejects a duplicate remote', () => {
  assert.throws(() => validateRegistry({ products: [base, { ...base, name: 'trm2' }] }), /REGISTRY_INVALID: duplicate remote/);
});

test('rejects a duplicate name', () => {
  assert.throws(() => validateRegistry({ products: [base, { ...base, remote: 'git@github.com:sorensencc-dotcom/x.wiki.git' }] }), /REGISTRY_INVALID: duplicate name/);
});

test('rejects a remote that is not a sorensencc-dotcom wiki', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, remote: 'https://github.com/someone/TRM.wiki.git' }] }), /REGISTRY_INVALID: remote/);
  assert.throws(() => validateRegistry({ products: [{ ...base, remote: 'https://github.com/sorensencc-dotcom/TRM.git' }] }), /REGISTRY_INVALID: remote/);
});

test('rejects quarantine and disallowed source folders', () => {
  for (const bad of ['C:\\dev\\wiki', '_kb-sync-staging/x', 'dev-sandbox/a', '.claude/worktrees/b', 'node_modules/c']) {
    assert.throws(
      () => validateRegistry({ products: [{ ...base, repoPath: bad.startsWith('C:') ? 'C:\\dev' : base.repoPath, sourceDir: bad.startsWith('C:') ? 'wiki' : bad }] }),
      /REGISTRY_INVALID: sourceDir/,
      bad,
    );
  }
});

test('mirror needs sourceDir, command needs publishCommand', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: undefined }] }), /REGISTRY_INVALID: trm: mirror mode needs sourceDir/);
  assert.throws(() => validateRegistry({ products: [{ ...base, mode: 'command', sourceDir: undefined }] }), /REGISTRY_INVALID: trm: command mode needs publishCommand/);
});

test('rejects an unknown mode', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, mode: 'fleet' }] }), /REGISTRY_INVALID: trm: mode/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `timeout 60 node --test tests/doc-sync-registry.test.mjs`
Expected: FAIL with `Cannot find module` for `registry.mjs`.

- [ ] **Step 3: Write the implementation**

```js
// scripts/doc-sync/registry.mjs
import fs from 'node:fs';
import path from 'node:path';

const REMOTE_RE = /^(https:\/\/github\.com\/|git@github\.com:)sorensencc-dotcom\/[\w.-]+\.wiki\.git$/;
const DISALLOWED = ['_kb-sync-staging', 'dev-sandbox', '.claude/worktrees', 'node_modules'];
const QUARANTINE_ROOT = path.win32.normalize('C:\\dev\\wiki').toLowerCase();

function fail(msg) {
  throw new Error(`REGISTRY_INVALID: ${msg}`);
}

function checkSourceDir(p) {
  const rel = p.sourceDir.replace(/\\/g, '/');
  if (DISALLOWED.some((d) => rel.includes(d))) fail(`sourceDir ${p.sourceDir} is disallowed (${p.name})`);
  const abs = path.win32.normalize(path.win32.join(p.repoPath, p.sourceDir)).toLowerCase();
  if (abs === QUARANTINE_ROOT || abs.startsWith(QUARANTINE_ROOT + '\\')) fail(`sourceDir ${abs} is the quarantine dump (${p.name})`);
}

export function validateRegistry(raw) {
  if (!raw || !Array.isArray(raw.products)) fail('missing products array');
  const names = new Set();
  const remotes = new Set();
  return raw.products.map((p) => {
    for (const k of ['name', 'repoPath', 'remote', 'mode']) if (typeof p[k] !== 'string' || !p[k]) fail(`missing ${k}`);
    if (typeof p.enabled !== 'boolean') fail(`${p.name}: enabled must be boolean`);
    if (!REMOTE_RE.test(p.remote)) fail(`remote ${p.remote} is not a sorensencc-dotcom wiki (${p.name})`);
    if (p.mode !== 'mirror' && p.mode !== 'command') fail(`${p.name}: mode must be mirror or command`);
    if (p.mode === 'mirror' && !p.sourceDir) fail(`${p.name}: mirror mode needs sourceDir`);
    if (p.mode === 'command' && !p.publishCommand) fail(`${p.name}: command mode needs publishCommand`);
    if (p.sourceDir) checkSourceDir(p);
    if (names.has(p.name)) fail(`duplicate name ${p.name}`);
    if (remotes.has(p.remote)) fail(`duplicate remote ${p.remote}`);
    names.add(p.name);
    remotes.add(p.remote);
    return { ...p };
  });
}

export function loadRegistry(filePath) {
  return validateRegistry(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}
```

```json
// docs/meta/governance/wiki-sync-registry.json
{
  "$comment": "Authoritative wiki sync registry. Human notes live in wiki-sync-registry.md. Edit rows here, then run npm run docs:sync -- --dry-run.",
  "products": []
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `timeout 60 node --test tests/doc-sync-registry.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-sync/registry.mjs tests/doc-sync-registry.test.mjs docs/meta/governance/wiki-sync-registry.json
git commit -m "feat(doc-sync): add validated wiki sync registry loader"
```

---

### Task 2: Mirror stager

**Files:**
- Create: `scripts/doc-sync/stage-mirror.mjs`
- Test: `tests/doc-sync-stage-mirror.test.mjs`

**Interfaces:**
- Produces: `stageMirror({ sourceDir: string, cloneDir: string, homeFrom?: string }): void`. Afterwards, `cloneDir` contains exactly the files in `sourceDir` plus its own `.git`. Pages removed from the source are removed from the clone. If `homeFrom` is set, that file is written as `Home.md` instead of under its own name.

- [ ] **Step 1: Write the failing test**

```js
// tests/doc-sync-stage-mirror.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageMirror } from '../scripts/doc-sync/stage-mirror.mjs';

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docsync-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

function list(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath ?? e.path, e.name)).replace(/\\/g, '/'))
    .filter((f) => !f.startsWith('.git/'))
    .sort();
}

test('replaces clone contents with source, keeps .git, removes stale pages', () => {
  const src = tree({ 'Home.md': 'new home', 'sub/Page.md': 'p', 'img/a.png': 'x' });
  const clone = tree({ '.git/HEAD': 'ref', 'Home.md': 'old', 'Stale.md': 'gone' });
  stageMirror({ sourceDir: src, cloneDir: clone });
  assert.deepEqual(list(clone), ['Home.md', 'img/a.png', 'sub/Page.md']);
  assert.equal(fs.readFileSync(path.join(clone, 'Home.md'), 'utf8'), 'new home');
  assert.equal(fs.readFileSync(path.join(clone, '.git/HEAD'), 'utf8'), 'ref');
});

test('homeFrom renames the given file to Home.md', () => {
  const src = tree({ 'README.md': 'landing', 'Other.md': 'o' });
  const clone = tree({ '.git/HEAD': 'ref' });
  stageMirror({ sourceDir: src, cloneDir: clone, homeFrom: 'README.md' });
  assert.deepEqual(list(clone), ['Home.md', 'Other.md']);
  assert.equal(fs.readFileSync(path.join(clone, 'Home.md'), 'utf8'), 'landing');
});

test('throws when the source folder is missing or empty', () => {
  const clone = tree({ '.git/HEAD': 'ref', 'Keep.md': 'k' });
  assert.throws(() => stageMirror({ sourceDir: path.join(clone, 'nope'), cloneDir: clone }), /STAGE_SOURCE_MISSING/);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'docsync-empty-'));
  assert.throws(() => stageMirror({ sourceDir: empty, cloneDir: clone }), /STAGE_SOURCE_EMPTY/);
  assert.deepEqual(list(clone), ['Keep.md']);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `timeout 60 node --test tests/doc-sync-stage-mirror.test.mjs`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Write the implementation**

The empty-source check must run before anything is deleted. A wrong `sourceDir` must not wipe a wiki.

```js
// scripts/doc-sync/stage-mirror.mjs
import fs from 'node:fs';
import path from 'node:path';

export function stageMirror({ sourceDir, cloneDir, homeFrom }) {
  if (!fs.existsSync(sourceDir)) throw new Error(`STAGE_SOURCE_MISSING: ${sourceDir}`);
  const entries = fs.readdirSync(sourceDir).filter((n) => n !== '.git');
  if (entries.length === 0) throw new Error(`STAGE_SOURCE_EMPTY: ${sourceDir}`);

  for (const name of fs.readdirSync(cloneDir)) {
    if (name === '.git') continue;
    fs.rmSync(path.join(cloneDir, name), { recursive: true, force: true });
  }
  for (const name of entries) {
    const dest = homeFrom && name === homeFrom ? 'Home.md' : name;
    fs.cpSync(path.join(sourceDir, name), path.join(cloneDir, dest), { recursive: true });
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `timeout 60 node --test tests/doc-sync-stage-mirror.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-sync/stage-mirror.mjs tests/doc-sync-stage-mirror.test.mjs
git commit -m "feat(doc-sync): add mirror stager that refuses empty sources"
```

---

### Task 3: Sidebar guard

Blocks the cross-repo sidebar contamination found in toolforge-marketplace and kb-sync-wiki: sidebar links that point at pages from another product.

**Files:**
- Create: `scripts/doc-sync/sidebar-guard.mjs`
- Test: `tests/doc-sync-sidebar-guard.test.mjs`

**Interfaces:**
- Produces: `findForeignSidebarLinks(dir: string): string[]`. Returns the internal link targets in `dir/_Sidebar.md` that have no matching `<target>.md` anywhere in `dir`. Returns `[]` when there's no sidebar. External links (`http:`, `https:`, `mailto:`) and `#` anchors are ignored. Matching is case-insensitive and ignores a trailing `.md`.

- [ ] **Step 1: Write the failing test**

```js
// tests/doc-sync-sidebar-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findForeignSidebarLinks } from '../scripts/doc-sync/sidebar-guard.mjs';

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidebar-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

test('no sidebar means no findings', () => {
  assert.deepEqual(findForeignSidebarLinks(tree({ 'Home.md': 'h' })), []);
});

test('flags wiki links and markdown links with no matching page', () => {
  const dir = tree({
    'Home.md': 'h',
    'docs/Architecture.md': 'a',
    '_Sidebar.md': [
      '- [[Home]]',
      '- [Arch](Architecture)',
      '- [[KB-Sync-Pipeline]]',
      '- [Foreign](TRM-Ingest.md)',
      '- [Ext](https://example.com/x)',
      '- [Anchor](#top)',
    ].join('\n'),
  });
  assert.deepEqual(findForeignSidebarLinks(dir), ['KB-Sync-Pipeline', 'TRM-Ingest']);
});

test('wiki link with a label uses the page part', () => {
  const dir = tree({ 'Real-Page.md': 'r', '_Sidebar.md': '- [[Label|Real-Page]]\n- [[Other|Missing-Page]]' });
  assert.deepEqual(findForeignSidebarLinks(dir), ['Missing-Page']);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `timeout 60 node --test tests/doc-sync-sidebar-guard.test.mjs`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Write the implementation**

GitHub wikis use `[[Label|Page]]`, with the page after the pipe.

```js
// scripts/doc-sync/sidebar-guard.mjs
import fs from 'node:fs';
import path from 'node:path';

function pageNames(dir) {
  const names = new Set();
  for (const e of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (e.isFile() && e.name.toLowerCase().endsWith('.md')) names.add(e.name.slice(0, -3).toLowerCase());
  }
  return names;
}

function targets(sidebar) {
  const out = [];
  for (const m of sidebar.matchAll(/\[\[([^\]]+)\]\]/g)) out.push(m[1].split('|').pop().trim());
  for (const m of sidebar.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) out.push(m[1].trim());
  return out
    .filter((t) => t && !t.startsWith('#') && !/^(https?|mailto):/i.test(t))
    .map((t) => t.split('#')[0].split('/').pop().replace(/\.md$/i, ''));
}

export function findForeignSidebarLinks(dir) {
  const file = path.join(dir, '_Sidebar.md');
  if (!fs.existsSync(file)) return [];
  const pages = pageNames(dir);
  return [...new Set(targets(fs.readFileSync(file, 'utf8')))].filter((t) => !pages.has(t.toLowerCase()));
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `timeout 60 node --test tests/doc-sync-sidebar-guard.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-sync/sidebar-guard.mjs tests/doc-sync-sidebar-guard.test.mjs
git commit -m "feat(doc-sync): fail on sidebar links to pages outside the product"
```

---

### Task 4: Publisher

**Files:**
- Create: `scripts/doc-sync/publish.mjs`
- Test: `tests/doc-sync-publish.test.mjs`

**Interfaces:**
- Consumes: `stageMirror` (Task 2), `findForeignSidebarLinks` (Task 3), `Product` (Task 1).
- Produces: `publishProduct(product: Product, opts: { dryRun?: boolean, sh?: (cmd: string, cwd: string) => string }): Promise<Result>`.
- `Result` = `{ product: string, status: 'SYNCHRONIZED' | 'UP_TO_DATE' | 'DRY_RUN' | 'DRY_RUN_SKIPPED' | 'FAILED', changed: string[], error?: string }`.
- `sh` defaults to a `child_process.execSync` wrapper that returns trimmed stdout and throws on a non-zero exit. Tests use the real `sh` against a local bare repo, so no network is involved.

- [ ] **Step 1: Write the failing test**

```js
// tests/doc-sync-publish.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { publishProduct } from '../scripts/doc-sync/publish.mjs';

const git = (cmd, cwd) => execSync(`git -c user.name=t -c user.email=t@t ${cmd}`, { cwd, encoding: 'utf8' }).trim();

function fakeRemote(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-'));
  const bare = path.join(root, 'r.wiki.git');
  git(`init --bare -b master "${bare}"`, root);
  const seed = path.join(root, 'seed');
  git(`clone "${bare}" "${seed}"`, root);
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(seed, rel), body);
  git('add -A', seed);
  git('commit -m seed', seed);
  git('push origin HEAD', seed);
  return bare;
}

function remoteFiles(bare) {
  return git('ls-tree -r --name-only HEAD', bare).split('\n').filter(Boolean).sort();
}

function repoWithWiki(files) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  fs.mkdirSync(path.join(repo, 'wiki'));
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(repo, 'wiki', rel), body);
  return repo;
}

const product = (repoPath, remote, extra = {}) => ({ name: 'p', repoPath, remote, mode: 'mirror', sourceDir: 'wiki', enabled: true, ...extra });

test('mirror publishes source and deletes stale remote pages', async () => {
  const bare = fakeRemote({ 'Home.md': 'old', 'Stale.md': 's' });
  const repo = repoWithWiki({ 'Home.md': 'new', 'Page.md': 'p' });
  const r = await publishProduct(product(repo, bare));
  assert.equal(r.status, 'SYNCHRONIZED', r.error);
  assert.deepEqual(remoteFiles(bare), ['Home.md', 'Page.md']);
});

test('second run is UP_TO_DATE', async () => {
  const bare = fakeRemote({ 'Home.md': 'x' });
  const repo = repoWithWiki({ 'Home.md': 'x' });
  assert.equal((await publishProduct(product(repo, bare))).status, 'UP_TO_DATE');
});

test('dry run reports changes and pushes nothing', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'new', 'Add.md': 'a' });
  const r = await publishProduct(product(repo, bare), { dryRun: true });
  assert.equal(r.status, 'DRY_RUN');
  assert.deepEqual(r.changed.sort(), ['Add.md', 'Home.md']);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
});

test('foreign sidebar link fails before push', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'h', '_Sidebar.md': '- [[Other-Product-Page]]' });
  const r = await publishProduct(product(repo, bare));
  assert.equal(r.status, 'FAILED');
  assert.match(r.error, /SIDEBAR_FOREIGN_LINKS: Other-Product-Page/);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
});

test('failing preValidate stops publish', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'new' });
  const r = await publishProduct(product(repo, bare, { preValidate: 'node -e "process.exit(3)"' }));
  assert.equal(r.status, 'FAILED');
  assert.match(r.error, /PREVALIDATE_FAILED/);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
});

test('command mode runs publishCommand in repoPath; dry run skips it', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-'));
  const p = { name: 'c', repoPath: repo, remote: 'git@github.com:sorensencc-dotcom/c.wiki.git', mode: 'command', publishCommand: 'node -e "require(\'fs\').writeFileSync(\'ran.txt\',\'1\')"', enabled: true };
  assert.equal((await publishProduct(p, { dryRun: true })).status, 'DRY_RUN_SKIPPED');
  assert.equal(fs.existsSync(path.join(repo, 'ran.txt')), false);
  assert.equal((await publishProduct(p)).status, 'SYNCHRONIZED');
  assert.equal(fs.existsSync(path.join(repo, 'ran.txt')), true);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `timeout 60 node --test tests/doc-sync-publish.test.mjs`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Write the implementation**

`core.hooksPath` points at a nonexistent folder because wiki clones must not pick up workspace git hooks; `scripts/sync-github-wiki.mjs` does the same. Commands are logged without the remote URL so CI tokens embedded in URLs never reach logs.

```js
// scripts/doc-sync/publish.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { stageMirror } from './stage-mirror.mjs';
import { findForeignSidebarLinks } from './sidebar-guard.mjs';

const defaultSh = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const GIT = 'git -c core.hooksPath=.git/no-hooks -c user.name=doc-sync -c user.email=doc-sync@localhost';

function runCommand(sh, label, cmd, cwd) {
  try {
    sh(cmd, cwd);
  } catch (err) {
    throw new Error(`${label}: ${(err.stderr || err.message || '').toString().trim().slice(0, 500)}`);
  }
}

export async function publishProduct(product, { dryRun = false, sh = defaultSh } = {}) {
  const result = { product: product.name, status: 'FAILED', changed: [] };
  let cloneDir;
  try {
    if (product.preValidate) runCommand(sh, 'PREVALIDATE_FAILED', product.preValidate, product.repoPath);

    if (product.mode === 'command') {
      if (dryRun) return { ...result, status: 'DRY_RUN_SKIPPED' };
      runCommand(sh, 'PUBLISH_COMMAND_FAILED', product.publishCommand, product.repoPath);
      return { ...result, status: 'SYNCHRONIZED' };
    }

    cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), `doc-sync-${product.name}-`));
    runCommand(sh, 'CLONE_FAILED', `git clone --quiet "${product.remote}" "${cloneDir}"`, os.tmpdir());
    stageMirror({ sourceDir: path.join(product.repoPath, product.sourceDir), cloneDir, homeFrom: product.homeFrom });

    const foreign = findForeignSidebarLinks(cloneDir);
    if (foreign.length) throw new Error(`SIDEBAR_FOREIGN_LINKS: ${foreign.join(', ')}`);

    sh(`${GIT} add -A`, cloneDir);
    result.changed = sh(`${GIT} -c core.quotePath=false diff --cached --name-only`, cloneDir).split('\n').filter(Boolean);
    if (result.changed.length === 0) return { ...result, status: 'UP_TO_DATE' };
    if (dryRun) return { ...result, status: 'DRY_RUN' };

    runCommand(sh, 'COMMIT_FAILED', `${GIT} commit --quiet -m "docs(wiki): sync from ${product.name} ${product.sourceDir}"`, cloneDir);
    runCommand(sh, 'PUSH_FAILED', `${GIT} push --quiet origin HEAD`, cloneDir);
    return { ...result, status: 'SYNCHRONIZED' };
  } catch (err) {
    return { ...result, error: err.message };
  } finally {
    if (cloneDir) fs.rmSync(cloneDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `timeout 60 node --test tests/doc-sync-publish.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-sync/publish.mjs tests/doc-sync-publish.test.mjs
git commit -m "feat(doc-sync): publish one product via mirror or command mode"
```

---

### Task 5: CLI, receipt, and ingest

**Files:**
- Create: `scripts/doc-sync/run.mjs`
- Modify: `package.json` (`scripts` block)
- Test: `tests/doc-sync-run.test.mjs`

**Interfaces:**
- Consumes: `loadRegistry` (Task 1), `publishProduct` (Task 4).
- Produces: `runDocSync({ registryPath, only?: string, dryRun?: boolean, ingest?: boolean, receiptPath, publish?, runIngest? }): Promise<{ ok: boolean, results: Result[] }>`. `publish` and `runIngest` are injectable for tests and default to the real functions.
- CLI: `node scripts/doc-sync/run.mjs [--product=<name>] [--dry-run] [--ingest]`. Exits 1 if any result is `FAILED`. Writes the receipt to `_status-feed/doc-sync-receipt.json`.
- Ingest runs only when not a dry run and no product failed. It runs `npm run kb:cache:sync` in `C:\dev\kb-sync`, because that script resolves its database path from the folder it runs in.

- [ ] **Step 1: Write the failing test**

```js
// tests/doc-sync-run.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDocSync } from '../scripts/doc-sync/run.mjs';

function setup(products) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-'));
  const registryPath = path.join(dir, 'reg.json');
  fs.writeFileSync(registryPath, JSON.stringify({ products }));
  return { registryPath, receiptPath: path.join(dir, 'receipt.json') };
}

const row = (name, enabled = true) => ({ name, repoPath: 'C:\\x', remote: `git@github.com:sorensencc-dotcom/${name}.wiki.git`, mode: 'mirror', sourceDir: 'wiki', enabled });

test('publishes enabled products only and ingests after success', async () => {
  const { registryPath, receiptPath } = setup([row('a'), row('b', false)]);
  const seen = [];
  let ingested = 0;
  const out = await runDocSync({
    registryPath, receiptPath, ingest: true,
    publish: async (p) => { seen.push(p.name); return { product: p.name, status: 'SYNCHRONIZED', changed: [] }; },
    runIngest: () => { ingested++; },
  });
  assert.equal(out.ok, true);
  assert.deepEqual(seen, ['a']);
  assert.equal(ingested, 1);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.results[0].status, 'SYNCHRONIZED');
  assert.equal(receipt.ingest, 'RAN');
});

test('a failure blocks ingest, the run continues to other products, ok is false', async () => {
  const { registryPath, receiptPath } = setup([row('a'), row('b')]);
  let ingested = 0;
  const out = await runDocSync({
    registryPath, receiptPath, ingest: true,
    publish: async (p) => ({ product: p.name, status: p.name === 'a' ? 'FAILED' : 'SYNCHRONIZED', changed: [], error: p.name === 'a' ? 'boom' : undefined }),
    runIngest: () => { ingested++; },
  });
  assert.equal(out.ok, false);
  assert.deepEqual(out.results.map((r) => r.product), ['a', 'b']);
  assert.equal(ingested, 0);
  assert.equal(JSON.parse(fs.readFileSync(receiptPath, 'utf8')).ingest, 'SKIPPED_FAILURE');
});

test('--product selects one row, even when disabled; unknown name throws', async () => {
  const { registryPath, receiptPath } = setup([row('a'), row('b', false)]);
  const seen = [];
  await runDocSync({ registryPath, receiptPath, only: 'b', publish: async (p) => { seen.push(p.name); return { product: p.name, status: 'DRY_RUN', changed: [] }; } });
  assert.deepEqual(seen, ['b']);
  await assert.rejects(runDocSync({ registryPath, receiptPath, only: 'zzz', publish: async () => ({}) }), /UNKNOWN_PRODUCT: zzz/);
});

test('dry run never ingests', async () => {
  const { registryPath, receiptPath } = setup([row('a')]);
  let ingested = 0;
  await runDocSync({ registryPath, receiptPath, dryRun: true, ingest: true, publish: async (p) => ({ product: p.name, status: 'DRY_RUN', changed: [] }), runIngest: () => { ingested++; } });
  assert.equal(ingested, 0);
  assert.equal(JSON.parse(fs.readFileSync(receiptPath, 'utf8')).ingest, 'SKIPPED_DRY_RUN');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `timeout 60 node --test tests/doc-sync-run.test.mjs`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Write the implementation**

`--product` can select a disabled row on purpose. That's how Task 8 dry-runs each product before enabling it.

```js
// scripts/doc-sync/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './registry.mjs';
import { publishProduct } from './publish.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KB_SYNC = path.join(ROOT, 'kb-sync');

const defaultIngest = () => execSync('npm run kb:cache:sync', { cwd: KB_SYNC, stdio: 'inherit' });

export async function runDocSync({ registryPath, receiptPath, only, dryRun = false, ingest = false, publish = publishProduct, runIngest = defaultIngest }) {
  const all = loadRegistry(registryPath);
  let selected;
  if (only) {
    selected = all.filter((p) => p.name === only);
    if (selected.length === 0) throw new Error(`UNKNOWN_PRODUCT: ${only}`);
  } else {
    selected = all.filter((p) => p.enabled);
  }

  const results = [];
  for (const p of selected) {
    const r = await publish(p, { dryRun });
    console.log(`[doc-sync] ${p.name}: ${r.status}${r.changed?.length ? ` (${r.changed.length} changed)` : ''}${r.error ? ` - ${r.error}` : ''}`);
    results.push(r);
  }

  const ok = results.every((r) => r.status !== 'FAILED');
  let ingestStatus = 'NOT_REQUESTED';
  if (ingest) {
    if (dryRun) ingestStatus = 'SKIPPED_DRY_RUN';
    else if (!ok) ingestStatus = 'SKIPPED_FAILURE';
    else { runIngest(); ingestStatus = 'RAN'; }
  }

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify({ timestamp: new Date().toISOString(), dryRun, ok, ingest: ingestStatus, results }, null, 2) + '\n');
  return { ok, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--product='))?.slice('--product='.length);
  runDocSync({
    registryPath: path.join(ROOT, 'docs', 'meta', 'governance', 'wiki-sync-registry.json'),
    receiptPath: path.join(ROOT, '_status-feed', 'doc-sync-receipt.json'),
    only,
    dryRun: args.includes('--dry-run'),
    ingest: args.includes('--ingest'),
  }).then(({ ok }) => process.exit(ok ? 0 : 1)).catch((err) => {
    console.error(`[doc-sync] ${err.message}`);
    process.exit(1);
  });
}
```

Add to `package.json` `scripts`:

```json
"docs:sync": "node scripts/doc-sync/run.mjs",
"test:doc-sync": "node --test tests/doc-sync-registry.test.mjs tests/doc-sync-stage-mirror.test.mjs tests/doc-sync-sidebar-guard.test.mjs tests/doc-sync-publish.test.mjs tests/doc-sync-run.test.mjs"
```

- [ ] **Step 4: Run all doc-sync tests and confirm they pass**

Run: `timeout 60 npm run test:doc-sync`
Expected: PASS, 23 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-sync/run.mjs tests/doc-sync-run.test.mjs package.json
git commit -m "feat(doc-sync): add docs:sync CLI with receipt and gated kb-sync ingest"
```

---

### Task 6: Fix the always-push bug in the toolforge publisher

[scripts/sync-github-wiki.mjs:15](../../../scripts/sync-github-wiki.mjs#L15) reads `... || true`, so `shouldPush` is always true and the script can't stage without pushing. The toolforge row runs this script in command mode, so Task 8 needs a safe preview of its output.

**Files:**
- Modify: `scripts/sync-github-wiki.mjs:15`

- [ ] **Step 1: Prove the bug against a local bare repo**

```bash
T=$(mktemp -d) && git init --bare -q -b master "$T/r.wiki.git" \
  && git clone -q "$T/r.wiki.git" "$T/seed" && echo x > "$T/seed/Home.md" \
  && git -C "$T/seed" add -A && git -C "$T/seed" -c user.name=t -c user.email=t@t commit -qm seed && git -C "$T/seed" push -q origin HEAD \
  && timeout 120 node scripts/sync-github-wiki.mjs --repo-url "$T/r.wiki.git" --no-push; git -C "$T/r.wiki.git" log --oneline | wc -l
```

Expected: `2`. The script pushed even though `--no-push` was passed.

- [ ] **Step 2: Fix the line, and keep the staged folder when not pushing**

Replace line 15:

```js
const shouldPush = !args.includes('--no-push') && process.env.AUTO_PUSH !== 'false';
```

The cleanup block at the end of `main()` deletes `targetWikiDir` unconditionally, which would delete the preview. Wrap it:

```js
  if (shouldPush) {
    try {
      fs.rmSync(targetWikiDir, { recursive: true, force: true });
    } catch {}
  } else {
    console.log(`Preview left at ${targetWikiDir} (--no-push). Delete it when done.`);
  }
```

- [ ] **Step 3: Rerun the Step 1 command against a fresh temp folder**

Expected: `1`, meaning nothing was pushed, and the script prints the `Preview left at ...` line. Delete that preview folder afterwards.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-github-wiki.mjs
git commit -m "fix(doc-sync): honor --no-push in toolforge wiki publisher"
```

---

### Task 7: Fill the registry and correct the markdown registry

**Files:**
- Modify: `docs/meta/governance/wiki-sync-registry.json`
- Modify: `docs/meta/governance/wiki-sync-registry.md`

Every row starts with `"enabled": false`. Task 8 enables them one at a time.

- [ ] **Step 1: Write the rows**

```json
{
  "$comment": "Authoritative wiki sync registry. Human notes live in wiki-sync-registry.md. Edit rows here, then run npm run docs:sync -- --dry-run.",
  "products": [
    { "name": "toolforge", "repoPath": "C:\\dev", "remote": "git@github.com:sorensencc-dotcom/toolforge.wiki.git", "mode": "command", "publishCommand": "node scripts/sync-github-wiki.mjs", "enabled": false },
    { "name": "sigil", "repoPath": "C:\\dev\\sigil-repo", "remote": "https://github.com/sorensencc-dotcom/sigil.wiki.git", "mode": "command", "publishCommand": "npm run wiki:sync", "enabled": false },
    { "name": "kb-sync", "repoPath": "C:\\dev\\kb-sync", "remote": "https://github.com/sorensencc-dotcom/kb-sync.wiki.git", "mode": "command", "preValidate": "npm run wiki:validate-contract", "publishCommand": "node scripts/sync-github-wiki.mjs", "enabled": false },
    { "name": "trm", "repoPath": "C:\\dev\\trm", "remote": "https://github.com/sorensencc-dotcom/TRM.wiki.git", "mode": "mirror", "sourceDir": "wiki", "preValidate": "node scripts/validate-diagram-triplets.mjs", "enabled": false },
    { "name": "icf", "repoPath": "C:\\dev\\icf", "remote": "https://github.com/sorensencc-dotcom/icf.wiki.git", "mode": "mirror", "sourceDir": "wiki", "enabled": false },
    { "name": "helix", "repoPath": "C:\\dev\\helix", "remote": "https://github.com/sorensencc-dotcom/helix.wiki.git", "mode": "mirror", "sourceDir": "wiki", "enabled": false },
    { "name": "toolforge-marketplace", "repoPath": "C:\\dev\\toolforge-marketplace", "remote": "https://github.com/sorensencc-dotcom/toolforge-marketplace.wiki.git", "mode": "mirror", "sourceDir": "wiki", "enabled": false },
    { "name": "cic-ingestion", "repoPath": "C:\\dev\\cic-ingestion", "remote": "https://github.com/sorensencc-dotcom/cic-ingestion.wiki.git", "mode": "mirror", "sourceDir": "wiki", "enabled": false },
    { "name": "rewrite-mcp", "repoPath": "C:\\dev\\rewrite-mcp", "remote": "https://github.com/sorensencc-dotcom/rewrite-mcp.wiki.git", "mode": "mirror", "sourceDir": "wiki", "enabled": false }
  ]
}
```

- [ ] **Step 2: Check the registry loads**

Run: `node -e "import('./scripts/doc-sync/registry.mjs').then(m=>console.log(m.loadRegistry('docs/meta/governance/wiki-sync-registry.json').length))"`
Expected: `9`.

- [ ] **Step 3: Update `wiki-sync-registry.md`**

Make these edits by hand and keep the file's line endings:
1. Under the status lines, add: `**Machine-readable source:** [wiki-sync-registry.json](wiki-sync-registry.json). The orchestrator reads only the JSON. This table is human notes and must name the same products.`
2. In the toolforge row, replace `C:\dev\toolforge` root with `C:\dev` root (origin `toolforge.git`).
3. In the sigil row and the related-tooling table, replace `C:\dev\sigil` with `C:\dev\sigil-repo`, and fix the script path to `C:\dev\sigil-repo\sigil\scripts\sync-wiki.mjs`.
4. Add a row to the related-tooling table: `| Doc sync orchestrator | C:\dev\scripts\doc-sync\run.mjs (npm run docs:sync) | The only publish entry point |`.
5. Leave **Status:** as draft. Flipping it to active is Task 10.

- [ ] **Step 4: Commit**

```bash
git add docs/meta/governance/wiki-sync-registry.json docs/meta/governance/wiki-sync-registry.md
git commit -m "docs(governance): add registry rows and fix stale toolforge and sigil paths"
```

---

### Task 8: Onboard products one at a time

Each product goes through dry run → review → enable → real run. Start with trm, which already has a curated `wiki/` folder with 26 entries.

**Files:**
- Modify: `docs/meta/governance/wiki-sync-registry.json` (one `enabled` flag per product)
- Create in product repos: `<repo>/wiki/**` for icf, helix, toolforge-marketplace, cic-ingestion, and rewrite-mcp (seeded from their current live wiki)

- [ ] **Step 1: trm dry run**

Run: `node scripts/doc-sync/run.mjs --product=trm --dry-run`
Expected: `trm: DRY_RUN (N changed)` or `trm: UP_TO_DATE`. Read the `changed` list in `_status-feed/doc-sync-receipt.json`. Any deletion of a page that only exists in the live wiki means `C:\dev\trm\wiki` is missing it. Copy that page in from `C:\dev\trm-wiki`, commit it in the trm repo, and rerun the dry run.

- [ ] **Step 2: trm real run**

Set `"enabled": true` on trm. Run: `node scripts/doc-sync/run.mjs --product=trm`
Expected: `SYNCHRONIZED` or `UP_TO_DATE`. Then rerun it and expect `UP_TO_DATE`.

- [ ] **Step 3: Seed each product whose live wiki is the only copy**

For icf, helix, and toolforge-marketplace (no `wiki/` folder in the repo), and for cic-ingestion and rewrite-mcp (`wiki/` holds 1 file while the live wiki holds 435 and 301 pages), run these commands one product at a time. `<name>` is the registry name, and `<clone>` is the existing local wiki clone (`C:\dev\<name>-wiki`).

```bash
pwsh -NoProfile -File C:/dev/scripts/verify-repo-context.ps1 -Path C:/dev/<name>
git -C C:/dev/<clone> pull --ff-only
mkdir -p C:/dev/<name>/wiki
cp -r C:/dev/<clone>/. C:/dev/<name>/wiki/ && rm -rf C:/dev/<name>/wiki/.git
git -C C:/dev/<name> add wiki
git -C C:/dev/<name> commit -m "docs(wiki): seed in-repo wiki source from live GitHub wiki"
```

For cic-ingestion and rewrite-mcp, ask Chris first whether the generated per-file pages (`*.ts.md` and similar, outside the `_Sidebar.md` set) should be kept. Seed only the pages he approves. Mirror mode deletes from the live wiki anything you leave out.

- [ ] **Step 4: Dry-run each seeded product**

Run: `node scripts/doc-sync/run.mjs --product=<name> --dry-run`
Expected: `UP_TO_DATE`, or `SIDEBAR_FOREIGN_LINKS: ...` for toolforge-marketplace, which has 6 known foreign links. Remove those lines from `C:\dev\toolforge-marketplace\wiki\_Sidebar.md`, commit, and rerun until it reports `UP_TO_DATE`.

- [ ] **Step 5: Enable and run each seeded product**

Set `"enabled": true` on each product, then run `node scripts/doc-sync/run.mjs --product=<name>`. Expected: `UP_TO_DATE`.

- [ ] **Step 6: Command-mode products**

Toolforge first. Run `node scripts/sync-github-wiki.mjs --no-push --target-dir .wiki-preview` from `C:\dev`, review `C:\dev\.wiki-preview`, then delete that folder. Do the same for kb-sync from `C:\dev\kb-sync`; check that `kb-sync/scripts/sync-github-wiki.mjs` honors `--no-push` first, and if it doesn't, apply the Task 6 fix there. For sigil, read `sigil-repo/sigil/scripts/sync-wiki.mjs` for a dry-run flag before running it for real. Enable each row, then run `node scripts/doc-sync/run.mjs --product=<name>`.

- [ ] **Step 7: Full run**

Run: `npm run docs:sync -- --dry-run`, then `npm run docs:sync`.
Expected: 9 lines, none `FAILED`, exit code 0.

- [ ] **Step 8: Commit after each product is enabled**

```bash
git add docs/meta/governance/wiki-sync-registry.json
git commit -m "chore(doc-sync): enable <name> in wiki sync registry"
```

---

### Task 9: Remove the duplicate publish paths

Do this only after Task 8 Step 7 passes.

**Files:**
- Modify: `kb-sync/.github/workflows/wiki-drift-and-publish.yml` (remove the step that runs `node scripts/sync-github-wiki.mjs --repo-url "$WIKI_REPO_URL"`, plus its env block, and the receipt-verify step if that step only checks the publish)
- Modify: `kb-sync/package.json` (remove `fleet:wiki:reconcile`)
- Delete: `kb-sync/modules/wiki/fleet-wiki-reconciler.ts` and `kb-sync/tests/fleet-wiki-reconciler.test.ts`, if only that script used them
- Modify: `trm/package.json` (`wiki:publish`)
- Delete: `trm/scripts/sync-remote-wiki.mjs`

- [ ] **Step 1: Check what else uses the fleet reconciler**

Run from `C:\dev\kb-sync`: `graft callers reconcileFleetWikis --depth all` and `graft callers syncRepositoryWiki --depth all`.
Expected: only the module's own CLI block and its test. If anything else calls either function, stop and list the callers for Chris instead of deleting.

- [ ] **Step 2: Remove the fleet reconciler and its npm script**

```bash
git -C C:/dev/kb-sync rm modules/wiki/fleet-wiki-reconciler.ts tests/fleet-wiki-reconciler.test.ts
```

Remove the `fleet:wiki:reconcile` and `test:fleet-reconciler` lines from `kb-sync/package.json`. Keep `cross-repo-drift-scanner.ts`; it reports drift and doesn't publish.

- [ ] **Step 3: Remove the publish step from kb-sync CI**

Delete the publish step from `wiki-drift-and-publish.yml`, keeping the validate step (`npm run wiki:validate-contract`). Change the `cron: '0 */4 * * *'` schedule to `push` and `pull_request` triggers only. With publishing gone, the job is a validation check, not a scheduler.

- [ ] **Step 4: Point trm at the orchestrator**

In `trm/package.json`, set `"wiki:publish": "node C:/dev/scripts/doc-sync/run.mjs --product=trm"`, then `git -C C:/dev/trm rm scripts/sync-remote-wiki.mjs`.

- [ ] **Step 5: Run kb-sync's tests**

Run from `C:\dev\kb-sync`: `timeout 600 npm test`
Expected: the same pass count as before minus the deleted fleet-reconciler tests, with no new failures. If the suite produces no output for 60 seconds, treat it as hung per AGENTS.md.

- [ ] **Step 6: Commit in each repo**

```bash
git -C C:/dev/kb-sync add -A modules/wiki tests package.json .github/workflows/wiki-drift-and-publish.yml
git -C C:/dev/kb-sync commit -m "chore(doc-sync): retire fleet reconciler and CI wiki publish in favor of docs:sync"
git -C C:/dev/trm add -A package.json scripts/sync-remote-wiki.mjs
git -C C:/dev/trm commit -m "chore(doc-sync): route wiki:publish through C:/dev docs:sync"
```

---

### Task 10: One scheduled run, and make the registry authoritative

**Files:**
- Modify: `kb-sync/scripts/schedule-task-wrapper-KB-Sync-Master.ps1`
- Modify: `docs/meta/governance/wiki-sync-registry.md`
- Modify: `docs/meta/governance/wiki-style-and-structure.md` §10

- [ ] **Step 1: Run doc sync first in the nightly pipeline**

In the master wrapper, before the NotebookLM auth check at line 69, add the block below, matching the wrapper's existing `& cmd /c ... | Tee-Object` style. Doc sync runs `kb:cache:sync` itself after a clean publish, so the wrapper doesn't run it a second time.

```powershell
Write-LogInfo "Publishing product wikis (docs:sync --ingest)..."
& cmd /c "node C:\dev\scripts\doc-sync\run.mjs --ingest" 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-LogError "docs:sync failed (exit $LASTEXITCODE); see C:\dev\_status-feed\doc-sync-receipt.json. Skipping downstream ingest so stale docs are not uploaded."
    exit 1
}
```

- [ ] **Step 2: Run the scheduled task once and check the receipt**

Run: `schtasks.exe /run /tn "\KB-SYNC\KB-Sync-Master-Pipeline"`. When it finishes, read `C:\dev\_status-feed\doc-sync-receipt.json`.
Expected: `"ok": true` and `"ingest": "RAN"`.

- [ ] **Step 3: Ask Chris to approve making the registry authoritative**

The registry's own rule 4 requires this before the status changes. Ask Chris directly, and do not proceed without his typed approval in the transcript. Once approved, change **Status:** from `draft` to `active` in `wiki-sync-registry.md`, and in `wiki-style-and-structure.md` §10 change "registry TODO" to "registry is authoritative (`wiki-sync-registry.json`)".

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/kb-sync add scripts/schedule-task-wrapper-KB-Sync-Master.ps1
git -C C:/dev/kb-sync commit -m "feat(doc-sync): run docs:sync first in nightly master pipeline"
git add docs/meta/governance/wiki-sync-registry.md docs/meta/governance/wiki-style-and-structure.md
git commit -m "docs(governance): make wiki sync registry authoritative"
```

---

## Done when

- `npm run docs:sync` is the only command that pushes to any product wiki. A search across `C:\dev` for `.wiki.git` pushes finds only `scripts/doc-sync/publish.mjs` and the three command-mode scripts it calls.
- Two `npm run docs:sync` runs in a row report every product as `UP_TO_DATE` on the second run.
- The nightly master pipeline publishes before ingesting and stops if publishing fails.
- The registry is marked active, and its JSON rows match its markdown rows.
