# TRM `ingest --file` Auto-Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--file <path>` option to `trm ingest` that converts a local `.docx`/`.pdf`/`.txt`/`.md` document to plain text and writes it directly to `sources/raw/SRC-###.txt`, removing the manual unzip/copy step this session had to do by hand.

**Architecture:** A new `convertFileToText()` function dispatches by file extension, with `.docx`/`.pdf` extraction routed through an injectable `FileConverters` interface (mirroring the existing `ClaudeCliExec` injectable pattern in `src/extraction/claudeCodeRunner.ts`) so unit tests never need real binary docx/pdf fixtures. `runIngest` becomes async, gains a `file?: string` arg, and — when given — converts the file, registers the source via existing `addSource()`, then writes the converted text to the source's raw-text path itself.

**Tech Stack:** TypeScript, `mammoth@1.12.0` (docx), `pdf-parse@2.4.5` (PDF), existing trm Jest test runner.

## Global Constraints

- `convertFileToText(filePath: string, converters?: FileConverters): Promise<string>` dispatches on extension: `.txt`/`.md` read as-is, `.docx` via injected `extractDocx`, `.pdf` via injected `extractPdf`; unsupported extension throws naming the file's extension and the four supported ones (spec §Architecture).
- Empty/whitespace-only extracted text throws an error naming the file, before `addSource` is ever called (spec §Error Handling).
- `runIngest`'s CLI-level `url` argument becomes optional; when omitted with `--file` given, resolves to `local:<basename>` — `SourceEntry.url`'s type/schema stays a required `string`, only the CLI argument is optional (spec §CLI wiring).
- Neither `url` nor `--file` provided → throw `"trm ingest: either <url> or --file must be provided"` (spec §runIngest changes).
- Dry-run check runs first, before any conversion/addSource/write — unchanged from today's `ingest.ts` ordering (spec §Dry-run ordering, an intentional accepted tradeoff, not a gap).
- `addSource` (mutating) runs before the raw-file write; a subsequent write failure is accepted as non-fatal since `extract.ts:32` already tolerates a missing raw file for a registered source (spec §addSource-before-write ordering).
- CLI action handler must be `async` and `await` `runIngest` — Commander does not await non-async handlers (spec §CLI wiring).
- No changes to `metadata.schema.json` or `SourceEntry`'s type shape.

---

### Task 1: `convertFileToText()` with injectable converters

**Files:**
- Create: `C:\dev\trm\src\ingestion\fileConvert.ts`
- Test: `C:\dev\trm\tests\ingestion\fileConvert.test.ts`

**Interfaces:**
- Produces: `FileConverters` interface and `convertFileToText(filePath: string, converters?: FileConverters): Promise<string>` from `src/ingestion/fileConvert.ts` — consumed by Task 2 (`runIngest`).

- [ ] **Step 1: Install dependencies**

Run: `cd C:\dev\trm && npm install mammoth@1.12.0 pdf-parse@2.4.5`
Expected: `package.json` `dependencies` gains both entries; no `@types/*` packages needed (both ship their own `.d.ts`).

- [ ] **Step 2: Write the failing tests**

```typescript
// C:\dev\trm\tests\ingestion\fileConvert.test.ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { convertFileToText, FileConverters } from '../../src/ingestion/fileConvert';

function makeFile(name: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-fileconvert-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}

const fakeConverters: FileConverters = {
  extractDocx: async () => 'docx extracted text',
  extractPdf: async () => 'pdf extracted text',
};

describe('convertFileToText', () => {
  it('reads a .txt file as-is', async () => {
    const file = makeFile('note.txt', 'plain text content');
    const text = await convertFileToText(file);
    expect(text).toBe('plain text content');
  });

  it('reads a .md file as-is', async () => {
    const file = makeFile('note.md', '# Heading\n\nBody text');
    const text = await convertFileToText(file);
    expect(text).toBe('# Heading\n\nBody text');
  });

  it('routes .docx through the injected extractDocx converter', async () => {
    const file = makeFile('doc.docx', 'ignored binary placeholder');
    const text = await convertFileToText(file, fakeConverters);
    expect(text).toBe('docx extracted text');
  });

  it('routes .pdf through the injected extractPdf converter', async () => {
    const file = makeFile('doc.pdf', 'ignored binary placeholder');
    const text = await convertFileToText(file, fakeConverters);
    expect(text).toBe('pdf extracted text');
  });

  it('throws on an unsupported extension, naming the extension and supported list', async () => {
    const file = makeFile('image.png', 'binary placeholder');
    await expect(convertFileToText(file)).rejects.toThrow(/\.png.*\.txt.*\.md.*\.docx.*\.pdf/s);
  });

  it('throws when the extracted text is empty', async () => {
    const file = makeFile('empty.docx', 'ignored binary placeholder');
    const emptyConverters: FileConverters = { extractDocx: async () => '   ', extractPdf: async () => '' };
    await expect(convertFileToText(file, emptyConverters)).rejects.toThrow(/no extractable text/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd C:\dev\trm && npx jest tests/ingestion/fileConvert.test.ts`
Expected: FAIL — `Cannot find module '../../src/ingestion/fileConvert'`

- [ ] **Step 4: Write the implementation**

```typescript
// C:\dev\trm\src\ingestion\fileConvert.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export interface FileConverters {
  extractDocx: (filePath: string) => Promise<string>;
  extractPdf: (buffer: Buffer) => Promise<string>;
}

const defaultConverters: FileConverters = {
  extractDocx: async (filePath) => (await mammoth.extractRawText({ path: filePath })).value,
  extractPdf: async (buffer) => (await pdfParse(buffer)).text,
};

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx', '.pdf'];

export async function convertFileToText(
  filePath: string,
  converters: FileConverters = defaultConverters
): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  let text: string;

  if (ext === '.txt' || ext === '.md') {
    text = fs.readFileSync(filePath, 'utf-8');
  } else if (ext === '.docx') {
    text = await converters.extractDocx(filePath);
  } else if (ext === '.pdf') {
    text = await converters.extractPdf(fs.readFileSync(filePath));
  } else {
    throw new Error(
      `trm ingest --file: unsupported file extension "${ext}" (supported: ${SUPPORTED_EXTENSIONS.join(', ')})`
    );
  }

  if (text.trim().length === 0) {
    throw new Error(`trm ingest --file: "${filePath}" produced no extractable text`);
  }

  return text;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd C:\dev\trm && npx jest tests/ingestion/fileConvert.test.ts`
Expected: PASS, 6/6

- [ ] **Step 6: Typecheck**

Run: `cd C:\dev\trm && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd C:\dev\trm
git add package.json package-lock.json src/ingestion/fileConvert.ts tests/ingestion/fileConvert.test.ts
git commit -m "feat: add convertFileToText for docx/pdf/txt/md ingestion"
```

---

### Task 2: `runIngest` + CLI wiring

**Files:**
- Modify: `C:\dev\trm\src\cli\commands\ingest.ts`
- Modify: `C:\dev\trm\src\cli\index.ts` (ingest command registration)
- Test: `C:\dev\trm\tests\cli\ingest.test.ts` (extend existing file)

**Interfaces:**
- Consumes: `convertFileToText(filePath, converters?)` (Task 1).
- Produces: updated `runIngest(root, topicPath, cliArgs): Promise<SourceEntry | null>` signature — consumed by `cli/index.ts`.

- [ ] **Step 1: Write the failing tests (append to existing file)**

Read the current `C:\dev\trm\tests\cli\ingest.test.ts` first — it already has two `it` blocks (`ingests a source and marks the node active`, `dry-run writes nothing`) using a `makeRoot()` helper and calling `runIngest(root, 'cuba', {...})` synchronously. Update the existing calls to `await runIngest(...)` (the function is now async) and add these new cases in the same `describe('runIngest', ...)` block:

```typescript
  it('with --file and no url, writes the converted text to sources/raw/SRC-001.txt and derives a local: url', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const filePath = path.join(root, 'doc.txt');
    fs.writeFileSync(filePath, 'Converted file content.', 'utf-8');

    const entry = await runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Overview', origin: 'LOC', file: filePath });

    expect(entry?.url).toBe('local:doc.txt');
    const rawPath = path.join(root, 'topics', 'cuba', 'sources', 'raw', 'SRC-001.txt');
    expect(fs.existsSync(rawPath)).toBe(true);
    expect(fs.readFileSync(rawPath, 'utf-8')).toBe('Converted file content.');
  });

  it('with --file AND an explicit url, the explicit url wins', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const filePath = path.join(root, 'doc.txt');
    fs.writeFileSync(filePath, 'Content.', 'utf-8');

    const entry = await runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Overview', origin: 'LOC', url: 'https://example.com/real', file: filePath });

    expect(entry?.url).toBe('https://example.com/real');
  });

  it('throws when neither url nor file is provided', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    await expect(
      runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Overview', origin: 'LOC' })
    ).rejects.toThrow(/either.*url.*--file/i);
  });

  it('dry-run with --file writes nothing (no raw file, no metadata)', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const filePath = path.join(root, 'doc.txt');
    fs.writeFileSync(filePath, 'Content.', 'utf-8');

    const entry = await runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Overview', origin: 'LOC', file: filePath, dryRun: true });

    expect(entry).toBeNull();
    expect(fs.existsSync(path.join(root, 'topics', 'cuba', 'sources', 'metadata.json'))).toBe(false);
  });
```

Also add `import * as fs from 'node:fs';` and `import * as path from 'node:path';` to the top of the test file if not already present (check first — the file may already import these).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd C:\dev\trm && npx jest tests/cli/ingest.test.ts`
Expected: FAIL — `runIngest(...)` currently returns `SourceEntry | null` synchronously with no `file` handling; new assertions on `.url`/`local:` behavior and the throw case fail; the two pre-existing tests may also fail once you change their calls to `await` a still-synchronous function, until Step 4 lands.

- [ ] **Step 3: Update `src/cli/commands/ingest.ts`**

Replace its entire contents with:

```typescript
// C:\dev\trm\src\cli\commands\ingest.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SourceEntry } from '../../core/sourceIngest';
import { addSource } from '../../core/sourceIngest';
import { resolveActor } from '../../registry/actorRegistry';
import { nodeDir } from '../../core/paths';
import { convertFileToText } from '../../ingestion/fileConvert';

export async function runIngest(
  root: string,
  topicPath: string,
  cliArgs: { actor?: string; type: string; title: string; origin: string; url?: string; file?: string; dryRun?: boolean }
): Promise<SourceEntry | null> {
  const actor = resolveActor(root, cliArgs.actor);
  if (cliArgs.dryRun) return null;

  const url = cliArgs.url ?? (cliArgs.file ? `local:${path.basename(cliArgs.file)}` : undefined);
  if (!url) {
    throw new Error('trm ingest: either <url> or --file must be provided');
  }

  const entry = addSource(root, topicPath, actor, { type: cliArgs.type, title: cliArgs.title, origin: cliArgs.origin, url });

  if (cliArgs.file) {
    const text = await convertFileToText(cliArgs.file);
    const rawPath = path.join(nodeDir(root, topicPath), 'sources', 'raw', `${entry.id}.txt`);
    fs.writeFileSync(rawPath, text);
  }

  return entry;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:\dev\trm && npx jest tests/cli/ingest.test.ts`
Expected: PASS, 6/6 (2 pre-existing + 4 new)

- [ ] **Step 5: Wire into `cli/index.ts`**

Change the top of the file from:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { runCreate } from './commands/create';
import { runIngest } from './commands/ingest';
```

to (unchanged — the import line stays the same; only the command registration below changes).

Find the existing `ingest` command block (around `src/cli/index.ts:28-37`):

```typescript
program
  .command('ingest <path> <url>')
  .requiredOption('--type <type>')
  .requiredOption('--title <title>')
  .requiredOption('--origin <origin>')
  .option('--actor <actor>')
  .option('--dry-run')
  .action((path, url, opts) => {
    const entry = runIngest(root, path, { ...opts, url, dryRun: opts.dryRun });
    console.log(entry ? JSON.stringify(entry, null, 2) : '(dry-run, nothing written)');
  });
```

Replace it with:

```typescript
program
  .command('ingest <path> [url]')
  .requiredOption('--type <type>')
  .requiredOption('--title <title>')
  .requiredOption('--origin <origin>')
  .option('--actor <actor>')
  .option('--file <file>')
  .option('--dry-run')
  .action(async (path, url, opts) => {
    const entry = await runIngest(root, path, { ...opts, url, file: opts.file, dryRun: opts.dryRun });
    console.log(entry ? JSON.stringify(entry, null, 2) : '(dry-run, nothing written)');
  });
```

- [ ] **Step 6: Full test suite passes**

Run: `cd C:\dev\trm && npx jest`
Expected: PASS, all suites (26 pre-existing + 2 new = 28 suites), 0 failures

- [ ] **Step 7: Typecheck**

Run: `cd C:\dev\trm && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Build**

Run: `cd C:\dev\trm && npx tsc`
Expected: no errors, `dist/ingestion/fileConvert.js` produced

- [ ] **Step 9: Live smoke test — re-ingest the real museum doc through the new flag**

The Michigan Flight Museum photo log from this session is at `C:\Users\soren\trm-vault\topics\charlie\willow-run\sources\raw\MFM_Sorensen_Photo_Log_FINAL.docx` (already ingested once manually as `SRC-001`). Prove the new flag on a *fresh* topic so it doesn't collide with the existing `SRC-001`:

```bash
cd /c/Users/soren/trm-vault
export TRM_ACTOR=ACTOR-001
node C:/dev/trm/dist/cli/index.js create charlie/willow-run-filetest
node C:/dev/trm/dist/cli/index.js ingest charlie/willow-run-filetest --type catalog --title "MFM Photo Log (auto-converted)" --origin "Michigan Flight Museum" --file "C:/Users/soren/trm-vault/topics/charlie/willow-run/sources/raw/MFM_Sorensen_Photo_Log_FINAL.docx"
```
Expected: exits 0, prints a `SourceEntry` JSON with `url: "local:MFM_Sorensen_Photo_Log_FINAL.docx"`.

```bash
cat "C:/Users/soren/trm-vault/topics/charlie/willow-run-filetest/sources/raw/SRC-001.txt" | head -5
```
Expected: real extracted text starting with `Michigan Flight Museum — Sorensen Photo Archive Log` (matching the manually-extracted text from this session), not empty and not garbled.

Clean up the throwaway test topic afterward:
```bash
rm -rf "C:/Users/soren/trm-vault/topics/charlie/willow-run-filetest"
```

- [ ] **Step 10: Commit**

```bash
cd C:\dev\trm
git add src/cli/commands/ingest.ts src/cli/index.ts tests/cli/ingest.test.ts
git commit -m "feat: wire --file auto-conversion into trm ingest CLI"
```

---

## Self-Review Notes

- **Spec coverage:** §Architecture (`convertFileToText`, injectable converters, unsupported-extension error, empty-content guard) → Task 1. §runIngest changes (async signature, `local:` derivation, either-url-or-file error, addSource-before-write ordering) → Task 2. §Dry-run ordering → Task 2 Step 1's dry-run test case. §CLI wiring (optional url positional, async action handler) → Task 2 Step 5. §Testing (unit + live smoke) → Task 1 Step 2, Task 2 Step 1, Task 2 Step 9.
- **Placeholder scan:** none — all code blocks are complete; the existing `ingest.test.ts` content isn't reproduced in full (only the new cases plus the "read it first" instruction), which is intentional since Task 2 Step 1 explicitly tells the implementer to read the real file before editing it, not to guess its contents.
- **Type consistency:** `FileConverters`/`convertFileToText` signature from Task 1 matches its only call site in Task 2's `runIngest`; `runIngest`'s new `Promise<SourceEntry | null>` return type is threaded consistently into the `async` CLI action handler in Task 2 Step 5.
