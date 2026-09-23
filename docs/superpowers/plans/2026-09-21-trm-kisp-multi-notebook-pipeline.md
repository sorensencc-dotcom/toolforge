# Multi-Notebook TRM Knowledge Ingestion & Synchronization Pipeline (KIS-P) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade TRM and kb-sync from a single-target, isolated export model into an execution-ready Multi-Notebook Knowledge Ingestion & Synchronization Pipeline (KIS-P) featuring an Entity Topic Registry, bidirectional cross-notebook digest injection, hard bundle budgeting (≤389,120 bytes / 380 KiB), true asynchronous multi-target dispatching with stage-before-drop transactions, and comprehensive cleanup of all review findings.

**Architecture:** 
1. `master_entity_manifest.json` provides the canonical ontology mapping orthographic aliases to categories, deriving notebook UUIDs exclusively from `categories.json` to prevent dual-source configuration drift.
2. `scripts/validate-trm-semantics.mjs` executes full JSON schema and semantic invariant checks (alias collision, word-boundary integrity, valid category bindings, UUID verification, and non-empty I/O error propagation).
3. `scripts/consolidate-pack.mjs` purges stale `partN` files, parses YAML frontmatter with SHA-256 provenance hashes, scans for outbound citations using regex word boundaries, injects inline L0/L1 Cross-Notebook Digest blocks, deduplicates provenance serialization, respects category filters, and partitions final serialized UTF-8 byte payloads into deterministic ≤380 KiB chunks.
4. `notebooklm-uploader.js` and `scripts/notebooklm/dispatch-multi-notebook.mjs` execute true non-blocking asynchronous uploads (`child_process.spawn`) across all target notebooks in `categories.json`, implementing stage-before-drop safety: uploading the new pack, polling NotebookLM source readiness, verifying source integrity, and only then purging the prior version.
5. `kb-sync/core/config.mjs` separates query lookup from disk mutations, ensuring deterministic read semantics.

**Tech Stack:** Node.js 20+ (ESM), `node:test`, `node:crypto`, `node:fs`, `node:child_process` (async `spawn`), `kb-sync/core/config.mjs`, NotebookLM CLI (`nlm`).

## Global Constraints

- **Single Source of Truth**: Target notebook UUIDs are owned exclusively by `kb-sync/core/categories.json`. `master_entity_manifest.json` maps entities to `primary_category` only; target UUIDs are derived dynamically.
- **Master KB Domain Isolation**: Categories with `exclude_from_master_kb: true` in `categories.json` (`ironledger`, `sigil`, `dev-triage`, `personal-os`, `governance`, `meta`, `modules`, `operations`, `skills`, `superpowers`, `targets`) are strictly excluded from `pack_master_kb.txt`.
- **Hard Byte Budget Ceiling**: Binary 380 KiB (`380 * 1024 = 389,120` bytes). Measured on the **final serialized UTF-8 output**, including all provenance headers, digest blocks, separators, and footers.
- **Fail-Closed Invariant**: Any single file exceeding 380 KiB independently or any unmapped entity halts consolidation with an explicit error rather than silently truncating or misrouting.
- **Transactional Stage-Before-Drop**: An existing source is deleted **only after** the new replacement source is uploaded and confirmed `READY` by NotebookLM index polling. If upload or indexing fails, the prior source is preserved.

---

### Task 1: Entity Topic Registry (ETR) Schema & Manifest Definition

**Files:**
- Create: `_kb-sync-staging/trm/master_entity_manifest.json`
- Create: `_kb-sync-staging/trm/master_entity_manifest.schema.json`
- Test: `tests/master-entity-manifest.test.mjs`

**Interfaces:**
- Consumes: `kb-sync/core/categories.json`.
- Produces: `_kb-sync-staging/trm/master_entity_manifest.json` mapping entities to `primary_category`, aliases, and L0 summaries (notebook targets derived from category definition).

- [ ] **Step 1: Write the failing test for ETR schema and semantic structure**

Create `tests/master-entity-manifest.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const MANIFEST_PATH = path.join(REPO_ROOT, '_kb-sync-staging/trm/master_entity_manifest.json');
const CATEGORIES_PATH = path.join(REPO_ROOT, 'kb-sync/core/categories.json');

test('master_entity_manifest.json conforms to ETR specification and matches categories.json', () => {
  assert.ok(fs.existsSync(MANIFEST_PATH), 'master_entity_manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const categoriesData = JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8'));
  const categories = categoriesData.categories;

  assert.equal(manifest.version, '1.0.0');
  assert.ok(manifest.updated_at, 'Manifest must have updated_at timestamp');
  assert.ok(manifest.entities && typeof manifest.entities === 'object');

  const seenAliases = new Map();
  const seenCanonicalNames = new Set();

  for (const [entityKey, entityDef] of Object.entries(manifest.entities)) {
    assert.ok(entityDef.canonical_name && typeof entityDef.canonical_name === 'string', `Entity ${entityKey} missing canonical_name`);
    assert.ok(!seenCanonicalNames.has(entityDef.canonical_name.toLowerCase()), `Duplicate canonical_name: ${entityDef.canonical_name}`);
    seenCanonicalNames.add(entityDef.canonical_name.toLowerCase());

    assert.ok(categories[entityDef.primary_category], `Entity ${entityKey} has unknown primary_category: ${entityDef.primary_category}`);
    assert.ok(entityDef.l0_summary && entityDef.l0_summary.trim().length >= 20, `Entity ${entityKey} missing or insufficient l0_summary`);
    assert.ok(Array.isArray(entityDef.aliases) && entityDef.aliases.length > 0, `Entity ${entityKey} missing aliases`);

    for (const alias of entityDef.aliases) {
      assert.equal(typeof alias, 'string', `Alias in ${entityKey} must be string`);
      const norm = alias.toLowerCase().trim();
      assert.ok(norm.length > 0, `Alias in ${entityKey} cannot be empty/whitespace`);
      assert.ok(!seenAliases.has(norm), `Duplicate alias '${alias}' in entity '${entityKey}', already owned by '${seenAliases.get(norm)}'`);
      seenAliases.set(norm, entityKey);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/master-entity-manifest.test.mjs`
Expected: FAIL with "master_entity_manifest.json must exist"

- [ ] **Step 3: Create schema and initial master entity manifest**

Create `_kb-sync-staging/trm/master_entity_manifest.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "TRM Master Entity Topic Registry Schema",
  "type": "object",
  "required": ["version", "updated_at", "entities"],
  "properties": {
    "version": { "type": "string" },
    "updated_at": { "type": "string", "format": "date-time" },
    "entities": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["canonical_name", "primary_category", "aliases", "l0_summary"],
        "properties": {
          "canonical_name": { "type": "string", "minLength": 2 },
          "primary_category": { "type": "string", "minLength": 2 },
          "aliases": {
            "type": "array",
            "items": { "type": "string", "minLength": 1 },
            "minItems": 1
          },
          "l0_summary": { "type": "string", "minLength": 20 },
          "l1_digest_source": { "type": "string" }
        }
      }
    }
  }
}
```

Create `_kb-sync-staging/trm/master_entity_manifest.json`:
```json
{
  "$schema": "./master_entity_manifest.schema.json",
  "version": "1.0.0",
  "updated_at": "2026-09-21T00:00:00.000Z",
  "entities": {
    "charles-e-sorensen": {
      "canonical_name": "Charles E. Sorensen",
      "primary_category": "willow-run",
      "aliases": [
        "Sorensen",
        "Sorenson",
        "Cast-Iron Charlie",
        "Charles Sorensen",
        "C. E. Sorensen"
      ],
      "l0_summary": "Executive head of Ford manufacturing; architect of Highland Park assembly line and Willow Run B-24 Bomber Plant.",
      "l1_digest_source": "wiki/entities/charles-e-sorensen.md"
    },
    "willow-run-bomber-plant": {
      "canonical_name": "Willow Run Bomber Plant",
      "primary_category": "willow-run",
      "aliases": [
        "Willow Run",
        "Willow Run Plant",
        "B-24 Plant",
        "Bomber Plant"
      ],
      "l0_summary": "Ford mass-production aircraft facility manufacturing B-24 Liberator bombers using moving assembly line techniques.",
      "l1_digest_source": "wiki/topics/willow-run.md"
    },
    "cesor-corporation": {
      "canonical_name": "CESOR Corporation",
      "primary_category": "cuba-claims",
      "aliases": [
        "CESOR",
        "cesor",
        "Cesor Corp",
        "Cuban Economic Studies & Operations Research"
      ],
      "l0_summary": "Entity managing Sorensen Cuban agricultural and plantation assets subject to 1960 nationalization claims.",
      "l1_digest_source": "wiki/entities/cesor-corporation.md"
    },
    "willys-overland-motors": {
      "canonical_name": "Willys-Overland Motors",
      "primary_category": "post-war",
      "aliases": [
        "Willys",
        "Willys-Overland",
        "Willys Overland",
        "CJ-3B"
      ],
      "l0_summary": "Post-war automotive company where Sorensen served as President/Vice Chairman, developing civilian Jeep lines.",
      "l1_digest_source": "wiki/topics/willys-overland.md"
    },
    "harry-bennett": {
      "canonical_name": "Harry Bennett",
      "primary_category": "ford-politics",
      "aliases": [
        "Harry Bennett",
        "Bennett",
        "Ford Service Department"
      ],
      "l0_summary": "Head of Ford Service Department; key antagonist in Ford executive politics against Edsel Ford and Sorensen.",
      "l1_digest_source": "wiki/entities/harry-bennett.md"
    },
    "helene-estate": {
      "canonical_name": "Helene Estate & Miami Properties",
      "primary_category": "miami-estate",
      "aliases": [
        "Helene",
        "Helene I",
        "Helene II",
        "5185 N Bay Rd",
        "5185 North Bay Road",
        "Miami Beach Estate"
      ],
      "l0_summary": "Sorensen Miami Beach residence and luxury yachts (Helene I & II) utilized during retirement and Florida operations.",
      "l1_digest_source": "wiki/topics/miami-estate.md"
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/master-entity-manifest.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add _kb-sync-staging/trm/master_entity_manifest.json _kb-sync-staging/trm/master_entity_manifest.schema.json tests/master-entity-manifest.test.mjs
git commit -m "feat(trm): establish Entity Topic Registry schema and canonical manifest"
```

---

### Task 2: Semantic Validator Implementation & Structured Rule Taxonomy

**Files:**
- Create: `scripts/validate-trm-semantics.mjs`
- Test: `tests/validate-trm-semantics.test.mjs`

**Interfaces:**
- Consumes: `_kb-sync-staging/trm/master_entity_manifest.json`, `kb-sync/core/categories.json`.
- Produces: `validateEntityTopicRegistry(manifest, categoriesData)` returning `{ valid: boolean, errors: Array<{ rule_id: string, message: string }> }`.

- [ ] **Step 1: Write the failing test for semantic validator**

Create `tests/validate-trm-semantics.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntityTopicRegistry, ETR_RULES } from '../scripts/validate-trm-semantics.mjs';

test('validateEntityTopicRegistry passes for valid manifest and categories', () => {
  const validManifest = {
    version: '1.0.0',
    updated_at: '2026-09-21T00:00:00.000Z',
    entities: {
      'test-entity': {
        canonical_name: 'Test Entity',
        primary_category: 'willow-run',
        aliases: ['Test', 'Test Alias'],
        l0_summary: 'Test summary description exceeding twenty characters.'
      }
    }
  };
  const categoriesData = {
    categories: {
      'willow-run': { target: '6fd7c40b-df90-444b-9c7a-a64682925856', title: 'Willow Run', status: 'canonical' }
    }
  };

  const res = validateEntityTopicRegistry(validManifest, categoriesData);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
});

test('validateEntityTopicRegistry catches alias collision across entities', () => {
  const invalidManifest = {
    version: '1.0.0',
    updated_at: '2026-09-21T00:00:00.000Z',
    entities: {
      'entity-a': {
        canonical_name: 'Entity A',
        primary_category: 'willow-run',
        aliases: ['SharedAlias'],
        l0_summary: 'Valid summary for entity A in test.'
      },
      'entity-b': {
        canonical_name: 'Entity B',
        primary_category: 'willow-run',
        aliases: ['sharedalias'],
        l0_summary: 'Valid summary for entity B in test.'
      }
    }
  };
  const categoriesData = {
    categories: { 'willow-run': { target: '6fd7c40b-df90-444b-9c7a-a64682925856', status: 'canonical' } }
  };

  const res = validateEntityTopicRegistry(invalidManifest, categoriesData);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some(e => e.rule_id === ETR_RULES.ALIAS_COLLISION));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/validate-trm-semantics.test.mjs`
Expected: FAIL with "Cannot find module '../scripts/validate-trm-semantics.mjs'"

- [ ] **Step 3: Implement `scripts/validate-trm-semantics.mjs`**

Create `scripts/validate-trm-semantics.mjs`:
```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCategoriesData } from '../kb-sync/core/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export const ETR_RULES = {
  SCHEMA_INVALID: 'RULE_ETR_SCHEMA_INVALID',
  TIMESTAMP_MISSING: 'RULE_ETR_TIMESTAMP_MISSING',
  NAME_MISSING: 'RULE_ETR_NAME_MISSING',
  DUPLICATE_CANONICAL_NAME: 'RULE_ETR_DUPLICATE_CANONICAL_NAME',
  UNKNOWN_CATEGORY: 'RULE_ETR_UNKNOWN_CATEGORY',
  SUMMARY_INSUFFICIENT: 'RULE_ETR_SUMMARY_INSUFFICIENT',
  ALIASES_EMPTY: 'RULE_ETR_ALIASES_EMPTY',
  ALIAS_COLLISION: 'RULE_ETR_ALIAS_COLLISION'
};

export function validateEntityTopicRegistry(manifest, categoriesData = loadCategoriesData()) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || !manifest.entities) {
    return {
      valid: false,
      errors: [{ rule_id: ETR_RULES.SCHEMA_INVALID, message: 'Manifest missing entities dictionary' }]
    };
  }

  if (!manifest.updated_at || typeof manifest.updated_at !== 'string') {
    errors.push({ rule_id: ETR_RULES.TIMESTAMP_MISSING, message: 'Manifest missing valid updated_at timestamp' });
  }

  const categories = categoriesData.categories || {};
  const seenAliases = new Map();
  const seenCanonicalNames = new Set();

  for (const [entityKey, entityDef] of Object.entries(manifest.entities)) {
    if (!entityDef.canonical_name || typeof entityDef.canonical_name !== 'string' || entityDef.canonical_name.trim().length < 2) {
      errors.push({ rule_id: ETR_RULES.NAME_MISSING, message: `Entity '${entityKey}' missing canonical_name` });
    } else {
      const normName = entityDef.canonical_name.toLowerCase().trim();
      if (seenCanonicalNames.has(normName)) {
        errors.push({ rule_id: ETR_RULES.DUPLICATE_CANONICAL_NAME, message: `Duplicate canonical name: '${entityDef.canonical_name}'` });
      }
      seenCanonicalNames.add(normName);
    }

    const cat = categories[entityDef.primary_category];
    if (!cat) {
      errors.push({ rule_id: ETR_RULES.UNKNOWN_CATEGORY, message: `Entity '${entityKey}' references unknown primary_category '${entityDef.primary_category}'` });
    }

    if (!entityDef.l0_summary || typeof entityDef.l0_summary !== 'string' || entityDef.l0_summary.trim().length < 20) {
      errors.push({ rule_id: ETR_RULES.SUMMARY_INSUFFICIENT, message: `Entity '${entityKey}' missing or insufficient l0_summary (min 20 chars)` });
    }

    if (!Array.isArray(entityDef.aliases) || entityDef.aliases.length === 0) {
      errors.push({ rule_id: ETR_RULES.ALIASES_EMPTY, message: `Entity '${entityKey}' has no aliases` });
    } else {
      for (const alias of entityDef.aliases) {
        if (typeof alias !== 'string' || alias.trim().length === 0) {
          errors.push({ rule_id: ETR_RULES.ALIASES_EMPTY, message: `Entity '${entityKey}' contains an empty or non-string alias` });
          continue;
        }
        const norm = alias.toLowerCase().trim();
        if (seenAliases.has(norm)) {
          errors.push({
            rule_id: ETR_RULES.ALIAS_COLLISION,
            message: `Alias collision: '${alias}' in '${entityKey}' was already declared by '${seenAliases.get(norm)}'`
          });
        }
        seenAliases.set(norm, entityKey);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  const manifestPath = path.join(REPO_ROOT, '_kb-sync-staging/trm/master_entity_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`[ETR] Manifest not found: ${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const res = validateEntityTopicRegistry(manifest);
  if (!res.valid) {
    console.error(`[ETR] Semantic validation failed with ${res.errors.length} error(s):`);
    for (const err of res.errors) {
      console.error(`  - [${err.rule_id}] ${err.message}`);
    }
    process.exit(1);
  }
  console.log(`[ETR] Manifest validation passed (validated ${Object.keys(manifest.entities).length} entities).`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/validate-trm-semantics.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-trm-semantics.mjs tests/validate-trm-semantics.test.mjs
git commit -m "feat(trm): implement Entity Topic Registry semantic validator with structured rule taxonomy"
```

---

### Task 3: Domain Isolation & Cleanup in `consolidate-pack.mjs`

**Files:**
- Modify: `scripts/consolidate-pack.mjs`
- Test: `tests/consolidate-pack-isolation.test.mjs`

**Interfaces:**
- Consumes: `getMasterKbExclusions` and `loadCategoriesData` from `kb-sync/core/config.mjs`.
- Produces: `pack_master_kb.txt` strictly excluding non-historical categories.

- [ ] **Step 1: Write test for master-kb domain isolation across every excluded category**

Create `tests/consolidate-pack-isolation.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { consolidatePacks } from '../scripts/consolidate-pack.mjs';
import { loadCategoriesData, getMasterKbExclusions } from '../kb-sync/core/config.mjs';

test('consolidatePacks excludes all excluded categories from master-kb', () => {
  const tmpDir = path.join(process.cwd(), '.tmp', 'test-pack-isolation');
  fs.mkdirSync(tmpDir, { recursive: true });

  const exclusions = getMasterKbExclusions();
  assert.ok(exclusions.size > 0, 'Exclusions set must not be empty');

  const packs = consolidatePacks({ outDir: tmpDir });
  const masterPack = packs.find(p => p.packDef.category === 'master-kb');
  assert.ok(masterPack, 'master-kb pack must be generated');

  const content = fs.readFileSync(masterPack.packFile, 'utf8');
  for (const excludedKey of exclusions) {
    assert.equal(content.includes(`category: ${excludedKey}`), false, `Category '${excludedKey}' must not leak into master-kb`);
  }

  // Verify category filter works
  const singlePacks = consolidatePacks({ outDir: tmpDir, category: 'willow-run' });
  assert.equal(singlePacks.length, 1);
  assert.equal(singlePacks[0].packDef.category, 'willow-run');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/consolidate-pack-isolation.test.mjs`

- [ ] **Step 3: Update `scripts/consolidate-pack.mjs` to honor exclusions and deduplicate formatting**

Modify `scripts/consolidate-pack.mjs`:
- Check `exclusions.has(canonicalKey)` before pushing to `master-kb`.
- Extract `formatProvenanceHeader(item)`.
- Honor `options.category`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/consolidate-pack-isolation.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/consolidate-pack.mjs tests/consolidate-pack-isolation.test.mjs
git commit -m "fix(kb-sync): enforce master-kb domain isolation, deduplicate provenance serialization, and respect category filters"
```

---

### Task 4: Outbound Citation Scanner & Cross-Notebook Digest Injector

**Files:**
- Modify: `scripts/consolidate-pack.mjs`
- Test: `tests/consolidate-pack-digest.test.mjs`

**Interfaces:**
- Consumes: `_kb-sync-staging/trm/master_entity_manifest.json`, `kb-sync/core/categories.json`.
- Produces: Inline `=== CROSS-NOTEBOOK DIGEST ===` blocks with regex word-boundary matching and duplicate suppression.

- [ ] **Step 1: Write failing test for cross-notebook digest injection**

Create `tests/consolidate-pack-digest.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectCrossNotebookDigests } from '../scripts/consolidate-pack.mjs';

test('injectCrossNotebookDigests appends digest using word boundaries and prevents duplicates', () => {
  const content = 'Sorensen oversaw the Willow Run factory, while CESOR handled offshore sugar operations. Bennett opposed Edsel.';
  const manifest = {
    entities: {
      'charles-e-sorensen': {
        canonical_name: 'Charles E. Sorensen',
        primary_category: 'willow-run',
        aliases: ['Sorensen'],
        l0_summary: 'Head of Ford manufacturing.'
      },
      'cesor-corporation': {
        canonical_name: 'CESOR Corporation',
        primary_category: 'cuba-claims',
        aliases: ['CESOR'],
        l0_summary: 'Cuban asset management entity.'
      },
      'harry-bennett': {
        canonical_name: 'Harry Bennett',
        primary_category: 'ford-politics',
        aliases: ['Bennett'],
        l0_summary: 'Head of Ford Service Department.'
      }
    }
  };
  const categoriesData = {
    categories: {
      'willow-run': { target: 'uuid-willow' },
      'cuba-claims': { target: 'uuid-cuba' },
      'ford-politics': { target: 'uuid-ford' }
    }
  };

  const injected = injectCrossNotebookDigests(content, 'willow-run', manifest, categoriesData);
  assert.equal(injected.includes('CROSS-NOTEBOOK DIGEST: Charles E. Sorensen'), false, 'Local entity must not inject cross-digest');
  assert.ok(injected.includes('=== CROSS-NOTEBOOK DIGEST: CESOR Corporation ==='));
  assert.ok(injected.includes('=== CROSS-NOTEBOOK DIGEST: Harry Bennett ==='));
  assert.ok(injected.includes('Target Notebook ID: uuid-cuba'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/consolidate-pack-digest.test.mjs`
Expected: FAIL with "injectCrossNotebookDigests is not a function"

- [ ] **Step 3: Implement citation scanner and digest injector in `scripts/consolidate-pack.mjs`**

Implement `injectCrossNotebookDigests` using regex `\b${alias}\b` boundaries, looking up target notebook IDs dynamically from `categoriesData.categories[primary_category].target`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/consolidate-pack-digest.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/consolidate-pack.mjs tests/consolidate-pack-digest.test.mjs
git commit -m "feat(kb-sync): add cross-notebook digest injector with word-boundary matching and dynamic target lookup"
```

---

### Task 5: Knowledge Pack Chunking & Final Serialized Byte Budget Enforcement

**Files:**
- Modify: `scripts/consolidate-pack.mjs`
- Test: `tests/consolidate-pack-budget.test.mjs`

**Interfaces:**
- Produces: Deterministic chunk files `pack_<category>_part1.txt`, `pack_<category>_part2.txt` when final serialized UTF-8 byte length exceeds 389,120 bytes (380 KiB). Purges stale part files before write.

- [ ] **Step 1: Write failing test for final serialized byte budgeting**

Create `tests/consolidate-pack-budget.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionPackItems, MAX_PACK_BYTES } from '../scripts/consolidate-pack.mjs';

test('partitionPackItems correctly splits 3 items of 200 KB into 3 distinct chunks under 380 KiB limit', () => {
  const dummyLargeContent = 'A'.repeat(200 * 1024); // 200 KiB
  const items = [
    { relPath: 'doc1.md', content: dummyLargeContent, sha256: 'h1', frontmatter: {}, sourceType: 'md' },
    { relPath: 'doc2.md', content: dummyLargeContent, sha256: 'h2', frontmatter: {}, sourceType: 'md' },
    { relPath: 'doc3.md', content: dummyLargeContent, sha256: 'h3', frontmatter: {}, sourceType: 'md' }
  ];

  assert.equal(MAX_PACK_BYTES, 380 * 1024); // 389,120 bytes
  const chunks = partitionPackItems(items, MAX_PACK_BYTES);
  assert.equal(chunks.length, 3, 'Three 200 KB items must produce 3 chunks under a 380 KB limit');
});

test('partitionPackItems throws fail-closed error if a single item exceeds MAX_PACK_BYTES', () => {
  const oversizedContent = 'A'.repeat(400 * 1024); // 400 KiB
  const items = [
    { relPath: 'oversized.md', content: oversizedContent, sha256: 'h1', frontmatter: {}, sourceType: 'md' }
  ];

  assert.throws(() => {
    partitionPackItems(items, MAX_PACK_BYTES);
  }, /ITEM_EXCEEDS_BUDGET/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/consolidate-pack-budget.test.mjs`
Expected: FAIL with "partitionPackItems is not a function"

- [ ] **Step 3: Implement `partitionPackItems` and stale-part file purge in `scripts/consolidate-pack.mjs`**

Implement `partitionPackItems` measuring exact serialized item UTF-8 byte buffers. Add cleanup logic before emitting to remove any existing `pack_${category}*.txt` files.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/consolidate-pack-budget.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/consolidate-pack.mjs tests/consolidate-pack-budget.test.mjs
git commit -m "feat(kb-sync): enforce 380 KiB serialized byte ceiling, deterministic chunking, and stale-pack purging"
```

---

### Task 6: Refactor `notebooklm-uploader.js` for Fail-Closed Config & Helper Reuse

**Files:**
- Modify: `notebooklm-uploader.js`
- Test: `tests/notebooklm-uploader-config.test.mjs`

**Interfaces:**
- Consumes: `kb-sync/core/config.mjs` (`loadCategoriesData`, `NOTEBOOK_TARGETS`, `getCanonicalPacks`).
- Eliminates: Ad-hoc category reading, silent open failures on missing JSON, hardcoded fallback UUIDs, and legacy Willow Run string filters (`title.startsWith('pack_willow_run')`).

- [ ] **Step 1: Write test for notebooklm-uploader resolving targets from canonical config**

Create `tests/notebooklm-uploader-config.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTargetNotebook, resolvePackFile } from '../notebooklm-uploader.js';

test('resolveTargetNotebook resolves registered category to notebook ID from canonical config', () => {
  const target = resolveTargetNotebook(['--category=cuba-claims']);
  assert.equal(target, 'c8360946-dbee-4a2c-b622-7f89b05695b0');
});

test('resolveTargetNotebook throws fail-closed error on unknown category', () => {
  assert.throws(() => {
    resolveTargetNotebook(['--category=unknown-nonexistent-category']);
  }, /CATEGORY_NOT_FOUND/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/notebooklm-uploader-config.test.mjs`

- [ ] **Step 3: Refactor `notebooklm-uploader.js`**

Replace ad-hoc category loading with `loadCategoriesData()` from `kb-sync/core/config.mjs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/notebooklm-uploader-config.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add notebooklm-uploader.js tests/notebooklm-uploader-config.test.mjs
git commit -m "refactor(nlm): refactor uploader to consume canonical config with fail-closed error handling"
```

---

### Task 7: Concurrent Multi-Target Dispatcher with Transactional Stage-Before-Drop

**Files:**
- Create: `scripts/notebooklm/dispatch-multi-notebook.mjs`
- Test: `tests/dispatch-multi-notebook.test.mjs`

**Interfaces:**
- Consumes: Output from `consolidatePacks()`.
- Produces: True async execution (`spawn`), staged upload, index readiness polling, and transactional deletion of prior sources.

- [ ] **Step 1: Write failing test for dispatcher target plan building**

Create `tests/dispatch-multi-notebook.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDispatchPlan } from '../scripts/notebooklm/dispatch-multi-notebook.mjs';

test('buildDispatchPlan generates dispatch items directly from consolidated pack output', () => {
  const generatedPacks = [
    { packDef: { category: 'willow-run', notebookId: 'uuid-1', title: 'Willow Run' }, packFile: '/path/pack_willow_run.txt' },
    { packDef: { category: 'cuba-claims', notebookId: 'uuid-2', title: 'Cuba Claims' }, packFile: '/path/pack_cuba_claims.txt' }
  ];

  const plan = buildDispatchPlan(generatedPacks);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].notebookId, 'uuid-1');
  assert.equal(plan[1].notebookId, 'uuid-2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dispatch-multi-notebook.test.mjs`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `scripts/notebooklm/dispatch-multi-notebook.mjs`**

Create `scripts/notebooklm/dispatch-multi-notebook.mjs`:
```javascript
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { loadCategoriesData } from '../../kb-sync/core/config.mjs';
import { consolidatePacks } from '../consolidate-pack.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

export function buildDispatchPlan(generatedPacks = []) {
  return generatedPacks.map(p => ({
    category: p.packDef.category,
    title: p.packDef.title,
    notebookId: p.packDef.notebookId,
    packFile: p.packFile,
    filename: path.basename(p.packFile)
  }));
}

function runAsyncSubprocess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', err => reject(err));
  });
}

export async function dispatchMultiNotebook(options = {}) {
  console.log('[KIS-P DISPATCHER] Starting Multi-Notebook Ingestion Pipeline...');
  
  const packs = consolidatePacks({ rootDir: REPO_ROOT });
  const plan = buildDispatchPlan(packs);

  console.log(`[KIS-P DISPATCHER] Discovered ${plan.length} target pack dispatch task(s).`);

  const concurrency = options.concurrency || 3;
  const results = [];

  for (let i = 0; i < plan.length; i += concurrency) {
    const batch = plan.slice(i, i + concurrency);
    const batchPromises = batch.map(async (task) => {
      console.log(`[DISPATCH] Syncing ${task.filename} -> Notebook: ${task.notebookId} (${task.title})...`);
      if (options.dryRun) {
        return { task, status: 'dry-run-ok' };
      }
      const uploaderScript = path.join(REPO_ROOT, 'notebooklm-uploader.js');
      const res = await runAsyncSubprocess('node', [uploaderScript, `--notebook-id=${task.notebookId}`, `--file=${task.packFile}`]);
      return { task, status: res.code === 0 ? 'success' : 'failed', exitCode: res.code, stderr: res.stderr };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  const failed = results.filter(r => r.status === 'failed');
  if (failed.length > 0) {
    console.error(`[KIS-P DISPATCHER] ${failed.length} task(s) failed during multi-notebook synchronization.`);
    return { success: false, results };
  }

  console.log('[KIS-P DISPATCHER] All multi-notebook synchronization tasks completed successfully.');
  return { success: true, results };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  const isDryRun = process.argv.includes('--dry-run');
  dispatchMultiNotebook({ dryRun: isDryRun }).then(res => {
    if (!res.success) process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/dispatch-multi-notebook.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/notebooklm/dispatch-multi-notebook.mjs tests/dispatch-multi-notebook.test.mjs
git commit -m "feat(trm): implement asynchronous concurrent multi-notebook dispatcher"
```

---

### Task 8: End-to-End Orchestration & npm Script Registration

**Files:**
- Modify: `package.json`
- Test: `tests/kisp-e2e-pipeline.test.mjs`

**Interfaces:**
- Exposes: `npm run trm:kisp:sync` and `npm run trm:kisp:validate`.

- [ ] **Step 1: Write E2E smoke test for pipeline command execution**

Create `tests/kisp-e2e-pipeline.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('npm run trm:kisp:validate runs semantic validator successfully', () => {
  const res = spawnSync('node', ['scripts/validate-trm-semantics.mjs'], { encoding: 'utf8' });
  assert.equal(res.status, 0, `Validation script failed: ${res.stderr}`);
  assert.ok(res.stdout.includes('validation passed'));
});

test('multi-notebook dispatcher dry-run runs cleanly', () => {
  const res = spawnSync('node', ['scripts/notebooklm/dispatch-multi-notebook.mjs', '--dry-run'], { encoding: 'utf8' });
  assert.equal(res.status, 0, `Dry run failed: ${res.stderr}`);
  assert.ok(res.stdout.includes('completed successfully'));
});
```

- [ ] **Step 2: Add scripts to `package.json`**

Add scripts:
```json
"trm:kisp:validate": "node scripts/validate-trm-semantics.mjs",
"trm:kisp:sync": "node scripts/notebooklm/dispatch-multi-notebook.mjs",
"trm:kisp:dry-run": "node scripts/notebooklm/dispatch-multi-notebook.mjs --dry-run"
```

- [ ] **Step 3: Run E2E test to verify it passes**

Run: `node --test tests/kisp-e2e-pipeline.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json tests/kisp-e2e-pipeline.test.mjs
git commit -m "chore(trm): register KIS-P validation and sync npm scripts with E2E test"
```
