# Topic Research Module (TRM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone `trm` CLI/repo per `docs/meta/specs/2026-07-17-trm-topic-research-module-design.md` — recursive project/topic/subtopic research packets with lineage, stub scoring, and a governance-validating CLI.

**Architecture:** A new git repo at `C:\dev\trm`. Pure TypeScript/Node library (`src/core`, `src/scoring`, `src/lineage`, `src/extraction`, `src/registry`, `src/schemas`) wired together by a `commander`-based CLI (`src/cli`). Every CLI command is a plain exported function first, commander wiring is a thin adapter — this keeps commands directly unit-testable without spawning a process.

**Tech Stack:** TypeScript (strict), Node 20+, Jest + ts-jest (matches `cic-ingestion` convention), `commander` for CLI, `ajv` for JSON Schema validation, `node:crypto` for hashing, `node:fs` for storage. No external services required for v1 (no network calls).

## Global Constraints

- Standalone repo, zero build-time dependency on `cic-ingestion` or `services/torquequery` (spec §2).
- `ScoreResult` is closed — `schemas/score.schema.json` must set `additionalProperties: false` (spec §5).
- Lineage chaining is per-node only — never chain hashes across node boundaries (spec §3.5, §7).
- Actor ID format is `ACTOR-NNN` (3+ digits, zero-padded to at least 3), not `ACT-YYYYMMDD-NNNN` (spec §9).
- `promoted: true` may only be written by a `ScoringAdapter` — never hand-set (spec §7).
- v1 excludes: real TorqueQuery API client, CIC Treatment drift-checking, embedding-based topic similarity, multi-actor write locking, multi-repo version coordination (spec §8).

---

## File Structure

```
trm/
  package.json
  tsconfig.json
  jest.config.cjs
  config.json
  .gitignore
  README.md
  src/
    core/
      types.ts            # TopicMeta, NodeStatus, NodeType, TrmConfig
      paths.ts             # slug/path validation, node_type derivation
      config.ts            # load/validate config.json
      topicNode.ts          # create/read/write topic.json, parent/children maintenance
      sourceIngest.ts        # sources/metadata.json read/write + add source
    registry/
      actorRegistry.ts       # ACTOR-NNN resolution + local registry file
    lineage/
      hasher.ts               # chained hash compute, appendOperation, validateChain
    schemas/
      topic.schema.json
      metadata.schema.json
      extract.schema.json
      score.schema.json
      lineage.schema.json
      related_topics.schema.json
      validator.ts            # ajv wrapper, validateAgainstSchema(name, data)
    scoring/
      types.ts                # Fact, ScoreResult, ScoringAdapter
      adapters/
        stub.ts                 # deterministic weighted-formula adapter
    extraction/
      types.ts                 # ExtractionRunner interface
      stubRunner.ts              # deterministic mock runner (used by default + tests)
    crosslinks/
      treatmentLink.ts           # write-only treatment.json pointer
      relatedTopics.ts            # tag-overlap strength, related_topics.json read/write
    cli/
      commands/
        create.ts
        ingest.ts
        extract.ts
        score.ts
        crosslink.ts
        versionBump.ts
        validate.ts
      index.ts                   # commander wiring, calls command functions
  tests/
    core/paths.test.ts
    core/topicNode.test.ts
    core/sourceIngest.test.ts
    registry/actorRegistry.test.ts
    lineage/hasher.test.ts
    schemas/validator.test.ts
    scoring/stub.test.ts
    extraction/stubRunner.test.ts
    crosslinks/relatedTopics.test.ts
    cli/commands.test.ts         # integration: full create->ingest->extract->score->crosslink->validate flow
```

Each `src/` file has one responsibility; tests mirror the same path under `tests/`. CLI command functions take `(root: string, ...)` as their first arg (never read `process.cwd()` directly) so tests can point them at a temp dir.

---

## Task 1: Repo scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `jest.config.cjs`, `.gitignore`, `config.json`, `README.md`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: working `npm test` command, `tsc --noEmit` typecheck, jest resolving `.ts` files.

- [ ] **Step 1: Create the repo directory and package.json**

```bash
mkdir -p C:/dev/trm/src C:/dev/trm/tests
cd C:/dev/trm
git init
```

`C:/dev/trm/package.json`:

```json
{
  "name": "trm",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "bin": { "trm": "dist/cli/index.js" },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "trm": "ts-node src/cli/index.ts"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.30",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.5"
  },
  "dependencies": {
    "ajv": "^8.12.0",
    "commander": "^12.0.0"
  }
}
```

`C:/dev/trm/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

`C:/dev/trm/jest.config.cjs`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
};
```

`C:/dev/trm/.gitignore`:

```
node_modules/
dist/
*.log
```

`C:/dev/trm/config.json`:

```json
{
  "default_scoring_adapter": "stub",
  "promotion_threshold": 80,
  "actor_source": "env",
  "time_source": "system"
}
```

`C:/dev/trm/README.md`:

```markdown
# trm

Topic Research Module CLI. See `docs/meta/specs/2026-07-17-trm-topic-research-module-design.md`
in the main `C:/dev` repo for the design spec.
```

- [ ] **Step 2: Install dependencies**

```bash
cd C:/dev/trm
npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 3: Write smoke test**

`tests/smoke.test.ts`:

```ts
describe('project scaffold', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run test to verify it passes, and typecheck**

```bash
cd C:/dev/trm
npm test
npm run typecheck
```

Expected: `1 passed`, typecheck exits 0 (no `src/` files yet, so nothing to check — this just confirms the toolchain runs).

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add package.json tsconfig.json jest.config.cjs .gitignore config.json README.md tests/smoke.test.ts
git commit -m "chore: scaffold trm repo (TS + Jest + ajv + commander)"
```

---

## Task 2: Path/slug utilities

**Files:**
- Create: `src/core/types.ts`, `src/core/paths.ts`
- Test: `tests/core/paths.test.ts`

**Interfaces:**
- Produces:
  - `type NodeStatus = 'container' | 'active'`
  - `type NodeType = 'project' | 'topic' | 'subtopic'`
  - `interface TopicMeta { topic: string; path: string; parent: string | null; children: string[]; version: string; created_at: string; updated_at: string; actors: string[]; description: string; tags: string[]; status: NodeStatus; node_type: NodeType; }`
  - `validateSlug(slug: string): void` — throws `Error` on invalid slug
  - `splitPath(path: string): string[]`
  - `deriveNodeType(path: string): NodeType`
  - `parentPath(path: string): string | null`
  - `leafSlug(path: string): string`
  - `nodeDir(root: string, path: string): string`

- [ ] **Step 1: Write the failing test**

`tests/core/paths.test.ts`:

```ts
import * as path from 'node:path';
import { validateSlug, splitPath, deriveNodeType, parentPath, leafSlug, nodeDir } from '../../src/core/paths';

describe('paths', () => {
  it('validates slugs', () => {
    expect(() => validateSlug('cuba')).not.toThrow();
    expect(() => validateSlug('cuba-industry')).not.toThrow();
    expect(() => validateSlug('Cuba Industry')).toThrow();
    expect(() => validateSlug('')).toThrow();
  });

  it('splits paths', () => {
    expect(splitPath('cuba/industry/automotive')).toEqual(['cuba', 'industry', 'automotive']);
  });

  it('derives node type by depth', () => {
    expect(deriveNodeType('cuba')).toBe('project');
    expect(deriveNodeType('cuba/industry')).toBe('topic');
    expect(deriveNodeType('cuba/industry/automotive')).toBe('subtopic');
    expect(deriveNodeType('cuba/industry/automotive/parts')).toBe('subtopic');
  });

  it('computes parent path', () => {
    expect(parentPath('cuba')).toBeNull();
    expect(parentPath('cuba/industry')).toBe('cuba');
    expect(parentPath('cuba/industry/automotive')).toBe('cuba/industry');
  });

  it('extracts leaf slug', () => {
    expect(leafSlug('cuba/industry/automotive')).toBe('automotive');
    expect(leafSlug('cuba')).toBe('cuba');
  });

  it('resolves node directory under root', () => {
    expect(nodeDir('/root', 'cuba/industry')).toBe(path.join('/root', 'topics', 'cuba', 'industry'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/core/paths.test.ts
```

Expected: FAIL — `Cannot find module '../../src/core/paths'`.

- [ ] **Step 3: Write minimal implementation**

`src/core/types.ts`:

```ts
export type NodeStatus = 'container' | 'active';
export type NodeType = 'project' | 'topic' | 'subtopic';

export interface TopicMeta {
  topic: string;
  path: string;
  parent: string | null;
  children: string[];
  version: string;
  created_at: string;
  updated_at: string;
  actors: string[];
  description: string;
  tags: string[];
  status: NodeStatus;
  node_type: NodeType;
}

export interface TrmConfig {
  default_scoring_adapter: string;
  promotion_threshold: number;
  actor_source: 'env' | 'cli-only';
  time_source: 'system' | 'fixed';
}
```

`src/core/paths.ts`:

```ts
import * as path from 'node:path';
import { NodeType } from './types';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`invalid slug: "${slug}" (must be lowercase kebab-case)`);
  }
}

export function splitPath(topicPath: string): string[] {
  const segments = topicPath.split('/').filter(Boolean);
  segments.forEach(validateSlug);
  return segments;
}

export function deriveNodeType(topicPath: string): NodeType {
  const depth = splitPath(topicPath).length;
  if (depth <= 1) return 'project';
  if (depth === 2) return 'topic';
  return 'subtopic';
}

export function parentPath(topicPath: string): string | null {
  const segments = splitPath(topicPath);
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join('/');
}

export function leafSlug(topicPath: string): string {
  const segments = splitPath(topicPath);
  return segments[segments.length - 1];
}

export function nodeDir(root: string, topicPath: string): string {
  return path.join(root, 'topics', ...splitPath(topicPath));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/core/paths.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/core/types.ts src/core/paths.ts tests/core/paths.test.ts
git commit -m "feat: path/slug utilities and node-type derivation"
```

---

## Task 3: Config loader

**Files:**
- Create: `src/core/config.ts`
- Test: `tests/core/config.test.ts`

**Interfaces:**
- Consumes: `TrmConfig` from `src/core/types.ts` (Task 2)
- Produces: `loadConfig(root: string): TrmConfig`

- [ ] **Step 1: Write the failing test**

`tests/core/config.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from '../../src/core/config';

describe('loadConfig', () => {
  it('loads and validates config.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
    fs.writeFileSync(
      path.join(root, 'config.json'),
      JSON.stringify({
        default_scoring_adapter: 'stub',
        promotion_threshold: 80,
        actor_source: 'env',
        time_source: 'system',
      })
    );
    const config = loadConfig(root);
    expect(config.promotion_threshold).toBe(80);
    expect(config.actor_source).toBe('env');
  });

  it('throws if config.json is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
    expect(() => loadConfig(root)).toThrow(/config\.json/);
  });

  it('throws on invalid actor_source', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
    fs.writeFileSync(
      path.join(root, 'config.json'),
      JSON.stringify({
        default_scoring_adapter: 'stub',
        promotion_threshold: 80,
        actor_source: 'bogus',
        time_source: 'system',
      })
    );
    expect(() => loadConfig(root)).toThrow(/actor_source/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/core/config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/core/config.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TrmConfig } from './types';

export function loadConfig(root: string): TrmConfig {
  const configPath = path.join(root, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`config.json not found at ${configPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (raw.actor_source !== 'env' && raw.actor_source !== 'cli-only') {
    throw new Error(`config.json actor_source must be "env" or "cli-only", got "${raw.actor_source}"`);
  }
  if (raw.time_source !== 'system' && raw.time_source !== 'fixed') {
    throw new Error(`config.json time_source must be "system" or "fixed", got "${raw.time_source}"`);
  }
  if (typeof raw.promotion_threshold !== 'number') {
    throw new Error('config.json promotion_threshold must be a number');
  }
  if (typeof raw.default_scoring_adapter !== 'string') {
    throw new Error('config.json default_scoring_adapter must be a string');
  }
  return raw as TrmConfig;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/core/config.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/core/config.ts tests/core/config.test.ts
git commit -m "feat: config.json loader with validation"
```

---

## Task 4: JSON Schemas + validator

**Files:**
- Create: `src/schemas/topic.schema.json`, `src/schemas/metadata.schema.json`, `src/schemas/extract.schema.json`, `src/schemas/score.schema.json`, `src/schemas/lineage.schema.json`, `src/schemas/related_topics.schema.json`, `src/schemas/validator.ts`
- Test: `tests/schemas/validator.test.ts`

**Interfaces:**
- Produces: `validateAgainstSchema(schemaName: 'topic' | 'metadata' | 'extract' | 'score' | 'lineage' | 'related_topics', data: unknown): { valid: boolean; errors: string[] }`

This locks the score.json contract as closed, per spec §5 — this is the piece the review feedback called out as the difference between "spec" and "machine-enforceable contract."

- [ ] **Step 1: Write the failing test**

`tests/schemas/validator.test.ts`:

```ts
import { validateAgainstSchema } from '../../src/schemas/validator';

describe('validateAgainstSchema', () => {
  it('accepts a valid score.json', () => {
    const result = validateAgainstSchema('score', {
      scores: [
        {
          fact_id: 'FCT-001',
          relevance: 88,
          genealogy: 10,
          historical: 90,
          confidence: 92,
          novelty: 40,
          promotion_score: 83.4,
          promoted: true,
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a score.json with extra fields (closed schema)', () => {
    const result = validateAgainstSchema('score', {
      scores: [
        {
          fact_id: 'FCT-001',
          relevance: 88,
          genealogy: 10,
          historical: 90,
          confidence: 92,
          novelty: 40,
          promotion_score: 83.4,
          promoted: true,
          extra_field: 'nope',
        },
      ],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a score.json missing a required field', () => {
    const result = validateAgainstSchema('score', { scores: [{ fact_id: 'FCT-001' }] });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid topic.json', () => {
    const result = validateAgainstSchema('topic', {
      topic: 'automotive',
      path: 'cuba/industry/automotive',
      parent: 'cuba/industry',
      children: [],
      version: '1.0.0',
      created_at: '2026-07-17T16:50:00',
      updated_at: '2026-07-17T16:50:00',
      actors: ['ACTOR-001'],
      description: 'x',
      tags: ['history'],
      status: 'active',
      node_type: 'subtopic',
    });
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/schemas/validator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/schemas/score.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["scores"],
  "additionalProperties": false,
  "properties": {
    "scores": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["fact_id", "relevance", "genealogy", "historical", "confidence", "novelty", "promotion_score", "promoted"],
        "additionalProperties": false,
        "properties": {
          "fact_id": { "type": "string" },
          "relevance": { "type": "number" },
          "genealogy": { "type": "number" },
          "historical": { "type": "number" },
          "confidence": { "type": "number" },
          "novelty": { "type": "number" },
          "promotion_score": { "type": "number" },
          "promoted": { "type": "boolean" }
        }
      }
    }
  }
}
```

`src/schemas/topic.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["topic", "path", "parent", "children", "version", "created_at", "updated_at", "actors", "description", "tags", "status", "node_type"],
  "additionalProperties": false,
  "properties": {
    "topic": { "type": "string" },
    "path": { "type": "string" },
    "parent": { "type": ["string", "null"] },
    "children": { "type": "array", "items": { "type": "string" } },
    "version": { "type": "string" },
    "created_at": { "type": "string" },
    "updated_at": { "type": "string" },
    "actors": { "type": "array", "items": { "type": "string" } },
    "description": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "status": { "enum": ["container", "active"] },
    "node_type": { "enum": ["project", "topic", "subtopic"] }
  }
}
```

`src/schemas/metadata.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["sources"],
  "additionalProperties": false,
  "properties": {
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "title", "origin", "url", "added_at", "actor"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string" },
          "type": { "type": "string" },
          "title": { "type": "string" },
          "origin": { "type": "string" },
          "url": { "type": "string" },
          "added_at": { "type": "string" },
          "actor": { "type": "string" }
        }
      }
    }
  }
}
```

`src/schemas/extract.schema.json`:

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
          "categories": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

`src/schemas/lineage.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["topic", "hash", "operations"],
  "additionalProperties": false,
  "properties": {
    "topic": { "type": "string" },
    "hash": { "type": "string" },
    "operations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "op", "hash", "actor", "timestamp"],
        "properties": {
          "id": { "type": "string" },
          "op": { "type": "string" },
          "hash": { "type": "string" },
          "actor": { "type": "string" },
          "timestamp": { "type": "string" }
        }
      }
    }
  }
}
```

`src/schemas/related_topics.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["related"],
  "additionalProperties": false,
  "properties": {
    "related": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["topic", "relationship", "strength"],
        "additionalProperties": false,
        "properties": {
          "topic": { "type": "string" },
          "relationship": { "type": "string" },
          "strength": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    }
  }
}
```

`src/schemas/validator.ts`:

```ts
import Ajv, { ErrorObject } from 'ajv';
import topicSchema from './topic.schema.json';
import metadataSchema from './metadata.schema.json';
import extractSchema from './extract.schema.json';
import scoreSchema from './score.schema.json';
import lineageSchema from './lineage.schema.json';
import relatedTopicsSchema from './related_topics.schema.json';

export type SchemaName = 'topic' | 'metadata' | 'extract' | 'score' | 'lineage' | 'related_topics';

const ajv = new Ajv({ allErrors: true });
const schemas: Record<SchemaName, object> = {
  topic: topicSchema,
  metadata: metadataSchema,
  extract: extractSchema,
  score: scoreSchema,
  lineage: lineageSchema,
  related_topics: relatedTopicsSchema,
};
const compiled = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)])
) as Record<SchemaName, ReturnType<Ajv['compile']>>;

export function validateAgainstSchema(schemaName: SchemaName, data: unknown): { valid: boolean; errors: string[] } {
  const validateFn = compiled[schemaName];
  const valid = validateFn(data) as boolean;
  const errors = (validateFn.errors ?? []).map((e: ErrorObject) => `${e.instancePath} ${e.message}`);
  return { valid, errors };
}
```

Update `tsconfig.json` to allow JSON imports — add `"resolveJsonModule": true` to `compilerOptions`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/schemas/validator.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/schemas tests/schemas/validator.test.ts tsconfig.json
git commit -m "feat: JSON Schemas for all TRM file types, closed score.json contract"
```

---

## Task 5: Actor registry

**Files:**
- Create: `src/registry/actorRegistry.ts`
- Test: `tests/registry/actorRegistry.test.ts`

**Interfaces:**
- Consumes: `loadConfig` (Task 3)
- Produces:
  - `resolveActor(root: string, cliActor?: string): string`
  - `registerActor(root: string, actorId: string): void`
  - `ACTOR_ID_RE = /^ACTOR-\d{3,}$/`

- [ ] **Step 1: Write the failing test**

`tests/registry/actorRegistry.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveActor, registerActor } from '../../src/registry/actorRegistry';

function makeRoot(config: object) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify(config));
  return root;
}

describe('actorRegistry', () => {
  afterEach(() => {
    delete process.env.TRM_ACTOR;
  });

  it('resolves actor from env when actor_source is env', () => {
    const root = makeRoot({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'env', time_source: 'system' });
    process.env.TRM_ACTOR = 'ACTOR-001';
    expect(resolveActor(root)).toBe('ACTOR-001');
  });

  it('throws when actor_source is env and TRM_ACTOR unset', () => {
    const root = makeRoot({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'env', time_source: 'system' });
    expect(() => resolveActor(root)).toThrow(/TRM_ACTOR/);
  });

  it('requires --actor when actor_source is cli-only, ignores env', () => {
    const root = makeRoot({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' });
    process.env.TRM_ACTOR = 'ACTOR-001';
    expect(() => resolveActor(root)).toThrow(/--actor/);
    expect(resolveActor(root, 'ACTOR-002')).toBe('ACTOR-002');
  });

  it('rejects malformed actor ids', () => {
    const root = makeRoot({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' });
    expect(() => resolveActor(root, 'bob')).toThrow(/ACTOR-/);
  });

  it('registers a new actor exactly once', () => {
    const root = makeRoot({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' });
    registerActor(root, 'ACTOR-001');
    registerActor(root, 'ACTOR-001');
    const registryPath = path.join(root, 'registry', 'actors.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    expect(registry.actors).toEqual([{ actor_id: 'ACTOR-001' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/registry/actorRegistry.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/registry/actorRegistry.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../core/config';

export const ACTOR_ID_RE = /^ACTOR-\d{3,}$/;

function validateActorId(actorId: string): void {
  if (!ACTOR_ID_RE.test(actorId)) {
    throw new Error(`invalid actor id "${actorId}", expected format ACTOR-NNN`);
  }
}

export function resolveActor(root: string, cliActor?: string): string {
  const config = loadConfig(root);
  let actorId: string;
  if (config.actor_source === 'cli-only') {
    if (!cliActor) {
      throw new Error('actor_source is "cli-only" — pass --actor explicitly');
    }
    actorId = cliActor;
  } else {
    actorId = cliActor ?? process.env.TRM_ACTOR ?? '';
    if (!actorId) {
      throw new Error('TRM_ACTOR env var not set (actor_source is "env")');
    }
  }
  validateActorId(actorId);
  registerActor(root, actorId);
  return actorId;
}

export function registerActor(root: string, actorId: string): void {
  validateActorId(actorId);
  const registryDir = path.join(root, 'registry');
  const registryPath = path.join(registryDir, 'actors.json');
  fs.mkdirSync(registryDir, { recursive: true });
  const registry: { actors: { actor_id: string }[] } = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
    : { actors: [] };
  if (!registry.actors.some((a) => a.actor_id === actorId)) {
    registry.actors.push({ actor_id: actorId });
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/registry/actorRegistry.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/registry/actorRegistry.ts tests/registry/actorRegistry.test.ts
git commit -m "feat: actor resolution (ACTOR-NNN) honoring config.json actor_source"
```

---

## Task 6: Lineage hasher

**Files:**
- Create: `src/lineage/hasher.ts`
- Test: `tests/lineage/hasher.test.ts`

**Interfaces:**
- Produces:
  - `interface LineageOp { id: string; op: string; hash: string; actor: string; timestamp: string; [key: string]: unknown; }`
  - `interface LineageFile { topic: string; hash: string; operations: LineageOp[]; }`
  - `appendOperation(root: string, topicPath: string, op: { op: string; actor: string; timestamp: string; [key: string]: unknown }, payload: unknown): LineageOp`
  - `readLineage(root: string, topicPath: string): LineageFile`
  - `validateChain(root: string, topicPath: string): { valid: boolean; error?: string }`

- [ ] **Step 1: Write the failing test**

`tests/lineage/hasher.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { appendOperation, readLineage, validateChain } from '../../src/lineage/hasher';

describe('lineage hasher', () => {
  function makeRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
    fs.mkdirSync(path.join(root, 'topics', 'cuba', 'lineage'), { recursive: true });
    return root;
  }

  it('appends a first operation and chains from GENESIS', () => {
    const root = makeRoot();
    const op = appendOperation(
      root,
      'cuba',
      { op: 'INGEST', actor: 'ACTOR-001', timestamp: '2026-07-17T16:50:00', source_id: 'SRC-001' },
      { source_id: 'SRC-001' }
    );
    expect(op.id).toBe('OP-0001');
    const lineage = readLineage(root, 'cuba');
    expect(lineage.operations).toHaveLength(1);
    expect(lineage.hash).toBe(op.hash);
  });

  it('chains a second operation from the first hash', () => {
    const root = makeRoot();
    appendOperation(root, 'cuba', { op: 'INGEST', actor: 'ACTOR-001', timestamp: 't1', source_id: 'SRC-001' }, { source_id: 'SRC-001' });
    const op2 = appendOperation(root, 'cuba', { op: 'EXTRACT', actor: 'ACTOR-001', timestamp: 't2', extract_id: 'FCT-001' }, { extract_id: 'FCT-001' });
    expect(op2.id).toBe('OP-0002');
    const lineage = readLineage(root, 'cuba');
    expect(lineage.operations).toHaveLength(2);
    expect(lineage.hash).toBe(op2.hash);
    expect(op2.hash).not.toBe(lineage.operations[0].hash);
  });

  it('validates an intact chain', () => {
    const root = makeRoot();
    appendOperation(root, 'cuba', { op: 'INGEST', actor: 'ACTOR-001', timestamp: 't1', source_id: 'SRC-001' }, { source_id: 'SRC-001' });
    appendOperation(root, 'cuba', { op: 'EXTRACT', actor: 'ACTOR-001', timestamp: 't2', extract_id: 'FCT-001' }, { extract_id: 'FCT-001' });
    expect(validateChain(root, 'cuba')).toEqual({ valid: true });
  });

  it('detects a tampered chain', () => {
    const root = makeRoot();
    appendOperation(root, 'cuba', { op: 'INGEST', actor: 'ACTOR-001', timestamp: 't1', source_id: 'SRC-001' }, { source_id: 'SRC-001' });
    const lineagePath = path.join(root, 'topics', 'cuba', 'lineage', 'lineage.json');
    const lineage = JSON.parse(fs.readFileSync(lineagePath, 'utf-8'));
    lineage.operations[0].hash = 'tampered';
    fs.writeFileSync(lineagePath, JSON.stringify(lineage, null, 2));
    const result = validateChain(root, 'cuba');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/OP-0001/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/lineage/hasher.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lineage/hasher.ts`:

```ts
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../core/paths';

export interface LineageOp {
  id: string;
  op: string;
  hash: string;
  actor: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface LineageFile {
  topic: string;
  hash: string;
  operations: LineageOp[];
}

const GENESIS = 'GENESIS';

function lineagePath(root: string, topicPath: string): string {
  return path.join(nodeDir(root, topicPath), 'lineage', 'lineage.json');
}

function computeHash(prevHash: string, payload: unknown): string {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  return crypto.createHash('sha256').update(prevHash + canonical).digest('hex');
}

export function readLineage(root: string, topicPath: string): LineageFile {
  const file = lineagePath(root, topicPath);
  if (!fs.existsSync(file)) {
    const leaf = topicPath.split('/').pop() ?? topicPath;
    return { topic: leaf, hash: GENESIS, operations: [] };
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function appendOperation(
  root: string,
  topicPath: string,
  op: { op: string; actor: string; timestamp: string; [key: string]: unknown },
  payload: unknown
): LineageOp {
  const lineage = readLineage(root, topicPath);
  const opId = `OP-${String(lineage.operations.length + 1).padStart(4, '0')}`;
  const hash = computeHash(lineage.hash, payload);
  const fullOp: LineageOp = { ...op, id: opId, hash };
  lineage.operations.push(fullOp);
  lineage.hash = hash;
  const file = lineagePath(root, topicPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(lineage, null, 2));
  return fullOp;
}

export function validateChain(root: string, topicPath: string): { valid: boolean; error?: string } {
  const lineage = readLineage(root, topicPath);
  let prevHash = GENESIS;
  for (const op of lineage.operations) {
    const { id, hash, op: opName, actor, timestamp, ...payload } = op;
    const expected = computeHash(prevHash, payload);
    if (expected !== hash) {
      return { valid: false, error: `chain broken at ${id}: expected hash ${expected}, found ${hash}` };
    }
    prevHash = hash;
  }
  if (prevHash !== lineage.hash) {
    return { valid: false, error: `stored top-level hash does not match last operation hash` };
  }
  return { valid: true };
}
```

Note: `payload` passed to `appendOperation` must be the same object later reconstructed as `{ ...op, id, hash }` minus `id/hash/op/actor/timestamp` for `validateChain`'s recomputation to match — the test payloads (`{ source_id: 'SRC-001' }`, `{ extract_id: 'FCT-001' }`) are exactly the extra keys on `op`, so this holds. Later tasks (Task 8+) must pass the *same* extra fields as both `op` and `payload`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/lineage/hasher.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/lineage/hasher.ts tests/lineage/hasher.test.ts
git commit -m "feat: per-node chained lineage hashing (append + validate)"
```

---

## Task 7: Topic node CRUD (create, read, write, parent/children maintenance)

**Files:**
- Create: `src/core/topicNode.ts`
- Test: `tests/core/topicNode.test.ts`

**Interfaces:**
- Consumes: `nodeDir`, `parentPath`, `leafSlug`, `deriveNodeType`, `splitPath` (Task 2); `TopicMeta` (Task 2); `appendOperation` (Task 6)
- Produces:
  - `createNode(root: string, topicPath: string, actor: string, opts?: { description?: string; tags?: string[] }): TopicMeta`
  - `readTopicMeta(root: string, topicPath: string): TopicMeta`
  - `writeTopicMeta(root: string, meta: TopicMeta): void`
  - `markActive(root: string, topicPath: string, actor: string): void`

- [ ] **Step 1: Write the failing test**

`tests/core/topicNode.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createNode, readTopicMeta, markActive } from '../../src/core/topicNode';

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
}

describe('topicNode', () => {
  it('creates a single-segment node as a project', () => {
    const root = makeRoot();
    const meta = createNode(root, 'cuba', 'ACTOR-001', { description: 'Cuba research' });
    expect(meta.node_type).toBe('project');
    expect(meta.status).toBe('container');
    expect(meta.parent).toBeNull();
    expect(meta.children).toEqual([]);
    expect(fs.existsSync(path.join(root, 'topics', 'cuba', 'topic.json'))).toBe(true);
  });

  it('creates intermediate container nodes and links parent/children', () => {
    const root = makeRoot();
    createNode(root, 'cuba/industry/automotive', 'ACTOR-001');
    const project = readTopicMeta(root, 'cuba');
    const topic = readTopicMeta(root, 'cuba/industry');
    const subtopic = readTopicMeta(root, 'cuba/industry/automotive');

    expect(project.node_type).toBe('project');
    expect(project.children).toEqual(['industry']);
    expect(topic.node_type).toBe('topic');
    expect(topic.parent).toBe('cuba');
    expect(topic.children).toEqual(['automotive']);
    expect(subtopic.node_type).toBe('subtopic');
    expect(subtopic.parent).toBe('cuba/industry');
  });

  it('does not duplicate an existing child when re-creating a descendant', () => {
    const root = makeRoot();
    createNode(root, 'cuba/industry', 'ACTOR-001');
    createNode(root, 'cuba/industry/automotive', 'ACTOR-001');
    const project = readTopicMeta(root, 'cuba');
    expect(project.children).toEqual(['industry']);
  });

  it('marks a node active', () => {
    const root = makeRoot();
    createNode(root, 'cuba', 'ACTOR-001');
    markActive(root, 'cuba', 'ACTOR-001');
    expect(readTopicMeta(root, 'cuba').status).toBe('active');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/core/topicNode.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/core/topicNode.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TopicMeta } from './types';
import { nodeDir, parentPath, leafSlug, deriveNodeType, splitPath } from './paths';
import { appendOperation } from '../lineage/hasher';

function topicJsonPath(root: string, topicPath: string): string {
  return path.join(nodeDir(root, topicPath), 'topic.json');
}

export function readTopicMeta(root: string, topicPath: string): TopicMeta {
  return JSON.parse(fs.readFileSync(topicJsonPath(root, topicPath), 'utf-8'));
}

export function writeTopicMeta(root: string, meta: TopicMeta): void {
  const dir = nodeDir(root, meta.path);
  fs.mkdirSync(dir, { recursive: true });
  for (const sub of ['sources/raw', 'extracts', 'lineage', 'crosslinks']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  fs.writeFileSync(topicJsonPath(root, meta.path), JSON.stringify(meta, null, 2));
}

function ensureNode(root: string, topicPath: string, actor: string, opts?: { description?: string; tags?: string[] }): TopicMeta {
  const existingPath = topicJsonPath(root, topicPath);
  if (fs.existsSync(existingPath)) {
    return readTopicMeta(root, topicPath);
  }
  const now = new Date().toISOString();
  const meta: TopicMeta = {
    topic: leafSlug(topicPath),
    path: topicPath,
    parent: parentPath(topicPath),
    children: [],
    version: '1.0.0',
    created_at: now,
    updated_at: now,
    actors: [actor],
    description: opts?.description ?? '',
    tags: opts?.tags ?? [],
    status: 'container',
    node_type: deriveNodeType(topicPath),
  };
  writeTopicMeta(root, meta);
  appendOperation(
    root,
    topicPath,
    { op: 'CREATE', actor, timestamp: now, topic: meta.topic },
    { topic: meta.topic }
  );
  return meta;
}

export function createNode(root: string, topicPath: string, actor: string, opts?: { description?: string; tags?: string[] }): TopicMeta {
  const segments = splitPath(topicPath);
  let built = '';
  let leafMeta: TopicMeta | null = null;
  for (const segment of segments) {
    built = built ? `${built}/${segment}` : segment;
    const isLeaf = built === topicPath;
    const meta = ensureNode(root, built, actor, isLeaf ? opts : undefined);
    const parent = parentPath(built);
    if (parent) {
      const parentMeta = readTopicMeta(root, parent);
      if (!parentMeta.children.includes(leafSlug(built))) {
        parentMeta.children.push(leafSlug(built));
        parentMeta.updated_at = new Date().toISOString();
        writeTopicMeta(root, parentMeta);
      }
    }
    if (isLeaf) leafMeta = meta;
  }
  return leafMeta as TopicMeta;
}

export function markActive(root: string, topicPath: string, actor: string): void {
  const meta = readTopicMeta(root, topicPath);
  meta.status = 'active';
  meta.updated_at = new Date().toISOString();
  if (!meta.actors.includes(actor)) meta.actors.push(actor);
  writeTopicMeta(root, meta);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/core/topicNode.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/core/topicNode.ts tests/core/topicNode.test.ts
git commit -m "feat: topic node CRUD with recursive container creation and parent/children linking"
```

---

## Task 8: `trm create` CLI command

**Files:**
- Create: `src/cli/commands/create.ts`
- Test: `tests/cli/create.test.ts`

**Interfaces:**
- Consumes: `createNode` (Task 7), `resolveActor` (Task 5)
- Produces: `runCreate(root: string, topicPath: string, cliArgs: { actor?: string; description?: string; tags?: string[] }): TopicMeta`

- [ ] **Step 1: Write the failing test**

`tests/cli/create.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';

describe('runCreate', () => {
  it('creates a node and returns its meta', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' }));
    const meta = runCreate(root, 'cuba/industry', { actor: 'ACTOR-001', description: 'Cuban industry' });
    expect(meta.path).toBe('cuba/industry');
    expect(meta.description).toBe('Cuban industry');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/cli/create.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/cli/commands/create.ts`:

```ts
import { TopicMeta } from '../../core/types';
import { createNode } from '../../core/topicNode';
import { resolveActor } from '../../registry/actorRegistry';

export function runCreate(
  root: string,
  topicPath: string,
  cliArgs: { actor?: string; description?: string; tags?: string[] }
): TopicMeta {
  const actor = resolveActor(root, cliArgs.actor);
  return createNode(root, topicPath, actor, { description: cliArgs.description, tags: cliArgs.tags });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/cli/create.test.ts
```

Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/cli/commands/create.ts tests/cli/create.test.ts
git commit -m "feat: trm create command function"
```

---

## Task 9: Source ingestion + `trm ingest`

**Files:**
- Create: `src/core/sourceIngest.ts`, `src/cli/commands/ingest.ts`
- Test: `tests/core/sourceIngest.test.ts`, `tests/cli/ingest.test.ts`

**Interfaces:**
- Consumes: `nodeDir` (Task 2), `readTopicMeta`/`markActive` (Task 7), `appendOperation` (Task 6), `resolveActor` (Task 5)
- Produces:
  - `interface SourceEntry { id: string; type: string; title: string; origin: string; url: string; added_at: string; actor: string }`
  - `addSource(root: string, topicPath: string, actor: string, entry: Omit<SourceEntry, 'id' | 'added_at' | 'actor'>): SourceEntry`
  - `runIngest(root: string, topicPath: string, cliArgs: { actor?: string; type: string; title: string; origin: string; url: string; dryRun?: boolean }): SourceEntry | null` (returns `null` on `--dry-run`, writes nothing)

- [ ] **Step 1: Write the failing tests**

`tests/core/sourceIngest.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createNode } from '../../src/core/topicNode';
import { addSource } from '../../src/core/sourceIngest';

describe('addSource', () => {
  it('appends a source and updates lineage', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
    createNode(root, 'cuba', 'ACTOR-001');
    const entry = addSource(root, 'cuba', 'ACTOR-001', { type: 'pdf', title: 'Overview', origin: 'LOC', url: 'https://example.com' });
    expect(entry.id).toBe('SRC-001');
    const metadataPath = path.join(root, 'topics', 'cuba', 'sources', 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    expect(metadata.sources).toHaveLength(1);
  });

  it('numbers sources sequentially per node', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
    createNode(root, 'cuba', 'ACTOR-001');
    addSource(root, 'cuba', 'ACTOR-001', { type: 'pdf', title: 'A', origin: 'x', url: 'x' });
    const second = addSource(root, 'cuba', 'ACTOR-001', { type: 'pdf', title: 'B', origin: 'x', url: 'x' });
    expect(second.id).toBe('SRC-002');
  });
});
```

`tests/cli/ingest.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runIngest } from '../../src/cli/commands/ingest';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' }));
  return root;
}

describe('runIngest', () => {
  it('ingests a source and marks the node active', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const entry = runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Overview', origin: 'LOC', url: 'x' });
    expect(entry?.id).toBe('SRC-001');
  });

  it('dry-run writes nothing', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    const entry = runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'pdf', title: 'Overview', origin: 'LOC', url: 'x', dryRun: true });
    expect(entry).toBeNull();
    const metadataPath = path.join(root, 'topics', 'cuba', 'sources', 'metadata.json');
    expect(fs.existsSync(metadataPath)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:/dev/trm
npx jest tests/core/sourceIngest.test.ts tests/cli/ingest.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

`src/core/sourceIngest.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from './paths';
import { markActive } from './topicNode';
import { appendOperation } from '../lineage/hasher';

export interface SourceEntry {
  id: string;
  type: string;
  title: string;
  origin: string;
  url: string;
  added_at: string;
  actor: string;
}

function metadataPath(root: string, topicPath: string): string {
  return path.join(nodeDir(root, topicPath), 'sources', 'metadata.json');
}

function readMetadata(root: string, topicPath: string): { sources: SourceEntry[] } {
  const file = metadataPath(root, topicPath);
  if (!fs.existsSync(file)) return { sources: [] };
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function addSource(
  root: string,
  topicPath: string,
  actor: string,
  entry: Omit<SourceEntry, 'id' | 'added_at' | 'actor'>
): SourceEntry {
  const metadata = readMetadata(root, topicPath);
  const id = `SRC-${String(metadata.sources.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const fullEntry: SourceEntry = { ...entry, id, added_at: now, actor };
  metadata.sources.push(fullEntry);
  const file = metadataPath(root, topicPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(metadata, null, 2));
  appendOperation(root, topicPath, { op: 'INGEST', actor, timestamp: now, source_id: id }, { source_id: id });
  markActive(root, topicPath, actor);
  return fullEntry;
}
```

`src/cli/commands/ingest.ts`:

```ts
import { SourceEntry } from '../../core/sourceIngest';
import { addSource } from '../../core/sourceIngest';
import { resolveActor } from '../../registry/actorRegistry';

export function runIngest(
  root: string,
  topicPath: string,
  cliArgs: { actor?: string; type: string; title: string; origin: string; url: string; dryRun?: boolean }
): SourceEntry | null {
  const actor = resolveActor(root, cliArgs.actor);
  if (cliArgs.dryRun) return null;
  return addSource(root, topicPath, actor, { type: cliArgs.type, title: cliArgs.title, origin: cliArgs.origin, url: cliArgs.url });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd C:/dev/trm
npx jest tests/core/sourceIngest.test.ts tests/cli/ingest.test.ts
```

Expected: PASS, 4 tests total.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/core/sourceIngest.ts src/cli/commands/ingest.ts tests/core/sourceIngest.test.ts tests/cli/ingest.test.ts
git commit -m "feat: source ingestion + trm ingest command with --dry-run"
```

---

## Task 10: Scoring types + stub adapter

**Files:**
- Create: `src/scoring/types.ts`, `src/scoring/adapters/stub.ts`
- Test: `tests/scoring/stub.test.ts`

**Interfaces:**
- Consumes: `TopicMeta`, `TrmConfig` (Task 2)
- Produces:
  - `interface Fact { id: string; text: string; source_id: string; confidence: number; categories: string[]; }`
  - `interface ScoreResult { fact_id: string; relevance: number; genealogy: number; historical: number; confidence: number; novelty: number; promotion_score: number; promoted: boolean; }`
  - `interface ScoringAdapter { score(facts: Fact[], topic: TopicMeta, config: TrmConfig): ScoreResult[]; }`
  - `stubAdapter: ScoringAdapter`

- [ ] **Step 1: Write the failing test**

`tests/scoring/stub.test.ts`:

```ts
import { stubAdapter } from '../../src/scoring/adapters/stub';
import { TopicMeta, TrmConfig } from '../../src/core/types';

const topic: TopicMeta = {
  topic: 'cuba', path: 'cuba', parent: null, children: [], version: '1.0.0',
  created_at: 't', updated_at: 't', actors: ['ACTOR-001'], description: '', tags: [],
  status: 'active', node_type: 'project',
};
const config: TrmConfig = { default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'env', time_source: 'system' };

describe('stubAdapter', () => {
  it('scores a fact deterministically', () => {
    const facts = [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.92, categories: ['history', 'genealogy'] }];
    const [result] = stubAdapter.score(facts, topic, config);
    expect(result.fact_id).toBe('FCT-001');
    expect(result.confidence).toBe(92);
    expect(result.genealogy).toBe(80);
    expect(result.historical).toBe(80);
    expect(result.relevance).toBe(92);
    expect(result.novelty).toBe(50);
  });

  it('is deterministic across repeated calls', () => {
    const facts = [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.5, categories: [] }];
    const a = stubAdapter.score(facts, topic, config);
    const b = stubAdapter.score(facts, topic, config);
    expect(a).toEqual(b);
  });

  it('sets promoted true only when promotion_score meets threshold', () => {
    const facts = [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.95, categories: ['history', 'genealogy'] }];
    const [high] = stubAdapter.score(facts, topic, { ...config, promotion_threshold: 80 });
    const [tooHigh] = stubAdapter.score(facts, topic, { ...config, promotion_threshold: 100 });
    expect(high.promoted).toBe(true);
    expect(tooHigh.promoted).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/scoring/stub.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/scoring/types.ts`:

```ts
import { TopicMeta, TrmConfig } from '../core/types';

export interface Fact {
  id: string;
  text: string;
  source_id: string;
  confidence: number;
  categories: string[];
}

export interface ScoreResult {
  fact_id: string;
  relevance: number;
  genealogy: number;
  historical: number;
  confidence: number;
  novelty: number;
  promotion_score: number;
  promoted: boolean;
}

export interface ScoringAdapter {
  score(facts: Fact[], topic: TopicMeta, config: TrmConfig): ScoreResult[];
}
```

`src/scoring/adapters/stub.ts`:

```ts
import { Fact, ScoreResult, ScoringAdapter } from '../types';

const WEIGHTS = { relevance: 0.3, genealogy: 0.1, historical: 0.2, confidence: 0.3, novelty: 0.1 };

export const stubAdapter: ScoringAdapter = {
  score(facts: Fact[], _topic, config): ScoreResult[] {
    return facts.map((fact) => {
      const confidence = Math.round(fact.confidence * 100);
      const relevance = confidence;
      const genealogy = fact.categories.includes('genealogy') ? 80 : 20;
      const historical = fact.categories.includes('history') ? 80 : 20;
      const novelty = 50;
      const promotion_score =
        relevance * WEIGHTS.relevance +
        genealogy * WEIGHTS.genealogy +
        historical * WEIGHTS.historical +
        confidence * WEIGHTS.confidence +
        novelty * WEIGHTS.novelty;
      return {
        fact_id: fact.id,
        relevance,
        genealogy,
        historical,
        confidence,
        novelty,
        promotion_score: Math.round(promotion_score * 10) / 10,
        promoted: promotion_score >= config.promotion_threshold,
      };
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/scoring/stub.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/scoring/types.ts src/scoring/adapters/stub.ts tests/scoring/stub.test.ts
git commit -m "feat: closed ScoreResult type + deterministic stub scoring adapter"
```

---

## Task 11: Extraction runner + `trm extract`

**Files:**
- Create: `src/extraction/types.ts`, `src/extraction/stubRunner.ts`, `src/cli/commands/extract.ts`
- Test: `tests/extraction/stubRunner.test.ts`, `tests/cli/extract.test.ts`

**Interfaces:**
- Consumes: `Fact` (Task 10), `SourceEntry` (Task 9), `appendOperation` (Task 6), `resolveActor` (Task 5)
- Produces:
  - `interface ExtractionRunner { run(source: SourceEntry, rawText: string): { facts: Fact[]; summary: string }; }`
  - `stubRunner: ExtractionRunner` — naive deterministic split, used as the default v1 runner (real Claude Code shell-out is explicitly out of scope for this plan's unit tests; `ExtractionRunner` is the seam a future `claudeCodeRunner` plugs into without touching callers)
  - `runExtract(root: string, topicPath: string, cliArgs: { actor?: string; dryRun?: boolean }, runner?: ExtractionRunner): { facts: Fact[]; summary: string } | null`

- [ ] **Step 1: Write the failing tests**

`tests/extraction/stubRunner.test.ts`:

```ts
import { stubRunner } from '../../src/extraction/stubRunner';

describe('stubRunner', () => {
  it('produces one fact per non-empty line, deterministically', () => {
    const source = { id: 'SRC-001', type: 'text', title: 'x', origin: 'x', url: 'x', added_at: 't', actor: 'ACTOR-001' };
    const result = stubRunner.run(source, 'First fact.\n\nSecond fact.\n');
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toEqual({ id: 'FCT-001', text: 'First fact.', source_id: 'SRC-001', confidence: 0.5, categories: [] });
    expect(result.facts[1].id).toBe('FCT-002');
    expect(result.summary).toContain('2 fact');
  });
});
```

`tests/cli/extract.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runIngest } from '../../src/cli/commands/ingest';
import { runExtract } from '../../src/cli/commands/extract';
import { stubRunner } from '../../src/extraction/stubRunner';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' }));
  return root;
}

describe('runExtract', () => {
  it('writes extract.json and summary.md from ingested source text', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'text', title: 'x', origin: 'x', url: 'x' });
    const rawDir = path.join(root, 'topics', 'cuba', 'sources', 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, 'SRC-001.txt'), 'Fact one.\nFact two.\n');

    const result = runExtract(root, 'cuba', { actor: 'ACTOR-001' }, stubRunner);
    expect(result?.facts).toHaveLength(2);
    const extractPath = path.join(root, 'topics', 'cuba', 'extracts', 'extract.json');
    expect(JSON.parse(fs.readFileSync(extractPath, 'utf-8')).facts).toHaveLength(2);
    expect(fs.existsSync(path.join(root, 'topics', 'cuba', 'extracts', 'summary.md'))).toBe(true);
  });

  it('dry-run writes nothing', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    runIngest(root, 'cuba', { actor: 'ACTOR-001', type: 'text', title: 'x', origin: 'x', url: 'x' });
    const rawDir = path.join(root, 'topics', 'cuba', 'sources', 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, 'SRC-001.txt'), 'Fact one.\n');

    const result = runExtract(root, 'cuba', { actor: 'ACTOR-001', dryRun: true }, stubRunner);
    expect(result).toBeNull();
    expect(fs.existsSync(path.join(root, 'topics', 'cuba', 'extracts', 'extract.json'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:/dev/trm
npx jest tests/extraction/stubRunner.test.ts tests/cli/extract.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

`src/extraction/types.ts`:

```ts
import { Fact } from '../scoring/types';
import { SourceEntry } from '../core/sourceIngest';

export interface ExtractionRunner {
  run(source: SourceEntry, rawText: string): { facts: Fact[]; summary: string };
}
```

`src/extraction/stubRunner.ts`:

```ts
import { ExtractionRunner } from './types';

export const stubRunner: ExtractionRunner = {
  run(source, rawText) {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const facts = lines.map((text, i) => ({
      id: `FCT-${String(i + 1).padStart(3, '0')}`,
      text,
      source_id: source.id,
      confidence: 0.5,
      categories: [] as string[],
    }));
    return { facts, summary: `Extracted ${facts.length} fact(s) from ${source.title}.` };
  },
};
```

`src/cli/commands/extract.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../../core/paths';
import { readTopicMeta } from '../../core/topicNode';
import { Fact } from '../../scoring/types';
import { ExtractionRunner } from '../../extraction/types';
import { stubRunner } from '../../extraction/stubRunner';
import { resolveActor } from '../../registry/actorRegistry';
import { appendOperation } from '../../lineage/hasher';

interface SourceMetadata {
  sources: { id: string }[];
}

export function runExtract(
  root: string,
  topicPath: string,
  cliArgs: { actor?: string; dryRun?: boolean },
  runner: ExtractionRunner = stubRunner
): { facts: Fact[]; summary: string } | null {
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd C:/dev/trm
npx jest tests/extraction/stubRunner.test.ts tests/cli/extract.test.ts
```

Expected: PASS, 3 tests total.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/extraction src/cli/commands/extract.ts tests/extraction/stubRunner.test.ts tests/cli/extract.test.ts
git commit -m "feat: extraction runner interface + stub runner + trm extract command"
```

---

## Task 12: `trm score` (with `--rollup`)

**Files:**
- Create: `src/cli/commands/score.ts`
- Test: `tests/cli/score.test.ts`

**Interfaces:**
- Consumes: `stubAdapter`/`ScoringAdapter`/`Fact`/`ScoreResult` (Task 10), `readTopicMeta` (Task 7), `loadConfig` (Task 3), `validateAgainstSchema` (Task 4), `appendOperation` (Task 6), `resolveActor` (Task 5)
- Produces:
  - `runScore(root: string, topicPath: string, cliArgs: { actor?: string; dryRun?: boolean; rollup?: boolean }, adapter?: ScoringAdapter): { scores: ScoreResult[]; rolledUpFrom?: string[] } | null`

- [ ] **Step 1: Write the failing test**

`tests/cli/score.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runScore } from '../../src/cli/commands/score';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' }));
  return root;
}

function writeExtract(root: string, topicPath: string, facts: any[]) {
  const dir = path.join(root, 'topics', ...topicPath.split('/'), 'extracts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'extract.json'), JSON.stringify({ facts }, null, 2));
}

describe('runScore', () => {
  it('scores facts and writes score.json validated against the schema', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.95, categories: ['history', 'genealogy'] }]);
    const result = runScore(root, 'cuba', { actor: 'ACTOR-001' });
    expect(result?.scores[0].promoted).toBe(true);
    const scorePath = path.join(root, 'topics', 'cuba', 'extracts', 'score.json');
    expect(JSON.parse(fs.readFileSync(scorePath, 'utf-8')).scores).toHaveLength(1);
  });

  it('rolls up child scores without writing a merged file', () => {
    const root = makeRoot();
    runCreate(root, 'cuba/industry', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba/industry', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.9, categories: [] }]);
    runScore(root, 'cuba/industry', { actor: 'ACTOR-001' });

    const result = runScore(root, 'cuba', { actor: 'ACTOR-001', rollup: true });
    expect(result?.scores).toHaveLength(1);
    expect(result?.rolledUpFrom).toContain('cuba/industry');
    expect(fs.existsSync(path.join(root, 'topics', 'cuba', 'extracts', 'score.json'))).toBe(false);
  });

  it('dry-run writes nothing', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.5, categories: [] }]);
    const result = runScore(root, 'cuba', { actor: 'ACTOR-001', dryRun: true });
    expect(result).not.toBeNull();
    expect(fs.existsSync(path.join(root, 'topics', 'cuba', 'extracts', 'score.json'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/cli/score.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/cli/commands/score.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../../core/paths';
import { readTopicMeta } from '../../core/topicNode';
import { loadConfig } from '../../core/config';
import { Fact, ScoreResult, ScoringAdapter } from '../../scoring/types';
import { stubAdapter } from '../../scoring/adapters/stub';
import { validateAgainstSchema } from '../../schemas/validator';
import { appendOperation } from '../../lineage/hasher';
import { resolveActor } from '../../registry/actorRegistry';

function readFacts(root: string, topicPath: string): Fact[] {
  const file = path.join(nodeDir(root, topicPath), 'extracts', 'extract.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8')).facts;
}

function readScores(root: string, topicPath: string): ScoreResult[] {
  const file = path.join(nodeDir(root, topicPath), 'extracts', 'score.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8')).scores;
}

export function runScore(
  root: string,
  topicPath: string,
  cliArgs: { actor?: string; dryRun?: boolean; rollup?: boolean },
  adapter: ScoringAdapter = stubAdapter
): { scores: ScoreResult[]; rolledUpFrom?: string[] } | null {
  const actor = resolveActor(root, cliArgs.actor);
  const meta = readTopicMeta(root, topicPath);
  const config = loadConfig(root);

  if (cliArgs.rollup) {
    const rolledUpFrom: string[] = [];
    const scores: ScoreResult[] = [];
    const walk = (childPath: string) => {
      const childMeta = readTopicMeta(root, childPath);
      scores.push(...readScores(root, childPath));
      if (readScores(root, childPath).length > 0) rolledUpFrom.push(childPath);
      for (const child of childMeta.children) {
        walk(`${childPath}/${child}`);
      }
    };
    for (const child of meta.children) {
      walk(`${topicPath}/${child}`);
    }
    return { scores, rolledUpFrom };
  }

  const facts = readFacts(root, topicPath);
  const scores = adapter.score(facts, meta, config);

  const validation = validateAgainstSchema('score', { scores });
  if (!validation.valid) {
    throw new Error(`ScoringAdapter produced invalid score.json: ${validation.errors.join('; ')}`);
  }

  if (cliArgs.dryRun) return { scores };

  const dir = path.join(nodeDir(root, topicPath), 'extracts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify({ scores }, null, 2));

  const now = new Date().toISOString();
  appendOperation(root, topicPath, { op: 'SCORE', actor, timestamp: now, score_count: scores.length }, { score_count: scores.length });

  return { scores };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/cli/score.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/cli/commands/score.ts tests/cli/score.test.ts
git commit -m "feat: trm score command — schema-validated ScoringAdapter writes, read-only --rollup"
```

---

## Task 13: Crosslinks (`treatment.json`, `related_topics.json`) + `trm crosslink`

**Files:**
- Create: `src/crosslinks/treatmentLink.ts`, `src/crosslinks/relatedTopics.ts`, `src/cli/commands/crosslink.ts`
- Test: `tests/crosslinks/relatedTopics.test.ts`, `tests/cli/crosslink.test.ts`

**Interfaces:**
- Consumes: `nodeDir`, `readTopicMeta` (Tasks 2, 7), `appendOperation` (Task 6), `resolveActor` (Task 5)
- Produces:
  - `computeTagOverlapStrength(a: string[], b: string[]): number` — Jaccard similarity of tag sets, `0` if either is empty
  - `writeRelatedTopic(root: string, topicPath: string, related: { topic: string; relationship: string; strength: number }): void`
  - `writeTreatmentLink(root: string, topicPath: string, link: { promoted_facts: string[]; promotion_reason: string; treatment_sections: string[] }): void`
  - `runCrosslink(root: string, topicPath: string, cliArgs: { actor?: string; relatedTopic?: string; relationship?: string; treatmentSections?: string[]; promotionReason?: string }): void`

- [ ] **Step 1: Write the failing tests**

`tests/crosslinks/relatedTopics.test.ts`:

```ts
import { computeTagOverlapStrength } from '../../src/crosslinks/relatedTopics';

describe('computeTagOverlapStrength', () => {
  it('returns 1 for identical tag sets', () => {
    expect(computeTagOverlapStrength(['a', 'b'], ['a', 'b'])).toBe(1);
  });
  it('returns 0 for disjoint tag sets', () => {
    expect(computeTagOverlapStrength(['a'], ['b'])).toBe(0);
  });
  it('returns 0 for empty input', () => {
    expect(computeTagOverlapStrength([], ['a'])).toBe(0);
  });
  it('returns partial overlap as Jaccard similarity', () => {
    expect(computeTagOverlapStrength(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3);
  });
});
```

`tests/cli/crosslink.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runCrosslink } from '../../src/cli/commands/crosslink';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' }));
  return root;
}

describe('runCrosslink', () => {
  it('writes related_topics.json with a computed or given strength', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001', tags: ['history', 'industry'] });
    runCreate(root, 'willys', { actor: 'ACTOR-001', tags: ['industry'] });
    runCrosslink(root, 'cuba', { actor: 'ACTOR-001', relatedTopic: 'willys', relationship: 'industrial context overlap' });
    const related = JSON.parse(fs.readFileSync(path.join(root, 'topics', 'cuba', 'crosslinks', 'related_topics.json'), 'utf-8'));
    expect(related.related[0]).toMatchObject({ topic: 'willys', relationship: 'industrial context overlap' });
    expect(related.related[0].strength).toBeCloseTo(1 / 2);
  });

  it('writes treatment.json as a promotion pointer', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    runCrosslink(root, 'cuba', {
      actor: 'ACTOR-001',
      treatmentSections: ['01_charlie'],
      promotionReason: 'High relevance',
    });
    const treatment = JSON.parse(fs.readFileSync(path.join(root, 'topics', 'cuba', 'crosslinks', 'treatment.json'), 'utf-8'));
    expect(treatment.treatment_sections).toEqual(['01_charlie']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:/dev/trm
npx jest tests/crosslinks/relatedTopics.test.ts tests/cli/crosslink.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementation**

`src/crosslinks/relatedTopics.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../core/paths';

export function computeTagOverlapStrength(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export function writeRelatedTopic(
  root: string,
  topicPath: string,
  related: { topic: string; relationship: string; strength: number }
): void {
  const file = path.join(nodeDir(root, topicPath), 'crosslinks', 'related_topics.json');
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : { related: [] };
  existing.related.push(related);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(existing, null, 2));
}
```

`src/crosslinks/treatmentLink.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../core/paths';

export function writeTreatmentLink(
  root: string,
  topicPath: string,
  link: { promoted_facts: string[]; promotion_reason: string; treatment_sections: string[] }
): void {
  const file = path.join(nodeDir(root, topicPath), 'crosslinks', 'treatment.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(link, null, 2));
}
```

`src/cli/commands/crosslink.ts`:

```ts
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
  }
): void {
  const actor = resolveActor(root, cliArgs.actor);
  const meta = readTopicMeta(root, topicPath);
  const now = new Date().toISOString();

  if (cliArgs.relatedTopic) {
    const otherMeta = readTopicMeta(root, cliArgs.relatedTopic);
    const strength = cliArgs.strength ?? computeTagOverlapStrength(meta.tags, otherMeta.tags);
    writeRelatedTopic(root, topicPath, {
      topic: cliArgs.relatedTopic,
      relationship: cliArgs.relationship ?? '',
      strength,
    });
    appendOperation(root, topicPath, { op: 'CROSSLINK', actor, timestamp: now, related_topic: cliArgs.relatedTopic }, { related_topic: cliArgs.relatedTopic });
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd C:/dev/trm
npx jest tests/crosslinks/relatedTopics.test.ts tests/cli/crosslink.test.ts
```

Expected: PASS, 6 tests total.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/crosslinks src/cli/commands/crosslink.ts tests/crosslinks/relatedTopics.test.ts tests/cli/crosslink.test.ts
git commit -m "feat: crosslinks (tag-overlap related_topics, write-only treatment pointer) + trm crosslink"
```

---

## Task 14: `trm version-bump`

**Files:**
- Create: `src/cli/commands/versionBump.ts`
- Test: `tests/cli/versionBump.test.ts`

**Interfaces:**
- Consumes: `readTopicMeta`/`writeTopicMeta` (Task 7), `appendOperation` (Task 6), `resolveActor` (Task 5)
- Produces: `runVersionBump(root: string, topicPath: string, bump: 'major' | 'minor' | 'patch', cliArgs: { actor?: string }): string` (returns new version)

- [ ] **Step 1: Write the failing test**

`tests/cli/versionBump.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runVersionBump } from '../../src/cli/commands/versionBump';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' }));
  return root;
}

describe('runVersionBump', () => {
  it('bumps patch/minor/major correctly', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    expect(runVersionBump(root, 'cuba', 'patch', { actor: 'ACTOR-001' })).toBe('1.0.1');
    expect(runVersionBump(root, 'cuba', 'minor', { actor: 'ACTOR-001' })).toBe('1.1.0');
    expect(runVersionBump(root, 'cuba', 'major', { actor: 'ACTOR-001' })).toBe('2.0.0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/cli/versionBump.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/cli/commands/versionBump.ts`:

```ts
import { readTopicMeta, writeTopicMeta } from '../../core/topicNode';
import { resolveActor } from '../../registry/actorRegistry';
import { appendOperation } from '../../lineage/hasher';

export function runVersionBump(
  root: string,
  topicPath: string,
  bump: 'major' | 'minor' | 'patch',
  cliArgs: { actor?: string }
): string {
  const actor = resolveActor(root, cliArgs.actor);
  const meta = readTopicMeta(root, topicPath);
  const [major, minor, patch] = meta.version.split('.').map(Number);
  const next =
    bump === 'major' ? `${major + 1}.0.0` :
    bump === 'minor' ? `${major}.${minor + 1}.0` :
    `${major}.${minor}.${patch + 1}`;
  meta.version = next;
  meta.updated_at = new Date().toISOString();
  writeTopicMeta(root, meta);
  appendOperation(root, topicPath, { op: 'VERSION_BUMP', actor, timestamp: meta.updated_at, version: next }, { version: next });
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/cli/versionBump.test.ts
```

Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/cli/commands/versionBump.ts tests/cli/versionBump.test.ts
git commit -m "feat: trm version-bump command"
```

---

## Task 15: `trm validate`

**Files:**
- Create: `src/cli/commands/validate.ts`
- Test: `tests/cli/validate.test.ts`

**Interfaces:**
- Consumes: `validateAgainstSchema` (Task 4), `validateChain`/`readLineage` (Task 6), `readTopicMeta` (Task 7)
- Produces: `interface ValidationReport { path: string; valid: boolean; errors: string[]; }` and `runValidate(root: string, topicPath: string, cliArgs: { recursive?: boolean }): ValidationReport[]`

Governance check per spec §7: schema validity on every file present, lineage chain integrity, and rejection of a hand-edited `score.json` (detected by recomputing the expected `SCORE`-op hash from the current `score.json` contents and comparing against the lineage-recorded hash for the most recent `SCORE` op).

- [ ] **Step 1: Write the failing test**

`tests/cli/validate.test.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runScore } from '../../src/cli/commands/score';
import { runValidate } from '../../src/cli/commands/validate';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 80, actor_source: 'cli-only', time_source: 'system' }));
  return root;
}

function writeExtract(root: string, topicPath: string, facts: any[]) {
  const dir = path.join(root, 'topics', ...topicPath.split('/'), 'extracts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'extract.json'), JSON.stringify({ facts }, null, 2));
}

describe('runValidate', () => {
  it('passes for an untouched, freshly scored node', () => {
    const root = makeRoot();
    runCreate(root, 'cuba', { actor: 'ACTOR-001' });
    writeExtract(root, 'cuba', [{ id: 'FCT-001', text: 'x', source_id: 'SRC-001', confidence: 0.9, categories: [] }]);
    runScore(root, 'cuba', { actor: 'ACTOR-001' });
    const [report] = runValidate(root, 'cuba', {});
    expect(report.valid).toBe(true);
  });

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
    expect(report.errors.some((e) => /score\.json/.test(e))).toBe(true);
  });

  it('recurses into descendants when --recursive is set', () => {
    const root = makeRoot();
    runCreate(root, 'cuba/industry', { actor: 'ACTOR-001' });
    const reports = runValidate(root, 'cuba', { recursive: true });
    expect(reports.map((r) => r.path)).toEqual(['cuba', 'cuba/industry']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/dev/trm
npx jest tests/cli/validate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/cli/commands/validate.ts`:

```ts
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nodeDir } from '../../core/paths';
import { readTopicMeta } from '../../core/topicNode';
import { readLineage, validateChain } from '../../lineage/hasher';
import { validateAgainstSchema, SchemaName } from '../../schemas/validator';

export interface ValidationReport {
  path: string;
  valid: boolean;
  errors: string[];
}

function checkSchema(root: string, topicPath: string, file: string, schema: SchemaName, errors: string[]): void {
  const filePath = path.join(nodeDir(root, topicPath), file);
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const result = validateAgainstSchema(schema, data);
  if (!result.valid) {
    errors.push(`${file}: ${result.errors.join('; ')}`);
  }
}

function checkScoreNotHandEdited(root: string, topicPath: string, errors: string[]): void {
  const scorePath = path.join(nodeDir(root, topicPath), 'extracts', 'score.json');
  if (!fs.existsSync(scorePath)) return;
  const lineage = readLineage(root, topicPath);
  const lastScoreOp = [...lineage.operations].reverse().find((op) => op.op === 'SCORE');
  if (!lastScoreOp) {
    errors.push('score.json exists but no SCORE lineage operation was recorded');
    return;
  }
  const scoreContent = JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
  const expectedHash = crypto.createHash('sha256').update(JSON.stringify(scoreContent.scores)).digest('hex');
  const recordedHash = lastScoreOp.content_hash;
  if (recordedHash && recordedHash !== expectedHash) {
    errors.push('score.json contents do not match the hash recorded at the last SCORE operation — hand-edited');
  }
}

function validateNode(root: string, topicPath: string): ValidationReport {
  const errors: string[] = [];
  readTopicMeta(root, topicPath); // throws if node missing

  checkSchema(root, topicPath, 'topic.json', 'topic', errors);
  checkSchema(root, topicPath, path.join('sources', 'metadata.json'), 'metadata', errors);
  checkSchema(root, topicPath, path.join('extracts', 'extract.json'), 'extract', errors);
  checkSchema(root, topicPath, path.join('extracts', 'score.json'), 'score', errors);
  checkSchema(root, topicPath, path.join('crosslinks', 'related_topics.json'), 'related_topics', errors);

  const chainResult = validateChain(root, topicPath);
  if (!chainResult.valid) errors.push(`lineage: ${chainResult.error}`);

  checkScoreNotHandEdited(root, topicPath, errors);

  return { path: topicPath, valid: errors.length === 0, errors };
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

This requires `score`'s `SCORE` lineage operation to carry a `content_hash` of the written scores so `validate` can detect tampering. Update Task 12's `runScore` to include it:

`src/cli/commands/score.ts` — replace the `appendOperation` call in the non-rollup, non-dry-run branch:

```ts
  const now = new Date().toISOString();
  const contentHash = require('node:crypto').createHash('sha256').update(JSON.stringify(scores)).digest('hex');
  appendOperation(
    root,
    topicPath,
    { op: 'SCORE', actor, timestamp: now, score_count: scores.length, content_hash: contentHash },
    { score_count: scores.length, content_hash: contentHash }
  );
```

(Also add `import * as crypto from 'node:crypto';` at the top of `score.ts` and use `crypto.createHash(...)` instead of the inline `require`.)

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/dev/trm
npx jest tests/cli/score.test.ts tests/cli/validate.test.ts
```

Expected: PASS, all tests (score.test.ts must still pass after the `score.ts` edit — rerun it alongside).

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/cli/commands/validate.ts src/cli/commands/score.ts tests/cli/validate.test.ts
git commit -m "feat: trm validate — schema checks, lineage-chain integrity, hand-edit detection on score.json"
```

---

## Task 16: CLI wiring (commander) + end-to-end integration test

**Files:**
- Create: `src/cli/index.ts`
- Test: `tests/cli/integration.test.ts`

**Interfaces:**
- Consumes: all `run*` command functions from Tasks 8, 9, 11, 12, 13, 14, 15
- Produces: an executable CLI entrypoint; no new exported functions beyond wiring

- [ ] **Step 1: Write the failing test**

`tests/cli/integration.test.ts` — drives the full lifecycle (spec §6) through the command functions directly (fast, no process spawn):

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCreate } from '../../src/cli/commands/create';
import { runIngest } from '../../src/cli/commands/ingest';
import { runExtract } from '../../src/cli/commands/extract';
import { runScore } from '../../src/cli/commands/score';
import { runCrosslink } from '../../src/cli/commands/crosslink';
import { runVersionBump } from '../../src/cli/commands/versionBump';
import { runValidate } from '../../src/cli/commands/validate';

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ default_scoring_adapter: 'stub', promotion_threshold: 60, actor_source: 'cli-only', time_source: 'system' }));
  return root;
}

describe('full TRM lifecycle', () => {
  it('create -> ingest -> extract -> score -> crosslink -> version-bump -> validate', () => {
    const root = makeRoot();
    const actor = 'ACTOR-001';

    runCreate(root, 'cuba/industry/automotive', { actor, description: 'Automotive research', tags: ['history', 'industry'] });

    runIngest(root, 'cuba/industry/automotive', { actor, type: 'text', title: 'Overview', origin: 'LOC', url: 'https://example.com' });
    const rawDir = path.join(root, 'topics', 'cuba', 'industry', 'automotive', 'sources', 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, 'SRC-001.txt'), 'Industrial expansion accelerated in the 1920s.\n');

    const extracted = runExtract(root, 'cuba/industry/automotive', { actor });
    expect(extracted?.facts.length).toBeGreaterThan(0);

    const scored = runScore(root, 'cuba/industry/automotive', { actor });
    expect(scored?.scores.length).toBe(extracted?.facts.length);

    runCreate(root, 'willys', { actor, tags: ['industry'] });
    runCrosslink(root, 'cuba/industry/automotive', {
      actor,
      relatedTopic: 'willys',
      relationship: 'industrial context overlap',
    });

    const newVersion = runVersionBump(root, 'cuba/industry/automotive', 'minor', { actor });
    expect(newVersion).toBe('1.1.0');

    const reports = runValidate(root, 'cuba', { recursive: true });
    expect(reports.every((r) => r.valid)).toBe(true);
    expect(reports.map((r) => r.path)).toEqual(['cuba', 'cuba/industry', 'cuba/industry/automotive']);

    const rollup = runScore(root, 'cuba', { actor, rollup: true });
    expect(rollup?.scores.length).toBe(extracted?.facts.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes for the wrong reason**

```bash
cd C:/dev/trm
npx jest tests/cli/integration.test.ts
```

Expected: This should mostly pass already since it only composes existing command functions — run it now to confirm the full lifecycle holds together before adding the CLI wiring. If it fails, fix the composition bug it surfaces before proceeding (do not skip this check).

- [ ] **Step 3: Write the commander CLI wiring**

`src/cli/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { runCreate } from './commands/create';
import { runIngest } from './commands/ingest';
import { runExtract } from './commands/extract';
import { runScore } from './commands/score';
import { runCrosslink } from './commands/crosslink';
import { runVersionBump } from './commands/versionBump';
import { runValidate } from './commands/validate';

const root = process.cwd();
const program = new Command();
program.name('trm').version('0.1.0');

program
  .command('create <path>')
  .option('--actor <actor>')
  .option('--description <description>')
  .option('--tags <tags>', 'comma-separated', (v) => v.split(','))
  .action((path, opts) => {
    const meta = runCreate(root, path, opts);
    console.log(JSON.stringify(meta, null, 2));
  });

program
  .command('ingest <path> <url>')
  .requiredOption('--type <type>')
  .requiredOption('--title <title>')
  .requiredOption('--origin <origin>')
  .option('--actor <actor>')
  .option('--dry-run', false)
  .action((path, url, opts) => {
    const entry = runIngest(root, path, { ...opts, url, dryRun: opts.dryRun });
    console.log(entry ? JSON.stringify(entry, null, 2) : '(dry-run, nothing written)');
  });

program
  .command('extract <path>')
  .option('--actor <actor>')
  .option('--dry-run', false)
  .action((path, opts) => {
    const result = runExtract(root, path, { ...opts, dryRun: opts.dryRun });
    console.log(result ? `${result.facts.length} fact(s) extracted` : '(dry-run)');
  });

program
  .command('score <path>')
  .option('--actor <actor>')
  .option('--dry-run', false)
  .option('--rollup', false)
  .action((path, opts) => {
    const result = runScore(root, path, opts);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('crosslink <path>')
  .option('--actor <actor>')
  .option('--related-topic <path>')
  .option('--relationship <text>')
  .option('--treatment-sections <sections>', 'comma-separated', (v) => v.split(','))
  .option('--promotion-reason <text>')
  .action((path, opts) => {
    runCrosslink(root, path, {
      actor: opts.actor,
      relatedTopic: opts.relatedTopic,
      relationship: opts.relationship,
      treatmentSections: opts.treatmentSections,
      promotionReason: opts.promotionReason,
    });
    console.log('crosslink written');
  });

program
  .command('version-bump <path> <bump>')
  .option('--actor <actor>')
  .action((path, bump, opts) => {
    const version = runVersionBump(root, path, bump, opts);
    console.log(version);
  });

program
  .command('validate <path>')
  .option('--recursive', false)
  .action((path, opts) => {
    const reports = runValidate(root, path, opts);
    console.log(JSON.stringify(reports, null, 2));
    if (reports.some((r) => !r.valid)) process.exitCode = 1;
  });

program.parse();
```

- [ ] **Step 4: Run the full test suite and typecheck**

```bash
cd C:/dev/trm
npm test
npm run typecheck
```

Expected: all tests PASS, typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/trm
git add src/cli/index.ts tests/cli/integration.test.ts
git commit -m "feat: wire commander CLI over command functions; full-lifecycle integration test"
```

---

## Self-Review

**1. Spec coverage:**
- §2 Repository / standalone, no build-time CIC dep → Task 1 (scaffold), Task 3/Task 10 (adapter interface keeps TorqueQuery out of the build).
- §2.1 config.json → Task 1, Task 3.
- §3 TRM node file layout (all 6 file types) → Tasks 4 (schemas), 7 (topic.json), 9 (sources), 11 (extract/summary), 10/12 (score), 13 (crosslinks).
- §3.1 node_type field → Task 2 (`deriveNodeType`), Task 7 (`createNode` sets it).
- §3.5 per-op lineage attribution, per-node chaining → Task 6.
- §4 recursive hierarchy, rollup → Task 7 (container creation), Task 12 (`--rollup`).
- §5 ScoringAdapter, closed ScoreResult, stub now / real later → Task 10, Task 4 (schema enforces closure).
- §6 Lifecycle/CLI verbs → Tasks 8, 9, 11, 12, 13, 14, wired in Task 16.
- §6 `--dry-run` → Tasks 9, 11, 12.
- §7 Governance table → Task 15 (`trm validate`); "promotion discipline" enforced by Task 12 writing via schema-validated adapter output only, Task 15 detecting hand-edits.
- §8 Exclusions → nothing in this plan builds a TorqueQuery client, Treatment diff-checker, embedding similarity, or multi-actor locking. Confirmed no task does so.
- §9 Actor ID format, standalone location → Task 5, Task 1.

**2. Placeholder scan:** No TBD/TODO in any task. Every step has real, complete code. No "similar to Task N" references — Task 15's edit to `score.ts` shows the exact diff inline rather than pointing back.

**3. Type consistency:** `TopicMeta`, `Fact`, `ScoreResult`, `SourceEntry`, `LineageOp`, `ExtractionRunner`, `ScoringAdapter` are each defined exactly once (Tasks 2, 6, 9, 10, 11) and imported by name everywhere else — verified no renamed duplicates across tasks (e.g. `runScore`'s `ScoreResult` import matches Task 10's export; `runValidate`'s `SchemaName` matches Task 4's export).

One known internal dependency to watch during execution: Task 15 modifies `score.ts` (from Task 12) to add `content_hash` to the `SCORE` lineage op. This is called out explicitly in Task 15 rather than left implicit, and Task 15's step 4 reruns Task 12's test file alongside its own to confirm nothing broke.
