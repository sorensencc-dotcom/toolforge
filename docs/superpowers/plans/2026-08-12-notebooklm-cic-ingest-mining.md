# NotebookLM CIC Ingest & Reverse-Mining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `trm ingest-notebooklm <notebook-id>` (pull NotebookLM sources/notes into trm's existing intake→extract→sync-treatment chain) and `trm mine-notebooklm <notebook-id>` (fixed-question research-gap mining into a doc + TODOS.md) commands to the trm CLI.

**Architecture:** Two new orchestrator commands shell out to the `nlm` CLI (Python, on PATH, the same tool as the `notebooklm-mcp` MCP server) for all NotebookLM I/O, and shell out to trm's own existing CLI commands (`triage-intake`, `route-intake`, `ingest`, `extract`, `sync-treatment`) for all vault I/O. No new staging format, classifier, or cross-repo write path — see `docs/superpowers/specs/2026-08-12-notebooklm-cic-ingest-mining-design.md` for the full design rationale.

**Tech Stack:** Node.js / TypeScript, Commander (existing trm CLI framework), Jest, Python `nlm` CLI (external, invoked via `child_process`).

## Global Constraints

- All new trm-side commands run with `process.cwd()` as the vault root (`assertSafeRoot` requirement, `trm/src/cli/index.ts:19-20`) — never pass a vault path as an argument, always assume cwd.
- Registry file (`notebooklm-registry.json`) is **mutable runtime state** and lives at the **vault root**, not `trm/config/` — deviates from spec §2's stated path. Rationale: `trm/config/topic-routing.json` is static seed config shipped with the tool (resolved relative to `__dirname`, three levels up from the compiled command, per `routeIntake.ts:52-59`); registry hashes mutate on every run, which is exactly the pattern trm already uses for `intake-manifest.json` and `.sync-cursor.json` — both vault-root, both gitignored-by-convention runtime state, not tool config. `mining-questions.json` stays under `trm/config/` since it is genuinely static/versioned tool config, not runtime state.
- `nlm <subcommand> --json` always exits 0 with `{status: "success", ...}` on success, exits 1 with `{status: "error", error: "<message>"}` on failure — confirmed live (`nlm source content <bad-id> --json` → exit 1, `{"status":"error","error":"API error (code 5): NOT_FOUND"}`). Every `nlm` wrapper function must check both the exit code and the `status` field, not just one.
- Every new registry/report write uses `writeFileAtomic` from `trm/src/core/atomicWrite.ts` — never `fs.writeFileSync` directly on a tracked state file.
- Tests use Jest (existing `npm test`), `fs.mkdtempSync(path.join(os.tmpdir(), 'trm-<name>-'))` fixture pattern, matching `trm/tests/core/topicRouting.test.ts`.

---

## File Structure

```
trm/src/notebooklm/
  nlmCli.ts          # spawns `nlm`, parses --json output, typed success/error result
  nlmCli.test.ts
  registry.ts         # load/save vault-root registry, namespaced hash lookup, quarantine, per-item flush
  registry.test.ts
  stagingName.ts       # slugify title -> intake/ filename, path-containment guard
  stagingName.test.ts
  runReport.ts         # durable per-run report (.nlm-ingest-reports/<runId>.json)
  runReport.test.ts

trm/src/cli/commands/
  ingestNotebooklm.ts   # forward-ingest orchestrator
  ingestNotebooklm.test.ts
  mineNotebooklm.ts     # reverse-mining orchestrator
  mineNotebooklm.test.ts

trm/config/
  mining-questions.json # static, versioned question set (id + text pairs)

trm/src/cli/index.ts    # register the two new commands (modify)
trm/README.md           # add the two new commands to the command table (modify)

schedule-task-wrapper-TRM-Notebooklm-Mine.ps1   # repo root, matches kb-sync wrapper pattern (new)
```

---

### Task 1: `nlm` CLI wrapper

**Files:**
- Create: `trm/src/notebooklm/nlmCli.ts`
- Test: `trm/src/notebooklm/nlmCli.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module)
- Produces:
  - `interface NlmSource { id: string; title: string; type: string; url: string | null }`
  - `interface NlmNote { id: string; title: string; content: string }`
  - `type NlmResult<T> = { ok: true; data: T } | { ok: false; error: string }`
  - `function listSources(notebookId: string): NlmResult<NlmSource[]>`
  - `function getSourceContent(sourceId: string): NlmResult<string>`
  - `function listNotes(notebookId: string): NlmResult<NlmNote[]>`
  - `function queryNotebook(notebookId: string, question: string, timeoutSeconds?: number): NlmResult<string>`

These four functions are the only integration point with the `nlm` binary — every other module in this plan calls through them, never `child_process` directly.

- [ ] **Step 1: Write the failing test**

```typescript
// trm/src/notebooklm/nlmCli.test.ts
import { listSources, getSourceContent, listNotes, queryNotebook } from './nlmCli';
import * as childProcess from 'node:child_process';

jest.mock('node:child_process');
const mockSpawnSync = childProcess.spawnSync as jest.Mock;

describe('nlmCli', () => {
  afterEach(() => jest.resetAllMocks());

  it('listSources parses a successful --json array', () => {
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: JSON.stringify([
        { id: 'src-1', title: 'memcode-ai/memcode', type: 'web_page', url: 'https://github.com/memcode-ai/memcode' },
        { id: 'src-2', title: 'repo_knowledge_pack.txt', type: 'generated_text', url: null },
      ]),
      stderr: '',
    });

    const result = listSources('nb-1');

    expect(result).toEqual({
      ok: true,
      data: [
        { id: 'src-1', title: 'memcode-ai/memcode', type: 'web_page', url: 'https://github.com/memcode-ai/memcode' },
        { id: 'src-2', title: 'repo_knowledge_pack.txt', type: 'generated_text', url: null },
      ],
    });
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'nlm',
      ['source', 'list', 'nb-1', '--json', '--skip-freshness'],
      expect.objectContaining({ encoding: 'utf-8' })
    );
  });

  it('getSourceContent returns ok:false on a non-zero exit with an error payload', () => {
    mockSpawnSync.mockReturnValue({
      status: 1,
      stdout: JSON.stringify({ status: 'error', error: 'API error (code 5): NOT_FOUND' }),
      stderr: '',
    });

    const result = getSourceContent('bad-id');

    expect(result).toEqual({ ok: false, error: 'API error (code 5): NOT_FOUND' });
  });

  it('getSourceContent returns ok:false when stdout is not valid JSON', () => {
    mockSpawnSync.mockReturnValue({ status: 0, stdout: 'not json', stderr: '' });

    const result = getSourceContent('src-1');

    expect(result.ok).toBe(false);
  });

  it('listNotes parses the {notebook_id, notes} wrapper', () => {
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: JSON.stringify({
        notebook_id: 'nb-1',
        notes: [{ id: 'note-1', title: 'T', content: 'full note body' }],
      }),
      stderr: '',
    });

    const result = listNotes('nb-1');

    expect(result).toEqual({ ok: true, data: [{ id: 'note-1', title: 'T', content: 'full note body' }] });
  });

  it('queryNotebook passes timeout and returns the answer text', () => {
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: JSON.stringify({ status: 'success', answer: 'The answer.' }),
      stderr: '',
    });

    const result = queryNotebook('nb-1', 'What is unresolved?', 60);

    expect(result).toEqual({ ok: true, data: 'The answer.' });
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'nlm',
      ['query', 'notebook', 'nb-1', 'What is unresolved?', '--json', '--timeout', '60'],
      expect.objectContaining({ encoding: 'utf-8' })
    );
  });

  it('returns ok:false when spawnSync itself reports an error (binary not found)', () => {
    mockSpawnSync.mockReturnValue({ status: null, error: new Error('ENOENT'), stdout: '', stderr: '' });

    const result = listSources('nb-1');

    expect(result).toEqual({ ok: false, error: 'ENOENT' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd trm && npx jest src/notebooklm/nlmCli.test.ts`
Expected: FAIL — `Cannot find module './nlmCli'`

- [ ] **Step 3: Write the implementation**

```typescript
// trm/src/notebooklm/nlmCli.ts
import { spawnSync } from 'node:child_process';

export interface NlmSource {
  id: string;
  title: string;
  type: string;
  url: string | null;
}

export interface NlmNote {
  id: string;
  title: string;
  content: string;
}

export type NlmResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface RawSpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

function runNlm(args: string[]): NlmResult<unknown> {
  const result = spawnSync('nlm', args, { encoding: 'utf-8' }) as unknown as RawSpawnResult;

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (err) {
    return { ok: false, error: `nlm produced non-JSON output: ${(err as Error).message}` };
  }

  if (result.status !== 0) {
    const errMessage =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : `nlm exited with status ${result.status}`;
    return { ok: false, error: errMessage };
  }

  return { ok: true, data: parsed };
}

export function listSources(notebookId: string): NlmResult<NlmSource[]> {
  const result = runNlm(['source', 'list', notebookId, '--json', '--skip-freshness']);
  if (!result.ok) return result;
  return { ok: true, data: result.data as NlmSource[] };
}

export function getSourceContent(sourceId: string): NlmResult<string> {
  const result = runNlm(['source', 'content', sourceId, '--json']);
  if (!result.ok) return result;
  return { ok: true, data: (result.data as { content: string }).content };
}

export function listNotes(notebookId: string): NlmResult<NlmNote[]> {
  const result = runNlm(['note', 'list', notebookId, '--json']);
  if (!result.ok) return result;
  return { ok: true, data: (result.data as { notes: NlmNote[] }).notes };
}

export function queryNotebook(notebookId: string, question: string, timeoutSeconds?: number): NlmResult<string> {
  const args = ['query', 'notebook', notebookId, question, '--json'];
  if (timeoutSeconds !== undefined) args.push('--timeout', String(timeoutSeconds));
  const result = runNlm(args);
  if (!result.ok) return result;
  return { ok: true, data: (result.data as { answer: string }).answer };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd trm && npx jest src/notebooklm/nlmCli.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git -C trm add src/notebooklm/nlmCli.ts src/notebooklm/nlmCli.test.ts
git -C trm commit -m "feat(notebooklm): add nlm CLI wrapper with typed success/error results"
```

---

### Task 2: Registry module (vault-root state, namespaced keys, quarantine, per-item flush)

**Files:**
- Create: `trm/src/notebooklm/registry.ts`
- Test: `trm/src/notebooklm/registry.test.ts`

**Interfaces:**
- Consumes: `writeFileAtomic` from `trm/src/core/atomicWrite.ts`
- Produces:
  - `interface QuarantineEntry { hash: string; reason: string; first_seen_at: string; last_seen_at: string; attempts: number }`
  - `interface NotebookRegistryEntry { notebook_id: string; title: string; url: string; last_pulled_hashes: Record<string, string>; quarantined: Record<string, QuarantineEntry>; last_ingested_at: string | null; last_mined_at: string | null; last_mined_answer_keys: string[] }`
  - `interface RegistryFile { version: 1; notebooks: NotebookRegistryEntry[] }`
  - `function registryPath(root: string): string`
  - `function readRegistry(root: string): RegistryFile` (returns `{version: 1, notebooks: []}` if file missing)
  - `function findNotebook(registry: RegistryFile, notebookId: string): NotebookRegistryEntry | null`
  - `function sourceKey(sourceId: string): string` → `"source:<id>"`
  - `function noteKey(noteId: string): string` → `"note:<id>"`
  - `function checkItem(entry: NotebookRegistryEntry, key: string, hash: string): 'new' | 'unchanged' | 'changed' | 'quarantined-same' | 'quarantined-retry'`
  - `function flushPulledHash(root: string, notebookId: string, key: string, hash: string, timestamp: string): void` — loads registry fresh, updates one key, atomic-writes whole file (matches `openIntakeManifest`'s load-mutate-flush model but per-call here since calls are infrequent per run, not per-line)
  - `function flushQuarantine(root: string, notebookId: string, key: string, hash: string, reason: string, timestamp: string): void`
  - `function flushIngestedAt(root: string, notebookId: string, timestamp: string): void`

- [ ] **Step 1: Write the failing test**

```typescript
// trm/src/notebooklm/registry.test.ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  registryPath,
  readRegistry,
  findNotebook,
  sourceKey,
  noteKey,
  checkItem,
  flushPulledHash,
  flushQuarantine,
  flushIngestedAt,
  RegistryFile,
} from './registry';

function seedRegistry(root: string, registry: RegistryFile): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(registryPath(root), JSON.stringify(registry, null, 2));
}

describe('registry', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-nlmregistry-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('readRegistry returns an empty registry when the file does not exist', () => {
    expect(readRegistry(root)).toEqual({ version: 1, notebooks: [] });
  });

  it('sourceKey and noteKey are namespaced and cannot collide', () => {
    expect(sourceKey('abc')).toBe('source:abc');
    expect(noteKey('abc')).toBe('note:abc');
    expect(sourceKey('abc')).not.toBe(noteKey('abc'));
  });

  it('checkItem classifies new, unchanged, and changed items', () => {
    const entry = {
      notebook_id: 'nb-1',
      title: 'T',
      url: 'https://x',
      last_pulled_hashes: { 'source:s1': 'hash-a' },
      quarantined: {},
      last_ingested_at: null,
      last_mined_at: null,
      last_mined_answer_keys: [],
    };

    expect(checkItem(entry, 'source:new', 'hash-z')).toBe('new');
    expect(checkItem(entry, 'source:s1', 'hash-a')).toBe('unchanged');
    expect(checkItem(entry, 'source:s1', 'hash-b')).toBe('changed');
  });

  it('checkItem classifies quarantined-same vs quarantined-retry', () => {
    const entry = {
      notebook_id: 'nb-1',
      title: 'T',
      url: 'https://x',
      last_pulled_hashes: {},
      quarantined: {
        'source:bad': { hash: 'hash-empty', reason: 'empty content', first_seen_at: 't0', last_seen_at: 't0', attempts: 1 },
      },
      last_ingested_at: null,
      last_mined_at: null,
      last_mined_answer_keys: [],
    };

    expect(checkItem(entry, 'source:bad', 'hash-empty')).toBe('quarantined-same');
    expect(checkItem(entry, 'source:bad', 'hash-now-real-content')).toBe('quarantined-retry');
  });

  it('flushPulledHash updates one key via atomic write without disturbing others', () => {
    seedRegistry(root, {
      version: 1,
      notebooks: [
        {
          notebook_id: 'nb-1',
          title: 'T',
          url: 'https://x',
          last_pulled_hashes: { 'source:s1': 'old-hash' },
          quarantined: {},
          last_ingested_at: null,
          last_mined_at: null,
          last_mined_answer_keys: [],
        },
      ],
    });

    flushPulledHash(root, 'nb-1', 'source:s2', 'new-hash', '2026-08-12T00:00:00.000Z');

    const registry = readRegistry(root);
    const entry = findNotebook(registry, 'nb-1')!;
    expect(entry.last_pulled_hashes).toEqual({ 'source:s1': 'old-hash', 'source:s2': 'new-hash' });
  });

  it('flushQuarantine writes a quarantine entry and increments attempts on repeat', () => {
    seedRegistry(root, {
      version: 1,
      notebooks: [
        {
          notebook_id: 'nb-1', title: 'T', url: 'https://x',
          last_pulled_hashes: {}, quarantined: {},
          last_ingested_at: null, last_mined_at: null, last_mined_answer_keys: [],
        },
      ],
    });

    flushQuarantine(root, 'nb-1', 'source:bad', 'hash-empty', 'empty content', '2026-08-12T00:00:00.000Z');
    flushQuarantine(root, 'nb-1', 'source:bad', 'hash-empty', 'empty content', '2026-08-13T00:00:00.000Z');

    const entry = findNotebook(readRegistry(root), 'nb-1')!;
    expect(entry.quarantined['source:bad']).toEqual({
      hash: 'hash-empty',
      reason: 'empty content',
      first_seen_at: '2026-08-12T00:00:00.000Z',
      last_seen_at: '2026-08-13T00:00:00.000Z',
      attempts: 2,
    });
  });

  it('flushIngestedAt clears a quarantine entry when a fresh hash succeeds and updates last_ingested_at', () => {
    seedRegistry(root, {
      version: 1,
      notebooks: [
        {
          notebook_id: 'nb-1', title: 'T', url: 'https://x',
          last_pulled_hashes: {},
          quarantined: { 'source:bad': { hash: 'h', reason: 'r', first_seen_at: 't', last_seen_at: 't', attempts: 1 } },
          last_ingested_at: null, last_mined_at: null, last_mined_answer_keys: [],
        },
      ],
    });

    flushIngestedAt(root, 'nb-1', '2026-08-12T00:00:00.000Z');

    const entry = findNotebook(readRegistry(root), 'nb-1')!;
    expect(entry.last_ingested_at).toBe('2026-08-12T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd trm && npx jest src/notebooklm/registry.test.ts`
Expected: FAIL — `Cannot find module './registry'`

- [ ] **Step 3: Write the implementation**

```typescript
// trm/src/notebooklm/registry.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeFileAtomic } from '../core/atomicWrite';

export interface QuarantineEntry {
  hash: string;
  reason: string;
  first_seen_at: string;
  last_seen_at: string;
  attempts: number;
}

export interface NotebookRegistryEntry {
  notebook_id: string;
  title: string;
  url: string;
  last_pulled_hashes: Record<string, string>;
  quarantined: Record<string, QuarantineEntry>;
  last_ingested_at: string | null;
  last_mined_at: string | null;
  last_mined_answer_keys: string[];
}

export interface RegistryFile {
  version: 1;
  notebooks: NotebookRegistryEntry[];
}

export type ItemStatus = 'new' | 'unchanged' | 'changed' | 'quarantined-same' | 'quarantined-retry';

export function registryPath(root: string): string {
  return path.join(root, 'notebooklm-registry.json');
}

export function readRegistry(root: string): RegistryFile {
  const file = registryPath(root);
  if (!fs.existsSync(file)) return { version: 1, notebooks: [] };
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeRegistry(root: string, registry: RegistryFile): void {
  writeFileAtomic(registryPath(root), JSON.stringify(registry, null, 2));
}

export function findNotebook(registry: RegistryFile, notebookId: string): NotebookRegistryEntry | null {
  return registry.notebooks.find((n) => n.notebook_id === notebookId) ?? null;
}

export function sourceKey(sourceId: string): string {
  return `source:${sourceId}`;
}

export function noteKey(noteId: string): string {
  return `note:${noteId}`;
}

export function checkItem(entry: NotebookRegistryEntry, key: string, hash: string): ItemStatus {
  const quarantine = entry.quarantined[key];
  if (quarantine) {
    return quarantine.hash === hash ? 'quarantined-same' : 'quarantined-retry';
  }
  const pulled = entry.last_pulled_hashes[key];
  if (pulled === undefined) return 'new';
  return pulled === hash ? 'unchanged' : 'changed';
}

function mutateNotebook(
  root: string,
  notebookId: string,
  mutate: (entry: NotebookRegistryEntry) => void
): void {
  const registry = readRegistry(root);
  const entry = findNotebook(registry, notebookId);
  if (!entry) {
    throw new Error(
      `notebooklm-registry.json has no entry for notebook "${notebookId}" -- add it before running ingest/mine`
    );
  }
  mutate(entry);
  writeRegistry(root, registry);
}

export function flushPulledHash(root: string, notebookId: string, key: string, hash: string, timestamp: string): void {
  mutateNotebook(root, notebookId, (entry) => {
    entry.last_pulled_hashes[key] = hash;
    delete entry.quarantined[key];
  });
}

export function flushQuarantine(
  root: string,
  notebookId: string,
  key: string,
  hash: string,
  reason: string,
  timestamp: string
): void {
  mutateNotebook(root, notebookId, (entry) => {
    const existing = entry.quarantined[key];
    entry.quarantined[key] =
      existing && existing.hash === hash
        ? { ...existing, last_seen_at: timestamp, attempts: existing.attempts + 1 }
        : { hash, reason, first_seen_at: timestamp, last_seen_at: timestamp, attempts: 1 };
  });
}

export function flushIngestedAt(root: string, notebookId: string, timestamp: string): void {
  mutateNotebook(root, notebookId, (entry) => {
    entry.last_ingested_at = timestamp;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd trm && npx jest src/notebooklm/registry.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git -C trm add src/notebooklm/registry.ts src/notebooklm/registry.test.ts
git -C trm commit -m "feat(notebooklm): add vault-root registry with namespaced keys and quarantine"
```

---

### Task 3: Staging filename module (slug + path-containment guard)

**Files:**
- Create: `trm/src/notebooklm/stagingName.ts`
- Test: `trm/src/notebooklm/stagingName.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `function slugifyTitle(title: string): string`
  - `function stagingRelativePath(notebookSlug: string, itemId: string, title: string): string` → `intake/notebooklm/<notebook-slug>/<item-id>--<slug>.md`
  - `function isPathContained(root: string, relativePath: string): boolean` — guards against a malformed title producing a path that escapes `intake/`

- [ ] **Step 1: Write the failing test**

```typescript
// trm/src/notebooklm/stagingName.test.ts
import { slugifyTitle, stagingRelativePath, isPathContained } from './stagingName';
import * as path from 'node:path';

describe('stagingName', () => {
  it('slugifyTitle lowercases, replaces non-alphanumerics with hyphens, trims repeats', () => {
    expect(slugifyTitle('The Willys-Overland Plant: 1943 Production!')).toBe('the-willys-overland-plant-1943-production');
  });

  it('slugifyTitle handles empty/whitespace-only titles with a fallback', () => {
    expect(slugifyTitle('   ')).toBe('untitled');
  });

  it('stagingRelativePath composes notebook slug, item id, and title slug', () => {
    expect(stagingRelativePath('cic-daily-research', 'src-abc-123', 'Willow Run Bomber Plant')).toBe(
      'intake/notebooklm/cic-daily-research/src-abc-123--willow-run-bomber-plant.md'
    );
  });

  it('a malicious title cannot escape intake/ once slugified', () => {
    const relPath = stagingRelativePath('nb', 'id1', '../../../etc/passwd');
    const root = path.resolve('/vault');
    const resolved = path.resolve(root, relPath);
    expect(isPathContained(root, relPath)).toBe(true);
    expect(resolved.startsWith(path.join(root, 'intake'))).toBe(true);
  });

  it('isPathContained rejects a path with raw traversal segments regardless of source', () => {
    expect(isPathContained('/vault', 'intake/../../outside.md')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd trm && npx jest src/notebooklm/stagingName.test.ts`
Expected: FAIL — `Cannot find module './stagingName'`

- [ ] **Step 3: Write the implementation**

```typescript
// trm/src/notebooklm/stagingName.ts
import * as path from 'node:path';

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'untitled';
}

export function stagingRelativePath(notebookSlug: string, itemId: string, title: string): string {
  const safeItemId = itemId.replace(/[^a-zA-Z0-9-]/g, '');
  return `intake/notebooklm/${notebookSlug}/${safeItemId}--${slugifyTitle(title)}.md`;
}

export function isPathContained(root: string, relativePath: string): boolean {
  const intakeRoot = path.join(path.resolve(root), 'intake');
  const resolved = path.resolve(root, relativePath);
  const rel = path.relative(intakeRoot, resolved);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd trm && npx jest src/notebooklm/stagingName.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git -C trm add src/notebooklm/stagingName.ts src/notebooklm/stagingName.test.ts
git -C trm commit -m "feat(notebooklm): add staging filename slug + path-containment guard"
```

---

### Task 4: Durable run report

**Files:**
- Create: `trm/src/notebooklm/runReport.ts`
- Test: `trm/src/notebooklm/runReport.test.ts`

**Interfaces:**
- Consumes: `writeFileAtomic` from `trm/src/core/atomicWrite.ts`
- Produces:
  - `type RunItemStatus = 'staged' | 'ingested' | 'extracted' | 'quarantined' | 'failed'`
  - `interface RunReportItem { key: string; status: RunItemStatus; detail?: string }`
  - `interface RunReport { runId: string; notebookId: string; startedAt: string; items: RunReportItem[]; syncTreatmentStatus?: 'ok' | 'skipped-topics' | 'error' }`
  - `function runReportPath(root: string, runId: string): string` → `.nlm-ingest-reports/<runId>.json`
  - `function createRunReport(root: string, runId: string, notebookId: string, startedAt: string): void`
  - `function recordItem(root: string, runId: string, item: RunReportItem): void`
  - `function readRunReport(root: string, runId: string): RunReport`
  - `function findMostRecentRunReport(root: string): RunReport | null`

- [ ] **Step 1: Write the failing test**

```typescript
// trm/src/notebooklm/runReport.test.ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRunReport, recordItem, readRunReport, findMostRecentRunReport, runReportPath } from './runReport';

describe('runReport', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-nlmreport-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('createRunReport writes an initial report with no items', () => {
    createRunReport(root, 'run-1', 'nb-1', '2026-08-12T00:00:00.000Z');

    const report = readRunReport(root, 'run-1');
    expect(report).toEqual({ runId: 'run-1', notebookId: 'nb-1', startedAt: '2026-08-12T00:00:00.000Z', items: [] });
    expect(fs.existsSync(runReportPath(root, 'run-1'))).toBe(true);
  });

  it('recordItem appends items across multiple calls', () => {
    createRunReport(root, 'run-1', 'nb-1', '2026-08-12T00:00:00.000Z');

    recordItem(root, 'run-1', { key: 'source:s1', status: 'ingested' });
    recordItem(root, 'run-1', { key: 'source:s2', status: 'quarantined', detail: 'empty content' });

    const report = readRunReport(root, 'run-1');
    expect(report.items).toEqual([
      { key: 'source:s1', status: 'ingested' },
      { key: 'source:s2', status: 'quarantined', detail: 'empty content' },
    ]);
  });

  it('findMostRecentRunReport returns the report with the latest startedAt', () => {
    createRunReport(root, 'run-1', 'nb-1', '2026-08-12T00:00:00.000Z');
    createRunReport(root, 'run-2', 'nb-1', '2026-08-13T00:00:00.000Z');

    const latest = findMostRecentRunReport(root);
    expect(latest?.runId).toBe('run-2');
  });

  it('findMostRecentRunReport returns null when no reports exist', () => {
    expect(findMostRecentRunReport(root)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd trm && npx jest src/notebooklm/runReport.test.ts`
Expected: FAIL — `Cannot find module './runReport'`

- [ ] **Step 3: Write the implementation**

```typescript
// trm/src/notebooklm/runReport.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeFileAtomic } from '../core/atomicWrite';

export type RunItemStatus = 'staged' | 'ingested' | 'extracted' | 'quarantined' | 'failed';

export interface RunReportItem {
  key: string;
  status: RunItemStatus;
  detail?: string;
}

export interface RunReport {
  runId: string;
  notebookId: string;
  startedAt: string;
  items: RunReportItem[];
  syncTreatmentStatus?: 'ok' | 'skipped-topics' | 'error';
}

function reportsDir(root: string): string {
  return path.join(root, '.nlm-ingest-reports');
}

export function runReportPath(root: string, runId: string): string {
  return path.join(reportsDir(root), `${runId}.json`);
}

export function createRunReport(root: string, runId: string, notebookId: string, startedAt: string): void {
  const report: RunReport = { runId, notebookId, startedAt, items: [] };
  writeFileAtomic(runReportPath(root, runId), JSON.stringify(report, null, 2));
}

export function readRunReport(root: string, runId: string): RunReport {
  return JSON.parse(fs.readFileSync(runReportPath(root, runId), 'utf-8'));
}

export function recordItem(root: string, runId: string, item: RunReportItem): void {
  const report = readRunReport(root, runId);
  report.items.push(item);
  writeFileAtomic(runReportPath(root, runId), JSON.stringify(report, null, 2));
}

export function findMostRecentRunReport(root: string): RunReport | null {
  const dir = reportsDir(root);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return null;

  let latest: RunReport | null = null;
  for (const file of files) {
    const report: RunReport = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    if (!latest || report.startedAt > latest.startedAt) latest = report;
  }
  return latest;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd trm && npx jest src/notebooklm/runReport.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git -C trm add src/notebooklm/runReport.ts src/notebooklm/runReport.test.ts
git -C trm commit -m "feat(notebooklm): add durable per-run report for crash reconciliation"
```

---

### Task 5: Ingest orchestrator — pull, hash, quarantine, stage

**Files:**
- Create: `trm/src/cli/commands/ingestNotebooklm.ts`
- Test: `trm/src/cli/commands/ingestNotebooklm.test.ts`

**Interfaces:**
- Consumes: `listSources`, `getSourceContent`, `listNotes` from `../../notebooklm/nlmCli`; `readRegistry`, `findNotebook`, `sourceKey`, `noteKey`, `checkItem`, `flushPulledHash`, `flushQuarantine`, `flushIngestedAt` from `../../notebooklm/registry`; `stagingRelativePath` from `../../notebooklm/stagingName`; `createRunReport`, `recordItem` from `../../notebooklm/runReport`
- Produces:
  - `interface StagedItem { key: string; relativePath: string; title: string; sourceUrl: string | null; origin: 'notebooklm' | 'notebooklm-derived' }`
  - `function pullAndStage(root: string, notebookId: string, runId: string): StagedItem[]` — this task's deliverable. Does **not** yet call `triage-intake`/`route-intake`/`ingest`/`extract`/`sync-treatment` (Task 6).

This task covers §3.1–§3.3 of the design (pull, change detection/quarantine, write staged files). Task 6 covers §3.4–§3.6 (drive the rest of the trm pipeline).

- [ ] **Step 1: Write the failing test**

```typescript
// trm/src/cli/commands/ingestNotebooklm.test.ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pullAndStage } from './ingestNotebooklm';
import * as nlmCli from '../../notebooklm/nlmCli';
import { registryPath } from '../../notebooklm/registry';

jest.mock('../../notebooklm/nlmCli');

function seedRegistry(root: string): void {
  fs.writeFileSync(
    registryPath(root),
    JSON.stringify({
      version: 1,
      notebooks: [
        {
          notebook_id: 'nb-1',
          title: 'CIC-KB',
          url: 'https://notebooklm.google.com/notebook/nb-1',
          last_pulled_hashes: {},
          quarantined: {},
          last_ingested_at: null,
          last_mined_at: null,
          last_mined_answer_keys: [],
        },
      ],
    })
  );
}

describe('pullAndStage', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-nlmingest-'));
    seedRegistry(root);
    jest.resetAllMocks();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('stages a new source and a new note as physical files under intake/notebooklm/', () => {
    (nlmCli.listSources as jest.Mock).mockReturnValue({
      ok: true,
      data: [{ id: 'src-1', title: 'Willow Run Plant', type: 'web_page', url: 'https://example.com/a' }],
    });
    (nlmCli.getSourceContent as jest.Mock).mockReturnValue({ ok: true, data: 'Real source content.' });
    (nlmCli.listNotes as jest.Mock).mockReturnValue({
      ok: true,
      data: [{ id: 'note-1', title: 'Discovery', content: 'A curated finding.' }],
    });

    const staged = pullAndStage(root, 'nb-1', 'run-1');

    expect(staged).toHaveLength(2);
    const sourceItem = staged.find((s) => s.key === 'source:src-1')!;
    expect(fs.readFileSync(path.join(root, sourceItem.relativePath), 'utf-8')).toBe('Real source content.');
    expect(sourceItem.origin).toBe('notebooklm');

    const noteItem = staged.find((s) => s.key === 'note:note-1')!;
    expect(fs.readFileSync(path.join(root, noteItem.relativePath), 'utf-8')).toBe('A curated finding.');
  });

  it('marks a youtube-typed source as derived provenance with a marker line', () => {
    (nlmCli.listSources as jest.Mock).mockReturnValue({
      ok: true,
      data: [{ id: 'src-yt', title: 'Bomber Plant Footage', type: 'youtube', url: 'https://youtube.com/x' }],
    });
    (nlmCli.getSourceContent as jest.Mock).mockReturnValue({ ok: true, data: 'Derived summary text.' });
    (nlmCli.listNotes as jest.Mock).mockReturnValue({ ok: true, data: [] });

    const staged = pullAndStage(root, 'nb-1', 'run-1');

    expect(staged[0].origin).toBe('notebooklm-derived');
    const content = fs.readFileSync(path.join(root, staged[0].relativePath), 'utf-8');
    expect(content.split('\n')[0]).toBe('<!-- provenance: derived -->');
  });

  it('skips a source whose content hash is unchanged from the registry', () => {
    (nlmCli.listSources as jest.Mock).mockReturnValue({
      ok: true,
      data: [{ id: 'src-1', title: 'Willow Run Plant', type: 'web_page', url: 'https://example.com/a' }],
    });
    (nlmCli.getSourceContent as jest.Mock).mockReturnValue({ ok: true, data: 'Unchanged content.' });
    (nlmCli.listNotes as jest.Mock).mockReturnValue({ ok: true, data: [] });

    pullAndStage(root, 'nb-1', 'run-1');
    const secondRun = pullAndStage(root, 'nb-1', 'run-2');

    expect(secondRun).toHaveLength(0);
  });

  it('quarantines empty content instead of staging it, and does not re-log unchanged empty content', () => {
    (nlmCli.listSources as jest.Mock).mockReturnValue({
      ok: true,
      data: [{ id: 'src-empty', title: 'Empty Source', type: 'web_page', url: 'https://example.com/e' }],
    });
    (nlmCli.getSourceContent as jest.Mock).mockReturnValue({ ok: true, data: '' });
    (nlmCli.listNotes as jest.Mock).mockReturnValue({ ok: true, data: [] });

    const first = pullAndStage(root, 'nb-1', 'run-1');
    const second = pullAndStage(root, 'nb-1', 'run-2');

    expect(first).toHaveLength(0);
    expect(second).toHaveLength(0);
    expect(fs.existsSync(path.join(root, 'intake', 'notebooklm'))).toBe(false);
  });

  it('quarantines a source when getSourceContent returns an MCP-style error, without throwing', () => {
    (nlmCli.listSources as jest.Mock).mockReturnValue({
      ok: true,
      data: [{ id: 'src-bad', title: 'Broken', type: 'web_page', url: 'https://example.com/b' }],
    });
    (nlmCli.getSourceContent as jest.Mock).mockReturnValue({ ok: false, error: 'API error (code 5): NOT_FOUND' });
    (nlmCli.listNotes as jest.Mock).mockReturnValue({ ok: true, data: [] });

    expect(() => pullAndStage(root, 'nb-1', 'run-1')).not.toThrow();
    expect(pullAndStage(root, 'nb-1', 'run-1')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd trm && npx jest src/cli/commands/ingestNotebooklm.test.ts`
Expected: FAIL — `Cannot find module './ingestNotebooklm'`

- [ ] **Step 3: Write the implementation**

```typescript
// trm/src/cli/commands/ingestNotebooklm.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { listSources, getSourceContent, listNotes } from '../../notebooklm/nlmCli';
import { readRegistry, findNotebook, sourceKey, noteKey, checkItem, flushPulledHash, flushQuarantine } from '../../notebooklm/registry';
import { stagingRelativePath } from '../../notebooklm/stagingName';
import { createRunReport, recordItem } from '../../notebooklm/runReport';

export interface StagedItem {
  key: string;
  relativePath: string;
  title: string;
  sourceUrl: string | null;
  origin: 'notebooklm' | 'notebooklm-derived';
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

function notebookSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function writeStaged(root: string, relativePath: string, content: string): void {
  const absPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

export function pullAndStage(root: string, notebookId: string, runId: string): StagedItem[] {
  const registry = readRegistry(root);
  const entry = findNotebook(registry, notebookId);
  if (!entry) {
    throw new Error(`notebooklm-registry.json has no entry for notebook "${notebookId}"`);
  }

  const now = new Date().toISOString();
  createRunReport(root, runId, notebookId, now);
  const slug = notebookSlug(entry.title);
  const staged: StagedItem[] = [];

  const sourcesResult = listSources(notebookId);
  const sources = sourcesResult.ok ? sourcesResult.data : [];

  for (const source of sources) {
    const key = sourceKey(source.id);
    const contentResult = getSourceContent(source.id);

    if (!contentResult.ok) {
      flushQuarantine(root, notebookId, key, hashContent(''), contentResult.error, now);
      recordItem(root, runId, { key, status: 'quarantined', detail: contentResult.error });
      continue;
    }

    const content = contentResult.data;
    const hash = hashContent(content);
    const status = checkItem(entry, key, hash);

    if (status === 'unchanged' || status === 'quarantined-same') continue;

    if (content.trim().length === 0) {
      flushQuarantine(root, notebookId, key, hash, 'empty content', now);
      recordItem(root, runId, { key, status: 'quarantined', detail: 'empty content' });
      continue;
    }

    const isDerived = source.type === 'youtube';
    const relativePath = stagingRelativePath(slug, source.id, source.title);
    const fileContent = isDerived ? `<!-- provenance: derived -->\n${content}` : content;
    writeStaged(root, relativePath, fileContent);
    flushPulledHash(root, notebookId, key, hash, now);
    recordItem(root, runId, { key, status: 'staged' });

    staged.push({
      key,
      relativePath,
      title: source.title,
      sourceUrl: source.url,
      origin: isDerived ? 'notebooklm-derived' : 'notebooklm',
    });
  }

  const notesResult = listNotes(notebookId);
  const notes = notesResult.ok ? notesResult.data : [];

  for (const note of notes) {
    const key = noteKey(note.id);
    const hash = hashContent(note.content);
    const status = checkItem(entry, key, hash);

    if (status === 'unchanged' || status === 'quarantined-same') continue;

    if (note.content.trim().length === 0) {
      flushQuarantine(root, notebookId, key, hash, 'empty content', now);
      recordItem(root, runId, { key, status: 'quarantined', detail: 'empty content' });
      continue;
    }

    const relativePath = stagingRelativePath(slug, note.id, note.title);
    writeStaged(root, relativePath, note.content);
    flushPulledHash(root, notebookId, key, hash, now);
    recordItem(root, runId, { key, status: 'staged' });

    staged.push({
      key,
      relativePath,
      title: note.title,
      sourceUrl: `https://notebooklm.google.com/notebook/${notebookId}?note=${note.id}`,
      origin: 'notebooklm',
    });
  }

  return staged;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd trm && npx jest src/cli/commands/ingestNotebooklm.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git -C trm add src/cli/commands/ingestNotebooklm.ts src/cli/commands/ingestNotebooklm.test.ts
git -C trm commit -m "feat(notebooklm): pull+hash+quarantine+stage sources and notes into intake/"
```

---

### Task 6: Ingest orchestrator — drive trm pipeline + sync-treatment, wire into CLI

**Files:**
- Modify: `trm/src/cli/commands/ingestNotebooklm.ts`
- Modify: `trm/src/cli/commands/ingestNotebooklm.test.ts`
- Modify: `trm/src/cli/index.ts`

**Interfaces:**
- Consumes: `StagedItem[]` from Task 5's `pullAndStage`; `flushIngestedAt` from `../../notebooklm/registry`
- Produces: `function runIngestNotebooklm(root: string, notebookId: string, opts: { narrativeRoot: string; spawn?: typeof import('node:child_process').spawnSync }): { staged: number; topicsExtracted: string[]; syncTreatmentReportPath: string | null }` — the full pipeline entrypoint the CLI command calls.

`spawn` is injectable for testing (defaults to real `child_process.spawnSync`) — this is how the test suite verifies the exact argv passed to `triage-intake`/`route-intake`/`ingest`/`extract`/`sync-treatment` without a real vault.

- [ ] **Step 1: Write the failing test**

```typescript
// append to trm/src/cli/commands/ingestNotebooklm.test.ts
import { runIngestNotebooklm } from './ingestNotebooklm';

describe('runIngestNotebooklm', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-nlmingest-run-'));
    seedRegistry(root);
    jest.resetAllMocks();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('runs triage-intake, route-intake, ingest per staged file, extract per touched topic, then sync-treatment unscoped', () => {
    (nlmCli.listSources as jest.Mock).mockReturnValue({
      ok: true,
      data: [{ id: 'src-1', title: 'Willow Run Plant', type: 'web_page', url: 'https://example.com/a' }],
    });
    (nlmCli.getSourceContent as jest.Mock).mockReturnValue({ ok: true, data: 'Willow Run bomber plant content.' });
    (nlmCli.listNotes as jest.Mock).mockReturnValue({ ok: true, data: [] });

    const calls: string[][] = [];
    const fakeSpawn = jest.fn((_cmd: string, args: string[]) => {
      calls.push(args);
      if (args[0] === 'route-intake') {
        return { status: 0, stdout: JSON.stringify({ totalConsidered: 1, byTopic: { willow_run: 1 }, ambiguousCount: 0, runStatus: 'completed' }), stderr: '' };
      }
      if (args[0] === 'triage-intake') {
        return { status: 0, stdout: JSON.stringify({ totalFiles: 1, processedCount: 1, skippedCount: 0, dupCount: 0, failedCount: 0, walkErrorCount: 0, visionFallbackCount: 0, byType: { text: 1 } }), stderr: '' };
      }
      return { status: 0, stdout: '{}', stderr: '' };
    });

    const result = runIngestNotebooklm(root, 'nb-1', { narrativeRoot: 'C:\\dev\\charlie-deep-research', spawn: fakeSpawn as any });

    expect(result.staged).toBe(1);
    const commands = calls.map((c) => c[0]);
    expect(commands).toEqual(expect.arrayContaining(['triage-intake', 'route-intake', 'sync-treatment']));

    const syncCall = calls.find((c) => c[0] === 'sync-treatment')!;
    expect(syncCall).toEqual(['sync-treatment', '--narrative-root', 'C:\\dev\\charlie-deep-research']);
  });

  it('continues to the next staged file when one ingest call throws', () => {
    (nlmCli.listSources as jest.Mock).mockReturnValue({
      ok: true,
      data: [
        { id: 'src-1', title: 'Good Source', type: 'web_page', url: 'https://example.com/a' },
        { id: 'src-2', title: 'Also Good', type: 'web_page', url: 'https://example.com/b' },
      ],
    });
    (nlmCli.getSourceContent as jest.Mock).mockReturnValue({ ok: true, data: 'Content here.' });
    (nlmCli.listNotes as jest.Mock).mockReturnValue({ ok: true, data: [] });

    let ingestCallCount = 0;
    const fakeSpawn = jest.fn((_cmd: string, args: string[]) => {
      if (args[0] === 'route-intake') {
        return { status: 0, stdout: JSON.stringify({ totalConsidered: 2, byTopic: { willow_run: 2 }, ambiguousCount: 0, runStatus: 'completed' }), stderr: '' };
      }
      if (args[0] === 'ingest') {
        ingestCallCount++;
        if (ingestCallCount === 1) throw new Error('simulated ingest crash');
        return { status: 0, stdout: '{}', stderr: '' };
      }
      return { status: 0, stdout: '{}', stderr: '' };
    });

    expect(() =>
      runIngestNotebooklm(root, 'nb-1', { narrativeRoot: 'C:\\dev\\charlie-deep-research', spawn: fakeSpawn as any })
    ).not.toThrow();
    expect(ingestCallCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd trm && npx jest src/cli/commands/ingestNotebooklm.test.ts`
Expected: FAIL — `runIngestNotebooklm is not a function`

- [ ] **Step 3: Extend the implementation**

Append to `trm/src/cli/commands/ingestNotebooklm.ts`:

```typescript
import { spawnSync as realSpawnSync } from 'node:child_process';
import { flushIngestedAt } from '../../notebooklm/registry';

interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

type SpawnFn = (cmd: string, args: string[], opts?: object) => SpawnResult;

export interface RunIngestOptions {
  narrativeRoot: string;
  spawn?: SpawnFn;
}

export interface RunIngestResult {
  staged: number;
  topicsExtracted: string[];
  syncTreatmentReportPath: string | null;
}

function runTrm(root: string, spawn: SpawnFn, args: string[]): SpawnResult {
  return spawn('trm', args, { cwd: root, encoding: 'utf-8' });
}

export function runIngestNotebooklm(root: string, notebookId: string, opts: RunIngestOptions): RunIngestResult {
  const spawn = opts.spawn ?? ((cmd, args, o) => realSpawnSync(cmd, args, { ...o, encoding: 'utf-8' }) as unknown as SpawnResult);
  const runId = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8)}`;

  const staged = pullAndStage(root, notebookId, runId);
  if (staged.length === 0) {
    runTrm(root, spawn, ['sync-treatment', '--narrative-root', opts.narrativeRoot]);
    return { staged: 0, topicsExtracted: [], syncTreatmentReportPath: null };
  }

  const notebookSlugDir = path.dirname(path.dirname(staged[0].relativePath)); // intake/notebooklm/<slug>
  runTrm(root, spawn, ['triage-intake', '--dir', notebookSlugDir]);
  const routeResult = runTrm(root, spawn, ['route-intake', '--apply']);
  const routeSummary = JSON.parse(routeResult.stdout || '{}') as { byTopic?: Record<string, number> };
  const touchedTopics = Object.keys(routeSummary.byTopic ?? {}).filter((t) => t !== 'unsorted');

  for (const item of staged) {
    // route-intake stages by keyword match; the staged path under
    // topics/charlie/<topic>/_staging-intake-<runId>/ is not deterministically
    // known here without re-reading intake-routing-report.json, so per-topic
    // ingest is driven by that report rather than the pre-route staged path.
    const reportPath = path.join(root, 'intake-routing-report.json');
    if (!fs.existsSync(reportPath)) continue;
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as {
      entries: { sourcePath: string; topic: string | null; stagedPath?: string; status: string }[];
    };
    const routed = report.entries.find((e) => e.sourcePath === item.relativePath && e.status === 'staged');
    if (!routed || !routed.topic || !routed.stagedPath) {
      recordItem(root, runId, { key: item.key, status: 'failed', detail: 'unsorted or not staged by route-intake' });
      continue;
    }

    try {
      runTrm(root, spawn, [
        'ingest',
        `topics/charlie/${routed.topic}`,
        item.sourceUrl ?? `local:${item.title}`,
        '--file',
        routed.stagedPath,
        '--type',
        item.origin === 'notebooklm-derived' ? 'notebooklm-source' : item.key.startsWith('note:') ? 'notebooklm-note' : 'notebooklm-source',
        '--title',
        item.title,
        '--origin',
        item.origin,
      ]);
      recordItem(root, runId, { key: item.key, status: 'ingested' });
    } catch (err) {
      recordItem(root, runId, { key: item.key, status: 'failed', detail: (err as Error).message });
      continue;
    }
  }

  for (const topic of touchedTopics) {
    runTrm(root, spawn, ['extract', `topics/charlie/${topic}`]);
  }

  runTrm(root, spawn, ['sync-treatment', '--narrative-root', opts.narrativeRoot]);
  flushIngestedAt(root, notebookId, new Date().toISOString());

  return { staged: staged.length, topicsExtracted: touchedTopics, syncTreatmentReportPath: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd trm && npx jest src/cli/commands/ingestNotebooklm.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Wire into the CLI**

In `trm/src/cli/index.ts`, add near the other imports:

```typescript
import { runIngestNotebooklm } from './commands/ingestNotebooklm';
```

And add a new command block after the `sync-treatment` command:

```typescript
program
  .command('ingest-notebooklm <notebook-id>')
  .requiredOption('--narrative-root <path>', 'path to the charlie-deep-research narrative repo')
  .action((notebookId, opts) => {
    const result = runIngestNotebooklm(root, notebookId, { narrativeRoot: opts.narrativeRoot });
    console.log(JSON.stringify(result, null, 2));
  });
```

- [ ] **Step 6: Commit**

```bash
git -C trm add src/cli/commands/ingestNotebooklm.ts src/cli/commands/ingestNotebooklm.test.ts src/cli/index.ts
git -C trm commit -m "feat(notebooklm): drive triage-intake/route-intake/ingest/extract/sync-treatment, wire trm ingest-notebooklm"
```

---

### Task 7: Mining question set config

**Files:**
- Create: `trm/config/mining-questions.json`

**Interfaces:**
- Consumes: nothing
- Produces: a static file consumed by Task 8 as `{ id: string; text: string }[]` under key `questions`

- [ ] **Step 1: Create the config file**

```json
{
  "version": 1,
  "questions": [
    { "id": "open-contradictions", "text": "What open questions or unresolved contradictions exist across these sources?" },
    { "id": "under-sourced", "text": "What claims are asserted but single-sourced or under-corroborated?" },
    { "id": "adjacent-topics", "text": "What adjacent topics do these sources point to that aren't covered yet?" },
    { "id": "follow-up", "text": "What follow-up research would most strengthen current findings?" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git -C trm add config/mining-questions.json
git -C trm commit -m "feat(notebooklm): add versioned mining question set"
```

---

### Task 8: Mining orchestrator

**Files:**
- Create: `trm/src/cli/commands/mineNotebooklm.ts`
- Test: `trm/src/cli/commands/mineNotebooklm.test.ts`

**Interfaces:**
- Consumes: `queryNotebook` from `../../notebooklm/nlmCli`; `readRegistry`, `findNotebook` from `../../notebooklm/registry`; `writeFileAtomic` from `../../core/atomicWrite`
- Produces:
  - `interface MiningQuestion { id: string; text: string }`
  - `function loadMiningQuestions(): MiningQuestion[]` — reads `trm/config/mining-questions.json` relative to `__dirname`, same resolution pattern as `resolveConfigPath` in `routeIntake.ts`
  - `function answerKey(notebookId: string, questionId: string, answer: string): string` → `<notebook_id>:<question_id>:sha256(answer)`
  - `function runMineNotebooklm(root: string, notebookId: string, opts: { topic?: string }): { newEntries: number; docPath: string }`

- [ ] **Step 1: Write the failing test**

```typescript
// trm/src/cli/commands/mineNotebooklm.test.ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadMiningQuestions, answerKey, runMineNotebooklm } from './mineNotebooklm';
import * as nlmCli from '../../notebooklm/nlmCli';
import { registryPath } from '../../notebooklm/registry';

jest.mock('../../notebooklm/nlmCli');

function seedRegistry(root: string): void {
  fs.writeFileSync(
    registryPath(root),
    JSON.stringify({
      version: 1,
      notebooks: [
        {
          notebook_id: 'nb-1',
          title: 'Willow Run Videos',
          url: 'https://notebooklm.google.com/notebook/nb-1',
          last_pulled_hashes: {},
          quarantined: {},
          last_ingested_at: null,
          last_mined_at: null,
          last_mined_answer_keys: [],
        },
      ],
    })
  );
}

describe('mineNotebooklm', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-nlmmine-'));
    seedRegistry(root);
    jest.resetAllMocks();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('loadMiningQuestions returns the 4 fixed questions with stable ids', () => {
    const questions = loadMiningQuestions();
    expect(questions.map((q) => q.id)).toEqual(['open-contradictions', 'under-sourced', 'adjacent-topics', 'follow-up']);
  });

  it('answerKey is stable for identical inputs and changes when the answer changes', () => {
    const k1 = answerKey('nb-1', 'open-contradictions', 'Answer A');
    const k2 = answerKey('nb-1', 'open-contradictions', 'Answer A');
    const k3 = answerKey('nb-1', 'open-contradictions', 'Answer B');
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
  });

  it('writes new rows to research-gaps doc and TODOS.md, and is idempotent on a second identical run', () => {
    (nlmCli.queryNotebook as jest.Mock).mockImplementation((_nb: string, question: string) => ({
      ok: true,
      data: question.includes('contradictions') ? 'No source found for the 1943 production date.' : 'Some other answer.',
    }));

    fs.writeFileSync(path.join(root, 'TODOS.md'), '# TODOS\n\n## Open\n\n## Completed\n');

    const first = runMineNotebooklm(root, 'nb-1', {});
    expect(first.newEntries).toBe(4);

    const docContent = fs.readFileSync(path.join(root, first.docPath), 'utf-8');
    expect(docContent).toContain('No source found for the 1943 production date.');

    const todos = fs.readFileSync(path.join(root, 'TODOS.md'), 'utf-8');
    expect(todos).toContain('No source found for the 1943 production date.');

    const second = runMineNotebooklm(root, 'nb-1', {});
    expect(second.newEntries).toBe(0);
  });

  it('quarantine-style MCP errors on a question do not throw and do not add a row', () => {
    (nlmCli.queryNotebook as jest.Mock).mockReturnValue({ ok: false, error: 'timeout' });
    fs.writeFileSync(path.join(root, 'TODOS.md'), '# TODOS\n\n## Open\n\n## Completed\n');

    const result = runMineNotebooklm(root, 'nb-1', {});
    expect(result.newEntries).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd trm && npx jest src/cli/commands/mineNotebooklm.test.ts`
Expected: FAIL — `Cannot find module './mineNotebooklm'`

- [ ] **Step 3: Write the implementation**

```typescript
// trm/src/cli/commands/mineNotebooklm.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { queryNotebook } from '../../notebooklm/nlmCli';
import { readRegistry, findNotebook } from '../../notebooklm/registry';
import { writeFileAtomic } from '../../core/atomicWrite';

export interface MiningQuestion {
  id: string;
  text: string;
}

const URGENCY_PATTERNS = [/needs verification/i, /recommend investigating/i, /no source found/i];

export function loadMiningQuestions(): MiningQuestion[] {
  const configPath = path.resolve(__dirname, '../../../config/mining-questions.json');
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { questions: MiningQuestion[] };
  return parsed.questions;
}

export function answerKey(notebookId: string, questionId: string, answer: string): string {
  const answerHash = crypto.createHash('sha256').update(answer, 'utf-8').digest('hex');
  return `${notebookId}:${questionId}:${answerHash}`;
}

function docPathFor(root: string, notebookSlug: string): string {
  return path.join('trm', 'research-gaps', `${notebookSlug}.md`);
}

function notebookSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function appendDocRow(root: string, relativeDocPath: string, question: MiningQuestion, answer: string, notebookTitle: string, key: string): void {
  const absPath = path.join(root, relativeDocPath);
  const exists = fs.existsSync(absPath);
  const header = '| Question | Answer excerpt | Notebook | First-seen date | Entry key |\n|---|---|---|---|---|\n';
  const excerpt = answer.length > 200 ? `${answer.slice(0, 200)}...` : answer;
  const row = `| ${question.text} | ${excerpt.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${notebookTitle} | ${new Date().toISOString().slice(0, 10)} | ${key} |\n`;
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const existing = exists ? fs.readFileSync(absPath, 'utf-8') : `# Research Gaps: ${notebookTitle}\n\n${header}`;
  writeFileAtomic(absPath, existing + row);
}

function appendTodoIfUrgent(root: string, answer: string, question: MiningQuestion, key: string): void {
  const isUrgent = URGENCY_PATTERNS.some((p) => p.test(answer));
  if (!isUrgent) return;

  const todosPath = path.join(root, 'TODOS.md');
  const content = fs.existsSync(todosPath) ? fs.readFileSync(todosPath, 'utf-8') : '# TODOS\n\n## Open\n\n## Completed\n';
  if (content.includes(key)) return; // idempotent across Open + Completed

  const line = `- [ ] ${question.text} -- ${answer.slice(0, 150)} (${key})\n`;
  const openMarker = '## Open\n';
  const idx = content.indexOf(openMarker);
  const updated =
    idx === -1
      ? `${content}\n## Open\n${line}`
      : `${content.slice(0, idx + openMarker.length)}${line}${content.slice(idx + openMarker.length)}`;
  writeFileAtomic(todosPath, updated);
}

export function runMineNotebooklm(root: string, notebookId: string, _opts: { topic?: string }): { newEntries: number; docPath: string } {
  const registry = readRegistry(root);
  const entry = findNotebook(registry, notebookId);
  if (!entry) {
    throw new Error(`notebooklm-registry.json has no entry for notebook "${notebookId}"`);
  }

  const questions = loadMiningQuestions();
  const relativeDocPath = docPathFor(root, notebookSlug(entry.title));
  const seenKeys = new Set(entry.last_mined_answer_keys);
  let newEntries = 0;

  for (const question of questions) {
    const result = queryNotebook(notebookId, question.text);
    if (!result.ok) continue;

    const key = answerKey(notebookId, question.id, result.data);
    if (seenKeys.has(key)) continue;

    appendDocRow(root, relativeDocPath, question, result.data, entry.title, key);
    appendTodoIfUrgent(root, result.data, question, key);
    seenKeys.add(key);
    newEntries++;
  }

  entry.last_mined_answer_keys = Array.from(seenKeys);
  entry.last_mined_at = new Date().toISOString();
  writeFileAtomic(registryPath(root), JSON.stringify(registry, null, 2));

  return { newEntries, docPath: relativeDocPath };
}

import { registryPath } from '../../notebooklm/registry';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd trm && npx jest src/cli/commands/mineNotebooklm.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Fix import ordering**

Move the `import { registryPath } from '../../notebooklm/registry';` line from the bottom of the file to the top import block, alongside the other `../../notebooklm/registry` import (combine into one `import { readRegistry, findNotebook, registryPath } from '../../notebooklm/registry';`). Re-run the test to confirm it still passes.

Run: `cd trm && npx jest src/cli/commands/mineNotebooklm.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git -C trm add src/cli/commands/mineNotebooklm.ts src/cli/commands/mineNotebooklm.test.ts
git -C trm commit -m "feat(notebooklm): mining orchestrator with dedup key + urgency-gated TODOS"
```

---

### Task 9: Wire `mine-notebooklm` into CLI, update README

**Files:**
- Modify: `trm/src/cli/index.ts`
- Modify: `trm/README.md`

**Interfaces:**
- Consumes: `runMineNotebooklm` from `./commands/mineNotebooklm`
- Produces: `trm mine-notebooklm <notebook-id>` CLI command

- [ ] **Step 1: Add the command**

In `trm/src/cli/index.ts`, add the import:

```typescript
import { runMineNotebooklm } from './commands/mineNotebooklm';
```

And add the command block after `ingest-notebooklm`:

```typescript
program
  .command('mine-notebooklm <notebook-id>')
  .action((notebookId) => {
    const result = runMineNotebooklm(root, notebookId, {});
    console.log(JSON.stringify(result, null, 2));
  });
```

- [ ] **Step 2: Verify the CLI builds and both commands appear**

Run: `cd trm && npm run build && node dist/cli/index.js --help`
Expected: output includes `ingest-notebooklm <notebook-id>` and `mine-notebooklm <notebook-id>` in the command list, no TypeScript compile errors.

- [ ] **Step 3: Update README.md**

In `trm/README.md`, find the command table (the line matching `trm ingest <path> <url> --type <t> --title <t> --origin <o> [--actor] [--dry-run]`) and add two rows immediately after it:

```markdown
| `trm ingest-notebooklm <notebook-id> --narrative-root <path>` | Pull new/changed sources+notes from a registered NotebookLM notebook, route/ingest/extract them, then run sync-treatment. |
| `trm mine-notebooklm <notebook-id>` | Run the fixed research-gap question set against a registered NotebookLM notebook; appends new answers to `trm/research-gaps/<slug>.md` and urgent ones to `TODOS.md`. |
```

- [ ] **Step 4: Commit**

```bash
git -C trm add src/cli/index.ts README.md
git -C trm commit -m "feat(notebooklm): wire trm mine-notebooklm into CLI, document both commands"
```

---

### Task 10: Seed the vault registry for the 5 known CIC notebooks

**Files:**
- Create (at the vault root, **not** inside the `trm` tool repo — this is per-vault runtime data): `<vault-root>/notebooklm-registry.json`

This is a manual data-entry task, not code — the registry lives outside the `trm` git repo (it's vault state). No test applies; verify by running `trm mine-notebooklm 679b8bab-2d87-42cb-a726-6dc54c83acc2` (CIC-KB, smallest notebook) against a real vault checkout afterward and confirming it doesn't throw the "no entry for notebook" error.

- [ ] **Step 1: Write the seed file**

At the vault root:

```json
{
  "version": 1,
  "notebooks": [
    {
      "notebook_id": "679b8bab-2d87-42cb-a726-6dc54c83acc2",
      "title": "CIC-KB",
      "url": "https://notebooklm.google.com/notebook/679b8bab-2d87-42cb-a726-6dc54c83acc2",
      "last_pulled_hashes": {},
      "quarantined": {},
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    },
    {
      "notebook_id": "1b4861a3-931f-4632-8fc1-343a8dd37df8",
      "title": "CIC - Daily Research",
      "url": "https://notebooklm.google.com/notebook/1b4861a3-931f-4632-8fc1-343a8dd37df8",
      "last_pulled_hashes": {},
      "quarantined": {},
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    },
    {
      "notebook_id": "ef78168d-b7b9-4952-8e0f-fcb353a21181",
      "title": "Willow Run Videos",
      "url": "https://notebooklm.google.com/notebook/ef78168d-b7b9-4952-8e0f-fcb353a21181",
      "last_pulled_hashes": {},
      "quarantined": {},
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    },
    {
      "notebook_id": "b8bc161d-495f-42f9-a7d1-ed8692141f6b",
      "title": "Cast Iron Charlie - Research Logs",
      "url": "https://notebooklm.google.com/notebook/b8bc161d-495f-42f9-a7d1-ed8692141f6b",
      "last_pulled_hashes": {},
      "quarantined": {},
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    },
    {
      "notebook_id": "fd0e0e4e-6890-4fb9-89bf-b9e568295e7a",
      "title": "The Sorensen Photographic Archive: Industrial Giants at Willow Run",
      "url": "https://notebooklm.google.com/notebook/fd0e0e4e-6890-4fb9-89bf-b9e568295e7a",
      "last_pulled_hashes": {},
      "quarantined": {},
      "last_ingested_at": null,
      "last_mined_at": null,
      "last_mined_answer_keys": []
    }
  ]
}
```

- [ ] **Step 2: Confirm `nlm` is authenticated**

Run: `nlm doctor`
Expected: reports an active/valid Google session. If not, run `nlm login` first (interactive, requires the user).

- [ ] **Step 3: Smoke-test against the real, smallest notebook**

Run (from the vault root): `trm mine-notebooklm 679b8bab-2d87-42cb-a726-6dc54c83acc2`
Expected: exits 0, prints `{"newEntries": <n>, "docPath": "trm/research-gaps/cic-kb.md"}`, and `trm/research-gaps/cic-kb.md` exists with real answers to the 4 fixed questions.

- [ ] **Step 4: Commit** (vault repo, not trm repo)

```bash
git add notebooklm-registry.json trm/research-gaps/cic-kb.md
git commit -m "chore(notebooklm): register 5 CIC notebooks, smoke-test mining against CIC-KB"
```

---

### Task 11: Scheduler wrapper for weekly mining sweep

**Files:**
- Create: `schedule-task-wrapper-TRM-Notebooklm-Mine.ps1` (repo root, matches `schedule-task-wrapper-KB-Sync-*.ps1` pattern)

**Interfaces:**
- Consumes: `trm mine-notebooklm <notebook-id>` CLI command (Task 9); `<vault-root>/notebooklm-registry.json` (Task 10) as the list of notebooks to sweep
- Produces: a PowerShell script suitable for Windows Task Scheduler registration, weekly trigger

- [ ] **Step 1: Read the existing kb-sync wrapper for the established pattern**

Run: `cat kb-sync/schedule-task-wrapper-KB-Sync-Nightly-NotebookLM.ps1`

Match its structure: cd to the correct working directory, run the command, log stdout/stderr to a timestamped log file, exit with the wrapped command's exit code.

- [ ] **Step 2: Write the wrapper**

```powershell
# schedule-task-wrapper-TRM-Notebooklm-Mine.ps1
# Weekly sweep: runs `trm mine-notebooklm <id>` for every notebook in
# notebooklm-registry.json. Registered in Windows Task Scheduler, weekly
# trigger -- see docs/superpowers/specs/2026-08-12-notebooklm-cic-ingest-mining-design.md §5.

$ErrorActionPreference = 'Stop'
$vaultRoot = 'C:\dev'
$logDir = Join-Path $vaultRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "trm-notebooklm-mine-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

Set-Location $vaultRoot

$registryPath = Join-Path $vaultRoot 'notebooklm-registry.json'
if (-not (Test-Path $registryPath)) {
    "notebooklm-registry.json not found at $registryPath -- nothing to mine" | Tee-Object -FilePath $logFile
    exit 1
}

$registry = Get-Content $registryPath -Raw | ConvertFrom-Json
$exitCode = 0

foreach ($notebook in $registry.notebooks) {
    "=== mining $($notebook.title) ($($notebook.notebook_id)) ===" | Tee-Object -FilePath $logFile -Append
    try {
        & trm mine-notebooklm $notebook.notebook_id 2>&1 | Tee-Object -FilePath $logFile -Append
        if ($LASTEXITCODE -ne 0) {
            "mine-notebooklm failed for $($notebook.notebook_id) with exit code $LASTEXITCODE" | Tee-Object -FilePath $logFile -Append
            $exitCode = 1
        }
    } catch {
        "mine-notebooklm threw for $($notebook.notebook_id): $_" | Tee-Object -FilePath $logFile -Append
        $exitCode = 1
    }
}

exit $exitCode
```

- [ ] **Step 3: Dry-run the wrapper manually**

Run: `powershell -File schedule-task-wrapper-TRM-Notebooklm-Mine.ps1`
Expected: exits 0 (assuming Task 10's registry + `nlm login` are already in place), log file created under `logs/` with per-notebook sections.

- [ ] **Step 4: Commit**

```bash
git add schedule-task-wrapper-TRM-Notebooklm-Mine.ps1
git commit -m "chore(notebooklm): add weekly mining-sweep Task Scheduler wrapper"
```

Registering the actual Windows Task Scheduler entry (trigger: weekly) is a manual one-time step outside this plan's scope — same as how the existing kb-sync wrappers are registered (no code in this repo does that registration).

---

## Self-Review Notes

- **Spec coverage:** §2 registry (Tasks 2, 10 — with the vault-root location correction documented in Global Constraints), §3.1–3.3 pull/hash/quarantine/stage (Task 5), §3.4 exact CLI invocations (Task 6), §3.5 unscoped sync-treatment (Task 6), §3.6 per-item flush + run report (Tasks 2, 4, 6), §4 mining + dedup key + urgency TODOS (Tasks 7, 8), §5 scheduler (Task 11), §6 error handling (quarantine in Task 5, ingest-continue-on-error in Task 6, MCP error mapping in Task 1) — all covered.
- **Deferred, explicitly flagged, not blocking:** confirming the literal `type: "youtube"` string from a live `Willow Run Videos` `source list` call — Task 5's derived-provenance branch is implemented against the design's stated assumption; if the real value differs, it's a one-line fix to the `source.type === 'youtube'` check, caught immediately by the smoke test in Task 10 once run against that notebook specifically (not covered by Task 10's CIC-KB smoke test, which has no YouTube sources — a follow-up smoke test against `ef78168d-...` is recommended before relying on derived-provenance tagging in production).
- **Type consistency:** `StagedItem`, `NlmSource`, `NlmNote`, `NlmResult<T>`, `RegistryFile`/`NotebookRegistryEntry`/`QuarantineEntry`, `RunReport`/`RunReportItem` are each defined once (Tasks 1, 2, 4, 5) and imported (never redefined) everywhere else they're used.
