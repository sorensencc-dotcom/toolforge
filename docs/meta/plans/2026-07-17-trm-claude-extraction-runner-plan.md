# TRM Claude Code Extraction Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `trm extract`'s naive `stubRunner` default with a real `claudeCodeRunner` that shells to the `claude` CLI for actual fact extraction, per `docs/meta/specs/2026-07-17-trm-topic-research-module-design.md` §8.

**Architecture:** A new `createClaudeCodeRunner(exec)` factory in `trm/src/extraction/claudeCodeRunner.ts` implements the existing `ExtractionRunner` interface, taking an injectable exec function so no test spawns a real process. It shells to `claude -p <fixed prompt> --output-format json --model sonnet`, piping source text via stdin, parses the JSON envelope, and validates the result against a tightened `extract.schema.json` (categories now a closed enum). `trm extract`'s default flips from `stubRunner` to `claudeCodeRunner`; a new `--stub` flag opts back to the naive splitter for offline/no-cost dev work.

**Tech Stack:** Same as the existing `trm` repo — TypeScript, Jest + ts-jest, `node:child_process.spawnSync` for the CLI shell-out (no new dependencies).

## Global Constraints

- No `--bare` mode — uses whatever auth is already active (subscription/OAuth), never requires a separate API key (spec §8, rejected after testing).
- Category vocabulary is closed: exactly `history`, `genealogy`, `industry`, `geopolitics`, `biography` — enforced by JSON Schema, not just prompt instruction (spec §8).
- Fails hard on any error — non-zero exit, `is_error: true`, malformed JSON, schema-invalid output — no partial writes to `extract.json`/`summary.md`/`lineage.json` (spec §8, matches existing `runScore` fail-hard pattern).
- Determinism is best-effort only for `claudeCodeRunner` — not guaranteed byte-identical across runs, unlike `stubRunner` (spec §8, §7).
- `id`/`source_id` on each fact are assigned by the runner, never trusted from the model's output (avoids hallucinated/colliding IDs).
- All new runner logic must be unit-testable without spawning a real `claude` process (spec §8 "Testability").

---

## File Structure

```
trm/
  src/
    extraction/
      prompts/
        extractFacts.ts        # NEW: buildExtractPrompt(), CATEGORY_VOCAB
      claudeCodeRunner.ts       # NEW: createClaudeCodeRunner(exec), claudeCodeRunner default instance
    cli/
      commands/
        extract.ts              # MODIFY: default runner claudeCodeRunner, add stub flag support
      index.ts                  # MODIFY: add --stub option to extract command
    schemas/
      extract.schema.json       # MODIFY: categories becomes closed enum
  tests/
    extraction/
      extractFacts.test.ts     # NEW
      claudeCodeRunner.test.ts  # NEW
    cli/
      extractWiring.test.ts     # NEW: proves default is claudeCodeRunner via mocked child_process
    schemas/
      validator.test.ts         # MODIFY: add category-enum rejection case
```

---

## Task 1: Tighten `extract.schema.json` to a closed category vocabulary

**Files:**
- Modify: `C:\dev\trm\src\schemas\extract.schema.json`
- Modify: `C:\dev\trm\tests\schemas\validator.test.ts`

**Interfaces:**
- Consumes: nothing new — same `validateAgainstSchema('extract', data)` from `C:\dev\trm\src\schemas\validator.ts` (already exists).
- Produces: schema now rejects any `categories` value outside the 5-word vocabulary. Downstream tasks (2, 3) rely on this to catch model output that ignores the prompt's category instruction.

- [ ] **Step 1: Write the failing test**

Add this test case to the end of the `describe('validateAgainstSchema', ...)` block in `C:\dev\trm\tests\schemas\validator.test.ts` (the file already exists from the base TRM plan; append inside the existing `describe`, don't create a new file):

```ts
  it('rejects an extract.json fact with a category outside the fixed vocabulary', () => {
    const result = validateAgainstSchema('extract', {
      facts: [
        {
          id: 'FCT-001',
          text: 'x',
          source_id: 'SRC-001',
          confidence: 0.5,
          categories: ['not-a-real-category'],
        },
      ],
    });
    expect(result.valid).toBe(false);
  });

  it('accepts an extract.json fact with categories from the fixed vocabulary', () => {
    const result = validateAgainstSchema('extract', {
      facts: [
        {
          id: 'FCT-001',
          text: 'x',
          source_id: 'SRC-001',
          confidence: 0.5,
          categories: ['history', 'genealogy'],
        },
      ],
    });
    expect(result.valid).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/schemas/validator.test.ts
```

Expected: FAIL — the first new test fails because the current schema accepts any string category (it currently has no `enum` restriction).

- [ ] **Step 3: Tighten the schema**

In `C:\dev\trm\src\schemas\extract.schema.json`, replace the `categories` property:

```json
          "categories": { "type": "array", "items": { "type": "string" } }
```

with:

```json
          "categories": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["history", "genealogy", "industry", "geopolitics", "biography"]
            }
          }
```

The full file after this change:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["facts"],
  "additionalProperties": false,
  "properties": {
    "facts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "text", "source_id", "confidence", "categories"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string" },
          "text": { "type": "string" },
          "source_id": { "type": "string" },
          "confidence": { "type": "number" },
          "categories": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["history", "genealogy", "industry", "geopolitics", "biography"]
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/schemas/validator.test.ts
```

Expected: PASS, 6 tests total (4 original + 2 new).

- [ ] **Step 5: Run the full suite to confirm nothing else broke, then commit**

```bash
cd C:/dev/trm
npm test
```

Expected: all suites still pass — `stubRunner` always produces `categories: []`, which satisfies an empty-array enum-of-items check trivially, so nothing downstream breaks.

```bash
cd C:/dev/trm
git add src/schemas/extract.schema.json tests/schemas/validator.test.ts
git commit -m "feat: restrict extract.json categories to fixed 5-word vocabulary"
```

---

## Task 2: Fixed extraction prompt template

**Files:**
- Create: `C:\dev\trm\src\extraction\prompts\extractFacts.ts`
- Test: `C:\dev\trm\tests\extraction\extractFacts.test.ts`

**Interfaces:**
- Produces:
  - `export const CATEGORY_VOCAB: readonly ['history', 'genealogy', 'industry', 'geopolitics', 'biography']`
  - `export function buildExtractPrompt(sourceTitle: string): string`

Task 3 imports `buildExtractPrompt` to build the argument passed to the `claude` CLI.

- [ ] **Step 1: Write the failing test**

`C:\dev\trm\tests\extraction\extractFacts.test.ts`:

```ts
import { buildExtractPrompt, CATEGORY_VOCAB } from '../../src/extraction/prompts/extractFacts';

describe('buildExtractPrompt', () => {
  it('includes the source title', () => {
    const prompt = buildExtractPrompt('Beats 7.3-7.4: Empire of Sand');
    expect(prompt).toContain('Beats 7.3-7.4: Empire of Sand');
  });

  it('includes every category in the fixed vocabulary', () => {
    const prompt = buildExtractPrompt('Some Title');
    for (const category of CATEGORY_VOCAB) {
      expect(prompt).toContain(category);
    }
  });

  it('instructs the model not to include id or source_id fields', () => {
    const prompt = buildExtractPrompt('Some Title');
    expect(prompt).toMatch(/"id"/);
    expect(prompt).toMatch(/"source_id"/);
    expect(prompt).toMatch(/assigned by the caller/);
  });

  it('is deterministic for the same title', () => {
    const a = buildExtractPrompt('Some Title');
    const b = buildExtractPrompt('Some Title');
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/extraction/extractFacts.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the prompt template**

`C:\dev\trm\src\extraction\prompts\extractFacts.ts`:

```ts
export const CATEGORY_VOCAB = ['history', 'genealogy', 'industry', 'geopolitics', 'biography'] as const;

export function buildExtractPrompt(sourceTitle: string): string {
  return `You are extracting discrete factual claims from source text piped via stdin below, for a structured research archive.

Source title: ${sourceTitle}

Return ONLY strict JSON, no prose outside the JSON, in this exact shape:
{"facts": [{"text": "...", "confidence": 0.0, "categories": ["..."]}], "summary": "one paragraph human-readable summary"}

Rules:
- Each fact.text is one discrete, verifiable claim from the source text, in your own concise words or a tight quote.
- fact.confidence is a number 0.0-1.0: how directly the source text supports this exact claim.
- fact.categories is an array of zero or more of exactly these five strings, no others: ${CATEGORY_VOCAB.map((c) => `"${c}"`).join(', ')}. Only include a category if the fact genuinely fits it. Leave the array empty if none apply.
- Do not invent facts not present in the source text.
- Do not include an "id" or "source_id" field on each fact -- those will be assigned by the caller.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/extraction/extractFacts.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/extraction/prompts/extractFacts.ts tests/extraction/extractFacts.test.ts
git commit -m "feat: fixed prompt template for Claude Code extraction"
```

---

## Task 3: `claudeCodeRunner` — real ExtractionRunner implementation

**Files:**
- Create: `C:\dev\trm\src\extraction\claudeCodeRunner.ts`
- Test: `C:\dev\trm\tests\extraction\claudeCodeRunner.test.ts`

**Interfaces:**
- Consumes:
  - `ExtractionRunner` interface from `C:\dev\trm\src\extraction\types.ts` (existing: `run(source: SourceEntry, rawText: string): { facts: Fact[]; summary: string }`)
  - `Fact` type from `C:\dev\trm\src\scoring\types.ts` (existing)
  - `SourceEntry` type from `C:\dev\trm\src\core\sourceIngest.ts` (existing)
  - `validateAgainstSchema` from `C:\dev\trm\src\schemas\validator.ts` (existing, now enforces the category enum per Task 1)
  - `buildExtractPrompt` from `C:\dev\trm\src\extraction\prompts\extractFacts.ts` (Task 2)
- Produces:
  - `export interface ClaudeCliExec { (args: string[], input: string): { stdout: string; status: number | null }; }`
  - `export function createClaudeCodeRunner(exec?: ClaudeCliExec): ExtractionRunner`
  - `export const claudeCodeRunner: ExtractionRunner` (the real, non-injected default instance)

Task 4 imports both `createClaudeCodeRunner` (for the wiring test) and `claudeCodeRunner` (as `extract.ts`'s new default).

- [ ] **Step 1: Write the failing test**

`C:\dev\trm\tests\extraction\claudeCodeRunner.test.ts`:

```ts
import { createClaudeCodeRunner, ClaudeCliExec } from '../../src/extraction/claudeCodeRunner';

const source = { id: 'SRC-001', type: 'text', title: 'Beats 7.3-7.4', origin: 'x', url: 'x', added_at: 't', actor: 'ACTOR-001' };

function envelope(result: string, isError = false): string {
  return JSON.stringify({ type: 'result', is_error: isError, result });
}

describe('createClaudeCodeRunner', () => {
  it('parses a valid envelope into facts with assigned id/source_id', () => {
    const exec: ClaudeCliExec = () => ({
      stdout: envelope(
        JSON.stringify({
          facts: [
            { text: 'Sorensen owned a Cuban estate.', confidence: 0.8, categories: ['history', 'geopolitics'] },
            { text: 'Castro took Havana in 1959.', confidence: 0.95, categories: ['history'] },
          ],
          summary: 'Two facts about the Cuban estate and 1959 expropriation.',
        })
      ),
      status: 0,
    });
    const runner = createClaudeCodeRunner(exec);
    const result = runner.run(source, 'raw text here');

    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toEqual({
      id: 'FCT-001',
      text: 'Sorensen owned a Cuban estate.',
      source_id: 'SRC-001',
      confidence: 0.8,
      categories: ['history', 'geopolitics'],
    });
    expect(result.facts[1].id).toBe('FCT-002');
    expect(result.summary).toBe('Two facts about the Cuban estate and 1959 expropriation.');
  });

  it('passes the built prompt and raw text to exec', () => {
    let capturedArgs: string[] = [];
    let capturedInput = '';
    const exec: ClaudeCliExec = (args, input) => {
      capturedArgs = args;
      capturedInput = input;
      return { stdout: envelope(JSON.stringify({ facts: [], summary: 'empty' })), status: 0 };
    };
    const runner = createClaudeCodeRunner(exec);
    runner.run(source, 'the raw source text');

    expect(capturedArgs).toContain('-p');
    expect(capturedArgs).toContain('--output-format');
    expect(capturedArgs).toContain('json');
    expect(capturedArgs.some((a) => a.includes('Beats 7.3-7.4'))).toBe(true);
    expect(capturedInput).toBe('the raw source text');
  });

  it('throws on non-zero exit status', () => {
    const exec: ClaudeCliExec = () => ({ stdout: '', status: 1 });
    const runner = createClaudeCodeRunner(exec);
    expect(() => runner.run(source, 'raw text')).toThrow(/status 1/);
  });

  it('throws when the envelope is not valid JSON', () => {
    const exec: ClaudeCliExec = () => ({ stdout: 'not json', status: 0 });
    const runner = createClaudeCodeRunner(exec);
    expect(() => runner.run(source, 'raw text')).toThrow(/not valid JSON/);
  });

  it('throws when is_error is true', () => {
    const exec: ClaudeCliExec = () => ({ stdout: envelope('quota exceeded', true), status: 0 });
    const runner = createClaudeCodeRunner(exec);
    expect(() => runner.run(source, 'raw text')).toThrow(/quota exceeded/);
  });

  it('throws when result is not valid JSON', () => {
    const exec: ClaudeCliExec = () => ({ stdout: envelope('not json facts'), status: 0 });
    const runner = createClaudeCodeRunner(exec);
    expect(() => runner.run(source, 'raw text')).toThrow(/result was not valid JSON/);
  });

  it('throws when a fact has a category outside the fixed vocabulary', () => {
    const exec: ClaudeCliExec = () => ({
      stdout: envelope(
        JSON.stringify({
          facts: [{ text: 'x', confidence: 0.5, categories: ['not-a-real-category'] }],
          summary: 'x',
        })
      ),
      status: 0,
    });
    const runner = createClaudeCodeRunner(exec);
    expect(() => runner.run(source, 'raw text')).toThrow(/invalid facts/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/extraction/claudeCodeRunner.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the runner**

`C:\dev\trm\src\extraction\claudeCodeRunner.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { ExtractionRunner } from './types';
import { Fact } from '../scoring/types';
import { SourceEntry } from '../core/sourceIngest';
import { validateAgainstSchema } from '../schemas/validator';
import { buildExtractPrompt } from './prompts/extractFacts';

export interface ClaudeCliExec {
  (args: string[], input: string): { stdout: string; status: number | null };
}

const CLAUDE_BIN = process.platform === 'win32' ? 'claude.cmd' : 'claude';

function defaultExec(args: string[], input: string): { stdout: string; status: number | null } {
  const result = spawnSync(CLAUDE_BIN, args, { input, encoding: 'utf-8' });
  return { stdout: result.stdout ?? '', status: result.status };
}

interface RawExtractedFact {
  text: string;
  confidence: number;
  categories: string[];
}

interface RawExtractResult {
  facts?: RawExtractedFact[];
  summary?: string;
}

interface ClaudeCliEnvelope {
  result?: string;
  is_error?: boolean;
}

export function createClaudeCodeRunner(exec: ClaudeCliExec = defaultExec): ExtractionRunner {
  return {
    run(source: SourceEntry, rawText: string): { facts: Fact[]; summary: string } {
      const prompt = buildExtractPrompt(source.title);
      const { stdout, status } = exec(['-p', prompt, '--output-format', 'json', '--model', 'sonnet'], rawText);

      if (status !== 0) {
        throw new Error(`claude CLI exited with status ${status}`);
      }

      let envelope: ClaudeCliEnvelope;
      try {
        envelope = JSON.parse(stdout);
      } catch {
        throw new Error(`claude CLI output was not valid JSON: ${stdout.slice(0, 200)}`);
      }

      if (envelope.is_error) {
        throw new Error(`claude CLI reported an error: ${envelope.result}`);
      }

      if (typeof envelope.result !== 'string') {
        throw new Error('claude CLI envelope had no "result" string field');
      }

      let parsed: RawExtractResult;
      try {
        parsed = JSON.parse(envelope.result);
      } catch {
        throw new Error(`claude CLI result was not valid JSON: ${envelope.result.slice(0, 200)}`);
      }

      if (!Array.isArray(parsed.facts)) {
        throw new Error('claude CLI result had no "facts" array');
      }
      if (typeof parsed.summary !== 'string') {
        throw new Error('claude CLI result had no "summary" string');
      }

      const facts: Fact[] = parsed.facts.map((f, i) => ({
        id: `FCT-${String(i + 1).padStart(3, '0')}`,
        text: f.text,
        source_id: source.id,
        confidence: f.confidence,
        categories: f.categories,
      }));

      const validation = validateAgainstSchema('extract', { facts });
      if (!validation.valid) {
        throw new Error(`claudeCodeRunner produced invalid facts: ${validation.errors.join('; ')}`);
      }

      return { facts, summary: parsed.summary };
    },
  };
}

export const claudeCodeRunner = createClaudeCodeRunner();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/extraction/claudeCodeRunner.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/extraction/claudeCodeRunner.ts tests/extraction/claudeCodeRunner.test.ts
git commit -m "feat: claudeCodeRunner — real ExtractionRunner shelling to claude CLI"
```

---

## Task 4: Wire `claudeCodeRunner` as `trm extract`'s default, add `--stub`

**Files:**
- Modify: `C:\dev\trm\src\cli\commands\extract.ts`
- Modify: `C:\dev\trm\src\cli\index.ts`
- Test: `C:\dev\trm\tests\cli\extractWiring.test.ts`

**Interfaces:**
- Consumes:
  - `claudeCodeRunner` from `C:\dev\trm\src\extraction\claudeCodeRunner.ts` (Task 3)
  - `stubRunner` from `C:\dev\trm\src\extraction\stubRunner.ts` (existing)
- Produces: `runExtract`'s signature changes from `(root, topicPath, cliArgs, runner: ExtractionRunner = stubRunner)` to `(root, topicPath, cliArgs: { actor?: string; dryRun?: boolean; stub?: boolean }, runnerOverride?: ExtractionRunner)`. This is backward-compatible for existing callers that pass an explicit 4th argument (the existing `tests/cli/extract.test.ts` from the base plan passes `stubRunner` explicitly and needs no changes) — only the *default* behavior when the 4th argument is omitted changes.

- [ ] **Step 1: Write the failing test**

`C:\dev\trm\tests\cli\extractWiring.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn(() => ({
    stdout: JSON.stringify({
      type: 'result',
      is_error: false,
      result: JSON.stringify({
        facts: [{ text: 'Mocked fact.', confidence: 0.8, categories: ['history'] }],
        summary: 'Mocked summary.',
      }),
    }),
    status: 0,
  })),
}));

import { spawnSync } from 'node:child_process';
import { runCreate } from '../../src/cli/commands/create';
import { runIngest } from '../../src/cli/commands/ingest';
import { runExtract } from '../../src/cli/commands/extract';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' })
  );
  return root;
}

function setUpSource(root: string) {
  runCreate(root, 'cuba', { actor: 'ACTOR-001' });
  runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'text', title: 'x', origin: 'x', url: 'x' });
  const rawDir = path.join(root, 'topics', 'cuba', 'sources', 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, 'SRC-001.txt'), 'Some raw text.\n');
}

describe('runExtract default runner wiring', () => {
  beforeEach(() => {
    (spawnSync as jest.Mock).mockClear();
  });

  it('uses claudeCodeRunner (spawns claude CLI) by default, not stubRunner', () => {
    const root = makeRoot();
    setUpSource(root);

    const result = runExtract(root, 'cuba', { actor: 'ACTOR-001' });

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(result?.facts).toHaveLength(1);
    expect(result?.facts[0].text).toBe('Mocked fact.');
    expect(result?.facts[0].categories).toEqual(['history']);
  });

  it('--stub bypasses claude CLI entirely and uses the naive splitter', () => {
    const root = makeRoot();
    setUpSource(root);

    const result = runExtract(root, 'cuba', { actor: 'ACTOR-001', stub: true });

    expect(spawnSync).not.toHaveBeenCalled();
    expect(result?.facts[0].text).toBe('Some raw text.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/cli/extractWiring.test.ts
```

Expected: FAIL — both tests fail. `spawnSync` is never called (current default is `stubRunner`, `cliArgs.stub` doesn't exist yet).

- [ ] **Step 3: Update `extract.ts` and `index.ts`**

`C:\dev\trm\src\cli\commands\extract.ts` — replace the whole file:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../../core/paths';
import { readTopicMeta } from '../../core/topicNode';
import { Fact } from '../../scoring/types';
import { ExtractionRunner } from '../../extraction/types';
import { stubRunner } from '../../extraction/stubRunner';
import { claudeCodeRunner } from '../../extraction/claudeCodeRunner';
import { resolveActor } from '../../registry/actorRegistry';
import { appendOperation } from '../../lineage/hasher';

interface SourceMetadata {
  sources: { id: string }[];
}

export function runExtract(
  root: string,
  topicPath: string,
  cliArgs: { actor?: string; dryRun?: boolean; stub?: boolean },
  runnerOverride?: ExtractionRunner
): { facts: Fact[]; summary: string } | null {
  const runner = runnerOverride ?? (cliArgs.stub ? stubRunner : claudeCodeRunner);
  const actor = resolveActor(root, cliArgs.actor);
  readTopicMeta(root, topicPath); // throws if node doesn't exist
  const dir = nodeDir(root, topicPath);
  const metadataPath = path.join(dir, 'sources', 'metadata.json');
  const metadata: SourceMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

  const allFacts: Fact[] = [];
  const summaries: string[] = [];
  for (const source of metadata.sources) {
    const rawFile = path.join(dir, 'sources', 'raw', `${source.id}.txt`);
    if (!fs.existsSync(rawFile)) continue;
    const rawText = fs.readFileSync(rawFile, 'utf-8');
    const sourceMeta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')).sources.find((s: any) => s.id === source.id);
    const { facts, summary } = runner.run(sourceMeta, rawText);
    allFacts.push(...facts);
    summaries.push(summary);
  }

  if (cliArgs.dryRun) return null;

  const extractsDir = path.join(dir, 'extracts');
  fs.mkdirSync(extractsDir, { recursive: true });
  fs.writeFileSync(path.join(extractsDir, 'extract.json'), JSON.stringify({ facts: allFacts }, null, 2));
  fs.writeFileSync(path.join(extractsDir, 'summary.md'), summaries.join('\n\n'));

  const now = new Date().toISOString();
  appendOperation(
    root,
    topicPath,
    { op: 'EXTRACT', actor, timestamp: now, fact_count: allFacts.length },
    { fact_count: allFacts.length }
  );

  return { facts: allFacts, summary: summaries.join('\n\n') };
}
```

(Only two things changed from the existing file: the new `claudeCodeRunner` import, and the `runner`/`runnerOverride` line at the top of the function. Everything else — including the `--dry-run` fix from the base plan — is unchanged.)

In `C:\dev\trm\src\cli\index.ts`, find the `extract` command block:

```ts
program
  .command('extract <path>')
  .option('--actor <actor>')
  .option('--dry-run')
  .action((path, opts) => {
    const result = runExtract(root, path, { ...opts, dryRun: opts.dryRun });
    console.log(result ? `${result.facts.length} fact(s) extracted` : '(dry-run)');
  });
```

Replace it with:

```ts
program
  .command('extract <path>')
  .option('--actor <actor>')
  .option('--dry-run')
  .option('--stub')
  .action((path, opts) => {
    const result = runExtract(root, path, { ...opts, dryRun: opts.dryRun, stub: opts.stub });
    console.log(result ? `${result.facts.length} fact(s) extracted` : '(dry-run)');
  });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/cli/extractWiring.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Run the full suite and typecheck, then commit**

```bash
cd C:/dev/trm
npm test
npm run typecheck
```

Expected: all suites pass (the pre-existing `tests/cli/extract.test.ts` from the base plan is unaffected since it always passes `stubRunner` explicitly as the 4th argument), typecheck exits 0.

```bash
cd C:/dev/trm
git add src/cli/commands/extract.ts src/cli/index.ts tests/cli/extractWiring.test.ts
git commit -m "feat: default trm extract to claudeCodeRunner, add --stub flag"
```

---

## Task 5: Live verification against the real `claude` CLI

Not a unit test — this is the acceptance check that the whole feature actually works end to end, the same way the base TRM plan was verified against the live binary before being called done.

- [ ] **Step 1: Build**

```bash
cd C:/dev/trm
npm run build
```

Expected: no errors.

- [ ] **Step 2: Set up a throwaway topic with a real source**

Use a real, existing piece of source text (not fabricated) — e.g. the same Beats 7.3-7.4 text used in the earlier TRM dogfood run (`charlie-deep-research/treatment/TREATMENT_DRAFT_v1.2.md`, lines 151-153). Create a fresh scratch root, `config.json`, run `create`, `ingest`, and place the raw text file, exactly as done manually during the base-plan dogfood run:

```bash
mkdir -p /tmp/trm-extraction-live-test
cp C:/dev/trm/config.json /tmp/trm-extraction-live-test/config.json
cd /tmp/trm-extraction-live-test
export TRM_ACTOR=ACTOR-001
node C:/dev/trm/dist/cli/index.js create charlie/cuba --description "live extraction verification" --tags history,geopolitics
node C:/dev/trm/dist/cli/index.js ingest charlie/cuba "file://test" --type treatment-beat --title "Beats 7.3-7.4" --origin "TREATMENT_DRAFT_v1.2.md"
mkdir -p topics/charlie/cuba/sources/raw
```

Then write the real beat text (same content as the base-plan dogfood run) to `topics/charlie/cuba/sources/raw/SRC-001.txt`.

- [ ] **Step 3: Run real extraction (no `--stub`) and inspect the output**

```bash
cd /tmp/trm-extraction-live-test
export TRM_ACTOR=ACTOR-001
node C:/dev/trm/dist/cli/index.js extract charlie/cuba
cat topics/charlie/cuba/extracts/extract.json
cat topics/charlie/cuba/extracts/summary.md
```

Expected: real, non-trivial facts (not naive line-splits) with non-empty `categories` arrays drawn from the fixed vocabulary, and confidence values that vary per fact rather than a flat `0.5`.

- [ ] **Step 4: Confirm scoring now reflects real categorization**

```bash
cd /tmp/trm-extraction-live-test
export TRM_ACTOR=ACTOR-001
node C:/dev/trm/dist/cli/index.js score charlie/cuba
```

Expected: `genealogy`/`historical` sub-scores reflect the model's actual category assignments (no longer flatlined at 20 the way the base-plan dogfood run showed with the naive stub), and at least one fact likely crosses the `promotion_threshold` given real `history`/`geopolitics` categorization on this content.

- [ ] **Step 5: Confirm `--stub` still works standalone (no cost, no network)**

```bash
cd /tmp/trm-extraction-live-test
export TRM_ACTOR=ACTOR-001
node C:/dev/trm/dist/cli/index.js version-bump charlie/cuba patch
node C:/dev/trm/dist/cli/index.js extract charlie/cuba --stub
cat topics/charlie/cuba/extracts/extract.json
```

Expected: naive line-split output, overwriting the real extraction — confirms the escape hatch works and the two runners are cleanly swappable.

- [ ] **Step 6: Clean up the scratch directory**

```bash
rm -rf /tmp/trm-extraction-live-test
```

No commit for this task — it's a verification pass, not a code change.

---

## Self-Review

**1. Spec coverage:**
- §8 "two implementations" (`stubRunner`/`claudeCodeRunner`) → Task 3, Task 4.
- §8 non-`--bare`, subscription auth → Task 3's `defaultExec` uses plain `spawnSync(CLAUDE_BIN, ...)`, no `--bare` flag anywhere.
- §8 fixed prompt contract, strict JSON, no id/source_id from model → Task 2, enforced by Task 3's mapping step (ids always assigned by the runner, never read from model output).
- §8 fixed category vocabulary → Task 1 (schema enum) + Task 2 (prompt text) + Task 3 test 7 (rejection case).
- §8 JSON envelope parsing (`result`, `is_error`) → Task 3.
- §8 fail-hard, no partial writes → Task 3 throws before any file write in `extract.ts`; Task 4's `runExtract` writes nothing until after `runner.run()` returns successfully (unchanged from base plan's structure).
- §8 testability (injectable exec, no real spawns in tests) → Task 3's `ClaudeCliExec` param, Task 4's `jest.mock('node:child_process')`.
- §7 downgraded determinism claim → no code artifact needed (it's a documentation-only spec change already committed); Task 3's tests don't assert byte-identical output across separate real calls, only against injected fakes.
- §9 exclusion of `--bare` → confirmed no task adds it.

**2. Placeholder scan:** No TBD/TODO. Task 5's live-verification commands are concrete and complete except for "write the real beat text" in step 2, which explicitly points to the exact same content already used and shown in full during the base-plan's dogfood run — not a fabricated placeholder, a pointer to real, already-known content to avoid a 2000-character duplicate paste.

**3. Type consistency:** `ExtractionRunner`, `Fact`, `SourceEntry` are reused unchanged from the base plan's Tasks 10/11/9 — no redefinition. `ClaudeCliExec` is defined once in Task 3 and imported by name in Task 4's test. `runExtract`'s new signature (`runnerOverride?` instead of `runner =`) is defined once in Task 4 and matches how Task 4's own test and the pre-existing base-plan test both call it (the base-plan test passes the override positionally, still valid).
