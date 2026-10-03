# Viking VFS Tiering and Context Compaction Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile and integrate Viking VFS tiered compaction (L0/L1/L2) by extracting a pure AST skeletonizer, implementing an offline compaction generator (`scripts/viking-compact-vault.mjs`), reconciling MCP tool aliases, and establishing atomic generation refreshes while preserving read-only snapshot retrieval invariants.

**Architecture:** Refactor the AST skeletonizer from `trm/viking-vfs-mount.mjs` into a reusable module (`modules/mcp/viking-ast-skeleton.mjs`) featuring a deterministic 3-tier fallback (TypeScript Compiler API -> Graft CLI -> Regex fallback). Create `scripts/viking-compact-vault.mjs` to generate immutable L0/L1 artifact metadata under `.viking/metadata/` and register them in `tier-index.sqlite`. Reconcile MCP endpoints in `modules/mcp/viking-vfs-server.mjs` with backward-compatible method aliases while strictly preserving read-only execution boundaries.

**Tech Stack:** Node.js (ESM), TypeScript Compiler API (`typescript`), Better-SQLite3, Node `node:test` / `assert`, OpenViking VFS protocol contracts.

## Global Constraints

- **Read-Only Invariant**: Viking VFS retrieval endpoints must never mutate source files, staging directories, or live workspace paths during reads.
- **URI Grammar**: Canonical URIs follow `viking://<vault-name>/<layer>/<relative-path>` where layer is one of `sources`, `wiki`, or `schema`. Domain aliases (`resources/`, `user/operator/`, `agent/`) must be resolved transparently via path mapping adapters without breaking base schema.
- **Fail-Soft AST Skeletonization**: Code compaction must never fail on syntax errors; it must degrade gracefully through TypeScript AST -> Graft skeleton -> Regex signature header.
- **Zero Raw NPX Calls**: Dynamic `npx @nanonets/graft` shell invocations are forbidden in hot paths; use direct CLI binary resolution or library calls.

---

### Task 1: Extract Reusable AST Skeletonizer Module

**Files:**
- Create: `modules/mcp/viking-ast-skeleton.mjs`
- Test: `modules/mcp/viking-ast-skeleton.test.mjs`

**Interfaces:**
- Consumes: Raw file content (string), file extension / language identifier (`.ts`, `.js`, `.mjs`, `.md`).
- Produces: `extractL0Abstract(content, ext): { abstract: string, intent: string, exports: string[] }`, `extractL1Skeleton(content, ext): { skeleton: string, tier: 'ts-ast' | 'graft' | 'regex' | 'markdown-outline' }`.

- [ ] **Step 1: Write the failing unit tests for AST skeletonizer**

```javascript
// modules/mcp/viking-ast-skeleton.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractL0Abstract, extractL1Skeleton } from './viking-ast-skeleton.mjs';

test('extractL0Abstract extracts single-line intent and exported symbols', () => {
  const code = `
    /** Authenticates the incoming request with bearer token */
    export function authenticateUser(token: string): boolean {
      return token === 'secret';
    }
  `;
  const res = extractL0Abstract(code, '.ts');
  assert.match(res.abstract, /Authenticates the incoming request/);
  assert.deepEqual(res.exports, ['authenticateUser']);
});

test('extractL1Skeleton replaces function bodies with error traps in TypeScript', () => {
  const code = `
    export function calculateTax(amount: number): number {
      const rate = 0.05;
      return amount * rate;
    }
  `;
  const res = extractL1Skeleton(code, '.ts');
  assert.match(res.skeleton, /export function calculateTax\(amount: number\): number/);
  assert.match(res.skeleton, /COMPACTED SKELETON: IMPLEMENTATION STRIPPED/);
  assert.equal(res.skeleton.includes('amount * rate'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/mcp/viking-ast-skeleton.test.mjs`
Expected: FAIL with module not found or functions not exported.

- [ ] **Step 3: Implement minimal AST skeletonizer**

```javascript
// modules/mcp/viking-ast-skeleton.mjs
import ts from 'typescript';

const COMPACT_TRAP = ' { throw new Error("[COMPACTED SKELETON: IMPLEMENTATION STRIPPED - DO NOT EXECUTE]"); }';

export function extractL0Abstract(content, ext = '.ts') {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const firstDocOrLine = lines.find(l => !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*')) || lines[0] || '';
  const exportMatches = [...content.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|type|interface)\s+([a-zA-Z0-9_$]+)/g)];
  const exports = exportMatches.map(m => m[1]);

  return {
    abstract: firstDocOrLine.replace(/[\/\*]/g, '').trim().slice(0, 200),
    exports,
  };
}

export function extractL1Skeleton(content, ext = '.ts') {
  if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    // Markdown outline fallback
    const headings = content.split('\n').filter(l => l.startsWith('#')).join('\n');
    return { skeleton: headings || content.slice(0, 500), tier: 'markdown-outline' };
  }

  try {
    const sourceFile = ts.createSourceFile('file' + ext, content, ts.ScriptTarget.Latest, true);
    const transformer = (context) => (rootNode) => {
      function visit(node) {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          if (node.body) {
            return ts.factory.updateFunctionDeclaration(
              node,
              node.modifiers,
              node.asteriskToken,
              node.name,
              node.typeParameters,
              node.parameters,
              node.type,
              ts.factory.createBlock([
                ts.factory.createThrowStatement(
                  ts.factory.createNewExpression(
                    ts.factory.createIdentifier('Error'),
                    undefined,
                    [ts.factory.createStringLiteral('[COMPACTED SKELETON: IMPLEMENTATION STRIPPED - DO NOT EXECUTE]')]
                  )
                )
              ], true)
            );
          }
        }
        return ts.visitEachChild(node, visit, context);
      }
      return ts.visitNode(rootNode, visit);
    };

    const result = ts.transform(sourceFile, [transformer]);
    const printer = ts.createPrinter({ removeComments: false });
    const skeleton = printer.printFile(result.transformed[0]);
    return { skeleton, tier: 'ts-ast' };
  } catch {
    // Fallback: Regex header stripper
    const stripped = content.replace(/\{[\s\S]*?\}/g, COMPACT_TRAP);
    return { skeleton: stripped, tier: 'regex' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test modules/mcp/viking-ast-skeleton.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/mcp/viking-ast-skeleton.mjs modules/mcp/viking-ast-skeleton.test.mjs
git commit -m "feat(viking): add pure AST skeletonizer and L0/L1 extractor module"
```

---

### Task 2: Build Offline Vault Compactor Script (`scripts/viking-compact-vault.mjs`)

**Files:**
- Create: `scripts/viking-compact-vault.mjs`
- Test: `scripts/viking-compact-vault.test.mjs`

**Interfaces:**
- Consumes: Target directory (`scripts/`, `modules/`, `kb-sync/`), destination root (`.viking/metadata/`).
- Produces: Generated L0/L1 files, SQLite index population (`tier-index.sqlite`), JSON execution manifest.

- [ ] **Step 1: Write failing test for vault compactor**

```javascript
// scripts/viking-compact-vault.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compactVault } from './viking-compact-vault.mjs';

test('compactVault scans source directory and outputs L0/L1 artifacts + manifest', async () => {
  const tmpDir = path.join(process.cwd(), 'temp-compact-test');
  const srcDir = path.join(tmpDir, 'sources');
  const outDir = path.join(tmpDir, 'metadata');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'sample.ts'), 'export function testFn(): void { console.log("hello"); }');

  try {
    const summary = await compactVault({ sourceDir: srcDir, outputDir: outDir, vaultName: 'test-vault' });
    assert.equal(summary.processedFiles, 1);
    assert.ok(fs.existsSync(path.join(outDir, 'manifest.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'sources', 'sample.ts.l0.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'sources', 'sample.ts.l1.txt')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/viking-compact-vault.test.mjs`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `scripts/viking-compact-vault.mjs`**

```javascript
// scripts/viking-compact-vault.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractL0Abstract, extractL1Skeleton } from '../modules/mcp/viking-ast-skeleton.mjs';

export async function compactVault({ sourceDir, outputDir, vaultName = 'dev' }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { recursive: true, withFileTypes: true });
  let processedFiles = 0;
  const manifest = { vaultName, timestamp: new Date().toISOString(), files: [] };

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(entry.path || entry.parentPath || sourceDir, entry.name);
    const relPath = path.relative(sourceDir, fullPath).replace(/\\/g, '/');
    if (relPath.includes('node_modules') || relPath.startsWith('.')) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const ext = path.extname(fullPath);
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');

    const l0 = extractL0Abstract(content, ext);
    const l1 = extractL1Skeleton(content, ext);

    const outSubdir = path.join(outputDir, path.dirname(relPath));
    fs.mkdirSync(outSubdir, { recursive: true });

    const l0File = path.join(outputDir, `${relPath}.l0.json`);
    const l1File = path.join(outputDir, `${relPath}.l1.txt`);

    fs.writeFileSync(l0File, JSON.stringify({ ...l0, sha256, path: relPath }, null, 2));
    fs.writeFileSync(l1File, l1.skeleton);

    manifest.files.push({ path: relPath, sha256, tierL0: `${relPath}.l0.json`, tierL1: `${relPath}.l1.txt` });
    processedFiles++;
  }

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { processedFiles, manifestPath: path.join(outputDir, 'manifest.json') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  const sourceDir = process.argv[2] || path.join(process.cwd(), 'modules');
  const outputDir = process.argv[3] || path.join(process.cwd(), '.viking', 'metadata');
  compactVault({ sourceDir, outputDir }).then(res => {
    console.log(`[viking-compact] Processed ${res.processedFiles} files. Manifest written to ${res.manifestPath}`);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/viking-compact-vault.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/viking-compact-vault.mjs scripts/viking-compact-vault.test.mjs
git commit -m "feat(viking): add offline vault compaction pipeline"
```

---

### Task 3: Reconcile MCP Tool Aliases and Read-Only Gate

**Files:**
- Modify: `modules/mcp/viking-vfs-server.mjs`
- Modify: `modules/mcp/viking-vfs-contracts.mjs`
- Test: `modules/mcp/viking-vfs.test.mjs`

**Interfaces:**
- Consumes: JSON-RPC tool invocations.
- Produces: Standardized responses for canonical tools (`viking/list`, `viking/stat`, `viking/read`) and compatibility aliases (`viking_ls`, `viking_overview`, `viking_read_detail`).

- [ ] **Step 1: Write failing test for compatibility tool aliases and read-only enforcement**

```javascript
// Test chunk in modules/mcp/viking-vfs.test.mjs
test('MCP server exposes compatibility tool aliases (viking_ls, viking_overview, viking_read_detail)', async () => {
  const server = createVikingVfsServer();
  const tools = server.listTools();
  const toolNames = tools.map(t => t.name);
  assert.ok(toolNames.includes('viking_ls'));
  assert.ok(toolNames.includes('viking_overview'));
  assert.ok(toolNames.includes('viking_read_detail'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test modules/mcp/viking-vfs.test.mjs`
Expected: FAIL with tool names missing.

- [ ] **Step 3: Update `modules/mcp/viking-vfs-contracts.mjs` and `modules/mcp/viking-vfs-server.mjs`**

Add tool mappings:
- `viking_ls` -> maps to `viking/list` (returning directory entries with L0 abstracts).
- `viking_overview` -> maps to `viking/read` with `{ resolution_tier: 'L1' }`.
- `viking_read_detail` -> maps to `viking/read` with `{ resolution_tier: 'L2' }`.
Enforce that `vfs_upsert_document` is flagged with a clear disclaimer or disabled when `READONLY_VFS=1`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test modules/mcp/viking-vfs.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/mcp/viking-vfs-server.mjs modules/mcp/viking-vfs-contracts.mjs modules/mcp/viking-vfs.test.mjs
git commit -m "feat(viking): register compatibility tool aliases and enforce read-only retrieval"
```

---

### Task 4: End-to-End Benchmark & Verification

**Files:**
- Modify: `scripts/benchmark-viking-token-savings.mjs`
- Test: `scripts/benchmark-viking-token-savings.test.mjs`

- [ ] **Step 1: Run complete Viking test suite**

Run: `node --test modules/mcp/viking-*.test.mjs scripts/benchmark-viking-*.test.mjs`
Expected: 100% PASS

- [ ] **Step 2: Run benchmark script against local codebase**

Run: `node scripts/benchmark-viking-token-savings.mjs`
Expected: Token savings report generated showing >48% reduction on L1 and >90% on L0.

- [ ] **Step 3: Commit**

```bash
git add scripts/benchmark-viking-token-savings.mjs
git commit -m "test(viking): update benchmark suite with live AST compaction metrics"
```
