# TRM Feedback/Report Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standing, repeatable feedback/report pass for TRM ingest batches — classifier/extraction quality stats, OCR latency percentiles vs. budget, heuristic new-topic-candidate surfacing, and a web-search cross-check on low-confidence facts.

**Architecture:** Split across two repos. `trm` (TypeScript CLI, `C:\dev\trm`) gets typed validation errors, an OCR-timing log, a `Fact.flags` field, `crosslink --tags` support, and a new `feedback-stats` subcommand — all pure/mechanical, no LLM or network calls beyond what already exists, each independently unit-tested. `skills/trm-feedback-report/` (this repo, `C:\dev\skills\trm-feedback-report`) is a small TypeScript library of deterministic helper functions (new-topic clustering, signal-strength scoring, report metadata/filename logic, a thin `trm` CLI wrapper) that Claude calls into directly — the genuinely judgment-requiring parts (running `WebSearch`, writing the narrative prose) are Claude tool calls orchestrated per `SKILL.md`, not Node code, since a plain script cannot invoke Claude's own tools.

**Tech Stack:** TypeScript, Jest + ts-jest, Ajv (JSON Schema), Node `child_process`/`fs`. Matches existing `trm` and `skills/automation-audit` conventions exactly — no new tooling introduced.

## Global Constraints

- `trm`'s `Fact.categories` is a closed 5-value enum (`history`, `genealogy`, `industry`, `geopolitics`, `biography`, per `extract.schema.json`) — never used as a topic-clustering key (see spec correction).
- `extract.schema.json` and `score.schema.json` both set `additionalProperties: false` on their item objects — any new field added to `Fact` or `ScoreResult` must be added to the corresponding schema's `properties` in the same task, or `trm validate` will reject every extract/score file.
- `lineage.schema.json`'s operation items have no `additionalProperties: false` — extra fields on a lineage op (e.g. `tags`) are schema-legal without a schema change.
- OCR latency budget default: `90000` ms (matches the existing `ImageAnalyzer` timeout tuned in `ingestDir.ts`).
- All new `trm` code follows existing patterns exactly: `runXxx(root, topicPath, cliArgs)` function shape, `node:fs`/`node:path` imports, tests under `trm/tests/**/*.test.ts` using `fs.mkdtempSync` + a `config.json` fixture (see `makeRoot()` in `trm/tests/cli/validate.test.ts`).
- All new skill code follows `skills/automation-audit/` conventions exactly: own `package.json`/`jest.config.js`/`tsconfig.json`, `skill.json` in the flat (non-`_TEMPLATE`) shape, `SKILL.md` per the Skill Documentation Compliance policy (<150 lines, frontmatter + Trigger + I/O schema only, rest links to the Skill Operator Guide).
- TDD throughout: write the failing test, confirm it fails, implement, confirm it passes, commit. One commit per task minimum.

---

## Task 1: `validate.ts` typed validation errors

**Files:**
- Modify: `trm/src/cli/commands/validate.ts`
- Modify: `trm/tests/cli/validate.test.ts`

**Interfaces:**
- Produces: `ValidationIssueType = 'schema_error' | 'lineage_error' | 'hand_edited' | 'mock_source'`, `ValidationIssue { type: ValidationIssueType; message: string }`, `ValidationReport { path: string; valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] }`. Task 5 (`feedback-stats`) and Task 9 (skill) consume these exact names.

- [ ] **Step 1: Write the failing tests**

Update `trm/tests/cli/validate.test.ts` — change the two assertions that read raw strings to read the typed shape, and add one new test for `schema_error` tagging:

```typescript
  it('fails when score.json was hand-edited after the SCORE lineage op', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.9, categories: [] }]);
    runScore(root, 'cuba', { actor: 'ACTOR-001' });

    const scorePath = path.join(root, 'topics', 'cuba', 'extracts', 'score.json');
    const score = JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
    score.scores[0].promoted = true;
    fs.writeFileSync(scorePath, JSON.stringify(score, null, 2));

    const [report] = runValidate(root, 'cuba', {});
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.type === 'hand_edited' && /score\.json/.test(e.message))).toBe(true);
  });
```

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
    expect(report.warnings).toContainEqual({
      type: 'mock_source',
      message: 'SRC-001 is mock image-extraction data, not a verified fact source',
    });
  });
```

```typescript
  it('tags a broken lineage chain as lineage_error', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const lineagePath = path.join(root, 'topics', 'cuba', 'lineage', 'lineage.json');
    const lineage = JSON.parse(fs.readFileSync(lineagePath, 'utf-8'));
    lineage.operations[0].hash = 'tampered';
    fs.writeFileSync(lineagePath, JSON.stringify(lineage, null, 2));

    const [report] = runValidate(root, 'cuba', {});
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.type === 'lineage_error')).toBe(true);
  });

  it('tags a schema-invalid extract.json as schema_error', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const extractDir = path.join(root, 'topics', 'cuba', 'extracts');
    fs.mkdirSync(extractDir, { recursive: true });
    // missing required "confidence" field -> fails the 'extract' schema
    fs.writeFileSync(path.join(extractDir, 'extract.json'), JSON.stringify({ facts: [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', categories: [] }] }));

    const [report] = runValidate(root, 'cuba', {});
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.type === 'schema_error' && /extract\.json/.test(e.message))).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd trm && npx jest tests/cli/validate.test.ts`
Expected: FAIL — current code pushes plain strings, not `{type, message}` objects, so `e.type` is `undefined`.

- [ ] **Step 3: Implement the typed error shape**

Replace the top of `trm/src/cli/commands/validate.ts`:

```typescript
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../../core/paths';
import { readTopicMeta } from '../../core/topicNode';
import { readLineage, validateChain } from '../../lineage/hasher';
import { validateAgainstSchema, SchemaName } from '../../schemas/validator';

export type ValidationIssueType = 'schema_error' | 'lineage_error' | 'hand_edited' | 'mock_source';

export interface ValidationIssue {
  type: ValidationIssueType;
  message: string;
}

export interface ValidationReport {
  path: string;
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function checkSchema(root: string, topicPath: string, file: string, schema: SchemaName, errors: ValidationIssue[]): void {
  const filePath = path.join(nodeDir(root, topicPath), file);
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const result = validateAgainstSchema(schema, data);
  if (!result.valid) {
    errors.push({ type: 'schema_error', message: `${file}: ${result.errors.join('; ')}` });
  }
}

function checkScoreNotHandEdited(root: string, topicPath: string, errors: ValidationIssue[]): void {
  const scorePath = path.join(nodeDir(root, topicPath), 'extracts', 'score.json');
  if (!fs.existsSync(scorePath)) return;
  const lineage = readLineage(root, topicPath);
  const lastScoreOp = [...lineage.operations].reverse().find((op) => op.op === 'SCORE');
  if (!lastScoreOp) {
    errors.push({ type: 'hand_edited', message: 'score.json exists but no SCORE lineage operation was recorded' });
    return;
  }
  const scoreContent = JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
  const expectedHash = crypto.createHash('sha256').update(JSON.stringify(scoreContent.scores)).digest('hex');
  const recordedHash = lastScoreOp.content_hash;
  if (recordedHash && recordedHash !== expectedHash) {
    errors.push({ type: 'hand_edited', message: 'score.json contents do not match the hash recorded at the last SCORE operation — hand-edited' });
  }
}

function checkMockImageSources(root: string, topicPath: string, warnings: ValidationIssue[]): void {
  const rawDir = path.join(nodeDir(root, topicPath), 'sources', 'raw');
  if (!fs.existsSync(rawDir)) return;
  for (const file of fs.readdirSync(rawDir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(rawDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data.mock === true) {
      const sourceId = path.basename(file, '.json');
      warnings.push({ type: 'mock_source', message: `${sourceId} is mock image-extraction data, not a verified fact source` });
    }
  }
}

function validateNode(root: string, topicPath: string): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  readTopicMeta(root, topicPath); // throws if node missing

  checkSchema(root, topicPath, 'topic.json', 'topic', errors);
  checkSchema(root, topicPath, path.join('sources', 'metadata.json'), 'metadata', errors);
  checkSchema(root, topicPath, path.join('extracts', 'extract.json'), 'extract', errors);
  checkSchema(root, topicPath, path.join('extracts', 'score.json'), 'score', errors);
  checkSchema(root, topicPath, path.join('crosslinks', 'related_topics.json'), 'related_topics', errors);

  const chainResult = validateChain(root, topicPath);
  if (!chainResult.valid) errors.push({ type: 'lineage_error', message: `lineage: ${chainResult.error}` });

  checkScoreNotHandEdited(root, topicPath, errors);
  checkMockImageSources(root, topicPath, warnings);

  return { path: topicPath, valid: errors.length === 0, errors, warnings };
}

export function runValidate(root: string, topicPath: string, cliArgs: { recursive?: boolean }): ValidationReport[] {
  const reports: ValidationReport[] = [validateNode(root, topicPath)];
  if (cliArgs.recursive) {
    const meta = readTopicMeta(root, topicPath);
    for (const child of meta.children) {
      reports.push(...runValidate(root, `${topicPath}/${child}`, cliArgs));
    }
  }
  return reports;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd trm && npx jest tests/cli/validate.test.ts`
Expected: PASS (all tests, including the recursive/plain-pass ones unaffected by the type change)

- [ ] **Step 5: Commit**

```bash
cd trm && git add src/cli/commands/validate.ts tests/cli/validate.test.ts && git commit -m "feat(validate): tag errors/warnings with a typed category instead of free text"
```

---

## Task 2: `Fact.flags` field + `extract.schema.json` update

**Files:**
- Modify: `trm/src/scoring/types.ts`
- Modify: `trm/src/schemas/extract.schema.json`
- Modify: `trm/tests/schemas/validator.test.ts`

**Interfaces:**
- Produces: `Fact.flags?: string[]` on the `Fact` interface. Task 9's cross-check helper reads `fact.flags?.includes('VERIFY')`.

- [ ] **Step 1: Write the failing test**

Add to `trm/tests/schemas/validator.test.ts`:

```typescript
  it('accepts an extract.json fact carrying an optional flags array', () => {
    const result = validateAgainstSchema('extract', {
      facts: [
        { id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.4, categories: ['history'], flags: ['VERIFY'] },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('still accepts an extract.json fact with no flags field at all', () => {
    const result = validateAgainstSchema('extract', {
      facts: [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.4, categories: [] }],
    });
    expect(result.valid).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd trm && npx jest tests/schemas/validator.test.ts`
Expected: FAIL on the first new test — `extract.schema.json` has `additionalProperties: false`, so `flags` is currently rejected.

- [ ] **Step 3: Implement**

In `trm/src/schemas/extract.schema.json`, add `flags` to the fact item's `properties` (do not add to `required`):

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
          },
          "flags": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

In `trm/src/scoring/types.ts`, add the field:

```typescript
export interface Fact {
  id: string;
  text: string;
  source_id: string;
  confidence: number;
  categories: string[];
  flags?: string[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd trm && npx jest tests/schemas/validator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd trm && git add src/scoring/types.ts src/schemas/extract.schema.json tests/schemas/validator.test.ts && git commit -m "feat(extract): add optional Fact.flags for cross-check markers like VERIFY"
```

---

## Task 3: `trm crosslink --tags` support

**Files:**
- Modify: `trm/src/cli/commands/crosslink.ts`
- Modify: `trm/src/cli/index.ts`
- Modify: `trm/tests/cli/crosslink.test.ts`

**Interfaces:**
- Produces: `runCrosslink`'s `cliArgs` gains `tags?: string[]`; when set, the appended `CROSSLINK` lineage op carries a `tags: string[]` field. Task 9's skill code invokes this via the CLI as `trm crosslink <path> --tags trm-feedback-report:v1`.

- [ ] **Step 1: Write the failing test**

Add to `trm/tests/cli/crosslink.test.ts`:

```typescript
  it('writes a tags-only CROSSLINK lineage op when no relatedTopic/treatmentSections given', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    runCrosslink(root, 'cuba', { actor: 'ACTOR-001', tags: ['trm-feedback-report:v1'] });

    const lineage = JSON.parse(fs.readFileSync(path.join(root, 'topics', 'cuba', 'lineage', 'lineage.json'), 'utf-8'));
    const lastOp = lineage.operations[lineage.operations.length - 1];
    expect(lastOp.op).toBe('CROSSLINK');
    expect(lastOp.tags).toEqual(['trm-feedback-report:v1']);
  });

  it('attaches tags alongside a relatedTopic CROSSLINK op', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    runCreate(root, 'willys', { actor: 'ACTOR-001' });
    runCrosslink(root, 'cuba', { actor: 'ACTOR-001', relatedTopic: 'willys', tags: ['trm-feedback-report:v1'] });

    const lineage = JSON.parse(fs.readFileSync(path.join(root, 'topics', 'cuba', 'lineage', 'lineage.json'), 'utf-8'));
    const lastOp = lineage.operations[lineage.operations.length - 1];
    expect(lastOp.tags).toEqual(['trm-feedback-report:v1']);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd trm && npx jest tests/cli/crosslink.test.ts`
Expected: FAIL — `runCrosslink` has no `tags` handling; `lastOp.tags` is `undefined`, and the tags-only case writes nothing at all today.

- [ ] **Step 3: Implement**

Replace `trm/src/cli/commands/crosslink.ts`:

```typescript
import { readTopicMeta } from '../../core/topicNode';
import { computeTagOverlapStrength, writeRelatedTopic } from '../../crosslinks/relatedTopics';
import { writeTreatmentLink } from '../../crosslinks/treatmentLink';
import { resolveActor } from '../../registry/actorRegistry';
import { appendOperation } from '../../lineage/hasher';

export function runCrosslink(
  root: string,
  topicPath: string,
  cliArgs: {
    actor?: string;
    relatedTopic?: string;
    relationship?: string;
    strength?: number;
    treatmentSections?: string[];
    promotionReason?: string;
    promotedFacts?: string[];
    tags?: string[];
  }
): void {
  const actor = resolveActor(root, cliArgs.actor);
  const meta = readTopicMeta(root, topicPath);
  const now = new Date().toISOString();
  const tagFields = cliArgs.tags ? { tags: cliArgs.tags } : {};

  if (cliArgs.relatedTopic) {
    const otherMeta = readTopicMeta(root, cliArgs.relatedTopic);
    const strength = cliArgs.strength ?? computeTagOverlapStrength(meta.tags, otherMeta.tags);
    writeRelatedTopic(root, topicPath, {
      topic: cliArgs.relatedTopic,
      relationship: cliArgs.relationship ?? '',
      strength,
    });
    appendOperation(
      root,
      topicPath,
      { op: 'CROSSLINK', actor, timestamp: now, related_topic: cliArgs.relatedTopic, ...tagFields },
      { related_topic: cliArgs.relatedTopic, ...tagFields }
    );
  } else if (cliArgs.tags) {
    appendOperation(root, topicPath, { op: 'CROSSLINK', actor, timestamp: now, ...tagFields }, { ...tagFields });
  }

  if (cliArgs.treatmentSections) {
    writeTreatmentLink(root, topicPath, {
      promoted_facts: cliArgs.promotedFacts ?? [],
      promotion_reason: cliArgs.promotionReason ?? '',
      treatment_sections: cliArgs.treatmentSections,
    });
    appendOperation(root, topicPath, { op: 'TREATMENT_LINK', actor, timestamp: now, sections: cliArgs.treatmentSections }, { sections: cliArgs.treatmentSections });
  }
}
```

In `trm/src/cli/index.ts`, update the `crosslink` command registration:

```typescript
program
  .command('crosslink <path>')
  .option('--actor <actor>')
  .option('--related-topic <path>')
  .option('--relationship <text>')
  .option('--treatment-sections <sections>', 'comma-separated', (v) => v.split(','))
  .option('--promotion-reason <text>')
  .option('--tags <tags>', 'comma-separated', (v) => v.split(','))
  .action((path, opts) => {
    runCrosslink(root, path, {
      actor: opts.actor,
      relatedTopic: opts.relatedTopic,
      relationship: opts.relationship,
      treatmentSections: opts.treatmentSections,
      promotionReason: opts.promotionReason,
      tags: opts.tags,
    });
    console.log('crosslink written');
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd trm && npx jest tests/cli/crosslink.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd trm && git add src/cli/commands/crosslink.ts src/cli/index.ts tests/cli/crosslink.test.ts && git commit -m "feat(crosslink): support a standalone --tags marker on CROSSLINK lineage ops"
```

---

## Task 4: OCR latency/retry instrumentation

**Files:**
- Modify: `trm/src/ingestion/imageExtract/imageAnalyzer.ts`
- Create: `trm/src/core/ocrTimingLog.ts`
- Modify: `trm/src/cli/commands/ingestDir.ts`
- Test: `trm/tests/core/ocrTimingLog.test.ts` (new)
- Modify: `trm/tests/cli/ingestDir.test.ts`

**Interfaces:**
- Produces: `appendOcrTiming(root: string, entry: OcrTimingEntry): void`, `readOcrTiming(root: string): OcrTimingEntry[]`, `OcrTimingEntry { schema_version: 1; topic: string; file: string; source_type: string; ms: number; retries: number; outcome: 'success' | 'failure'; ts: string }`. Task 5 (`feedback-stats`) consumes `readOcrTiming`.
- `OcrResult.metadata` gains `retries?: number` (consumed by `ingestDir.ts`'s new logging call).

- [ ] **Step 1: Write the failing tests**

Create `trm/tests/core/ocrTimingLog.test.ts`:

```typescript
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { appendOcrTiming, readOcrTiming } from '../../src/core/ocrTimingLog';

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trm-ocrtiming-'));
}

describe('ocrTimingLog', () => {
  it('returns an empty array when no log file exists yet', () => {
    const root = makeRoot();
    expect(readOcrTiming(root)).toEqual([]);
  });

  it('appends and reads back entries in order', () => {
    const root = makeRoot();
    const entry1 = { schema_version: 1 as const, topic: 'charlie/benson-ford', file: 'a.jpg', source_type: 'jpg', ms: 3200, retries: 0, outcome: 'success' as const, ts: '2026-07-28T00:00:00.000Z' };
    const entry2 = { ...entry1, file: 'b.jpg', ms: 91000, retries: 1, outcome: 'failure' as const };
    appendOcrTiming(root, entry1);
    appendOcrTiming(root, entry2);

    const entries = readOcrTiming(root);
    expect(entries).toEqual([entry1, entry2]);
  });
});
```

Extend `trm/tests/cli/ingestDir.test.ts` with a new test (add near the other OCR-path tests):

```typescript
  it('records OCR latency and retry count to ocr-timing.jsonl', async () => {
    const root = makeRoot();
    runCreate(root, 'topic1', { actor: 'ACTOR-001' });

    const dir = path.join(root, 'input-dir');
    fs.mkdirSync(dir);
    fs.copyFileSync(TEXT_DOC_FIXTURE, path.join(dir, 'scanned.png'));

    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/analyze/ocr')) {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 500, text: async () => 'transient failure' };
        }
        return {
          ok: true,
          json: async () => ({
            text: 'Scanned doc page with historical records.',
            metadata: { format: 'png', size: 59, processedAt: new Date().toISOString(), latencyMs: 15 },
          }),
        };
      }
      return { ok: false, status: 404, text: async () => 'Not found' };
    }) as any;

    await runIngestDir(root, 'topic1', { actor: 'ACTOR-001', dir, kind: 'text-doc', stub: true });

    const timingFile = path.join(root, '.trm-ops', 'ocr-timing.jsonl');
    const lines = fs.readFileSync(timingFile, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatchObject({ schema_version: 1, topic: 'topic1', file: 'scanned.png', source_type: 'png', ms: 15, retries: 1, outcome: 'success' });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd trm && npx jest tests/core/ocrTimingLog.test.ts tests/cli/ingestDir.test.ts`
Expected: FAIL — `ocrTimingLog.ts` does not exist yet; the `ingestDir` test finds no `.trm-ops/ocr-timing.jsonl` file at all.

- [ ] **Step 3: Implement `ocrTimingLog.ts`**

Create `trm/src/core/ocrTimingLog.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface OcrTimingEntry {
  schema_version: 1;
  topic: string;
  file: string;
  source_type: string;
  ms: number;
  retries: number;
  outcome: 'success' | 'failure';
  ts: string;
}

function ocrTimingPath(root: string): string {
  return path.join(root, '.trm-ops', 'ocr-timing.jsonl');
}

export function appendOcrTiming(root: string, entry: OcrTimingEntry): void {
  const file = ocrTimingPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

export function readOcrTiming(root: string): OcrTimingEntry[] {
  const file = ocrTimingPath(root);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}
```

- [ ] **Step 4: Add `retries` to `OcrResult` and populate it in `imageAnalyzer.ts`**

In `trm/src/ingestion/imageExtract/imageAnalyzer.ts`, update the `OcrResult` interface:

```typescript
export interface OcrResult {
  text: string;
  metadata: {
    format: string;
    size: number;
    processedAt: string;
    latencyMs: number;
    retries?: number;
    error?: string;
  };
}
```

Update `_callOcrServiceWithRetry` to record the attempt count on success and attach it to the thrown error on exhaustion:

```typescript
  private async _callOcrServiceWithRetry(buffer: Buffer, format: string): Promise<OcrResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await this._callOcrService(buffer, format);
        result.metadata.retries = attempt - 1;
        return result;
      } catch (error) {
        lastError = error as Error;
        log(`OCR attempt ${attempt}/${this.retryAttempts} failed: ${lastError.message}`);

        if (attempt < this.retryAttempts) {
          const delay = Math.pow(2, attempt - 1) * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const finalError = lastError || new Error('OCR service call failed after all retries');
    (finalError as Error & { retries?: number }).retries = this.retryAttempts - 1;
    throw finalError;
  }
```

Update `ocr()`'s catch block to read that attached count:

```typescript
  async ocr(imageBuffer: any): Promise<OcrResult> {
    const startTime = Date.now();
    log('ImageAnalyzer.ocr() starting');

    try {
      if (!imageBuffer) {
        return this._createOcrErrorResult('Image buffer is required');
      }

      const buffer = this._normalizeBuffer(imageBuffer);
      if (!buffer) {
        return this._createOcrErrorResult('Invalid image buffer format');
      }

      const format = this._detectFormat(buffer);
      if (!format) {
        return this._createOcrErrorResult('Unsupported image format');
      }

      const result = await this._callOcrServiceWithRetry(buffer, format);
      const totalLatency = Date.now() - startTime;

      log(`ImageAnalyzer.ocr() completed. Total latency: ${totalLatency}ms`);
      return result;
    } catch (error) {
      log('ImageAnalyzer.ocr() failed:', error);
      const result = this._createOcrErrorResult(`OCR failed: ${(error as Error).message}`);
      result.metadata.retries = (error as Error & { retries?: number }).retries ?? 0;
      return result;
    }
  }
```

- [ ] **Step 5: Wire logging into `ingestDir.ts`**

In `trm/src/cli/commands/ingestDir.ts`, add the import:

```typescript
import { appendOcrTiming } from '../../core/ocrTimingLog';
```

Replace the OCR call block (currently just below `// text-doc: OCR -> extraction path`):

```typescript
            const buffer = await fs.promises.readFile(filePath);

            // The OCR call itself is a Vision-API HTTP call, but running under claudePool
            // as it directly prepares input for the subsequent Claude extraction step.
            const ocrResult = await claudePool(() => analyzer.ocr(buffer));

            appendOcrTiming(root, {
              schema_version: 1,
              topic: targetTopicPath,
              file: path.basename(filePath),
              source_type: path.extname(filePath).toLowerCase().replace('.', '') || 'unknown',
              ms: ocrResult.metadata.latencyMs,
              retries: ocrResult.metadata.retries ?? 0,
              outcome: ocrResult.metadata.error ? 'failure' : 'success',
              ts: new Date().toISOString(),
            });

            if (ocrResult.metadata.error) {
              throw new Error(`OCR failed: ${ocrResult.metadata.error}`);
            }
```

(The `source_id` a real trm source gets isn't assigned until `addSource()` runs further down this same block, so the timing entry identifies the file by its on-disk basename instead — the only stable identifier available at OCR-call time.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd trm && npx jest tests/core/ocrTimingLog.test.ts tests/cli/ingestDir.test.ts tests/ingestion/imageExtract`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd trm && git add src/core/ocrTimingLog.ts src/ingestion/imageExtract/imageAnalyzer.ts src/cli/commands/ingestDir.ts tests/core/ocrTimingLog.test.ts tests/cli/ingestDir.test.ts && git commit -m "feat(ingest-dir): log OCR latency/retries to .trm-ops/ocr-timing.jsonl"
```

---

## Task 5: `trm feedback-stats` subcommand

**Files:**
- Create: `trm/src/cli/commands/feedbackStats.ts`
- Modify: `trm/src/cli/index.ts`
- Test: `trm/tests/cli/feedbackStats.test.ts` (new)

**Interfaces:**
- Consumes: `runValidate` (Task 1, returns `ValidationReport[]` with typed `errors`/`warnings`), `readOcrTiming` (Task 4), `readRawEnvelope` (existing, `core/rawSource.ts`), `readTopicMeta` (existing, `core/topicNode.ts`), `nodeDir` (existing, `core/paths.ts`).
- Produces: `runFeedbackStats(root, topicPath, cliArgs): FeedbackStats`, consumed by Task 9's skill code via the CLI (`trm feedback-stats <path> --recursive --latency-budget-ms <n>`, JSON on stdout).

- [ ] **Step 1: Write the failing tests**

Create `trm/tests/cli/feedbackStats.test.ts`:

```typescript
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runScore } from '../../src/cli/commands/score';
import { runFeedbackStats } from '../../src/cli/commands/feedbackStats';
import { appendOcrTiming } from '../../src/core/ocrTimingLog';
import { writeRawEnvelope } from '../../src/core/rawSource';
import { addSource } from '../../src/core/sourceIngest';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-feedbackstats-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' }));
  return root;
}

function writeExtract(root: string, topicPath: string, facts: any[]) {
  const dir = path.join(root, 'topics', ...topicPath.split('/'), 'extracts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'extract.json'), JSON.stringify({ facts }, null, 2));
}

describe('runFeedbackStats', () => {
  it('reports zeroed-out ocr_latency and has_ocr_timing: false when no timing log exists', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.9, categories: [] }]);

    const stats = runFeedbackStats(root, 'cuba', {});
    expect(stats.completeness.has_ocr_timing).toBe(false);
    expect(stats.ocr_latency.p50).toBe(0);
    expect(stats.ocr_latency.timeout_rate).toBe(0);
  });

  it('computes latency percentiles and over_budget against a custom budget', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    for (const ms of [1000, 2000, 3000, 95000]) {
      appendOcrTiming(root, { schema_version: 1, topic: 'cuba', file: `f-${ms}.jpg`, source_type: 'jpg', ms, retries: 0, outcome: 'success', ts: new Date().toISOString() });
    }

    const stats = runFeedbackStats(root, 'cuba', { latencyBudgetMs: 90000 });
    expect(stats.completeness.has_ocr_timing).toBe(true);
    expect(stats.ocr_latency.p50).toBeGreaterThan(0);
    expect(stats.ocr_latency.over_budget).toBe(true);
    expect(stats.ocr_latency.latency_budget_ms).toBe(90000);
  });

  it('computes timeout_rate from failure-outcome entries', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    appendOcrTiming(root, { schema_version: 1, topic: 'cuba', file: 'a.jpg', source_type: 'jpg', ms: 1000, retries: 0, outcome: 'success', ts: new Date().toISOString() });
    appendOcrTiming(root, { schema_version: 1, topic: 'cuba', file: 'b.jpg', source_type: 'jpg', ms: 90000, retries: 2, outcome: 'failure', ts: new Date().toISOString() });

    const stats = runFeedbackStats(root, 'cuba', {});
    expect(stats.ocr_latency.timeout_rate).toBeCloseTo(0.5);
  });

  it('computes fact_density from source text length, excluding image-only sources with no text', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const actor = 'ACTOR-001';
    const textEntry = addSource(root, 'cuba', actor, { type: 'document', title: 't', origin: 'local', url: 'local:t', contentHash: 'h1' });
    writeRawEnvelope(root, 'cuba', { sourceId: textEntry.id, kind: 'text', capturedAt: new Date().toISOString(), text: 'a'.repeat(1024) });
    const photoEntry = addSource(root, 'cuba', actor, { type: 'image', title: 'p', origin: 'local', url: 'local:p', contentHash: 'h2' });
    writeRawEnvelope(root, 'cuba', { sourceId: photoEntry.id, kind: 'image', capturedAt: new Date().toISOString(), image: { matches: [], metadata: { format: 'jpg', size: 1, processedAt: '', visionApiUsed: true }, mock: false } });

    writeExtract(root, 'cuba', [
      { id: 'FCT-001', text: 'x', source_id: textEntry.id, confidence: 0.9, categories: [] },
      { id: 'FCT-002', text: 'y', source_id: textEntry.id, confidence: 0.9, categories: [] },
    ]);

    const stats = runFeedbackStats(root, 'cuba', {});
    // 2 facts / 1KB of source text (the photo source contributes 0 bytes, not counted as zero-in-numerator noise)
    expect(stats.extract_stats.fact_density).toBeCloseTo(2);
  });

  it('rolls up score promoted/rejected counts and surfaces validate errors/warnings by type', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.9, categories: [] }]);
    runScore(root, 'cuba', { actor: 'ACTOR-001' });

    const rawDir = path.join(root, 'topics', 'cuba', 'sources', 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, 'SRC-001.json'), JSON.stringify({ mock: true, matches: [], metadata: { visionApiUsed: false } }));

    const stats = runFeedbackStats(root, 'cuba', {});
    expect(stats.score_stats.promoted + stats.score_stats.rejected).toBeGreaterThan(0);
    expect(stats.validate_stats.warnings_count_by_type.mock_source).toBe(1);
  });

  it('--recursive rolls up across descendant topics', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    runCreate(root, 'cuba/industry', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba/industry', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.9, categories: [] }]);

    const stats = runFeedbackStats(root, 'cuba', { recursive: true });
    expect(stats.extract_stats.fact_count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd trm && npx jest tests/cli/feedbackStats.test.ts`
Expected: FAIL — `feedbackStats.ts` does not exist yet.

- [ ] **Step 3: Implement**

Create `trm/src/cli/commands/feedbackStats.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../../core/paths';
import { readTopicMeta } from '../../core/topicNode';
import { readRawEnvelope } from '../../core/rawSource';
import { readOcrTiming } from '../../core/ocrTimingLog';
import { runValidate, ValidationIssue } from './validate';
import { Fact, ScoreResult } from '../../scoring/types';

export interface FeedbackStats {
  ocr_latency: {
    p50: number;
    p90: number;
    p99: number;
    timeout_rate: number;
    latency_budget_ms: number;
    over_budget: boolean;
  };
  extract_stats: {
    fact_count: number;
    confidence_histogram: Record<string, number>;
    category_histogram: Record<string, number>;
    fact_density: number;
  };
  score_stats: { promoted: number; rejected: number };
  validate_stats: { errors: ValidationIssue[]; warnings_count_by_type: Record<string, number> };
  completeness: { has_ocr_timing: boolean; has_extract: boolean; has_score: boolean; has_validate: boolean };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function confidenceBucket(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function collectTopicPaths(root: string, topicPath: string, recursive?: boolean): string[] {
  const meta = readTopicMeta(root, topicPath);
  const paths = [topicPath];
  if (recursive) {
    for (const child of meta.children) {
      paths.push(...collectTopicPaths(root, `${topicPath}/${child}`, true));
    }
  }
  return paths;
}

export function runFeedbackStats(
  root: string,
  topicPath: string,
  cliArgs: { recursive?: boolean; latencyBudgetMs?: number }
): FeedbackStats {
  const latencyBudgetMs = cliArgs.latencyBudgetMs ?? 90000;
  const topicPaths = collectTopicPaths(root, topicPath, cliArgs.recursive);

  let factCount = 0;
  const confidenceHistogram: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const categoryHistogram: Record<string, number> = {};
  let sourceTextBytes = 0;
  let promoted = 0;
  let rejected = 0;
  const allErrors: ValidationIssue[] = [];
  const warningsCountByType: Record<string, number> = { mock_source: 0, schema_error: 0, lineage_error: 0, hand_edited: 0 };
  let hasExtract = false;
  let hasScore = false;
  let hasValidate = false;

  for (const tp of topicPaths) {
    const dir = nodeDir(root, tp);

    const extractPath = path.join(dir, 'extracts', 'extract.json');
    if (fs.existsSync(extractPath)) {
      const { facts }: { facts: Fact[] } = JSON.parse(fs.readFileSync(extractPath, 'utf-8'));
      if (facts.length > 0) hasExtract = true;
      for (const fact of facts) {
        factCount++;
        confidenceHistogram[confidenceBucket(fact.confidence)]++;
        for (const cat of fact.categories) {
          categoryHistogram[cat] = (categoryHistogram[cat] ?? 0) + 1;
        }
      }

      const metadataPath = path.join(dir, 'sources', 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const { sources }: { sources: { id: string }[] } = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        for (const source of sources) {
          const envelope = readRawEnvelope(root, tp, source.id);
          if (envelope?.text) sourceTextBytes += Buffer.byteLength(envelope.text, 'utf-8');
        }
      }
    }

    const scorePath = path.join(dir, 'extracts', 'score.json');
    if (fs.existsSync(scorePath)) {
      hasScore = true;
      const { scores }: { scores: ScoreResult[] } = JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
      for (const score of scores) {
        if (score.promoted) promoted++;
        else rejected++;
      }
    }

    hasValidate = true;
    const reports = runValidate(root, tp, {});
    for (const report of reports) {
      allErrors.push(...report.errors);
      for (const issue of [...report.errors, ...report.warnings]) {
        warningsCountByType[issue.type] = (warningsCountByType[issue.type] ?? 0) + 1;
      }
    }
  }

  const relevantTiming = readOcrTiming(root).filter((e) => topicPaths.includes(e.topic));
  const latencies = relevantTiming.map((e) => e.ms).sort((a, b) => a - b);
  const timeoutCount = relevantTiming.filter((e) => e.outcome === 'failure').length;
  const hasOcrTiming = relevantTiming.length > 0;
  const p90 = percentile(latencies, 90);
  const fact_density = sourceTextBytes > 0 ? factCount / (sourceTextBytes / 1024) : 0;

  return {
    ocr_latency: {
      p50: percentile(latencies, 50),
      p90,
      p99: percentile(latencies, 99),
      timeout_rate: relevantTiming.length > 0 ? timeoutCount / relevantTiming.length : 0,
      latency_budget_ms: latencyBudgetMs,
      over_budget: p90 > latencyBudgetMs,
    },
    extract_stats: {
      fact_count: factCount,
      confidence_histogram: confidenceHistogram,
      category_histogram: categoryHistogram,
      fact_density,
    },
    score_stats: { promoted, rejected },
    validate_stats: { errors: allErrors, warnings_count_by_type: warningsCountByType },
    completeness: {
      has_ocr_timing: hasOcrTiming,
      has_extract: hasExtract,
      has_score: hasScore,
      has_validate: hasValidate,
    },
  };
}
```

Wire into `trm/src/cli/index.ts` — add the import alongside the others and register the command:

```typescript
import { runFeedbackStats } from './commands/feedbackStats';
```

```typescript
program
  .command('feedback-stats <path>')
  .option('--recursive')
  .option('--latency-budget-ms <ms>', 'override the OCR latency budget in ms (default 90000)', (v) => Number(v))
  .action((path, opts) => {
    const stats = runFeedbackStats(root, path, { recursive: opts.recursive, latencyBudgetMs: opts.latencyBudgetMs });
    console.log(JSON.stringify(stats, null, 2));
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd trm && npx jest tests/cli/feedbackStats.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd trm && git add src/cli/commands/feedbackStats.ts src/cli/index.ts tests/cli/feedbackStats.test.ts && git commit -m "feat(cli): add trm feedback-stats — mechanical batch-quality aggregation"
```

---

## Task 6: Run full `trm` suite, confirm no regressions

**Files:** none (verification-only task; no code changes)

- [ ] **Step 1: Run the entire `trm` test suite**

Run: `cd trm && npm test`
Expected: PASS — all pre-existing tests plus Tasks 1–5's new tests, no regressions from the `ValidationReport`/`Fact`/`OcrResult`/`crosslink` shape changes.

- [ ] **Step 2: Run `trm`'s typecheck**

Run: `cd trm && npm run typecheck`
Expected: PASS — no type errors from the new fields/interfaces.

(No commit — this task only verifies Tasks 1–5's combined state.)

---

## Task 7: Skill new-topic-candidate clustering

**Files:**
- Create: `skills/trm-feedback-report/package.json`
- Create: `skills/trm-feedback-report/tsconfig.json`
- Create: `skills/trm-feedback-report/jest.config.js`
- Create: `skills/trm-feedback-report/src/newTopicCandidates.ts`
- Test: `skills/trm-feedback-report/tests/newTopicCandidates.test.ts`

**Interfaces:**
- Produces: `findNewTopicCandidates(facts, existingSlugs): TopicCandidate[]`, `slugify(phrase): string`, `TopicCandidate { phrase: string; slug: string; factRefs: { factId: string; sourceId: string; confidence: number }[]; sourceCount: number; avgConfidence: number }`. Task 9's `SKILL.md` flow calls this directly.

- [ ] **Step 1: Scaffold the skill package**

Create `skills/trm-feedback-report/package.json`:

```json
{
  "name": "trm-feedback-report",
  "version": "0.1.0",
  "description": "Skill test suite",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "keywords": ["test", "jest"],
  "author": "Soren",
  "license": "MIT",
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  }
}
```

Create `skills/trm-feedback-report/tsconfig.json` (identical to `skills/automation-audit/tsconfig.json`):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "tests", "dist"]
}
```

Create `skills/trm-feedback-report/jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts'],
};
```

Run: `cd skills/trm-feedback-report && npm install`
Expected: installs jest/ts-jest/typescript devDependencies cleanly.

- [ ] **Step 2: Write the failing test**

Create `skills/trm-feedback-report/tests/newTopicCandidates.test.ts`:

```typescript
import { findNewTopicCandidates, slugify } from '../src/newTopicCandidates';

describe('slugify', () => {
  it('lowercases, hyphenates spaces, strips punctuation', () => {
    expect(slugify('Charles Sorensen')).toBe('charles-sorensen');
    expect(slugify("Willow Run's Plant")).toBe('willow-runs-plant');
  });
});

describe('findNewTopicCandidates', () => {
  const baseFacts = [
    { id: 'FCT-001', text: 'Charles Sorensen toured the plant in 1943.', source_id: 'SRC-001', confidence: 0.9 },
    { id: 'FCT-002', text: 'Charles Sorensen approved the new line layout.', source_id: 'SRC-002', confidence: 0.7 },
    { id: 'FCT-003', text: 'Records show Charles Sorensen visited weekly.', source_id: 'SRC-003', confidence: 0.6 },
  ];

  it('flags a phrase clearing all three guardrails as a candidate', () => {
    const candidates = findNewTopicCandidates(baseFacts, []);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(true);
  });

  it('does not flag a phrase appearing in fewer than 3 facts', () => {
    const facts = baseFacts.slice(0, 2);
    const candidates = findNewTopicCandidates(facts, []);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(false);
  });

  it('does not flag a phrase drawn from only 1 distinct source', () => {
    const facts = baseFacts.map((f) => ({ ...f, source_id: 'SRC-001' }));
    const candidates = findNewTopicCandidates(facts, []);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(false);
  });

  it('does not flag a phrase whose average confidence is below 0.55', () => {
    const facts = baseFacts.map((f) => ({ ...f, confidence: 0.2 }));
    const candidates = findNewTopicCandidates(facts, []);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(false);
  });

  it('does not flag a phrase whose slug already exists as a tag/path segment', () => {
    const candidates = findNewTopicCandidates(baseFacts, ['charlie/charles-sorensen']);
    expect(candidates.some((c) => c.slug === 'charles-sorensen')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd skills/trm-feedback-report && npx jest tests/newTopicCandidates.test.ts`
Expected: FAIL — `src/newTopicCandidates.ts` does not exist yet.

- [ ] **Step 4: Implement**

Create `skills/trm-feedback-report/src/newTopicCandidates.ts`:

```typescript
export interface CandidateFactRef {
  factId: string;
  sourceId: string;
  confidence: number;
}

export interface TopicCandidate {
  phrase: string;
  slug: string;
  factRefs: CandidateFactRef[];
  sourceCount: number;
  avgConfidence: number;
}

export interface FeedbackFact {
  id: string;
  text: string;
  source_id: string;
  confidence: number;
}

const TITLE_CASE_PHRASE_RE = /\b[A-Z][a-z]+(?:['\u2019]?[a-z]*)?(?:\s+[A-Z][a-z]+(?:['\u2019]?[a-z]*)?)+\b/g;

export function slugify(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function findNewTopicCandidates(facts: FeedbackFact[], existingSlugs: string[]): TopicCandidate[] {
  const byPhrase = new Map<string, { label: string; refs: CandidateFactRef[] }>();

  for (const fact of facts) {
    const matches = fact.text.match(TITLE_CASE_PHRASE_RE) ?? [];
    for (const phrase of matches) {
      const slug = slugify(phrase);
      const entry = byPhrase.get(slug) ?? { label: phrase, refs: [] };
      entry.refs.push({ factId: fact.id, sourceId: fact.source_id, confidence: fact.confidence });
      byPhrase.set(slug, entry);
    }
  }

  const candidates: TopicCandidate[] = [];
  for (const [slug, { label, refs }] of byPhrase) {
    if (refs.length < 3) continue;

    const distinctSources = new Set(refs.map((r) => r.sourceId));
    if (distinctSources.size < 2) continue;

    const avgConfidence = refs.reduce((sum, r) => sum + r.confidence, 0) / refs.length;
    if (avgConfidence < 0.55) continue;

    const alreadyExists = existingSlugs.some((existing) => existing === slug || existing.includes(slug));
    if (alreadyExists) continue;

    candidates.push({ phrase: label, slug, factRefs: refs, sourceCount: distinctSources.size, avgConfidence });
  }

  return candidates;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd skills/trm-feedback-report && npx jest tests/newTopicCandidates.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add skills/trm-feedback-report/package.json skills/trm-feedback-report/tsconfig.json skills/trm-feedback-report/jest.config.js skills/trm-feedback-report/src/newTopicCandidates.ts skills/trm-feedback-report/tests/newTopicCandidates.test.ts
git commit -m "feat(trm-feedback-report): add new-topic-candidate clustering from fact text"
```

---

## Task 8: Skill web-search signal-strength scoring

**Files:**
- Create: `skills/trm-feedback-report/src/signalStrength.ts`
- Test: `skills/trm-feedback-report/tests/signalStrength.test.ts`

**Interfaces:**
- Produces: `deriveSignalStrength(hits: SearchHit[]): SignalStrength`, `SignalStrength = 'low' | 'medium' | 'high'`, `SearchHit { consistent: boolean }`. `SKILL.md` (Task 9) instructs Claude to call `WebSearch` per selected fact, classify each hit's consistency with the fact's claim, then call this function.

- [ ] **Step 1: Write the failing test**

Create `skills/trm-feedback-report/tests/signalStrength.test.ts`:

```typescript
import { deriveSignalStrength } from '../src/signalStrength';

describe('deriveSignalStrength', () => {
  it('returns low when there are no corroborating hits at all', () => {
    expect(deriveSignalStrength([{ consistent: false }, { consistent: false }])).toBe('low');
  });

  it('returns low for a single ambiguous/contradictory hit among several', () => {
    expect(deriveSignalStrength([{ consistent: true }, { consistent: false }, { consistent: false }])).toBe('low');
  });

  it('returns medium for a majority-consistent but small hit set', () => {
    expect(deriveSignalStrength([{ consistent: true }, { consistent: true }, { consistent: false }])).toBe('medium');
  });

  it('returns high for several consistent hits with high agreement', () => {
    expect(deriveSignalStrength([
      { consistent: true }, { consistent: true }, { consistent: true }, { consistent: true },
    ])).toBe('high');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd skills/trm-feedback-report && npx jest tests/signalStrength.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement**

Create `skills/trm-feedback-report/src/signalStrength.ts`:

```typescript
export type SignalStrength = 'low' | 'medium' | 'high';

export interface SearchHit {
  consistent: boolean;
}

export function deriveSignalStrength(hits: SearchHit[]): SignalStrength {
  if (hits.length === 0) return 'low';

  const corroborating = hits.filter((h) => h.consistent).length;
  if (corroborating === 0) return 'low';

  const consistencyRatio = corroborating / hits.length;
  if (corroborating >= 3 && consistencyRatio >= 0.8) return 'high';
  if (corroborating >= 1 && consistencyRatio >= 0.5) return 'medium';
  return 'low';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd skills/trm-feedback-report && npx jest tests/signalStrength.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/trm-feedback-report/src/signalStrength.ts skills/trm-feedback-report/tests/signalStrength.test.ts
git commit -m "feat(trm-feedback-report): add web-search signal-strength scoring"
```

---

## Task 9: Report metadata/filename, `trm` CLI wrapper, and skill scaffold

**Files:**
- Create: `skills/trm-feedback-report/src/reportMeta.ts`
- Create: `skills/trm-feedback-report/src/trmCli.ts`
- Create: `skills/trm-feedback-report/src/index.ts`
- Create: `skills/trm-feedback-report/skill.json`
- Create: `skills/trm-feedback-report/SKILL.md`
- Create: `skills/trm-feedback-report/README.md`
- Create: `skills/trm-feedback-report/docs/USAGE.md`
- Test: `skills/trm-feedback-report/tests/reportMeta.test.ts`
- Test: `skills/trm-feedback-report/tests/trmCli.test.ts`

**Interfaces:**
- Consumes: `findNewTopicCandidates`/`slugify` (Task 7), `deriveSignalStrength` (Task 8).
- Produces: `buildReportMeta(completeness, hardFailure, webSearchSkipped): { partial_report: boolean; latency_data_stale: boolean }`, `reportFilename(topicSlug, statsVersion?): string`, `runTrmCommand(trmRoot, args): string`. These plus Tasks 7/8's exports are re-exported from `src/index.ts` as the skill's public surface, invoked directly by whichever agent runs this skill (per `SKILL.md`'s flow).

- [ ] **Step 1: Write the failing tests**

Create `skills/trm-feedback-report/tests/reportMeta.test.ts`:

```typescript
import { buildReportMeta, reportFilename } from '../src/reportMeta';

describe('buildReportMeta', () => {
  const fullCompleteness = { has_ocr_timing: true, has_extract: true, has_score: true, has_validate: true };

  it('is fully clean when nothing is missing or skipped', () => {
    expect(buildReportMeta(fullCompleteness, false, false)).toEqual({ partial_report: false, latency_data_stale: false });
  });

  it('flags latency_data_stale (not partial_report) when only ocr timing is missing', () => {
    const completeness = { ...fullCompleteness, has_ocr_timing: false };
    expect(buildReportMeta(completeness, false, false)).toEqual({ partial_report: false, latency_data_stale: true });
  });

  it('flags partial_report when validate/feedback-stats failed to run', () => {
    expect(buildReportMeta(fullCompleteness, true, false)).toEqual({ partial_report: true, latency_data_stale: false });
  });

  it('flags partial_report when the web-search step was skipped', () => {
    expect(buildReportMeta(fullCompleteness, false, true)).toEqual({ partial_report: true, latency_data_stale: false });
  });
});

describe('reportFilename', () => {
  it('includes the topic slug and stats version', () => {
    const name = reportFilename('charlie/benson-ford');
    expect(name).toMatch(/^charlie-benson-ford-feedback-v1-\d+\.md$/);
  });
});
```

Create `skills/trm-feedback-report/tests/trmCli.test.ts`:

```typescript
import { execFileSync } from 'node:child_process';
import { runTrmCommand } from '../src/trmCli';

jest.mock('node:child_process');

describe('runTrmCommand', () => {
  it('shells out to the trm binary with the given args and cwd', () => {
    (execFileSync as jest.Mock).mockReturnValue('{"ok":true}');
    const output = runTrmCommand('/vault/root', ['feedback-stats', 'charlie/benson-ford', '--recursive']);
    expect(execFileSync).toHaveBeenCalledWith(
      'trm',
      ['feedback-stats', 'charlie/benson-ford', '--recursive'],
      { cwd: '/vault/root', encoding: 'utf-8' }
    );
    expect(output).toBe('{"ok":true}');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd skills/trm-feedback-report && npx jest tests/reportMeta.test.ts tests/trmCli.test.ts`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Implement `reportMeta.ts`**

Create `skills/trm-feedback-report/src/reportMeta.ts`:

```typescript
export interface Completeness {
  has_ocr_timing: boolean;
  has_extract: boolean;
  has_score: boolean;
  has_validate: boolean;
}

export interface ReportMeta {
  partial_report: boolean;
  latency_data_stale: boolean;
}

export function buildReportMeta(completeness: Completeness, hardFailure: boolean, webSearchSkipped: boolean): ReportMeta {
  return {
    partial_report: hardFailure || webSearchSkipped,
    latency_data_stale: !completeness.has_ocr_timing,
  };
}

export function reportFilename(topicPath: string, statsVersion: string = 'v1'): string {
  const slug = topicPath.replace(/\//g, '-');
  const stamp = Date.now();
  return `${slug}-feedback-${statsVersion}-${stamp}.md`;
}
```

- [ ] **Step 4: Implement `trmCli.ts`**

Create `skills/trm-feedback-report/src/trmCli.ts`:

```typescript
import { execFileSync } from 'node:child_process';

export function runTrmCommand(trmRoot: string, args: string[]): string {
  return execFileSync('trm', args, { cwd: trmRoot, encoding: 'utf-8' });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd skills/trm-feedback-report && npx jest tests/reportMeta.test.ts tests/trmCli.test.ts`
Expected: PASS

- [ ] **Step 6: Create `src/index.ts` (public surface)**

Create `skills/trm-feedback-report/src/index.ts`:

```typescript
export { findNewTopicCandidates, slugify } from './newTopicCandidates';
export type { TopicCandidate, CandidateFactRef, FeedbackFact } from './newTopicCandidates';
export { deriveSignalStrength } from './signalStrength';
export type { SignalStrength, SearchHit } from './signalStrength';
export { buildReportMeta, reportFilename } from './reportMeta';
export type { Completeness, ReportMeta } from './reportMeta';
export { runTrmCommand } from './trmCli';
```

- [ ] **Step 7: Write `skill.json`**

Create `skills/trm-feedback-report/skill.json`:

```json
{
  "id": "trm-feedback-report",
  "name": "TRM Feedback/Report",
  "version": "0.1.0",
  "description": "Post-ingest-batch feedback pass for TRM: classifier/extraction quality, OCR latency vs. budget, candidate new-topic surfacing, and a web-search cross-check on low-confidence facts.",
  "author": "Soren (Cast Iron Forge)",
  "license": "MIT",
  "category": "research-ops",
  "runtime": "typescript",
  "entrypoint": "src/index.ts",
  "keywords": ["trm", "ingest-feedback", "classifier-accuracy", "ocr-latency", "new-topic-candidates"],
  "commands": {
    "invoke": "trm-feedback-report",
    "usage": "trm-feedback-report <topicPath> [--recursive] [--latency-budget-ms 90000]"
  },
  "inputs": {
    "topicPath": "string (required) — trm-vault topic path, e.g. charlie/benson-ford",
    "trmRoot": "string (required) — trm-vault root directory, passed to runTrmCommand",
    "recursive": "boolean (optional, default false)",
    "latencyBudgetMs": "number (optional, default 90000)"
  },
  "outputs": {
    "feedbackReport": {
      "reportPath": "string — path to the written markdown report under <trmRoot>/reports/",
      "partial_report": "boolean",
      "latency_data_stale": "boolean"
    }
  },
  "dependencies": {
    "internal": ["trm CLI (validate, feedback-stats, crosslink subcommands)"],
    "external": []
  },
  "errorConditions": [
    { "code": "TOPIC_NOT_FOUND", "message": "topicPath does not exist in the trm-vault", "handler": "fail" },
    { "code": "TRM_CLI_NOT_FOUND", "message": "trm binary is not on PATH / not installed", "handler": "fail" }
  ],
  "integrations": {
    "cowork": {
      "registered": false,
      "pluginType": "skill",
      "icon": "search",
      "registrationPath": "cowork://toolforge/skills/trm-feedback-report",
      "status": "pending_registration"
    }
  },
  "tooltip": "Post-ingest feedback pass for TRM batches: fact quality, OCR latency, new-topic candidates, web-search cross-check."
}
```

- [ ] **Step 8: Write `SKILL.md`**

Create `skills/trm-feedback-report/SKILL.md`:

```markdown
---
name: trm-feedback-report
description: Post-ingest-batch feedback pass for TRM — classifier/extraction quality, OCR latency vs. budget, candidate new-topic surfacing, and a web-search cross-check on low-confidence facts.
compatibility: |
  - Runtime: Node.js 18+, trm CLI on PATH
  - Dependencies: (see package.json)
---

# TRM Feedback/Report

Standing feedback pass for a TRM ingest batch. Run after `trm ingest-dir` completes.

## Trigger

After any TRM ingest batch, or on request ("feedback on the last ingest batch", "report on <topic>").

## Flow

1. Run `runTrmCommand(trmRoot, ['validate', topicPath, '--recursive'])` and `runTrmCommand(trmRoot, ['feedback-stats', topicPath, '--recursive', '--latency-budget-ms', String(latencyBudgetMs)])`. Parse both as JSON.
2. Read `extracts/extract.json` facts for the topic (recursively, matching `--recursive`) and call `findNewTopicCandidates(facts, existingTagsAndPathSegments)`, where `existingTagsAndPathSegments` is collected by walking `topic.json` from the vault root.
3. Select facts with `confidence < 0.55` OR `flags?.includes('VERIFY')`, capped at the top 10 by `score.json`'s `promotion_score`. For each, call the `WebSearch` tool, classify each hit's consistency with the fact's claim, then call `deriveSignalStrength(hits)`.
4. Write the narrative report: classifier accuracy verdict, extraction gaps (using `fact_density`/`over_budget`/`warnings_count_by_type`), three required risk labels (extraction risk / classifier drift risk / latency risk, each low/medium/high), new-topic candidates from step 2, cross-check results from step 3. Call `buildReportMeta(stats.completeness, hardFailure, webSearchSkipped)` for the `partial_report`/`latency_data_stale` flags and `reportFilename(topicPath)` for the filename.
5. Write the file to `<trmRoot>/reports/<filename>`.
6. Call `runTrmCommand(trmRoot, ['crosslink', topicPath, '--tags', 'trm-feedback-report:v1'])`.

## Input Schema

```typescript
interface Input {
  topicPath: string;
  trmRoot: string;
  recursive?: boolean;
  latencyBudgetMs?: number;
}
```

## Output Schema

```typescript
interface Output {
  reportPath: string;
  partial_report: boolean;
  latency_data_stale: boolean;
}
```

---

**Full reference:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For detailed workflow:** See [docs/USAGE.md](docs/USAGE.md).
```

- [ ] **Step 9: Write `README.md`**

Create `skills/trm-feedback-report/README.md`:

```markdown
# TRM Feedback/Report

Post-ingest-batch feedback pass for TRM: classifier/extraction quality, OCR latency vs. budget, candidate new-topic surfacing, and a web-search cross-check on low-confidence facts.

## Quick Start

```bash
npm test
```

## What it does

- Runs `trm validate`/`trm feedback-stats` and surfaces classifier accuracy, extraction gaps, and OCR latency vs. a configurable budget
- Clusters repeated proper-noun phrases in fact text into candidate new-topic stubs, guarded against single-source/low-confidence false positives
- Cross-checks low-confidence or `VERIFY`-flagged facts against a web search, scoring corroboration as low/medium/high signal strength
- Writes a versioned markdown report and tags it into the topic's lineage via `trm crosslink --tags`

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For detailed workflow:** See [docs/USAGE.md](docs/USAGE.md).
```

- [ ] **Step 10: Write `docs/USAGE.md`**

Create `skills/trm-feedback-report/docs/USAGE.md`:

```markdown
# TRM Feedback/Report — Usage

## Prerequisites

- `trm` CLI installed and on `PATH` (or invoked from `trm/` with `npx ts-node src/cli/index.ts`, adjusting `runTrmCommand`'s binary name accordingly for local dev).
- A `trm-vault` root containing the target topic, already ingested via `trm ingest-dir`.

## Running

Invoke via whichever agent runs this skill, passing `topicPath` and `trmRoot`. The skill's own exported functions (`findNewTopicCandidates`, `deriveSignalStrength`, `buildReportMeta`, `reportFilename`, `runTrmCommand`) are deterministic and unit-tested in isolation — the orchestration in `SKILL.md`'s Flow section (running `WebSearch`, writing the narrative prose) is performed by the invoking agent directly, since those steps require tool access this package's plain Node code does not have.

## Troubleshooting

- **`TRM_CLI_NOT_FOUND`**: confirm `trm` resolves on `PATH` inside `trmRoot`, or pass an absolute path to the `trm` binary by adjusting the first argument to `execFileSync` in `src/trmCli.ts`.
- **Every report shows `latency_data_stale: true`**: expected for any topic ingested before the OCR-timing instrumentation (`trm`'s `.trm-ops/ocr-timing.jsonl`) shipped — re-run `trm ingest-dir --retry-failed` or a fresh batch to populate it.
- **New-topic candidates never fire**: the three guardrails (≥3 facts, ≥2 distinct sources, ≥0.55 avg confidence) are intentionally conservative — a quiet batch with few repeated proper nouns across sources is expected to produce zero candidates, not a bug.
```

- [ ] **Step 11: Run the full skill test suite**

Run: `cd skills/trm-feedback-report && npx jest`
Expected: PASS — all of Tasks 7–9's tests together.

- [ ] **Step 12: Commit**

```bash
git add skills/trm-feedback-report/src/reportMeta.ts skills/trm-feedback-report/src/trmCli.ts skills/trm-feedback-report/src/index.ts skills/trm-feedback-report/skill.json skills/trm-feedback-report/SKILL.md skills/trm-feedback-report/README.md skills/trm-feedback-report/docs/USAGE.md skills/trm-feedback-report/tests/reportMeta.test.ts skills/trm-feedback-report/tests/trmCli.test.ts
git commit -m "feat(trm-feedback-report): add report metadata, trm CLI wrapper, and skill scaffold"
```

---

## Task 10: TODOS.md closure

**Files:**
- Modify: `TODOS.md`

- [ ] **Step 1: Mark the backlog item closed**

In `TODOS.md`, change the "TRM feedback/report skill" line from `- [ ]` to `- [x]`, appending a short closure note in the same style as other closed entries (real file/commit references, not a vague "done"):

```markdown
- [x] **TRM feedback/report skill** — `trm feedback-stats`/typed `validate` errors/`Fact.flags`/`crosslink --tags`/OCR-timing log shipped in `trm` (Tasks 1-6), `skills/trm-feedback-report/` shipped as the orchestrating skill (Tasks 7-9). See `docs/superpowers/specs/2026-07-28-trm-feedback-report-design.md` and `docs/superpowers/plans/2026-07-28-trm-feedback-report.md`.
```

- [ ] **Step 2: Commit**

```bash
git add TODOS.md && git commit -m "chore(todos): close TRM feedback/report skill backlog item"
```
