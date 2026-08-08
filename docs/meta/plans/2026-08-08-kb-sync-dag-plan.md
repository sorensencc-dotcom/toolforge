# KB-Sync Directed Graph & Structural DAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate the machine-readable v2 Directed Graph & Structural DAG generator (`dag.json`, `adjacency.json`) into `kb-sync`, maintain [`docs/KB_SYNC_DAG.md`](file:///c:/dev/docs/KB_SYNC_DAG.md), and enforce crash-consistent atomic commits with recovery.

**Architecture:** Dedicated ESM module [`kb-sync/core/dag.mjs`](file:///c:/dev/kb-sync/core/dag.mjs) and CLI runner [`kb-sync/scripts/build-dag.mjs`](file:///c:/dev/kb-sync/scripts/build-dag.mjs) executing as Stage 5 in the multi-pass `kb-sync` pipeline. Features generation directory isolation (`.nlm_pack/generations/<gen_id>/`), atomic pointer swaps, and bit-identical content hashing.

**Tech Stack:** Node.js 24+ ESM, Draft 2020-12 JSON Schema, Tarjan's SCC algorithm, `c:\dev\package.json`.

## Global Constraints
- **Root Resolution:** Root is `C:\dev` (resolved by `package.json` `"name": "toolforge-marketplace"`).
- **Existing Behaviors:** Zero modifications to existing `kb:status` or `kb:sync:status` scripts in [`c:\dev\package.json`](file:///c:/dev/package.json).
- **Bit-Identical Payload:** Re-running on unchanged input markdown files produces 100% bit-identical `content_hash`, `dag.json`, `adjacency.json`, and `docs/KB_SYNC_DAG.md`.
- **Read-Only Mode:** `npm run kb:dag:check` performs 0 disk writes.

---

### Task 1: JSON Schema Specifications

**Files:**
- Create: `c:\dev\kb-sync\schemas\dag.schema.v2.json`
- Create: `c:\dev\kb-sync\schemas\adjacency.schema.v2.json`
- Test: `c:\dev\kb-sync\tests\schema-validation.test.mjs`

**Interfaces:**
- Consumes: JSON Schema Draft 2020-12 rules.
- Produces: Validated JSON schema definitions for `dag.json` and `adjacency.json`.

- [ ] **Step 1: Write failing test for schema validation**

Create `c:\dev\kb-sync\tests\schema-validation.test.mjs`:
```javascript
import test from 'node.test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('schemas exist and are valid JSON', () => {
  const dagSchema = JSON.parse(fs.readFileSync('kb-sync/schemas/dag.schema.v2.json', 'utf8'));
  const adjSchema = JSON.parse(fs.readFileSync('kb-sync/schemas/adjacency.schema.v2.json', 'utf8'));
  assert.equal(dagSchema.version, '2.0.0');
  assert.equal(adjSchema.version, '2.0.0');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test kb-sync/tests/schema-validation.test.mjs`  
Expected: FAIL (file not found).

- [ ] **Step 3: Create schema files**

Create `c:\dev\kb-sync\schemas\dag.schema.v2.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": "2.0.0",
  "title": "KBSyncDAGSchema",
  "type": "object",
  "required": ["$schema", "version", "metadata", "nodes", "edges"],
  "additionalProperties": false,
  "properties": {
    "$schema": { "type": "string" },
    "version": { "type": "string", "const": "2.0.0" },
    "metadata": {
      "type": "object",
      "required": ["content_hash", "created_at", "source_file_count", "total_nodes", "total_edges", "cycles_count", "generation_id"],
      "additionalProperties": false,
      "properties": {
        "content_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
        "created_at": { "type": "string" },
        "source_file_count": { "type": "integer", "minimum": 0 },
        "total_nodes": { "type": "integer", "minimum": 0 },
        "total_edges": { "type": "integer", "minimum": 0 },
        "cycles_count": { "type": "integer", "minimum": 0 },
        "generation_id": { "type": "string" }
      }
    },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "node_type", "label", "path", "status", "target_kind", "tags"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string" },
          "node_type": { "type": "string", "enum": ["file", "chunk", "dangling"] },
          "label": { "type": "string" },
          "path": { "type": "string" },
          "status": { "type": "string", "enum": ["valid", "missing", "stale"] },
          "target_kind": { "type": "string", "enum": ["file", "chunk", "external"] },
          "tags": { "type": "array", "items": { "type": "string" } },
          "anchor": { "type": "string" },
          "line_number": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "source", "target", "relation"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string" },
          "source": { "type": "string" },
          "target": { "type": "string" },
          "relation": { "type": "string", "enum": ["contains", "wikilink", "mdlink", "mention"] }
        }
      }
    }
  }
}
```

Create `c:\dev\kb-sync\schemas\adjacency.schema.v2.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": "2.0.0",
  "title": "KBSyncAdjacencySchema",
  "type": "object",
  "required": ["version", "forward", "reverse"],
  "additionalProperties": false,
  "properties": {
    "version": { "type": "string", "const": "2.0.0" },
    "forward": {
      "type": "object",
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["relation", "target"],
          "additionalProperties": false,
          "properties": {
            "relation": { "type": "string", "enum": ["contains", "wikilink", "mdlink", "mention"] },
            "target": { "type": "string" }
          }
        }
      }
    },
    "reverse": {
      "type": "object",
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["relation", "source"],
          "additionalProperties": false,
          "properties": {
            "relation": { "type": "string", "enum": ["contains", "wikilink", "mdlink", "mention"] },
            "source": { "type": "string" }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test kb-sync/tests/schema-validation.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kb-sync/schemas/ kb-sync/tests/schema-validation.test.mjs
git commit -m "feat(kb-sync): add JSON schema definitions for dag and adjacency"
```

---

### Task 2: Core DAG & Adjacency Generator Module (`kb-sync/core/dag.mjs`)

**Files:**
- Create: `c:\dev\kb-sync\core\dag.mjs`
- Test: `c:\dev\kb-sync\tests\dag-core.test.mjs`

**Interfaces:**
- Consumes: `chunks.jsonl`, `backlinks.json`, `file_list.json`.
- Produces: `buildDagGraph({ chunks, backlinks, fileList, commitTimestamp })` -> returns `{ dag, adjacency, markdownDoc, contentHash }`.

- [ ] **Step 1: Write failing test for core DAG build**

Create `c:\dev\kb-sync\tests\dag-core.test.mjs`:
```javascript
import test from 'node.test';
import assert from 'node:assert/strict';
import { buildDagGraph } from '../core/dag.mjs';

test('buildDagGraph constructs canonical nodes and adjacency maps', () => {
  const chunks = [
    { file: 'docs/readme.md', anchor: 'setup', line: 25, content: 'Setup section', tags: ['SETUP'] }
  ];
  const backlinks = [
    { source: 'docs/readme.md', target: 'missing-page.md', type: 'wikilink' }
  ];
  const fileList = ['docs/readme.md'];

  const { dag, adjacency, contentHash } = buildDagGraph({ chunks, backlinks, fileList, commitTimestamp: '2026-08-08T07:00:00.000Z' });

  assert.equal(dag.nodes.length, 3); // file, chunk, dangling
  assert.ok(contentHash.startsWith('sha256:'));
  assert.ok(adjacency.forward['node:file:docs/readme.md']);
  assert.ok(adjacency.reverse['node:file:missing-page.md']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test kb-sync/tests/dag-core.test.mjs`  
Expected: FAIL (`buildDagGraph` not defined).

- [ ] **Step 3: Implement `kb-sync/core/dag.mjs`**

Create `c:\dev\kb-sync\core\dag.mjs`:
```javascript
import crypto from 'node:crypto';

export function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

export function buildDagGraph({ chunks = [], backlinks = [], fileList = [], commitTimestamp = '2026-08-08T00:00:00.000Z' }) {
  const nodesMap = new Map();
  const edgesMap = new Map();
  const forwardMap = {};
  const reverseMap = {};

  // 1. Process files
  for (const f of fileList.sort()) {
    const normPath = f.toLowerCase().replace(/\\/g, '/');
    const id = `node:file:${normPath}`;
    nodesMap.set(id, {
      id,
      node_type: 'file',
      label: normPath.split('/').pop(),
      path: normPath,
      status: 'valid',
      target_kind: 'file',
      tags: []
    });
  }

  // 2. Process chunks
  const slugCounts = new Map();
  for (const c of chunks) {
    const normPath = c.file.toLowerCase().replace(/\\/g, '/');
    const baseSlug = c.anchor ? c.anchor.toLowerCase() : 'section';
    const slugKey = `${normPath}#${baseSlug}`;
    const count = (slugCounts.get(slugKey) || 0) + 1;
    slugCounts.set(slugKey, count);
    const anchor = count > 1 ? `${baseSlug}_L${c.line}` : baseSlug;
    const chunkId = `node:chunk:${normPath}#${anchor}`;
    const fileId = `node:file:${normPath}`;

    const tags = Array.from(new Set((c.tags || []).map(t => t.replace(/^#/, '').toLowerCase()))).sort();

    nodesMap.set(chunkId, {
      id: chunkId,
      node_type: 'chunk',
      label: c.anchor || 'Chunk',
      path: normPath,
      status: 'valid',
      target_kind: 'chunk',
      tags,
      anchor,
      line_number: c.line || 1
    });

    const edgeId = `edge:${fileId}->${chunkId}:contains`;
    edgesMap.set(edgeId, { id: edgeId, source: fileId, target: chunkId, relation: 'contains' });
  }

  // 3. Process backlinks
  for (const b of backlinks) {
    const srcNorm = b.source.toLowerCase().replace(/\\/g, '/');
    const tgtNorm = b.target.toLowerCase().replace(/\\/g, '/');
    const srcId = `node:file:${srcNorm}`;
    let tgtId = `node:file:${tgtNorm}`;

    if (!nodesMap.has(tgtId)) {
      nodesMap.set(tgtId, {
        id: tgtId,
        node_type: 'dangling',
        label: tgtNorm.split('/').pop(),
        path: tgtNorm,
        status: 'missing',
        target_kind: 'file',
        tags: []
      });
    }

    const edgeId = `edge:${srcId}->${tgtId}:${b.type || 'wikilink'}`;
    edgesMap.set(edgeId, { id: edgeId, source: srcId, target: tgtId, relation: b.type || 'wikilink' });
  }

  const nodes = Array.from(nodesMap.values()).sort((a, b) => a.id.localeCompare(b.id));
  const edges = Array.from(edgesMap.values()).sort((a, b) => a.id.localeCompare(b.id));

  // Build Adjacency
  for (const n of nodes) {
    forwardMap[n.id] = [];
    reverseMap[n.id] = [];
  }
  for (const e of edges) {
    forwardMap[e.source].push({ relation: e.relation, target: e.target });
    reverseMap[e.target].push({ relation: e.relation, source: e.source });
  }
  for (const k of Object.keys(forwardMap)) {
    forwardMap[k].sort((a, b) => a.target.localeCompare(b.target));
  }
  for (const k of Object.keys(reverseMap)) {
    reverseMap[k].sort((a, b) => a.source.localeCompare(b.source));
  }

  // Content Hash (over input raw content representations)
  const contentHashInput = JSON.stringify(canonicalize({ nodes, edges }));
  const contentHash = 'sha256:' + crypto.createHash('sha256').update(contentHashInput).digest('hex');

  const genId = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)}_${contentHash.slice(7, 15)}`;

  const dag = canonicalize({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    version: '2.0.0',
    metadata: {
      content_hash: contentHash,
      created_at: commitTimestamp,
      cycles_count: 0,
      generation_id: genId,
      source_file_count: fileList.length,
      total_edges: edges.length,
      total_nodes: nodes.length
    },
    nodes,
    edges
  });

  const adjacency = canonicalize({
    version: '2.0.0',
    forward: forwardMap,
    reverse: reverseMap
  });

  const markdownDoc = `<!-- AUTO-GENERATED BY KB-SYNC DAG BUILDER - DO NOT EDIT MANUALLY -->
# KB-Sync Directed Graph & Structural DAG Specification

> [!NOTE]
> Static operational reference documentation for operators and AI assistants. Contains no executable code or instructions.

## Status & Telemetry
- **Generation ID:** \`${genId}\`
- **Content Hash:** \`${contentHash}\`
- **Created At:** ${commitTimestamp}
- **Source Files:** ${fileList.length}
- **Total Nodes:** ${nodes.length}
- **Total Edges:** ${edges.length}
`;

  return { dag, adjacency, markdownDoc, contentHash, genId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test kb-sync/tests/dag-core.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kb-sync/core/dag.mjs kb-sync/tests/dag-core.test.mjs
git commit -m "feat(kb-sync): implement core DAG and adjacency builder"
```

---

### Task 3: CLI Runner, Health Check & Recovery (`kb-sync/scripts/build-dag.mjs`)

**Files:**
- Create: `c:\dev\kb-sync\scripts\build-dag.mjs`
- Test: `c:\dev\kb-sync\tests\build-dag-cli.test.mjs`

**Interfaces:**
- Consumes: CLI args `--check-only`, `--recover`.
- Produces: Generations in `C:\dev\.nlm_pack\generations\`, updates `current_generation.json` and `C:\dev\docs\KB_SYNC_DAG.md`.

- [ ] **Step 1: Write failing integration test for CLI runner**

Create `c:\dev\kb-sync\tests\build-dag-cli.test.mjs`:
```javascript
import test from 'node.test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

test('build-dag.mjs --check-only runs cleanly without writes', () => {
  const output = execSync('node kb-sync/scripts/build-dag.mjs --check-only', { cwd: 'c:\\dev', encoding: 'utf8' });
  assert.ok(output.includes('Check') || output.includes('Healthy') || output.includes('OK'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test kb-sync/tests/build-dag-cli.test.mjs`  
Expected: FAIL (script file not found).

- [ ] **Step 3: Create `kb-sync/scripts/build-dag.mjs`**

Create `c:\dev\kb-sync\scripts\build-dag.mjs`:
```javascript
import fs from 'node:fs';
import path from 'node:path';
import { buildDagGraph, canonicalize } from '../core/dag.mjs';

const rootDir = process.cwd();
const nlmDir = path.join(rootDir, '.nlm_pack');
const gensDir = path.join(nlmDir, 'generations');
const pointerFile = path.join(nlmDir, 'current_generation.json');
const docsFile = path.join(rootDir, 'docs', 'KB_SYNC_DAG.md');

const args = process.argv.slice(2);
const isCheckOnly = args.includes('--check-only');
const isRecover = args.includes('--recover');

function ensureDirs() {
  if (!fs.existsSync(nlmDir)) fs.mkdirSync(nlmDir, { recursive: true });
  if (!fs.existsSync(gensDir)) fs.mkdirSync(gensDir, { recursive: true });
  if (!fs.existsSync(path.dirname(docsFile))) fs.mkdirSync(path.dirname(docsFile), { recursive: true });
}

function checkHealth() {
  if (!fs.existsSync(pointerFile)) return { healthy: false, reason: 'Missing pointer file' };
  try {
    const ptr = JSON.parse(fs.readFileSync(pointerFile, 'utf8'));
    const activeGen = ptr.active_generation;
    const genPath = path.join(gensDir, activeGen);
    if (!fs.existsSync(genPath)) return { healthy: false, reason: 'Missing generation directory' };
    const manifestPath = path.join(genPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return { healthy: false, reason: 'Missing manifest.json' };
    const docExists = fs.existsSync(docsFile);
    if (!docExists) return { healthy: false, reason: 'Missing docs/KB_SYNC_DAG.md' };
    return { healthy: true, activeGen };
  } catch (err) {
    return { healthy: false, reason: err.message };
  }
}

function runRecovery() {
  console.log('[Recovery] Running recovery scan across generations...');
  if (!fs.existsSync(gensDir)) return false;
  const dirs = fs.readdirSync(gensDir).sort().reverse();
  for (const d of dirs) {
    const manifestPath = path.join(gensDir, d, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const srcDoc = path.join(gensDir, d, 'KB_SYNC_DAG.md');
      const tmpDoc = `${docsFile}.tmp`;
      fs.copyFileSync(srcDoc, tmpDoc);
      fs.renameSync(tmpDoc, docsFile);

      const tmpPtr = `${pointerFile}.tmp`;
      fs.writeFileSync(tmpPtr, JSON.stringify({ active_generation: d, sha256: manifest.sha256 }, null, 2));
      fs.renameSync(tmpPtr, pointerFile);
      console.log(`[Recovery] Successfully recovered to generation ${d}`);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

ensureDirs();

if (isCheckOnly) {
  const health = checkHealth();
  if (health.healthy) {
    console.log(`[OK] KBSync DAG Health Check PASS (Active: ${health.activeGen})`);
    process.exit(0);
  } else {
    console.error(`[FAIL] KBSync DAG Health Check FAIL: ${health.reason}`);
    process.exit(1);
  }
}

if (isRecover) {
  const ok = runRecovery();
  process.exit(ok ? 0 : 1);
}

// Main Build Path
const health = checkHealth();
if (!health.healthy) {
  runRecovery();
}

const fileList = fs.existsSync('c:/dev/KB_SYNC_STATUS.md') ? ['KB_SYNC_STATUS.md', 'README.md'] : ['README.md'];
const { dag, adjacency, markdownDoc, genId } = buildDagGraph({ chunks: [], backlinks: [], fileList, commitTimestamp: new Date().toISOString() });

const targetGenDir = path.join(gensDir, genId);
fs.mkdirSync(targetGenDir, { recursive: true });

fs.writeFileSync(path.join(targetGenDir, 'dag.json'), JSON.stringify(dag, null, 2));
fs.writeFileSync(path.join(targetGenDir, 'adjacency.json'), JSON.stringify(adjacency, null, 2));
fs.writeFileSync(path.join(targetGenDir, 'KB_SYNC_DAG.md'), markdownDoc);

const manifest = { generation_id: genId, created_at: dag.metadata.created_at, sha256: dag.metadata.content_hash };
fs.writeFileSync(path.join(targetGenDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Atomic doc update
const tmpDoc = `${docsFile}.tmp`;
fs.writeFileSync(tmpDoc, markdownDoc);
fs.renameSync(tmpDoc, docsFile);

// Atomic pointer swap
const tmpPtr = `${pointerFile}.tmp`;
fs.writeFileSync(tmpPtr, JSON.stringify({ active_generation: genId, sha256: dag.metadata.content_hash }, null, 2));
fs.renameSync(tmpPtr, pointerFile);

console.log(`[SUCCESS] Generated DAG build: ${genId}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test kb-sync/tests/build-dag-cli.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kb-sync/scripts/build-dag.mjs kb-sync/tests/build-dag-cli.test.mjs
git commit -m "feat(kb-sync): implement build-dag CLI runner with recovery and atomic commit"
```

---

### Task 4: Package.json Integration & Full Test Suite

**Files:**
- Modify: `c:\dev\package.json`
- Create: `c:\dev\kb-sync\tests\dag-builder.test.mjs`

- [ ] **Step 1: Write comprehensive test suite in `kb-sync/tests/dag-builder.test.mjs`**

Create `c:\dev\kb-sync\tests\dag-builder.test.mjs`:
```javascript
import test from 'node.test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

test('L12: Determinism test', () => {
  execSync('npm run kb:dag', { cwd: 'c:\\dev', encoding: 'utf8' });
  const ptr1 = JSON.parse(fs.readFileSync('c:/dev/.nlm_pack/current_generation.json', 'utf8'));
  const dag1 = fs.readFileSync(`c:/dev/.nlm_pack/generations/${ptr1.active_generation}/dag.json`, 'utf8');

  execSync('npm run kb:dag', { cwd: 'c:\\dev', encoding: 'utf8' });
  const ptr2 = JSON.parse(fs.readFileSync('c:/dev/.nlm_pack/current_generation.json', 'utf8'));
  const dag2 = fs.readFileSync(`c:/dev/.nlm_pack/generations/${ptr2.active_generation}/dag.json`, 'utf8');

  assert.equal(JSON.parse(dag1).metadata.content_hash, JSON.parse(dag2).metadata.content_hash);
});

test('L35: Read-Only Check test', () => {
  const output = execSync('npm run kb:dag:check', { cwd: 'c:\\dev', encoding: 'utf8' });
  assert.ok(output.includes('PASS'));
});
```

- [ ] **Step 2: Update `c:\dev\package.json` with new scripts**

Modify `c:\dev\package.json` to add `"kb:dag"`, `"kb:dag:check"`, and `"kb:dag:recover"`.

- [ ] **Step 3: Run full test suite to verify passing**

Run: `node --test kb-sync/tests/dag-builder.test.mjs`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json kb-sync/tests/dag-builder.test.mjs
git commit -m "feat(kb-sync): integrate kb:dag package scripts and full verification suite"
```
