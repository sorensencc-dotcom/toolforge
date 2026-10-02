# Unified doc sync implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate wiki publish paths with one registry-driven command, `npm run docs:sync`, that publishes every product's docs to its own GitHub wiki and loads exactly what was published into the kb-sync cache.

**Architecture:** A JSON registry (`docs/meta/governance/wiki-sync-registry.json`) lists every product: its repo, its wiki remote, and where its pages come from. Pages come either from a folder in the repo (`sourceDir`) or from a build command that writes the finished pages into a temp folder (`buildCommand`). One orchestrator (`scripts/doc-sync/run.mjs`) publishes every product the same way: clone the row's remote, replace its contents with the pages, check the sidebar, commit, and push. No product script pushes on its own, so no push can reach a remote that isn't in the registry. After a successful push, the orchestrator loads the published pages into `kb-sync/.kb_cache/knowledge.db` under a per-product ID prefix, so local agents see exactly what the wikis show.

**Tech stack:** Node 20+ ESM (`.mjs`), `node:test`, `node:assert/strict`, `node:sqlite` (already used by kb-sync's cache), `git` CLI, PowerShell for the scheduled-task wrapper. No new npm dependencies.

**Spec:** [wiki-sync-registry.md](../../meta/governance/wiki-sync-registry.md) (draft registry; this plan makes it machine-readable and authoritative) plus [wiki-style-and-structure.md](../../meta/governance/wiki-style-and-structure.md) §10 (sync contract).

**Review history:** Revision 4 (2026-10-02) applies Chris's review: cic-ingestion dropped (its archive stays quarantined), the rewrite-docs site named as out of scope, and seeding limited to pages that belong to each product. While checking that review, the marketplace wiki turned out to still hold 557 copied foreign pages behind its cleaned sidebar. Revision 3 (2026-10-01) applies Codex's full review of revision 1, checked against the code: path escapes and empty-folder sources in the validator and stager, command timeouts and a run lock, rejecting unknown CLI flags, reporting deleted pages separately, toolforge page mappings that read `C:\dev\wiki`, the NotebookLM nightly script's own wiki publish stage, kb-sync's real test command (`test:all`), and the gap between the worktree where code is built and `C:\dev`, where it runs. Codex's claim that the nightly master wrapper publishes again after Stage 1 was checked and is false. Revision 2 (2026-10-01) follows a Codex review of revision 1, which ran some products' own scripts to publish them. That design broke three promises. Those scripts pushed to hardcoded remotes. Toolforge's script published `C:\dev\wiki`. Toolforge's and kb-sync's scripts wrote timestamped footers, so an unchanged run never reported no changes. Revision 1 also missed sigil's CI publish, kb-sync's pre-push publish, the drift scanner's receipts, and the fact that the cache never read product wikis.

## Global constraints

- Direction is fixed: product repo → that product's GitHub wiki. kb-sync and `C:\dev\wiki` are never a source for any wiki.
- One registry row per product. Only `scripts/doc-sync/publish.mjs` pushes to a wiki remote, and only to the row's `remote`.
- `C:\dev\wiki`, `_kb-sync-staging`, `dev-sandbox`, `.claude/worktrees`, and `node_modules` are never valid `sourceDir` values.
- A build command writes only into the folder it is given and never runs git.
- Two runs in a row with no source change must report `UP_TO_DATE`, so build output can't contain timestamps.
- Scripts live in `C:\dev\scripts\doc-sync\`. Tests live in `C:\dev\tests\`, except kb-sync cache tests, which live in `C:\dev\kb-sync\tests\`.
- Run every test under a timeout: `timeout 60 node --test <file>`.
- Commit prefixes: `feat(doc-sync):`, `fix(doc-sync):`, `test(doc-sync):`, `docs(governance):`, `chore(doc-sync):`.
- Work in a worktree off `main`, not on `parkd821-20260908`, which carries unrelated dirty state.
- Before any read, write, or commit in another repo (kb-sync, trm, sigil-repo, icf, helix, toolforge-marketplace, cic-ingestion, rewrite-mcp), run `pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path <that repo root>`.
- No real wiki push happens until Task 9. Earlier tasks use local bare repos as fake remotes.
- Code is built in a worktree, but the registry runs build commands in each product's canonical folder, and `C:\dev` is currently on `parkd821-20260908` with unrelated uncommitted work. Task 9 Step 0 merges this work to `main` and gets each canonical folder onto a branch that contains it before any live run. Never run a live sync from the worktree.
- Every command the publisher runs has a time limit, and git never prompts for credentials (`GIT_TERMINAL_PROMPT=0`), so an unattended run fails instead of hanging.
- Several files in this workspace use CRLF line endings. Check with `git diff --stat` after editing, and revert any edit that turns a whole file into a diff.

## Out of scope

- kb-sync → `C:\dev\docs`. Under the registry, `C:\dev\docs` is part of toolforge's own source (row `toolforge`). mkdocs keeps building it through `.github/workflows/documentation.yml`, which builds toolforge's site only.
- The rewrite-docs mkdocs site, which is the knowledge-base site that fell months behind. This plan moves wiki pages; it doesn't make anyone update or re-read docs. Doc-freshness enforcement for rewrite-docs needs its own plan.
- cic-ingestion's wiki. Its 435 pages are mostly a generated archive that stays quarantined, so it gets no registry row and nothing republishes it. Deleting the fleet reconciler in Task 10 removes the only thing that wrote to it.
- NotebookLM and Drive egress. Those follow the separate kb-sync pack plan.
- `\toolforge\Daily-Roadmap-Sync` and `\CIC\CIC-Vault-Sync-rl`. They sync roadmaps and vaults, not wikis.
- cic-jev, which stays a stub wiki per Chris.

## File map

| File | Status | Responsibility |
|---|---|---|
| `docs/meta/governance/wiki-sync-registry.json` | Create | Authoritative product list |
| `scripts/doc-sync/registry.mjs` | Create | Load and validate the registry |
| `scripts/doc-sync/stage-mirror.mjs` | Create | Replace a clone's contents with a page folder |
| `scripts/doc-sync/sidebar-guard.mjs` | Create | Fail when `_Sidebar.md` links to pages that aren't in the tree |
| `scripts/doc-sync/publish.mjs` | Create | Build (optional), stage, check, and push one product |
| `scripts/doc-sync/run.mjs` | Create | CLI: loop over products, write receipts, load cache |
| `tests/doc-sync-*.test.mjs` | Create | One test file per module above |
| `kb-sync/modules/cache/sync-cache.mjs` | Modify | Per-product ID prefix and scoped deletion |
| `kb-sync/tests/sync-cache-prefix.test.mjs` | Create | Tests for the prefix change |
| `scripts/sync-github-wiki.mjs` | Modify | Add `--build-only`; stop publishing `C:\dev\wiki`; static footer |
| `kb-sync/scripts/sync-github-wiki.mjs` | Modify | Add `--build-only`; static footer |
| `package.json` | Modify | Add `docs:sync` and `test:doc-sync` |
| `docs/meta/governance/wiki-sync-registry.md` | Modify | Point to the JSON, fix stale paths |
| `kb-sync/.github/workflows/wiki-drift-and-publish.yml` | Modify | Remove the publish step |
| `kb-sync/package.json`, `kb-sync/scripts/wiki-validate-prepush.sh` | Modify | Remove fleet reconciler script and pre-push publish |
| `sigil-repo/.github/workflows/wiki-sync.yml` | Delete | Sigil CI publish |
| `trm/package.json`, `trm/scripts/sync-remote-wiki.mjs` | Modify, delete | Point to the orchestrator |
| `kb-sync/scripts/schedule-task-wrapper-KB-Sync-Master.ps1` | Modify | Run doc sync first |

---

### Task 1: Registry loader

**Files:**
- Create: `scripts/doc-sync/registry.mjs`
- Create: `docs/meta/governance/wiki-sync-registry.json` (empty product list; real rows come in Task 8)
- Test: `tests/doc-sync-registry.test.mjs`

**Interfaces:**
- Produces: `loadRegistry(filePath: string): Product[]` and `validateRegistry(raw: object): Product[]`. Each throws an `Error` whose message starts with `REGISTRY_INVALID:` on bad input.
- `Product` = `{ name: string, repoPath: string, remote: string, sourceDir?: string, buildCommand?: string, homeFrom?: string, preValidate?: string, ingest: boolean, enabled: boolean }`.
- Exactly one of `sourceDir` and `buildCommand` is set. `buildCommand` contains the literal token `{out}`, which the publisher replaces with a temp folder path. `preValidate` and `buildCommand` run in `repoPath`. `ingest` defaults to `true` when omitted.

- [ ] **Step 1: Write the failing test**

```js
// tests/doc-sync-registry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistry } from '../scripts/doc-sync/registry.mjs';

const base = {
  name: 'trm', repoPath: 'C:\\dev\\trm', remote: 'https://github.com/sorensencc-dotcom/TRM.wiki.git',
  sourceDir: 'wiki', enabled: true,
};

test('accepts a valid sourceDir product and defaults ingest to true', () => {
  const [p] = validateRegistry({ products: [base] });
  assert.equal(p.name, 'trm');
  assert.equal(p.ingest, true);
});

test('accepts a buildCommand product that uses {out}', () => {
  const [p] = validateRegistry({ products: [{ ...base, sourceDir: undefined, buildCommand: 'node build.mjs --out "{out}"', ingest: false }] });
  assert.equal(p.ingest, false);
});

test('requires exactly one of sourceDir and buildCommand', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: undefined }] }), /REGISTRY_INVALID: trm: set exactly one of sourceDir or buildCommand/);
  assert.throws(() => validateRegistry({ products: [{ ...base, buildCommand: 'x {out}' }] }), /REGISTRY_INVALID: trm: set exactly one of sourceDir or buildCommand/);
});

test('buildCommand must contain {out}', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: undefined, buildCommand: 'node build.mjs' }] }), /REGISTRY_INVALID: trm: buildCommand must contain \{out\}/);
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

test('rejects quarantine, disallowed, escaping, and absolute source folders', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, repoPath: 'C:\\dev', sourceDir: 'wiki' }] }), /REGISTRY_INVALID: sourceDir/);
  assert.throws(() => validateRegistry({ products: [{ ...base, repoPath: 'C:\\dev\\x', sourceDir: '..\\wiki' }] }), /REGISTRY_INVALID: sourceDir/);
  for (const bad of ['_kb-sync-staging/x', 'dev-sandbox/a', '.claude/worktrees/b', 'NODE_MODULES/c', '..', '../other', 'C:\\elsewhere', '.']) {
    assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: bad }] }), /REGISTRY_INVALID: sourceDir/, bad);
  }
});

test('rejects a repoPath that is relative or inside a disallowed folder', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, repoPath: 'trm' }] }), /REGISTRY_INVALID: trm: repoPath/);
  assert.throws(() => validateRegistry({ products: [{ ...base, repoPath: 'C:\\dev\\dev-sandbox\\trm' }] }), /REGISTRY_INVALID: trm: repoPath/);
});

test('rejects a name with shell or path characters', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, name: 'trm"; rm -rf /' }] }), /REGISTRY_INVALID: name/);
});

test('treats SSH and HTTPS forms of one wiki as a duplicate', () => {
  assert.throws(
    () => validateRegistry({ products: [base, { ...base, name: 'trm2', remote: 'git@github.com:sorensencc-dotcom/TRM.wiki.git' }] }),
    /REGISTRY_INVALID: duplicate remote/,
  );
});

test('wraps bad rows and bad JSON in REGISTRY_INVALID', () => {
  assert.throws(() => validateRegistry({ products: [null] }), /REGISTRY_INVALID/);
  assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: 42 }] }), /REGISTRY_INVALID/);
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

const REMOTE_RE = /^(?:https:\/\/github\.com\/|git@github\.com:)sorensencc-dotcom\/([\w.-]+)\.wiki\.git$/;
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const DISALLOWED = ['_kb-sync-staging', 'dev-sandbox', '.claude', 'node_modules'];
const QUARANTINE_ROOT = 'c:\\dev\\wiki';
const OPTIONAL_STRINGS = ['sourceDir', 'buildCommand', 'homeFrom', 'preValidate'];

function fail(msg) {
  throw new Error(`REGISTRY_INVALID: ${msg}`);
}

const parts = (p) => p.toLowerCase().split(/[\\/]+/).filter(Boolean);
const hasDisallowedPart = (p) => {
  const segs = parts(p);
  return segs.includes('..') || DISALLOWED.some((d) => {
    const want = d.split('/');
    return segs.some((_, i) => want.every((w, j) => segs[i + j] === w));
  });
};

function checkRepoPath(p) {
  if (!path.win32.isAbsolute(p.repoPath)) fail(`${p.name}: repoPath must be absolute`);
  if (hasDisallowedPart(p.repoPath)) fail(`${p.name}: repoPath ${p.repoPath} is inside a disallowed folder`);
}

function checkSourceDir(p) {
  const src = p.sourceDir;
  if (path.win32.isAbsolute(src) || path.posix.isAbsolute(src)) fail(`sourceDir ${src} must be relative (${p.name})`);
  if (hasDisallowedPart(src)) fail(`sourceDir ${src} is disallowed (${p.name})`);
  const root = path.win32.resolve(p.repoPath).toLowerCase();
  const abs = path.win32.resolve(p.repoPath, src).toLowerCase();
  if (abs === root || !abs.startsWith(root + '\\')) fail(`sourceDir ${src} must be a folder inside repoPath (${p.name})`);
  if (abs === QUARANTINE_ROOT || abs.startsWith(QUARANTINE_ROOT + '\\')) fail(`sourceDir ${abs} is the quarantine dump (${p.name})`);
}

export function validateRegistry(raw) {
  if (!raw || !Array.isArray(raw.products)) fail('missing products array');
  const names = new Set();
  const remotes = new Set();
  return raw.products.map((p, i) => {
    if (!p || typeof p !== 'object') fail(`row ${i} is not an object`);
    for (const k of ['name', 'repoPath', 'remote']) if (typeof p[k] !== 'string' || !p[k]) fail(`row ${i}: missing ${k}`);
    for (const k of OPTIONAL_STRINGS) if (p[k] !== undefined && typeof p[k] !== 'string') fail(`${p.name}: ${k} must be a string`);
    if (!NAME_RE.test(p.name)) fail(`name ${JSON.stringify(p.name)} must match ${NAME_RE}`);
    if (typeof p.enabled !== 'boolean') fail(`${p.name}: enabled must be boolean`);
    if (p.ingest !== undefined && typeof p.ingest !== 'boolean') fail(`${p.name}: ingest must be boolean`);
    const m = REMOTE_RE.exec(p.remote);
    if (!m) fail(`remote ${p.remote} is not a sorensencc-dotcom wiki (${p.name})`);
    checkRepoPath(p);
    if (Boolean(p.sourceDir) === Boolean(p.buildCommand)) fail(`${p.name}: set exactly one of sourceDir or buildCommand`);
    if (p.buildCommand && !p.buildCommand.includes('{out}')) fail(`${p.name}: buildCommand must contain {out}`);
    if (p.sourceDir) checkSourceDir(p);
    const remoteKey = m[1].toLowerCase();
    if (names.has(p.name)) fail(`duplicate name ${p.name}`);
    if (remotes.has(remoteKey)) fail(`duplicate remote ${p.remote}`);
    names.add(p.name);
    remotes.add(remoteKey);
    return { ...p, ingest: p.ingest ?? true };
  });
}

export function loadRegistry(filePath) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`cannot read ${filePath}: ${err.message}`);
  }
  return validateRegistry(raw);
}
```

```json
{
  "$comment": "Authoritative wiki sync registry. Human notes live in wiki-sync-registry.md. Edit rows here, then run npm run docs:sync -- --dry-run.",
  "products": []
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `timeout 60 node --test tests/doc-sync-registry.test.mjs`
Expected: PASS, 12 tests.

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
- Produces: `stageMirror({ sourceDir: string, cloneDir: string, homeFrom?: string }): void`. Afterwards, `cloneDir` contains exactly the files in `sourceDir` plus its own `.git`. Pages removed from the source are removed from the clone. If `homeFrom` is set, that top-level file is written as `Home.md` instead of under its own name. The source must contain at least one file and a top-level landing page (`Home.md`, or the `homeFrom` file).

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

test('throws when the source is missing, empty, or has no landing page, and leaves the clone alone', () => {
  const clone = tree({ '.git/HEAD': 'ref', 'Keep.md': 'k' });
  assert.throws(() => stageMirror({ sourceDir: path.join(clone, 'nope'), cloneDir: clone }), /STAGE_SOURCE_MISSING/);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'docsync-empty-'));
  assert.throws(() => stageMirror({ sourceDir: empty, cloneDir: clone }), /STAGE_SOURCE_EMPTY/);
  const onlyDirs = fs.mkdtempSync(path.join(os.tmpdir(), 'docsync-dirs-'));
  fs.mkdirSync(path.join(onlyDirs, 'a', 'b'), { recursive: true });
  assert.throws(() => stageMirror({ sourceDir: onlyDirs, cloneDir: clone }), /STAGE_SOURCE_EMPTY/);
  assert.throws(() => stageMirror({ sourceDir: tree({ 'Other.md': 'o' }), cloneDir: clone }), /STAGE_NO_HOME/);
  assert.throws(() => stageMirror({ sourceDir: tree({ 'Home.md': 'h' }), cloneDir: clone, homeFrom: 'README.md' }), /STAGE_HOME_FROM_MISSING/);
  assert.throws(() => stageMirror({ sourceDir: tree({ 'README.md': 'r', 'Home.md': 'h' }), cloneDir: clone, homeFrom: 'README.md' }), /STAGE_HOME_COLLISION/);
  assert.deepEqual(list(clone), ['Keep.md']);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `timeout 60 node --test tests/doc-sync-stage-mirror.test.mjs`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Write the implementation**

Every check runs before anything is deleted, so a wrong `sourceDir`, a build that wrote nothing, or a source that lost its landing page can't wipe a wiki.

```js
// scripts/doc-sync/stage-mirror.mjs
import fs from 'node:fs';
import path from 'node:path';

function hasFile(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .some((e) => e.isFile() && !path.join(e.parentPath ?? e.path, e.name).split(path.sep).includes('.git'));
}

export function stageMirror({ sourceDir, cloneDir, homeFrom }) {
  if (!fs.existsSync(sourceDir)) throw new Error(`STAGE_SOURCE_MISSING: ${sourceDir}`);
  const entries = fs.readdirSync(sourceDir).filter((n) => n !== '.git');
  if (entries.length === 0 || !hasFile(sourceDir)) throw new Error(`STAGE_SOURCE_EMPTY: ${sourceDir}`);
  if (homeFrom) {
    if (!entries.includes(homeFrom)) throw new Error(`STAGE_HOME_FROM_MISSING: ${homeFrom}`);
    if (entries.includes('Home.md')) throw new Error(`STAGE_HOME_COLLISION: both ${homeFrom} and Home.md exist`);
  } else if (!entries.includes('Home.md')) {
    throw new Error(`STAGE_NO_HOME: ${sourceDir} has no top-level Home.md`);
  }

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

Blocks the cross-repo sidebar contamination found in toolforge-marketplace and kb-sync-wiki: sidebar links that point at another product's pages.

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
- Produces: `publishProduct(product: Product, opts: { dryRun?: boolean, sh?: (cmd: string, cwd: string) => string, onPublished?: (publishedDir: string) => void }): Promise<Result>`.
- `Result` = `{ product: string, status: 'SYNCHRONIZED' | 'UP_TO_DATE' | 'DRY_RUN' | 'FAILED', changed: string[], deleted: string[], pages: number, remoteHead?: string, error?: string }`. `changed` lists every added, modified, or deleted path; `deleted` lists only the deleted ones, so a dry run shows exactly which live pages a real run would remove. `pages` counts `.md` files in the published tree.
- Every command gets a 10-minute limit and a 64 MB output buffer, with `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` set so git fails instead of waiting for a login. Commands run through `cmd.exe` on Windows (Node's `execSync` default), which is why the registry's commands quote `"{out}"` with double quotes.
- `onPublished` may be async and is awaited. It runs after a successful push, or when the remote is already up to date, with the staged clone folder, before that folder is deleted. Task 6 uses it to load the cache. It never runs on a dry run or a failure. If it throws, the result is `FAILED` with its error message; the push has already happened by then.
- `sh` defaults to a `child_process.execSync` wrapper that returns trimmed stdout and throws on a non-zero exit.

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
  git(`init --bare -q -b master "${bare}"`, root);
  const seed = path.join(root, 'seed');
  git(`clone -q "${bare}" "${seed}"`, root);
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(seed, rel), body);
  git('add -A', seed);
  git('commit -qm seed', seed);
  git('push -q origin HEAD', seed);
  return bare;
}

const remoteFiles = (bare) => git('ls-tree -r --name-only HEAD', bare).split('\n').filter(Boolean).sort();

function repoWithWiki(files) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  fs.mkdirSync(path.join(repo, 'wiki'));
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(repo, 'wiki', rel), body);
  return repo;
}

const product = (repoPath, remote, extra = {}) => ({ name: 'p', repoPath, remote, sourceDir: 'wiki', ingest: true, enabled: true, ...extra });

test('sourceDir: publishes and deletes stale remote pages, then calls onPublished', async () => {
  const bare = fakeRemote({ 'Home.md': 'old', 'Stale.md': 's' });
  const repo = repoWithWiki({ 'Home.md': 'new', 'Page.md': 'p' });
  let seen = null;
  const r = await publishProduct(product(repo, bare), { onPublished: (dir) => { seen = fs.readdirSync(dir).filter((n) => n !== '.git').sort(); } });
  assert.equal(r.status, 'SYNCHRONIZED', r.error);
  assert.deepEqual(r.deleted, ['Stale.md']);
  assert.equal(r.pages, 2);
  assert.match(r.remoteHead, /^[0-9a-f]{40}$/);
  assert.deepEqual(remoteFiles(bare), ['Home.md', 'Page.md']);
  assert.deepEqual(seen, ['Home.md', 'Page.md']);
});

test('a second run after a real publish is UP_TO_DATE and still calls onPublished', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'new', 'Page.md': 'p' });
  assert.equal((await publishProduct(product(repo, bare))).status, 'SYNCHRONIZED');
  const headBefore = git('rev-parse HEAD', bare);
  let called = 0;
  const r = await publishProduct(product(repo, bare), { onPublished: () => { called++; } });
  assert.equal(r.status, 'UP_TO_DATE');
  assert.equal(called, 1);
  assert.equal(git('rev-parse HEAD', bare), headBefore);
});

test('a failing build command fails the product and leaves the remote alone', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'build-fail-'));
  const r = await publishProduct(product(repo, bare, { sourceDir: undefined, buildCommand: 'node -e "process.exit(4)" "{out}"' }));
  assert.equal(r.status, 'FAILED');
  assert.match(r.error, /BUILD_FAILED/);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
});

test('dry run reports changes, pushes nothing, skips onPublished', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = repoWithWiki({ 'Home.md': 'new', 'Add.md': 'a' });
  let called = 0;
  const r = await publishProduct(product(repo, bare), { dryRun: true, onPublished: () => { called++; } });
  assert.equal(r.status, 'DRY_RUN');
  assert.deepEqual(r.changed.sort(), ['Add.md', 'Home.md']);
  assert.deepEqual(r.deleted, []);
  assert.deepEqual(remoteFiles(bare), ['Home.md']);
  assert.equal(called, 0);
});

test('buildCommand output is what gets published', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'build-'));
  fs.writeFileSync(path.join(repo, 'build.mjs'), "import fs from 'node:fs'; import path from 'node:path'; const out = process.argv[2]; fs.writeFileSync(path.join(out, 'Home.md'), 'built'); fs.writeFileSync(path.join(out, 'Guide.md'), 'g');");
  const r = await publishProduct(product(repo, bare, { sourceDir: undefined, buildCommand: 'node build.mjs "{out}"' }));
  assert.equal(r.status, 'SYNCHRONIZED', r.error);
  assert.deepEqual(remoteFiles(bare), ['Guide.md', 'Home.md']);
});

test('a build that writes nothing fails without touching the remote', async () => {
  const bare = fakeRemote({ 'Home.md': 'old' });
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'build-empty-'));
  const r = await publishProduct(product(repo, bare, { sourceDir: undefined, buildCommand: 'node -e "" "{out}"' }));
  assert.equal(r.status, 'FAILED');
  assert.match(r.error, /STAGE_SOURCE_EMPTY/);
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `timeout 60 node --test tests/doc-sync-publish.test.mjs`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Write the implementation**

`core.hooksPath` points at a folder that doesn't exist, so wiki clones don't pick up workspace git hooks; `scripts/sync-github-wiki.mjs` does the same. Error messages never include the remote URL, so tokens embedded in URLs can't reach logs or receipts.

```js
// scripts/doc-sync/publish.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { stageMirror } from './stage-mirror.mjs';
import { findForeignSidebarLinks } from './sidebar-guard.mjs';

const SH_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
const defaultSh = (cmd, cwd) => execSync(cmd, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: SH_ENV,
  timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
}).trim();
const GIT = 'git -c core.hooksPath=.git/no-hooks -c user.name=doc-sync -c user.email=doc-sync@localhost';

function step(sh, label, cmd, cwd) {
  try {
    return sh(cmd, cwd);
  } catch (err) {
    throw new Error(`${label}: ${(err.stderr || err.message || '').toString().trim().slice(0, 500)}`);
  }
}

function countPages(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md') && !path.join(e.parentPath ?? e.path, e.name).includes(`${path.sep}.git${path.sep}`))
    .length;
}

export async function publishProduct(product, { dryRun = false, sh = defaultSh, onPublished } = {}) {
  const result = { product: product.name, status: 'FAILED', changed: [], deleted: [], pages: 0 };
  const temps = [];
  const mkTemp = (tag) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `doc-sync-${product.name}-${tag}-`));
    temps.push(dir);
    return dir;
  };
  try {
    if (product.preValidate) step(sh, 'PREVALIDATE_FAILED', product.preValidate, product.repoPath);

    let pagesDir;
    if (product.buildCommand) {
      pagesDir = mkTemp('build');
      step(sh, 'BUILD_FAILED', product.buildCommand.replaceAll('{out}', pagesDir), product.repoPath);
    } else {
      pagesDir = path.join(product.repoPath, product.sourceDir);
    }

    const cloneDir = mkTemp('clone');
    step(sh, 'CLONE_FAILED', `git clone --quiet "${product.remote}" "${cloneDir}"`, os.tmpdir());
    stageMirror({ sourceDir: pagesDir, cloneDir, homeFrom: product.homeFrom });

    const foreign = findForeignSidebarLinks(cloneDir);
    if (foreign.length) throw new Error(`SIDEBAR_FOREIGN_LINKS: ${foreign.join(', ')}`);

    result.pages = countPages(cloneDir);
    sh(`${GIT} add -A`, cloneDir);
    const names = (filter) => sh(`${GIT} -c core.quotePath=false diff --cached --name-only${filter}`, cloneDir).split('\n').filter(Boolean);
    result.changed = names('');
    result.deleted = names(' --diff-filter=D');

    if (result.changed.length === 0) {
      result.status = 'UP_TO_DATE';
    } else if (dryRun) {
      return { ...result, status: 'DRY_RUN' };
    } else {
      step(sh, 'COMMIT_FAILED', `${GIT} commit --quiet -m "docs(wiki): sync ${product.name}"`, cloneDir);
      step(sh, 'PUSH_FAILED', `${GIT} push --quiet origin HEAD`, cloneDir);
      result.status = 'SYNCHRONIZED';
    }
    result.remoteHead = sh('git rev-parse HEAD', cloneDir);
    if (!dryRun && onPublished) await onPublished(cloneDir);
    return result;
  } catch (err) {
    return { ...result, status: 'FAILED', error: err.message };
  } finally {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `timeout 60 node --test tests/doc-sync-publish.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/doc-sync/publish.mjs tests/doc-sync-publish.test.mjs
git commit -m "feat(doc-sync): publish one product from a folder or a build, mirror-only"
```

---

### Task 5: Per-product ID prefix in the kb-sync cache

Today `syncKnowledgeCache` uses the file's relative path as the row ID, so every product's `Home.md` would collide. A default kb-sync run, with no `scanPaths`, also deletes every row it didn't find, which would wipe product rows each night. This task adds an `idPrefix` option. Rows load as `product:<name>/<path>`. A prefixed run deletes only its own stale rows, and a default run never deletes `product:` rows.

**Files:**
- Modify: `kb-sync/modules/cache/sync-cache.mjs` (`processFile` ID at line 176; deletion block at lines 234–244)
- Test: `kb-sync/tests/sync-cache-prefix.test.mjs`

**Interfaces:**
- Produces: `syncKnowledgeCache({ repoRoot, scanPaths, dbPath, idPrefix })`. When `idPrefix` is set, every inserted ID starts with it, and deletion removes only rows that start with `idPrefix` and weren't found in this run, even though `scanPaths` is set. With no `idPrefix`, existing behavior holds, except that rows starting with `product:` are never deleted.

- [ ] **Step 1: Write the failing test**

```js
// kb-sync/tests/sync-cache-prefix.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDatabase } from '../modules/cache/db-schema.mjs';
import { syncKnowledgeCache } from '../modules/cache/sync-cache.mjs';

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

const ids = (dbPath) => getDatabase(dbPath).prepare('SELECT id FROM kb_documents ORDER BY id').all().map((r) => r.id);

test('prefixed runs keep products apart and delete only their own stale rows', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'db-')), 'k.db');
  const a = tree({ 'Home.md': '# A', 'Old.md': '# old' });
  const b = tree({ 'Home.md': '# B' });
  syncKnowledgeCache({ repoRoot: a, scanPaths: ['.'], dbPath, idPrefix: 'product:a/' });
  syncKnowledgeCache({ repoRoot: b, scanPaths: ['.'], dbPath, idPrefix: 'product:b/' });
  assert.deepEqual(ids(dbPath), ['product:a/Home.md', 'product:a/Old.md', 'product:b/Home.md']);

  fs.rmSync(path.join(a, 'Old.md'));
  const stats = syncKnowledgeCache({ repoRoot: a, scanPaths: ['.'], dbPath, idPrefix: 'product:a/' });
  assert.equal(stats.deleted, 1);
  assert.deepEqual(ids(dbPath), ['product:a/Home.md', 'product:b/Home.md']);
});

test('a default run never deletes product rows', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'db-')), 'k.db');
  const prod = tree({ 'Home.md': '# P' });
  syncKnowledgeCache({ repoRoot: prod, scanPaths: ['.'], dbPath, idPrefix: 'product:p/' });
  const kb = tree({ 'wiki/research/note.md': '# n' });
  syncKnowledgeCache({ repoRoot: kb, dbPath });
  assert.deepEqual(ids(dbPath), ['product:p/Home.md', 'wiki/research/note.md']);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run from `C:\dev\kb-sync`: `timeout 60 node --test tests/sync-cache-prefix.test.mjs`
Expected: FAIL. The first test sees unprefixed IDs (`Home.md`, `Old.md`), and `Home.md` collides.

- [ ] **Step 3: Change the ID and the deletion rule**

At line 176, replace `const id = relPath.replace(/\\/g, '/');` with:

```js
    const id = (options.idPrefix || '') + relPath.replace(/\\/g, '/');
```

Replace the deletion block (from `let deleted = 0;` through the closing brace of `if (!options.scanPaths) { ... }`) with:

```js
  let deleted = 0;
  const prefix = options.idPrefix;
  if (prefix || !options.scanPaths) {
    const deleteStmt = db.prepare('DELETE FROM kb_documents WHERE id = ?');
    for (const [id] of existingDocs) {
      const inScope = prefix ? id.startsWith(prefix) : !id.startsWith('product:');
      if (inScope && !foundDocIds.has(id)) {
        deleteStmt.run(id);
        deleted++;
        if (verbose) console.log(`[kb-cache] Deleted: ${id}`);
      }
    }
  }
```

- [ ] **Step 4: Run the new tests and the existing cache tests**

Run from `C:\dev\kb-sync`: `timeout 60 node --test tests/sync-cache-prefix.test.mjs tests/trm-cache-boundary.test.mjs` and `timeout 120 node --test --experimental-strip-types tests/context-cache.test.ts tests/trm-cache-e2e-pipeline.test.ts`
Expected: all PASS, 2 new tests included.

- [ ] **Step 5: Commit in kb-sync**

```bash
git -C C:/dev/kb-sync add modules/cache/sync-cache.mjs tests/sync-cache-prefix.test.mjs
git -C C:/dev/kb-sync commit -m "feat(doc-sync): per-product id prefix and scoped deletion in kb cache"
```

---

### Task 6: CLI, receipts, and cache load

**Files:**
- Create: `scripts/doc-sync/run.mjs`
- Modify: `package.json` (`scripts` block)
- Test: `tests/doc-sync-run.test.mjs`

**Interfaces:**
- Consumes: `loadRegistry` (Task 1), `publishProduct` (Task 4), `syncKnowledgeCache` with `idPrefix` (Task 5).
- Produces: `runDocSync({ registryPath, receiptPath, only?, dryRun?, publish?, loadCache? }): Promise<{ ok: boolean, results: Result[] }>`. `publish` and `loadCache` can be injected for tests. `loadCache(product, publishedDir)` defaults to `syncKnowledgeCache({ repoRoot: publishedDir, scanPaths: ['.'], dbPath: 'C:\\dev\\kb-sync\\.kb_cache\\knowledge.db', idPrefix: 'product:<name>/' })`.
- After each non-dry run of a product that succeeds, it writes `<repoPath>/.wiki-sync-receipt.json` in the `WikiSyncReceipt` shape that `kb-sync/modules/wiki/cross-repo-drift-scanner.ts:211` reads.
- CLI: `node scripts/doc-sync/run.mjs [--product=<name>] [--dry-run]`. Exits 1 if any result is `FAILED`. Writes the run receipt to `_status-feed/doc-sync-receipt.json`.

- [ ] **Step 1: Write the failing test**

```js
// tests/doc-sync-run.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDocSync, parseArgs } from '../scripts/doc-sync/run.mjs';

function setup(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-'));
  const registryPath = path.join(dir, 'reg.json');
  fs.writeFileSync(registryPath, JSON.stringify({ products: rows }));
  return { registryPath, receiptPath: path.join(dir, 'receipt.json') };
}

const row = (name, extra = {}) => ({
  name, repoPath: fs.mkdtempSync(path.join(os.tmpdir(), `repo-${name}-`)),
  remote: `git@github.com:sorensencc-dotcom/${name}.wiki.git`, sourceDir: 'wiki', enabled: true, ...extra,
});

const ok = (status) => async (p, { onPublished }) => {
  if (status !== 'DRY_RUN' && status !== 'FAILED') await onPublished?.('PUBLISHED_DIR');
  return { product: p.name, status, changed: [], pages: 3, remoteHead: 'a'.repeat(40), error: status === 'FAILED' ? 'boom' : undefined };
};

test('publishes enabled rows only, loads cache for ingest rows, writes drift receipt', async () => {
  const a = row('a');
  const b = row('b', { enabled: false });
  const c = row('c', { ingest: false });
  const { registryPath, receiptPath } = setup([a, b, c]);
  const loaded = [];
  const out = await runDocSync({ registryPath, receiptPath, publish: ok('SYNCHRONIZED'), loadCache: (p, dir) => loaded.push(`${p.name}:${dir}`) });
  assert.equal(out.ok, true);
  assert.deepEqual(out.results.map((r) => r.product), ['a', 'c']);
  assert.deepEqual(loaded, ['a:PUBLISHED_DIR']);
  const drift = JSON.parse(fs.readFileSync(path.join(a.repoPath, '.wiki-sync-receipt.json'), 'utf8'));
  assert.equal(drift.repository, 'a');
  assert.equal(drift.sync_status, 'SYNCHRONIZED');
  assert.equal(drift.total_pages_published, 3);
  assert.equal(drift.remote_wiki_head, 'a'.repeat(40));
  assert.equal(JSON.parse(fs.readFileSync(receiptPath, 'utf8')).ok, true);
});

test('one failure sets ok false, other products still run, no drift receipt for the failure', async () => {
  const a = row('a');
  const b = row('b');
  const { registryPath, receiptPath } = setup([a, b]);
  const publish = async (p, opts) => (p.name === 'a' ? ok('FAILED') : ok('UP_TO_DATE'))(p, opts);
  const out = await runDocSync({ registryPath, receiptPath, publish, loadCache: () => {} });
  assert.equal(out.ok, false);
  assert.deepEqual(out.results.map((r) => r.status), ['FAILED', 'UP_TO_DATE']);
  assert.equal(fs.existsSync(path.join(a.repoPath, '.wiki-sync-receipt.json')), false);
  assert.equal(fs.existsSync(path.join(b.repoPath, '.wiki-sync-receipt.json')), true);
});

test('--product selects one row even when disabled; unknown name throws', async () => {
  const { registryPath, receiptPath } = setup([row('a'), row('b', { enabled: false })]);
  const seen = [];
  await runDocSync({ registryPath, receiptPath, only: 'b', dryRun: true, publish: async (p) => { seen.push(p.name); return { product: p.name, status: 'DRY_RUN', changed: [], pages: 0 }; } });
  assert.deepEqual(seen, ['b']);
  await assert.rejects(runDocSync({ registryPath, receiptPath, only: 'zzz', publish: async () => ({}) }), /UNKNOWN_PRODUCT: zzz/);
});

test('parseArgs rejects unknown or malformed flags', () => {
  assert.deepEqual(parseArgs(['--dry-run', '--product=trm']), { dryRun: true, only: 'trm' });
  assert.deepEqual(parseArgs([]), { dryRun: false, only: undefined });
  for (const bad of [['--dryrun'], ['--product'], ['--product='], ['trm'], ['--ingest']]) {
    assert.throws(() => parseArgs(bad), /BAD_ARGS/, bad.join(' '));
  }
});

test('no enabled products is a failure, not a silent success', async () => {
  const { registryPath, receiptPath } = setup([row('a', { enabled: false })]);
  await assert.rejects(runDocSync({ registryPath, receiptPath, publish: ok('SYNCHRONIZED') }), /NO_PRODUCTS_SELECTED/);
});

test('a second concurrent run is refused by the lock', async () => {
  const { registryPath, receiptPath } = setup([row('a')]);
  let release;
  const slow = (p) => new Promise((resolve) => { release = () => resolve({ product: p.name, status: 'UP_TO_DATE', changed: [], deleted: [], pages: 1 }); });
  const first = runDocSync({ registryPath, receiptPath, publish: slow, loadCache: () => {} });
  await new Promise((r) => setTimeout(r, 50));
  await assert.rejects(runDocSync({ registryPath, receiptPath, publish: slow, loadCache: () => {} }), /RUN_LOCKED/);
  release();
  assert.equal((await first).ok, true);
});

test('dry run writes no drift receipt and loads no cache', async () => {
  const a = row('a');
  const { registryPath, receiptPath } = setup([a]);
  let loaded = 0;
  await runDocSync({ registryPath, receiptPath, dryRun: true, publish: ok('DRY_RUN'), loadCache: () => { loaded++; } });
  assert.equal(loaded, 0);
  assert.equal(fs.existsSync(path.join(a.repoPath, '.wiki-sync-receipt.json')), false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `timeout 60 node --test tests/doc-sync-run.test.mjs`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Write the implementation**

`--product` can select a disabled row on purpose. Task 9 uses that to preview each product before enabling it. The kb-sync cache module is loaded only when the default `loadCache` actually runs, so tests and dry runs never open the real database.

```js
// scripts/doc-sync/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRegistry } from './registry.mjs';
import { publishProduct } from './publish.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KB_SYNC = path.join(ROOT, 'kb-sync');
const KB_DB = path.join(KB_SYNC, '.kb_cache', 'knowledge.db');

async function defaultLoadCache(product, publishedDir) {
  const { syncKnowledgeCache } = await import(pathToFileURL(path.join(KB_SYNC, 'modules', 'cache', 'sync-cache.mjs')).href);
  syncKnowledgeCache({ repoRoot: publishedDir, scanPaths: ['.'], dbPath: KB_DB, idPrefix: `product:${product.name}/` });
}

function localHead(repoPath) {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}

function writeDriftReceipt(product, r) {
  const receipt = {
    repository: product.name,
    remote_wiki_url: product.remote,
    local_code_head: localHead(product.repoPath),
    remote_wiki_head: r.remoteHead,
    verified_at: new Date().toISOString(),
    system_time_epoch_ms: Date.now(),
    total_pages_published: r.pages,
    sync_status: r.status,
  };
  fs.writeFileSync(path.join(product.repoPath, '.wiki-sync-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
}

export function parseArgs(argv) {
  const out = { dryRun: false, only: undefined };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (/^--product=[a-z0-9][a-z0-9-]*$/.test(a)) out.only = a.slice('--product='.length);
    else throw new Error(`BAD_ARGS: unknown or malformed argument ${JSON.stringify(a)}. Usage: run.mjs [--dry-run] [--product=<name>]`);
  }
  return out;
}

function takeLock(lockPath) {
  try {
    fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') throw new Error(`RUN_LOCKED: another doc sync holds ${lockPath}. Delete it only if no doc sync is running.`);
    throw err;
  }
  return () => fs.rmSync(lockPath, { force: true });
}

export async function runDocSync({ registryPath, receiptPath, only, dryRun = false, publish = publishProduct, loadCache = defaultLoadCache }) {
  const all = loadRegistry(registryPath);
  let selected;
  if (only) {
    selected = all.filter((p) => p.name === only);
    if (selected.length === 0) throw new Error(`UNKNOWN_PRODUCT: ${only}`);
  } else {
    selected = all.filter((p) => p.enabled);
    if (selected.length === 0) throw new Error('NO_PRODUCTS_SELECTED: no enabled rows in the registry');
  }

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  const release = takeLock(`${receiptPath}.lock`);
  try {
    return await runSelected({ selected, receiptPath, dryRun, publish, loadCache });
  } finally {
    release();
  }
}

async function runSelected({ selected, receiptPath, dryRun, publish, loadCache }) {
  const results = [];
  for (const p of selected) {
    const onPublished = p.ingest
      ? async (dir) => {
          try {
            await loadCache(p, dir);
          } catch (err) {
            throw new Error(`CACHE_LOAD_FAILED: ${err.message}`);
          }
        }
      : undefined;
    let r;
    try {
      r = await publish(p, { dryRun, onPublished });
    } catch (err) {
      r = { product: p.name, status: 'FAILED', changed: [], deleted: [], pages: 0, error: `PUBLISH_THREW: ${err.message}` };
    }
    if (!dryRun && (r.status === 'SYNCHRONIZED' || r.status === 'UP_TO_DATE')) writeDriftReceipt(p, r);
    console.log(`[doc-sync] ${p.name}: ${r.status}${r.changed?.length ? ` (${r.changed.length} changed)` : ''}${r.error ? ` - ${r.error}` : ''}`);
    results.push(r);
  }

  const ok = results.every((r) => r.status !== 'FAILED');
  fs.writeFileSync(receiptPath, JSON.stringify({ timestamp: new Date().toISOString(), dryRun, ok, results }, null, 2) + '\n');
  return { ok, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => runDocSync({
    registryPath: path.join(ROOT, 'docs', 'meta', 'governance', 'wiki-sync-registry.json'),
    receiptPath: path.join(ROOT, '_status-feed', 'doc-sync-receipt.json'),
    ...parseArgs(process.argv.slice(2)),
  })).then(({ ok }) => process.exit(ok ? 0 : 1)).catch((err) => {
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
Expected: PASS, 33 tests (12 registry, 3 stager, 3 sidebar, 8 publisher, 7 CLI).

- [ ] **Step 5: Confirm `.wiki-sync-receipt.json` is ignored in each product repo**

Run: `for r in C:/dev C:/dev/kb-sync C:/dev/trm C:/dev/sigil-repo C:/dev/icf C:/dev/helix C:/dev/toolforge-marketplace C:/dev/rewrite-mcp; do git -C $r check-ignore -q .wiki-sync-receipt.json && echo "$r ok" || echo "$r NOT IGNORED"; done`
For each `NOT IGNORED` repo, add `.wiki-sync-receipt.json` to that repo's `.gitignore` and commit it there with `chore(doc-sync): ignore wiki sync receipt`.

- [ ] **Step 6: Commit**

```bash
git add scripts/doc-sync/run.mjs tests/doc-sync-run.test.mjs package.json
git commit -m "feat(doc-sync): add docs:sync CLI with drift receipts and per-product cache load"
```

---

### Task 7: Build-only mode for the toolforge and kb-sync publishers

Both scripts generate `Home.md`, `_Sidebar.md`, and `_Footer.md`, and toolforge maps root files into wiki pages, so they stay as build steps. This task adds `--build-only <dir>`, which writes the finished pages into `<dir>` with no clone, commit, or push. It removes the timestamps from the footers, and it stops toolforge from publishing `C:\dev\wiki`.

**Files:**
- Modify: `scripts/sync-github-wiki.mjs` (lines 13–16 args; 153–156 footer; 176–183 clone; 211 `wiki/` copy; 228–250 push and cleanup)
- Modify: `kb-sync/scripts/sync-github-wiki.mjs` (lines 29–33 args; 196–199 footer; 233–245 clone; 285 push)

- [ ] **Step 1: Confirm the current problems**

Run: `grep -n "toISOString" scripts/sync-github-wiki.mjs kb-sync/scripts/sync-github-wiki.mjs` and `grep -n "path.join(root, 'wiki')" scripts/sync-github-wiki.mjs`
Expected: the footer timestamp at line 154 of the first file and line 197 of the second, and the `wiki/` copy at line 211 of the first.

- [ ] **Step 2: Toolforge script changes**

1. After line 16, add:
   ```js
   const buildOnlyDir = value('--build-only', null);
   ```
2. Replace the footer body (line 154) with a static string:
   ```js
   const footerContent = `---\n*Toolforge Platform Documentation Wiki*`;
   ```
3. In `main()`, replace the remove-and-clone block (from `// 1. Prepare target clone` through the `git clone` line) with:
   ```js
   const outDir = buildOnlyDir ? path.resolve(buildOnlyDir) : targetWikiDir;
   if (!buildOnlyDir) {
     if (fs.existsSync(outDir)) {
       try { fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch (_) {}
     }
     console.log(`Cloning remote wiki git repository...`);
     execSync(`git clone "${repoUrl}" "${outDir}"`, { stdio: 'inherit' });
   } else {
     fs.mkdirSync(outDir, { recursive: true });
   }
   ```
   Then rename every later `targetWikiDir` inside `main()` to `outDir`.
4. Delete the line `copyRecursive(path.join(root, 'wiki'), path.join(outDir, 'wiki'));`. `C:\dev\wiki` is the quarantine dump and must never be published.
5. Change `if (shouldPush) {` to `if (shouldPush && !buildOnlyDir) {`, and wrap the final cleanup in `if (!buildOnlyDir) { ... }`.

- [ ] **Step 3: kb-sync script changes**

1. After line 33, add `const buildOnlyDir = value('--build-only', null);`.
2. Replace the footer body (line 197) with:
   ```js
   const footerContent = `---\n*Automated Knowledge Base Synchronization*`;
   ```
3. In the publish function, where `currentTarget` is removed and cloned (lines 241–245), guard the remove and clone with `if (!buildOnlyDir) { ... }`. Before that guard, add `if (buildOnlyDir) { currentTarget = path.resolve(buildOnlyDir); fs.mkdirSync(currentTarget, { recursive: true }); }`. If `currentTarget` is a `const`, change it to `let`.
4. Change the push condition so `pushEnabled` is `false` when `buildOnlyDir` is set. At line 233, use `pushEnabled = buildOnlyDir ? false : (customOptions.push !== undefined ? customOptions.push : shouldPush);`.
5. If the script writes `.wiki-sync-receipt.json` or `syncStatusData` (lines 302–317), skip both when `buildOnlyDir` is set. `run.mjs` owns the receipt now.

- [ ] **Step 3b: Stop toolforge's page map from reading `C:\dev\wiki`**

`ROOT_WIKI_PAGE_MAPPINGS` in `tools/wiki-browser-qa/wiki-page-rules.mjs` copies pages from `wiki/` (for example `wiki/toolforge-architecture-overview.png` and `wiki/research/whichllm-model-selection-evaluator.md`). Removing the folder copy in Step 2 doesn't stop these. Under the registry, moving a page out of the quarantine is a deliberate promotion, so:
1. List the affected mappings: `grep -n "src: 'wiki/" tools/wiki-browser-qa/wiki-page-rules.mjs`.
2. Show Chris the list and ask which pages to promote. Don't move anything without his answer.
3. For each approved page, `git mv` it from `wiki/...` to `docs/wiki-pages/<same file name>` (keep each `.html` diagram source with its `.png`), and change the mapping's `src` to the new path. Remove every mapping he didn't approve.
4. Run `grep -n "src: 'wiki/" tools/wiki-browser-qa/wiki-page-rules.mjs` again. Expected: no output.
5. Run the wiki QA unit tests if any exist for this file (`ls tests | grep -i wiki-page-rules`), under `timeout 60`.

- [ ] **Step 4: Prove both builds are repeatable and never push**

Run from `C:\dev`:
```bash
O1=$(mktemp -d); O2=$(mktemp -d)
timeout 180 node scripts/sync-github-wiki.mjs --build-only "$O1" && timeout 180 node scripts/sync-github-wiki.mjs --build-only "$O2"
diff -r "$O1" "$O2" && echo SAME; ls "$O1" | head; test -d "$O1/wiki" && echo "QUARANTINE LEAKED" || echo "no wiki/ folder"; test -d "$O1/.git" && echo "CLONED" || echo "no clone"
```
Expected: `SAME`, `no wiki/ folder`, `no clone`, and a listing that includes `Home.md`, `_Sidebar.md`, and `_Footer.md`. Repeat with `kb-sync/scripts/sync-github-wiki.mjs` run from `C:\dev\kb-sync`; expect `SAME` and `no clone`. If the outputs differ, find the generated value that changes between runs (`git diff --no-index "$O1" "$O2"`) and make it static the same way as the footer.

- [ ] **Step 5: Commit in each repo**

```bash
git add scripts/sync-github-wiki.mjs tools/wiki-browser-qa/wiki-page-rules.mjs docs/wiki-pages
git commit -m "fix(doc-sync): build-only mode, static footer, stop publishing C:/dev/wiki"
git -C C:/dev/kb-sync add scripts/sync-github-wiki.mjs
git -C C:/dev/kb-sync commit -m "fix(doc-sync): build-only mode and static footer for wiki publisher"
```

---

### Task 8: Fill the registry and correct the markdown registry

**Files:**
- Modify: `docs/meta/governance/wiki-sync-registry.json`
- Modify: `docs/meta/governance/wiki-sync-registry.md`

Every row starts with `"enabled": false`. Task 9 enables them one at a time.

- [ ] **Step 1: Write the rows**

Sigil's build reuses its own script with `--wiki-dir {out}` and no `--push`. In that mode the script only copies markdown and image files into the folder, renames `README.md` to `Home.md`, and never runs git ([sync-wiki.mjs:29](../../../sigil-repo/sigil/scripts/sync-wiki.mjs#L29) gates pushing on `--push` or `CI=true`). kb-sync gets `"ingest": false`, because kb-sync's own default cache run already indexes its source folders.

```json
{
  "$comment": "Authoritative wiki sync registry. Human notes live in wiki-sync-registry.md. Edit rows here, then run npm run docs:sync -- --dry-run.",
  "products": [
    { "name": "toolforge", "repoPath": "C:\\dev", "remote": "git@github.com:sorensencc-dotcom/toolforge.wiki.git", "buildCommand": "node scripts/sync-github-wiki.mjs --build-only \"{out}\"", "enabled": false },
    { "name": "sigil", "repoPath": "C:\\dev\\sigil-repo", "remote": "https://github.com/sorensencc-dotcom/sigil.wiki.git", "preValidate": "node sigil/scripts/verify-wiki-diagrams.mjs && node sigil/scripts/audit-wiki.mjs", "buildCommand": "node sigil/scripts/sync-wiki.mjs --wiki-dir \"{out}\"", "enabled": false },
    { "name": "kb-sync", "repoPath": "C:\\dev\\kb-sync", "remote": "https://github.com/sorensencc-dotcom/kb-sync.wiki.git", "preValidate": "npm run wiki:validate-contract", "buildCommand": "node scripts/sync-github-wiki.mjs --build-only \"{out}\"", "ingest": false, "enabled": false },
    { "name": "trm", "repoPath": "C:\\dev\\trm", "remote": "https://github.com/sorensencc-dotcom/TRM.wiki.git", "sourceDir": "wiki", "preValidate": "node scripts/validate-diagram-triplets.mjs", "enabled": false },
    { "name": "icf", "repoPath": "C:\\dev\\icf", "remote": "https://github.com/sorensencc-dotcom/icf.wiki.git", "sourceDir": "wiki", "enabled": false },
    { "name": "helix", "repoPath": "C:\\dev\\helix", "remote": "https://github.com/sorensencc-dotcom/helix.wiki.git", "sourceDir": "wiki", "enabled": false },
    { "name": "toolforge-marketplace", "repoPath": "C:\\dev\\toolforge-marketplace", "remote": "https://github.com/sorensencc-dotcom/toolforge-marketplace.wiki.git", "sourceDir": "wiki", "enabled": false },
    { "name": "rewrite-mcp", "repoPath": "C:\\dev\\rewrite-mcp", "remote": "https://github.com/sorensencc-dotcom/rewrite-mcp.wiki.git", "sourceDir": "wiki", "enabled": false }
  ]
}
```

- [ ] **Step 2: Check the registry loads**

Run: `node -e "import('./scripts/doc-sync/registry.mjs').then(m=>console.log(m.loadRegistry('docs/meta/governance/wiki-sync-registry.json').length))"`
Expected: `8`.

- [ ] **Step 3: Check sigil's build writes pages and pushes nothing**

Run from `C:\dev\sigil-repo`: `O=$(mktemp -d); timeout 120 node sigil/scripts/sync-wiki.mjs --wiki-dir "$O"; ls "$O"; test -d "$O/.git" && echo CLONED || echo "no clone"`
Expected: `Home.md` plus the other pages, and `no clone`. If the script refuses a folder that isn't a git repo, run `git init -q "$O"` before it and add `rm -rf "{out}/.git"` handling in `publish.mjs`. `stageMirror` already skips `.git`, so a `.git` folder in the build output is harmless and needs no change.

- [ ] **Step 4: Update `wiki-sync-registry.md`**

Edit by hand and keep the file's line endings:
1. Under the status lines, add: `**Machine-readable source:** [wiki-sync-registry.json](wiki-sync-registry.json). The orchestrator reads only the JSON. This table is human notes and must name the same products.`
2. In the toolforge row, replace the `C:\dev\toolforge` root with `C:\dev` root (origin `toolforge.git`).
3. In the sigil row and the related-tooling table, replace `C:\dev\sigil` with `C:\dev\sigil-repo`, and fix the script path to `C:\dev\sigil-repo\sigil\scripts\sync-wiki.mjs`.
4. Replace the related-tooling table's publish rows with one row: `| Doc sync orchestrator | C:\dev\scripts\doc-sync\run.mjs (npm run docs:sync) | The only process that pushes to a product wiki |`. Keep the validate-hook and page-map rows.
5. Leave **Status:** as draft. Making it active is Task 11.

- [ ] **Step 5: Commit**

```bash
git add docs/meta/governance/wiki-sync-registry.json docs/meta/governance/wiki-sync-registry.md
git commit -m "docs(governance): add registry rows and fix stale toolforge and sigil paths"
```

---

### Task 9: Onboard products one at a time

Each product goes through a dry run, a review, enabling, and a real run. Start with trm, which already has a curated `wiki/` folder with 26 entries.

- [ ] **Step 0: Get the new code where it will run, and get approval to switch over**

Live runs execute `C:\dev\scripts\doc-sync\run.mjs`, and the build commands run in each product's canonical folder, not in the worktree.
1. Open PRs for this work in each repo it touched (toolforge from the worktree, plus kb-sync and anything else changed so far), get them merged to `main`, and wait for CI to pass.
2. `C:\dev` is on `parkd821-20260908` with uncommitted work that isn't part of this plan. Show Chris `git -C C:/dev status --short | head -40` and ask how to get `C:\dev` onto `main` without losing that work: commit it on its branch, or stash it. Don't stash, reset, or switch branches without his answer.
3. Once Chris confirms, check each canonical folder is on a branch that contains the merged commits: `for r in C:/dev C:/dev/kb-sync; do git -C $r fetch -q && git -C $r merge-base --is-ancestor origin/main HEAD && echo "$r ok" || echo "$r BEHIND"; done`. Every line must read `ok`.
4. Ask Chris to approve the cutover itself: from here on, the registry's sources replace whatever is in each live wiki. This approval was in Task 11 in earlier revisions. It belongs here, before the first live push.

**Files:**
- Modify: `docs/meta/governance/wiki-sync-registry.json` (one `enabled` flag per product)
- Create in product repos: `<repo>/wiki/**` for icf, helix, toolforge-marketplace, and rewrite-mcp, seeded from reviewed pages of their current live wiki

- [ ] **Step 1: trm dry run**

Run: `node scripts/doc-sync/run.mjs --product=trm --dry-run`
Expected: `trm: DRY_RUN (N changed)` or `trm: UP_TO_DATE`. Read the `changed` list in `_status-feed/doc-sync-receipt.json`. A deleted page that exists only in the live wiki means `C:\dev\trm\wiki` is missing it. Copy that page in from `C:\dev\trm-wiki`, commit it in the trm repo, and run the dry run again.

- [ ] **Step 2: trm real run**

Set `"enabled": true` on trm. Run `node scripts/doc-sync/run.mjs --product=trm` twice.
Expected: the first run reports `SYNCHRONIZED` or `UP_TO_DATE`, and the second reports `UP_TO_DATE`. Then confirm the cache: `node -e "const {DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('C:/dev/kb-sync/.kb_cache/knowledge.db').prepare(\"SELECT count(*) n FROM kb_documents WHERE id LIKE 'product:trm/%'\").get())"` prints a count of 1 or more.

- [ ] **Step 3: Seed each product whose live wiki is the only copy**

This covers icf, helix, and toolforge-marketplace, which have no `wiki/` folder in their repo, plus rewrite-mcp, whose `wiki/` holds 1 file while the live wiki holds 301 pages. Seeding makes the seeded pages the new source, so seed only pages that belong to the product. Checked on 2026-10-02:
- **icf:** clean. 5 pages, the sidebar, the footer, and one diagram.
- **helix:** `Home`, `README`, plus `superpowers/` (3 plans and 3 specs) and `contracts/` (4 files). Ask Chris whether internal plans and specs belong on the public wiki before seeding them.
- **toolforge-marketplace:** the sidebar is clean (stripped 2026-09-27), but the live wiki still holds 557 pages copied from other products: `wiki/` (372), `docs/` (183), `kb-sync/` (2), plus `trm-gap-triage-architecture.*`. Seed only the top-level product pages and their own diagrams. Leave those folders out; the first mirror run then deletes them from the live wiki, and that deletion list goes to Chris in Step 4.
- **rewrite-mcp:** about 19 curated pages in the sidebar, plus a generated per-file dump.

Do one product at a time. `<name>` is the registry name, and `<clone>` is its local wiki clone, `C:\dev\<name>-wiki`.

Seed from a fresh clone of the registry's remote at a recorded commit, never from the local clone's working tree, which may hold untracked or unpushed edits:

```bash
pwsh -NoProfile -File C:/dev/scripts/verify-repo-context.ps1 -Path C:/dev/<name>
test -z "$(git -C C:/dev/<name> status --porcelain -- wiki)" || { echo "wiki/ has uncommitted changes; stop"; exit 1; }
S=$(mktemp -d) && git clone -q "<remote from the registry row>" "$S/w"
SEED=$(git -C "$S/w" rev-parse HEAD); echo "seeding from $SEED"
mkdir -p C:/dev/<name>/wiki
git -C "$S/w" archive HEAD | tar -x -C C:/dev/<name>/wiki
git -C C:/dev/<name> status --short -- wiki
```

Review that `status` output; it should list only new files under `wiki/`. Remove anything the product-by-product list above excludes (for example `rm -rf C:/dev/toolforge-marketplace/wiki/{wiki,docs,kb-sync} C:/dev/toolforge-marketplace/wiki/trm-gap-triage-architecture.*`), and check `git -C C:/dev/<name> status --short -- wiki` again. Then:

```bash
git -C C:/dev/<name> add wiki
git -C C:/dev/<name> commit -m "docs(wiki): seed in-repo wiki source from live wiki at $SEED"
rm -rf "$S"
```

For rewrite-mcp, ask Chris first whether to keep the generated per-file pages (`*.ts.md` and similar) outside the `_Sidebar.md` set. If he says no, treat it like cic-ingestion: drop the row instead of seeding a partial tree, because mirror publishing deletes from the live wiki any page left out of the repo.

- [ ] **Step 4: Dry-run each seeded product**

Run: `node scripts/doc-sync/run.mjs --product=<name> --dry-run`
Expected: `UP_TO_DATE` for icf, helix, and rewrite-mcp, because each source was just seeded from its live wiki. toolforge-marketplace reports `DRY_RUN` with the excluded foreign folders in its `deleted` list. Send Chris that `deleted` list and wait for his approval before Step 5.

- [ ] **Step 5: Enable and run each seeded product**

Set `"enabled": true` on each product, then run `node scripts/doc-sync/run.mjs --product=<name>` twice. Expected: the first run reports `UP_TO_DATE` (`SYNCHRONIZED` for toolforge-marketplace), and the second reports `UP_TO_DATE`.

- [ ] **Step 6: Build products (toolforge, kb-sync, sigil)**

For each one, dry-run it and read the `deleted` list in `_status-feed/doc-sync-receipt.json`. These three wikis have only ever been written by their own scripts, which didn't prune, so the first mirror run will remove pages those scripts left behind. Send Chris the full `deleted` list for each product and wait for his approval before the real run. Then enable the row and run `node scripts/doc-sync/run.mjs --product=<name>` twice; expect `UP_TO_DATE` on the second run.

- [ ] **Step 7: Full run**

Run `npm run docs:sync -- --dry-run`, then `npm run docs:sync` twice.
Expected: 8 lines (7 if rewrite-mcp's row was dropped) with no `FAILED` and exit code 0, and every product `UP_TO_DATE` on the last run.

- [ ] **Step 8: Commit after each product is enabled**

```bash
git add docs/meta/governance/wiki-sync-registry.json
git commit -m "chore(doc-sync): enable <name> in wiki sync registry"
```

---

### Task 10: Remove every other publish path

Do this only after Task 9 Step 7 passes.

**Files:**
- Modify: `kb-sync/.github/workflows/wiki-drift-and-publish.yml`
- Modify: `kb-sync/scripts/wiki-validate-prepush.sh` (lines 24–27)
- Modify: `kb-sync/scripts/notebooklm/kb-sync-nightly.ps1` (Stage 3, from line 230: runs `scripts\sync-github-wiki.mjs`)
- Modify: `kb-sync/package.json` and `C:\dev\package.json` (`wiki:publish` and `wiki:sync`, which run the publish scripts directly)
- Modify: `kb-sync/package.json` (`fleet:wiki:reconcile`, `test:fleet-reconciler`)
- Delete: `kb-sync/modules/wiki/fleet-wiki-reconciler.ts`, `kb-sync/tests/fleet-wiki-reconciler.test.ts`
- Delete: `sigil-repo/.github/workflows/wiki-sync.yml`
- Modify: `trm/package.json` (`wiki:publish`); delete `trm/scripts/sync-remote-wiki.mjs`

- [ ] **Step 1: List every remaining push to a wiki remote**

Run: `for r in C:/dev C:/dev/kb-sync C:/dev/trm C:/dev/sigil-repo C:/dev/icf C:/dev/helix C:/dev/toolforge-marketplace C:/dev/cic-ingestion C:/dev/rewrite-mcp; do echo "== $r"; git -C $r grep -n -E "wiki\.git|sync-github-wiki|sync-wiki\.mjs|sync-remote-wiki|fleet-wiki-reconciler|reconcileFleetWikis" -- ':!*.md' ':!docs/superpowers/**' ':!**/node_modules/**' 2>/dev/null; done`
Expected: the hits this task removes, plus `scripts/doc-sync/**`, the two build scripts called through `--build-only`, and `sigil/scripts/sync-wiki.mjs` called through `--wiki-dir`. List every other hit for Chris and remove it in this task, including any publish call in `kb-sync/scripts/schedule-task-wrapper-KB-Sync-Master.ps1` or the scripts it runs.

- [ ] **Step 2: Check what else uses the fleet reconciler**

Run from `C:\dev\kb-sync`: `graft callers reconcileFleetWikis --depth all` and `graft callers syncRepositoryWiki --depth all`.
Expected: only the module's own CLI block and its test. If anything else calls either function, stop and list the callers for Chris instead of deleting.

- [ ] **Step 3: Remove the fleet reconciler**

```bash
git -C C:/dev/kb-sync rm modules/wiki/fleet-wiki-reconciler.ts tests/fleet-wiki-reconciler.test.ts
```

Remove the `fleet:wiki:reconcile` and `test:fleet-reconciler` lines from `kb-sync/package.json`. Keep `cross-repo-drift-scanner.ts`; it reports drift from the receipts that `run.mjs` now writes, and it doesn't publish.

- [ ] **Step 4: Remove the publish step from kb-sync's pre-push hook**

In `kb-sync/scripts/wiki-validate-prepush.sh`, delete the `if [ -f "scripts/sync-github-wiki.mjs" ]; then ... fi` block (lines 24–27). Keep the validation lines. If `.git/hooks/pre-push` in kb-sync is an installed copy, reinstall it with `npm run wiki:setup-push-hook`.

- [ ] **Step 4b: Remove the NotebookLM nightly's wiki publish and the direct npm aliases**

In `kb-sync/scripts/notebooklm/kb-sync-nightly.ps1`, delete Stage 3 ("Synchronizing documentation remote GitHub Wiki", from the `STAGE 3` banner through the end of its `if`/`try` block), and renumber any later stage banners. The master pipeline now runs `docs:sync` first (Task 11). In `kb-sync/package.json` and `C:\dev\package.json`, point `wiki:publish` and `wiki:sync` at the orchestrator: `"node C:/dev/scripts/doc-sync/run.mjs --product=kb-sync"` and `"node scripts/doc-sync/run.mjs --product=toolforge"` respectively.

- [ ] **Step 5: Remove kb-sync's CI publish**

In `wiki-drift-and-publish.yml`, delete the step that runs `node scripts/sync-github-wiki.mjs --repo-url "$WIKI_REPO_URL"` along with its env block, plus the receipt-verify step if it only checks that publish. Keep `npm run wiki:validate-contract`. Replace the `cron: '0 */4 * * *'` schedule with `push` and `pull_request` triggers, because the job is now only a validation check.

- [ ] **Step 6: Remove sigil's CI publish**

```bash
git -C C:/dev/sigil-repo rm .github/workflows/wiki-sync.yml
```

Sigil's diagram and audit checks keep running locally as the registry row's `preValidate`. If Chris wants them in CI too, move them into a validate-only workflow in a separate change.

- [ ] **Step 7: Point trm at the orchestrator**

In `trm/package.json`, set `"wiki:publish": "node C:/dev/scripts/doc-sync/run.mjs --product=trm"`, then run `git -C C:/dev/trm rm scripts/sync-remote-wiki.mjs`.

- [ ] **Step 8: Run kb-sync's tests**

kb-sync's `npm test` runs only two suites; the full set is `test:all`. Before Step 3, record a baseline: from `C:\dev\kb-sync`, run `timeout 600 npm run test:all 2>&1 | tail -20` and save the pass/fail counts. Now run it again.
Expected: no test that passed in the baseline fails now. The fleet-reconciler tests are gone, so the total drops by their count. If the suite prints nothing for 60 seconds, treat it as hung per AGENTS.md.

- [ ] **Step 9: Run Step 1 again**

Expected: no hits beyond the allowed ones.

- [ ] **Step 10: Commit in each repo**

```bash
git -C C:/dev/kb-sync add -A modules/wiki tests package.json scripts/wiki-validate-prepush.sh scripts/notebooklm/kb-sync-nightly.ps1 .github/workflows/wiki-drift-and-publish.yml
git add package.json
git commit -m "chore(doc-sync): route toolforge wiki:publish through docs:sync"
git -C C:/dev/kb-sync commit -m "chore(doc-sync): retire fleet reconciler, pre-push and CI wiki publish"
git -C C:/dev/sigil-repo commit -m "chore(doc-sync): retire CI wiki publish in favor of C:/dev docs:sync"
git -C C:/dev/trm add -A package.json scripts/sync-remote-wiki.mjs
git -C C:/dev/trm commit -m "chore(doc-sync): route wiki:publish through C:/dev docs:sync"
```

---

### Task 11: One scheduled run, and make the registry authoritative

**Files:**
- Modify: `kb-sync/scripts/schedule-task-wrapper-KB-Sync-Master.ps1`
- Modify: `docs/meta/governance/wiki-sync-registry.md`
- Modify: `docs/meta/governance/wiki-style-and-structure.md` §10

- [ ] **Step 1: Run doc sync first in the nightly pipeline**

In the master wrapper, before the NotebookLM auth check at line 69, add this block, matching the wrapper's existing `& cmd /c ... | Tee-Object` style:

```powershell
Write-LogInfo "Publishing product wikis (docs:sync)..."
& cmd /c "node C:\dev\scripts\doc-sync\run.mjs" 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-LogError "docs:sync failed (exit $LASTEXITCODE); see C:\dev\_status-feed\doc-sync-receipt.json. Skipping downstream ingest so stale docs are not uploaded."
    exit 1
}
```

- [ ] **Step 2: Run the scheduled task once and check this run's receipt**

Record the time, then run `schtasks.exe /run /tn "\KB-SYNC\KB-Sync-Master-Pipeline"`. Poll `schtasks.exe /query /tn "\KB-SYNC\KB-Sync-Master-Pipeline" /v /fo list` until `Status` is `Ready`, then check that `Last Result` is `0`. Read `C:\dev\_status-feed\doc-sync-receipt.json`.
Expected: `timestamp` is later than the recorded start time, `"ok": true`, and every product is `UP_TO_DATE` or `SYNCHRONIZED`. An older timestamp means doc sync didn't run in this invocation, which is a failure.

- [ ] **Step 3: Make the registry authoritative**

Rule 4 of `wiki-sync-registry.md` requires every Owner TODO to be filled before the status changes. Ask Chris for an owner for each row, including the new `kb-sync` row. In the same edit, remove the rows for products that aren't published (charlie-deep-research, rewrite-docs, cic-jev, cic-ingestion, and the quarantine row) from the publish table, and list them under a separate "Inventory only (not published)" heading. Don't proceed without Chris's typed approval in the transcript. Then:
1. Change **Status:** from `draft` to `active`.
2. Find the §10 registry sentence in `wiki-style-and-structure.md` with `grep -n "Registry:" docs/meta/governance/wiki-style-and-structure.md` (currently line 278). Add after it: "The machine-readable source is `wiki-sync-registry.json`, and `npm run docs:sync` is the only publish path."

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/kb-sync add scripts/schedule-task-wrapper-KB-Sync-Master.ps1
git -C C:/dev/kb-sync commit -m "feat(doc-sync): run docs:sync first in nightly master pipeline"
git add docs/meta/governance/wiki-sync-registry.md docs/meta/governance/wiki-style-and-structure.md
git commit -m "docs(governance): make wiki sync registry authoritative"
```

---

## Known limits (accepted, not fixed here)

- The sidebar guard checks that each sidebar link has a page in the tree. It doesn't check who owns the page, so a foreign page copied into a product's `wiki/` folder would pass. With mirror publishing, that copy has to be committed in the product repo, where review can see it. The fleet reconciler's per-product allowlists (`PRODUCT_SIDEBAR_ALLOWLISTS`) are deleted in Task 10 along with the reconciler.
- Path validation doesn't follow symlinks or Windows junctions inside a source folder. No registry source contains one today.
- `UP_TO_DATE` means the live wiki matches the source folder. It doesn't mean anyone re-read the prose, so a stale page stays stale on every run. A last-reviewed date has the same gap.

## Done when

- `scripts/doc-sync/publish.mjs` is the only code that pushes to a product wiki (Task 10 Step 1 finds no other push).
- Two `npm run docs:sync` runs in a row report every product `UP_TO_DATE` on the second run.
- `query_context_cache` finds a page from each product with `ingest: true`, under `product:<name>/`.
- Each product repo's `.wiki-sync-receipt.json` shows the latest run, so the drift scanner reports current state.
- The nightly master pipeline publishes before ingesting and stops if publishing fails.
- The registry is marked active, and its JSON rows match its markdown rows.
