# TRM Harvester Mock Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `trm ingest --file <image>` produce a mock-flagged, structured source entry by vendoring cic-ingestion's mock `ReverseImageSearchExtractor` into TRM, in-process — validating the ingest pipeline shape end-to-end before any real vision capability exists.

**Architecture:** Vendor two small files from `cic-ingestion` into a new `trm/src/ingestion/imageExtract/` directory, add an `extractImage()` wrapper, then extend `trm ingest --file`'s existing extension-dispatch (currently in `fileConvert.ts`) so image extensions route to the new extractor instead of `convertFileToText`, writing a `.json` source file (carrying a `mock` flag) instead of `.txt`. Finally, add one non-blocking WARN check to `trm validate` for any mock-flagged source.

**Tech Stack:** TypeScript (strict, CommonJS), Jest + ts-jest, Node `fs`/`path`. No new dependencies.

## Global Constraints

- Repo root: `c:\dev\trm`. All paths below are relative to it unless stated otherwise.
- Vendored files carry a header comment identifying them as sourced from `cic-ingestion`, mock-only, with a pointer to the design spec: `docs/meta/specs/2026-07-18-trm-harvester-mock-wiring-design.md`.
- `extractImage()` must be called **before** `addSource()` in `ingest.ts`, matching the existing docx/pdf `--file` ordering — a failed extraction must never register an orphaned source (this is the exact bug class fixed for `--file` in the prior `trm ingest --file` PR).
- Object spread order for the mock wrapper is `{ ...result, mock: X }` (flag last) — never `{ mock: X, ...result }`.
- Test files live under `tests/` mirroring `src/` (e.g. `src/ingestion/imageExtract/index.ts` → `tests/ingestion/imageExtract/index.test.ts`), matching this repo's existing convention. Run via `npm test` (Jest).
- `tsconfig.json` has `strict: true` — all vendored/new code must type-check cleanly under strict mode.

---

## File Structure

- **Create** `src/ingestion/imageExtract/IExtractor.ts` — vendored base class, unmodified except header comment.
- **Create** `src/ingestion/imageExtract/ReverseImageSearchExtractor.ts` — vendored extractor, header comment added, `log` import replaced with a local one-line stub (cic-ingestion's `log` lives in `../lib/logger`, a file this plan does not vendor — inlining avoids a third vendored file for one function).
- **Create** `src/ingestion/imageExtract/index.ts` — new `extractImage(filePath): Promise<ExtractionResult>` wrapper: reads the file into a `Buffer`, calls the vendored extractor, returns its result.
- **Create** `tests/ingestion/imageExtract/index.test.ts` — unit tests for `extractImage()`.
- **Modify** `src/ingestion/fileConvert.ts` — no functional change to this file itself; the image-extension short-circuit lives in `ingest.ts` (see below), checked *before* `convertFileToText` is called, so `SUPPORTED_EXTENSIONS` here stays docx/pdf/txt/md only.
- **Modify** `src/cli/commands/ingest.ts` — add image-extension detection and the extract → wrap → write-JSON branch.
- **Modify** `tests/cli/ingest.test.ts` — add image-path test cases; fix the existing test at line 86-98 (`'a failing --file conversion does not register an orphaned source'`) which currently uses `image.png` as its example of an *unsupported* extension — after this plan, `.png` becomes supported via the new image path, so that test must switch to a genuinely unsupported extension (`.xyz`) to keep testing what it says it tests.
- **Modify** `src/cli/commands/validate.ts` — add `warnings: string[]` to `ValidationReport` and a new check for mock-flagged image sources.
- **Modify** `tests/cli/validate.test.ts` — add a test for the new WARN check.

---

## Task 1: Vendor the extractor and add the `extractImage()` wrapper

**Files:**
- Create: `src/ingestion/imageExtract/IExtractor.ts`
- Create: `src/ingestion/imageExtract/ReverseImageSearchExtractor.ts`
- Create: `src/ingestion/imageExtract/index.ts`
- Test: `tests/ingestion/imageExtract/index.test.ts`

**Interfaces:**
- Produces: `extractImage(filePath: string): Promise<ExtractionResult>` — used by Task 2's `ingest.ts` branch.
- Produces (re-exported from `index.ts` for Task 2/3 imports): `ExtractionResult`, `ImageMatch` interfaces (same shape as cic-ingestion's originals).

- [ ] **Step 1: Create `IExtractor.ts`**

```typescript
// src/ingestion/imageExtract/IExtractor.ts
// Vendored from cic-ingestion/src/extractors/IExtractor.ts. Mock-only stub —
// see docs/meta/specs/2026-07-18-trm-harvester-mock-wiring-design.md for the
// real-vision migration plan.

export class IExtractor {
  async extract(input: any): Promise<any> {
    throw new Error("not implemented");
  }
}
```

- [ ] **Step 2: Create `ReverseImageSearchExtractor.ts`**

```typescript
// src/ingestion/imageExtract/ReverseImageSearchExtractor.ts
// Vendored from cic-ingestion/src/extractors/ReverseImageSearchExtractor.ts.
// Mock-only stub — see
// docs/meta/specs/2026-07-18-trm-harvester-mock-wiring-design.md for the
// real-vision migration plan.

import { IExtractor } from "./IExtractor";

const log = (...args: any[]) => console.log("[trm-image-extract]", ...args);

export interface ImageMatch {
  url: string;
  similarity: number; // 0-100
  source: string;
}

export interface ExtractionResult {
  matches: ImageMatch[];
  metadata: {
    format: string;
    size: number;
    processedAt: string;
    visionApiUsed: boolean;
    error?: string;
  };
}

const VALID_FORMATS = ["jpeg", "jpg", "png", "webp", "gif"];

/**
 * ReverseImageSearchExtractor: Analyzes images and returns potential matches.
 * Uses Vision API if available, otherwise returns mock results.
 */
export class ReverseImageSearchExtractor extends IExtractor {
  private visionApiKey: string | undefined;

  constructor(apiKey?: string) {
    super();
    this.visionApiKey = apiKey || process.env.VISION_API_KEY;
  }

  async extract(imageBuffer: any): Promise<ExtractionResult> {
    const startTime = Date.now();
    log('ReverseImageSearchExtractor.extract() starting');

    try {
      if (!imageBuffer) {
        return this._createErrorResult("Image buffer is required");
      }

      const buffer = this._normalizeBuffer(imageBuffer);
      if (!buffer) {
        return this._createErrorResult("Invalid image buffer format");
      }

      const format = this._detectFormat(buffer);
      if (!format) {
        return this._createErrorResult(
          `Unsupported image format. Supported: ${VALID_FORMATS.join(", ")}`
        );
      }

      if (this.visionApiKey) {
        try {
          const apiResults = await this._callVisionApi(buffer, format);
          const extractionTime = Date.now() - startTime;
          log('ReverseImageSearchExtractor.extract() completed via Vision API. Time:', extractionTime, 'ms');
          return {
            matches: apiResults,
            metadata: {
              format,
              size: buffer.length,
              processedAt: new Date().toISOString(),
              visionApiUsed: true,
            },
          };
        } catch (apiError) {
          log("ReverseImageSearchExtractor: Vision API call failed, using mock results", apiError);
        }
      }

      const result = this._generateMockResults(buffer, format);
      const extractionTime = Date.now() - startTime;
      log('ReverseImageSearchExtractor.extract() completed with mock results. Time:', extractionTime, 'ms');
      return result;
    } catch (error) {
      log('ReverseImageSearchExtractor.extract() failed:', error);
      return this._createErrorResult(`Extraction failed: ${(error as Error).message}`);
    }
  }

  private _normalizeBuffer(input: any): Buffer | null {
    if (Buffer.isBuffer(input)) {
      return input;
    }
    if (typeof input === "string") {
      try {
        return Buffer.from(input, "base64");
      } catch {
        return null;
      }
    }
    if (input instanceof Uint8Array) {
      return Buffer.from(input);
    }
    return null;
  }

  private _detectFormat(buffer: Buffer): string | null {
    if (buffer.length < 4) return null;

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "jpeg";
    }

    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return "png";
    }

    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return "gif";
    }

    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      if (buffer.length >= 12 && buffer.subarray(8, 12).toString() === "WEBP") {
        return "webp";
      }
    }

    return null;
  }

  private async _callVisionApi(
    buffer: Buffer,
    format: string
  ): Promise<ImageMatch[]> {
    if (!this.visionApiKey) {
      throw new Error("Vision API key not configured");
    }

    return [
      {
        url: "https://example.com/similar-image-1",
        similarity: 95,
        source: "vision-api",
      },
      {
        url: "https://example.com/similar-image-2",
        similarity: 87,
        source: "vision-api",
      },
    ];
  }

  private _generateMockResults(buffer: Buffer, format: string): ExtractionResult {
    const hash = this._simpleHash(buffer);
    const baseMatch = 75 + (hash % 20);

    return {
      matches: [
        {
          url: `https://mock.example.com/image-${hash}`,
          similarity: baseMatch,
          source: "mock-reverse-search",
        },
        {
          url: `https://mock.example.com/similar-${hash + 1}`,
          similarity: Math.max(50, baseMatch - 15),
          source: "mock-reverse-search",
        },
      ],
      metadata: {
        format,
        size: buffer.length,
        processedAt: new Date().toISOString(),
        visionApiUsed: false,
      },
    };
  }

  private _simpleHash(buffer: Buffer): number {
    let hash = 0;
    for (let i = 0; i < Math.min(100, buffer.length); i++) {
      hash = (hash << 5) - hash + buffer[i];
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private _createErrorResult(error: string): ExtractionResult {
    return {
      matches: [],
      metadata: {
        format: "unknown",
        size: 0,
        processedAt: new Date().toISOString(),
        visionApiUsed: false,
        error,
      },
    };
  }
}
```

- [ ] **Step 3: Write the failing test for `extractImage()`**

```typescript
// tests/ingestion/imageExtract/index.test.ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractImage } from '../../../src/ingestion/imageExtract';

// Minimal valid 1x1 PNG (magic bytes + IHDR stub is enough for _detectFormat).
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makeImageFile(name: string, content: Buffer): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-imageextract-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

describe('extractImage', () => {
  it('reads a PNG file and returns mock ExtractionResult with visionApiUsed false', async () => {
    const file = makeImageFile('photo.png', PNG_MAGIC);
    const result = await extractImage(file);

    expect(result.metadata.format).toBe('png');
    expect(result.metadata.visionApiUsed).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].url).toMatch(/^https:\/\/mock\.example\.com\//);
  });

  it('returns an error result (not a throw) for an unrecognized image format', async () => {
    const file = makeImageFile('bad.png', Buffer.from('not an image'));
    const result = await extractImage(file);

    expect(result.matches).toEqual([]);
    expect(result.metadata.error).toMatch(/unsupported/i);
  });

  it('throws when the file path does not exist', async () => {
    await expect(extractImage('/nonexistent/path/photo.png')).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest tests/ingestion/imageExtract/index.test.ts`
Expected: FAIL — `Cannot find module '../../../src/ingestion/imageExtract'`

- [ ] **Step 5: Create `index.ts`**

```typescript
// src/ingestion/imageExtract/index.ts
import * as fs from 'node:fs';
import { ReverseImageSearchExtractor, ExtractionResult, ImageMatch } from './ReverseImageSearchExtractor';

export { ExtractionResult, ImageMatch };

export async function extractImage(filePath: string): Promise<ExtractionResult> {
  const buffer = fs.readFileSync(filePath);
  const extractor = new ReverseImageSearchExtractor();
  return extractor.extract(buffer);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest tests/ingestion/imageExtract/index.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/ingestion/imageExtract/ tests/ingestion/imageExtract/
git commit -m "feat: vendor mock ReverseImageSearchExtractor into TRM

Vendored from cic-ingestion for the Harvester mock-wiring stage. See
docs/meta/specs/2026-07-18-trm-harvester-mock-wiring-design.md."
```

---

## Task 2: Route `trm ingest --file` to the image extractor

**Files:**
- Modify: `src/cli/commands/ingest.ts`
- Test: `tests/cli/ingest.test.ts`

**Interfaces:**
- Consumes: `extractImage(filePath: string): Promise<ExtractionResult>` and `ExtractionResult` from Task 1's `src/ingestion/imageExtract/index.ts`.
- Consumes: `convertFileToText(filePath: string): Promise<string>` from `src/ingestion/fileConvert.ts` (existing, unchanged).
- Consumes: `addSource(root, topicPath, actor, entry): SourceEntry` from `src/core/sourceIngest.ts` (existing, unchanged).
- Consumes: `nodeDir(root, topicPath): string` from `src/core/paths.ts` (existing, unchanged).

- [ ] **Step 1: Write the failing tests**

Add to `tests/cli/ingest.test.ts` (append inside the existing `describe('runIngest', ...)` block, after the last existing test):

```typescript
  it('with --file pointing at a .png, writes an ExtractionResult JSON (not .txt) and flags mock: true', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const filePath = path.join(root, 'photo.png');
    fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    const entry = await runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'image', title: 'Photo', origin: 'LOC', file: filePath });

    expect(entry?.url).toBe('local:photo.png');
    const jsonPath = path.join(root, 'topics', 'cuba', 'sources', 'raw', 'SRC-001.json');
    expect(fs.existsSync(jsonPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    expect(written.mock).toBe(true);
    expect(written.metadata.visionApiUsed).toBe(false);
    expect(Array.isArray(written.matches)).toBe(true);

    const txtPath = path.join(root, 'topics', 'cuba', 'sources', 'raw', 'SRC-001.txt');
    expect(fs.existsSync(txtPath)).toBe(false);
  });

  it('recognizes .jpg, .jpeg, .webp, .gif as image extensions too', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    for (const ext of ['jpg', 'jpeg', 'webp', 'gif']) {
      const filePath = path.join(root, `photo.${ext}`);
      fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const entry = await runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'image', title: 'Photo', origin: 'LOC', file: filePath });
      const jsonPath = path.join(root, 'topics', 'cuba', 'sources', 'raw', `${entry?.id}.json`);
      expect(fs.existsSync(jsonPath)).toBe(true);
    }
  });

  it('a corrupt/unrecognized image writes an error-flagged JSON, does not throw', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const filePath = path.join(root, 'corrupt.png');
    fs.writeFileSync(filePath, 'not actually image bytes', 'utf-8');

    const entry = await runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'image', title: 'Photo', origin: 'LOC', file: filePath });

    expect(entry?.id).toBe('SRC-001');
    const jsonPath = path.join(root, 'topics', 'cuba', 'sources', 'raw', 'SRC-001.json');
    expect(fs.existsSync(jsonPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    expect(written.mock).toBe(true);
    expect(written.matches).toEqual([]);
    expect(written.metadata.error).toMatch(/unsupported/i);
  });

  it('a failing image extraction does not register an orphaned source', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const filePath = path.join(root, 'ghost.png');
    // File path does not exist -> extractImage() throws before addSource() runs.
    fs.rmSync(filePath, { force: true });

    await expect(
      runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'image', title: 'Photo', origin: 'LOC', file: filePath })
    ).rejects.toThrow();

    const metadataPath = path.join(root, 'topics', 'cuba', 'sources', 'metadata.json');
    expect(fs.existsSync(metadataPath)).toBe(false);
  });
```

Also **fix** the pre-existing test `'a failing --file conversion does not register an orphaned source'` (currently at line ~86-98) — it uses `image.png` as an example of an unsupported extension, which stops being true once this task ships. Change the extension to a genuinely unsupported one:

```typescript
  it('a failing --file conversion does not register an orphaned source', async () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const filePath = path.join(root, 'file.xyz');
    fs.writeFileSync(filePath, 'not a real format', 'utf-8');

    await expect(
      runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Overview', origin: 'LOC', file: filePath })
    ).rejects.toThrow(/unsupported/i);

    const metadataPath = path.join(root, 'topics', 'cuba', 'sources', 'metadata.json');
    expect(fs.existsSync(metadataPath)).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest tests/cli/ingest.test.ts`
Expected: the 4 new tests FAIL (image files currently reach `convertFileToText` and throw "unsupported file extension"); the fixed `.xyz` test should already PASS unchanged (it exercises existing behavior).

- [ ] **Step 3: Implement the image-routing branch in `ingest.ts`**

Replace the full contents of `src/cli/commands/ingest.ts`:

```typescript
// C:\dev\trm\src\cli\commands\ingest.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SourceEntry } from '../../core/sourceIngest';
import { addSource } from '../../core/sourceIngest';
import { resolveActor } from '../../registry/actorRegistry';
import { nodeDir } from '../../core/paths';
import { convertFileToText } from '../../ingestion/fileConvert';
import { extractImage } from '../../ingestion/imageExtract';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export async function runIngest(
  root: string,
  topicPath: string,
  cliArgs: { actor?: string; type: string; title: string; origin: string; url?: string; file?: string; dryRun?: boolean }
): Promise<SourceEntry | null> {
  const actor = resolveActor(root, cliArgs.actor);
  if (cliArgs.dryRun) return null;

  const url = cliArgs.url || (cliArgs.file ? `local:${path.basename(cliArgs.file)}` : undefined);
  if (!url) {
    throw new Error('trm ingest: either <url> or --file must be provided');
  }

  const isImage = cliArgs.file ? IMAGE_EXTENSIONS.has(path.extname(cliArgs.file).toLowerCase()) : false;

  let text: string | undefined;
  let imageJson: string | undefined;

  if (cliArgs.file && isImage) {
    const result = await extractImage(cliArgs.file);
    const wrapped = { ...result, mock: !result.metadata.visionApiUsed };
    imageJson = JSON.stringify(wrapped, null, 2);
  } else if (cliArgs.file) {
    text = await convertFileToText(cliArgs.file);
  }

  const entry = addSource(root, topicPath, actor, { type: cliArgs.type, title: cliArgs.title, origin: cliArgs.origin, url });

  if (imageJson !== undefined) {
    const rawPath = path.join(nodeDir(root, topicPath), 'sources', 'raw', `${entry.id}.json`);
    fs.writeFileSync(rawPath, imageJson);
  } else if (text !== undefined) {
    const rawPath = path.join(nodeDir(root, topicPath), 'sources', 'raw', `${entry.id}.txt`);
    fs.writeFileSync(rawPath, text);
  }

  return entry;
}
```

Note the extract-then-register ordering: `extractImage()` (or `convertFileToText()`) runs and can throw *before* `addSource()` is called — matching the Global Constraints ordering rule.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/cli/ingest.test.ts`
Expected: PASS (all tests, including the fixed `.xyz` test and the 4 new image tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/ingest.ts tests/cli/ingest.test.ts
git commit -m "feat: route trm ingest --file images to the mock extractor

Image extensions (jpg/jpeg/png/webp/gif) now produce a mock: true JSON
source instead of failing as unsupported. Extract-before-addSource
ordering preserved to avoid orphaned sources on failure."
```

---

## Task 3: Add the `trm validate` WARN check for mock image sources

**Files:**
- Modify: `src/cli/commands/validate.ts`
- Test: `tests/cli/validate.test.ts`

**Interfaces:**
- Consumes: `nodeDir(root, topicPath): string` from `src/core/paths.ts` (existing).
- Modifies: `ValidationReport` interface — adds `warnings: string[]` (additive, non-breaking for existing consumers since `errors`/`valid`/`path` are unchanged).

- [ ] **Step 1: Write the failing test**

Add to `tests/cli/validate.test.ts` (append inside `describe('runValidate', ...)`):

```typescript
  it('warns (but does not fail) when a source JSON is flagged mock: true', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.9, categories: [] }]);
    runScore(root, 'cuba', { actor: 'ACTOR-001' });

    const rawDir = path.join(root, 'topics', 'cuba', 'sources', 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(
      path.join(rawDir, 'SRC-001.json'),
      JSON.stringify({ mock: true, matches: [], metadata: { visionApiUsed: false } })
    );

    const [report] = runValidate(root, 'cuba', {});
    expect(report.valid).toBe(true);
    expect(report.warnings).toContain('SRC-001 is mock image-extraction data, not a verified fact source');
  });

  it('does not warn for a non-mock source JSON', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.9, categories: [] }]);
    runScore(root, 'cuba', { actor: 'ACTOR-001' });

    const rawDir = path.join(root, 'topics', 'cuba', 'sources', 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(
      path.join(rawDir, 'SRC-001.json'),
      JSON.stringify({ mock: false, matches: [], metadata: { visionApiUsed: true } })
    );

    const [report] = runValidate(root, 'cuba', {});
    expect(report.warnings).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/cli/validate.test.ts`
Expected: FAIL — `report.warnings` is `undefined` (property doesn't exist yet)

- [ ] **Step 3: Implement the WARN check**

In `src/cli/commands/validate.ts`, add a new function and wire it into `validateNode`:

```typescript
function checkMockImageSources(root: string, topicPath: string, warnings: string[]): void {
  const rawDir = path.join(nodeDir(root, topicPath), 'sources', 'raw');
  if (!fs.existsSync(rawDir)) return;
  for (const file of fs.readdirSync(rawDir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(rawDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data.mock === true) {
      const sourceId = path.basename(file, '.json');
      warnings.push(`${sourceId} is mock image-extraction data, not a verified fact source`);
    }
  }
}
```

Update `ValidationReport` and `validateNode`:

```typescript
export interface ValidationReport {
  path: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

```typescript
function validateNode(root: string, topicPath: string): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  readTopicMeta(root, topicPath); // throws if node missing

  checkSchema(root, topicPath, 'topic.json', 'topic', errors);
  checkSchema(root, topicPath, path.join('sources', 'metadata.json'), 'metadata', errors);
  checkSchema(root, topicPath, path.join('extracts', 'extract.json'), 'extract', errors);
  checkSchema(root, topicPath, path.join('extracts', 'score.json'), 'score', errors);
  checkSchema(root, topicPath, path.join('crosslinks', 'related_topics.json'), 'related_topics', errors);

  const chainResult = validateChain(root, topicPath);
  if (!chainResult.valid) errors.push(`lineage: ${chainResult.error}`);

  checkScoreNotHandEdited(root, topicPath, errors);
  checkMockImageSources(root, topicPath, warnings);

  return { path: topicPath, valid: errors.length === 0, errors, warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/cli/validate.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all suites PASS (this catches any other consumer of `ValidationReport` that might destructure it positionally rather than by field — none currently exist per the `src/cli/index.ts` check below, but the full run is the actual verification).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/validate.ts tests/cli/validate.test.ts
git commit -m "feat: warn on mock image sources in trm validate

Non-blocking WARN so mock ReverseImageSearchExtractor output never
silently passes as a verified fact source."
```

---

## Final check: run the whole suite once more

- [ ] **Step 1: Full test + typecheck pass**

Run: `npm test && npm run typecheck`
Expected: all suites PASS, no type errors.

- [ ] **Step 2: Manual smoke test**

```bash
npx ts-node src/cli/index.ts create smoke-test --actor ACTOR-001
echo -n "" > /tmp/smoke.png
node -e "require('fs').writeFileSync('/tmp/smoke.png', Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))"
npx ts-node src/cli/index.ts ingest smoke-test --type image --title "Smoke Test" --origin LOC --file /tmp/smoke.png
cat topics/smoke-test/sources/raw/SRC-001.json
npx ts-node src/cli/index.ts validate smoke-test
```

Expected: `SRC-001.json` exists with `"mock": true`; `validate` output JSON includes a `warnings` array containing the mock-source message; `valid: true` (non-blocking).

Clean up the smoke-test topic dir afterward if this repo tracks `topics/` in git (check `.gitignore` first).
