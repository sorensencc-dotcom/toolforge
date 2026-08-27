# TRM Frontmatter & Provenance Validator Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a comprehensive, zero-dependency unit and integration test suite for the Stage 3 TRM provenance validator (`scripts/validate-chunks.mjs`) to verify parsing edge cases and CLI pre-commit gating.

**Architecture:** Use TypeScript with Node's native test runner (`node:test` and `node:assert/strict`) executed via `tsx` to test in-memory parsing functions, directory walking against isolated temporary directories, and subprocess CLI execution for exit codes 0 and 1.

**Tech Stack:** Node.js (`node:test`, `node:assert/strict`, `child_process`, `fs`, `os`, `path`), TypeScript (`tsx`), NPM scripts.

## Global Constraints
- `scripts/validate-chunks.mjs` must remain an offline-safe, zero-third-party-dependency ES module.
- All tests must execute cleanly under `npx tsx --test tests/validate-chunks.test.ts` and `npm run test:trm`.
- Temporary scratch directories created during filesystem tests must be completely purged after test runs.

---

### Task 1: Create in-memory unit tests for frontmatter extraction and validation

**Files:**
- Create: `tests/validate-chunks.test.ts`
- Reference: `scripts/validate-chunks.mjs`

**Interfaces:**
- Consumes:
  - `extractFrontmatter(content: string): Record<string, string> | null` from `scripts/validate-chunks.mjs`
  - `validateFileProvenance(filePath: string, content?: string): { valid: boolean; errors: string[]; frontmatter: Record<string, string> | null }` from `scripts/validate-chunks.mjs`
  - `REQUIRED_PROVENANCE_FIELDS: string[]` from `scripts/validate-chunks.mjs`

- [ ] **Step 1: Write the unit test block for `extractFrontmatter` and `validateFileProvenance`**

Create `tests/validate-chunks.test.ts` with test cases covering:
- Standard POSIX LF frontmatter
- Windows CRLF (`\r\n`) frontmatter
- Quoted string stripping (single and double quotes)
- Hyphenated / underscored keys
- Missing fences (`---`) or corrupt inputs returning `null`
- Missing mandatory provenance fields
- Invalid `verification_status` enum values
- Valid payloads passing cleanly

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFrontmatter,
  validateFileProvenance,
  REQUIRED_PROVENANCE_FIELDS
} from '../scripts/validate-chunks.mjs';

describe('TRM Provenance Validator - In-Memory Unit Suite', () => {
  describe('extractFrontmatter()', () => {
    it('parses valid frontmatter with POSIX LF line breaks', () => {
      const content = `---
source_title: Test Document
repository: sorensencc-dotcom/sigil
document_date: 2026-08-26
verification_status: verified
category: research
---
# Main Content`;
      const fm = extractFrontmatter(content);
      assert.ok(fm);
      assert.equal(fm.source_title, 'Test Document');
      assert.equal(fm.repository, 'sorensencc-dotcom/sigil');
      assert.equal(fm.document_date, '2026-08-26');
      assert.equal(fm.verification_status, 'verified');
      assert.equal(fm.category, 'research');
    });

    it('parses valid frontmatter with Windows CRLF line breaks', () => {
      const content = '---\r\nsource_title: CRLF Doc\r\nrepository: sorensencc-dotcom/toolforge\r\n---\r\nBody';
      const fm = extractFrontmatter(content);
      assert.ok(fm);
      assert.equal(fm.source_title, 'CRLF Doc');
      assert.equal(fm.repository, 'sorensencc-dotcom/toolforge');
    });

    it('strips single and double quotes from values', () => {
      const content = `---
source_title: "Double Quoted Title"
repository: 'Single Quoted Repo'
---
Body`;
      const fm = extractFrontmatter(content);
      assert.ok(fm);
      assert.equal(fm.source_title, 'Double Quoted Title');
      assert.equal(fm.repository, 'Single Quoted Repo');
    });

    it('returns null when frontmatter fences are missing or malformed', () => {
      assert.equal(extractFrontmatter('# Just markdown without fences'), null);
      assert.equal(extractFrontmatter('--- missing closing fence'), null);
      assert.equal(extractFrontmatter(null as unknown as string), null);
      assert.equal(extractFrontmatter(undefined as unknown as string), null);
    });
  });

  describe('validateFileProvenance()', () => {
    const validContent = `---
source_title: Accession 42 Notes
repository: sorensencc-dotcom/sigil
document_date: 2026-08-26
verification_status: verified
category: wiki
---
# Content`;

    it('passes for a fully compliant markdown file', () => {
      const result = validateFileProvenance('/fake/path.md', validContent);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
      assert.ok(result.frontmatter);
    });

    it('fails when frontmatter block is missing', () => {
      const result = validateFileProvenance('/fake/path.md', '# No frontmatter');
      assert.equal(result.valid, false);
      assert.match(result.errors[0], /Missing required YAML frontmatter block/);
    });

    it('fails when any mandatory field is missing or empty', () => {
      for (const field of REQUIRED_PROVENANCE_FIELDS) {
        const lines = validContent.split('\n').filter(l => !l.startsWith(`${field}:`));
        const partialContent = lines.join('\n');
        const result = validateFileProvenance('/fake/path.md', partialContent);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.includes(`Missing mandatory provenance field: '${field}'`)));
      }
    });

    it('validates verification_status enum constraints', () => {
      const invalidStatusContent = validContent.replace('verification_status: verified', 'verification_status: unknown_status');
      const result = validateFileProvenance('/fake/path.md', invalidStatusContent);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid verification_status')));
    });
  });
});
```

- [ ] **Step 2: Run test to verify it executes and passes**

Run: `npx tsx --test tests/validate-chunks.test.ts`
Expected: PASS (all unit tests green)

- [ ] **Step 3: Commit unit test implementation**

```bash
git add tests/validate-chunks.test.ts
git commit -m "test(trm): add unit tests for frontmatter parser and provenance validator"
```

---

### Task 2: Add directory walker and filesystem integration tests

**Files:**
- Modify: `tests/validate-chunks.test.ts`
- Reference: `scripts/validate-chunks.mjs`

**Interfaces:**
- Consumes:
  - `validateResearchDirectories(targetDirs: string[], rootDir?: string): { totalFiles: number; failedFiles: number; passed: boolean; failures: any[] }` from `scripts/validate-chunks.mjs`

- [ ] **Step 1: Add filesystem integration tests with isolated temporary scratch directories**

Append to `tests/validate-chunks.test.ts`:
- Create scratch directories using `fs.mkdtempSync`
- Test clean directory trees yielding `passed: true` and `failedFiles: 0`
- Test malformed directory trees yielding `passed: false` and `failedFiles: > 0`
- Test ignore filters (`node_modules`, `.git`, `.nlm_pack`) ensuring invalid files inside them are ignored
- Clean up temporary directories in `afterEach` hooks

```typescript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateResearchDirectories } from '../scripts/validate-chunks.mjs';

describe('TRM Provenance Validator - Filesystem & Directory Walker Suite', () => {
  let tempDir: string;

  const validMarkdown = `---
source_title: Valid Note
repository: sorensencc-dotcom/sigil
document_date: 2026-08-26
verification_status: verified
category: research
---
# Content`;

  const invalidMarkdown = `---
source_title: Invalid Note
---
# Content`;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('passes cleanly on directory containing valid research notes', () => {
    const researchDir = path.join(tempDir, 'wiki/research');
    fs.mkdirSync(researchDir, { recursive: true });
    fs.writeFileSync(path.join(researchDir, 'note-1.md'), validMarkdown, 'utf8');
    fs.writeFileSync(path.join(researchDir, 'note-2.md'), validMarkdown, 'utf8');

    const outcome = validateResearchDirectories([researchDir], tempDir);
    assert.equal(outcome.passed, true);
    assert.equal(outcome.totalFiles, 2);
    assert.equal(outcome.failedFiles, 0);
  });

  it('fails and reports errors when malformed notes exist', () => {
    const researchDir = path.join(tempDir, 'wiki/research');
    fs.mkdirSync(researchDir, { recursive: true });
    fs.writeFileSync(path.join(researchDir, 'valid.md'), validMarkdown, 'utf8');
    fs.writeFileSync(path.join(researchDir, 'invalid.md'), invalidMarkdown, 'utf8');

    const outcome = validateResearchDirectories([researchDir], tempDir);
    assert.equal(outcome.passed, false);
    assert.equal(outcome.totalFiles, 2);
    assert.equal(outcome.failedFiles, 1);
    assert.equal(outcome.failures.length, 1);
    assert.ok(outcome.failures[0].file.includes('invalid.md'));
  });

  it('ignores non-markdown files and excluded directories like node_modules and .git', () => {
    const researchDir = path.join(tempDir, 'research');
    const ignoredModules = path.join(researchDir, 'node_modules/bad_pkg');
    const ignoredGit = path.join(researchDir, '.git');
    const ignoredNlm = path.join(researchDir, '.nlm_pack');

    fs.mkdirSync(ignoredModules, { recursive: true });
    fs.mkdirSync(ignoredGit, { recursive: true });
    fs.mkdirSync(ignoredNlm, { recursive: true });

    // Invalid files in ignored directories should NOT fail validation
    fs.writeFileSync(path.join(ignoredModules, 'bad.md'), invalidMarkdown, 'utf8');
    fs.writeFileSync(path.join(ignoredGit, 'bad.md'), invalidMarkdown, 'utf8');
    fs.writeFileSync(path.join(ignoredNlm, 'bad.md'), invalidMarkdown, 'utf8');
    fs.writeFileSync(path.join(researchDir, 'notes.txt'), 'Not markdown', 'utf8');
    fs.writeFileSync(path.join(researchDir, 'good.md'), validMarkdown, 'utf8');

    const outcome = validateResearchDirectories([researchDir], tempDir);
    assert.equal(outcome.passed, true);
    assert.equal(outcome.totalFiles, 1);
    assert.equal(outcome.failedFiles, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it executes and passes**

Run: `npx tsx --test tests/validate-chunks.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 3: Commit integration test suite**

```bash
git add tests/validate-chunks.test.ts
git commit -m "test(trm): add filesystem directory walker integration tests"
```

---

### Task 3: Add CLI subprocess exit code tests and wire NPM scripts

**Files:**
- Modify: `tests/validate-chunks.test.ts`
- Modify: `package.json`

**Interfaces:**
- CLI: Spawns `node scripts/validate-chunks.mjs <paths>` via `child_process.spawnSync`

- [ ] **Step 1: Add CLI process execution tests in `tests/validate-chunks.test.ts`**

Add subprocess test suite:
```typescript
import { spawnSync } from 'node:child_process';

describe('TRM Provenance Validator - CLI Subprocess Execution', () => {
  let tempDir: string;
  const scriptPath = path.resolve(process.cwd(), 'scripts/validate-chunks.mjs');

  const validMarkdown = `---
source_title: CLI Valid Note
repository: sorensencc-dotcom/sigil
document_date: 2026-08-26
verification_status: verified
category: research
---
# Content`;

  const invalidMarkdown = `---
source_title: CLI Invalid Note
---
# Content`;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-cli-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('exits with code 0 when all files are compliant', () => {
    const validDir = path.join(tempDir, 'valid-tree');
    fs.mkdirSync(validDir, { recursive: true });
    fs.writeFileSync(path.join(validDir, 'note.md'), validMarkdown, 'utf8');

    const result = spawnSync('node', [scriptPath, validDir], {
      encoding: 'utf8',
      cwd: process.cwd()
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Provenance Validation Summary/);
    assert.match(result.stdout, /Failed: 0/);
  });

  it('exits with code 1 when malformed files exist (blocking pre-commit)', () => {
    const invalidDir = path.join(tempDir, 'invalid-tree');
    fs.mkdirSync(invalidDir, { recursive: true });
    fs.writeFileSync(path.join(invalidDir, 'bad-note.md'), invalidMarkdown, 'utf8');

    const result = spawnSync('node', [scriptPath, invalidDir], {
      encoding: 'utf8',
      cwd: process.cwd()
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[VALIDATE-PROVENANCE\] \[ERROR\]/);
  });
});
```

- [ ] **Step 2: Add `"test:trm"` and update `"pre-flight"` in `package.json`**

In `package.json`:
- Add `"test:trm": "npx tsx --test tests/validate-chunks.test.ts"`
- Update `"pre-flight"` script to include `npm run test:trm`

- [ ] **Step 3: Run the full test suite and preflight command**

Run: `npm run test:trm`
Expected: PASS with 0 exit code

- [ ] **Step 4: Commit task changes**

```bash
git add package.json tests/validate-chunks.test.ts
git commit -m "feat(trm): wire test:trm script and add CLI subprocess exit code tests"
```

---

### Task 4: Full verification and pre-commit gate audit

**Files:**
- Verify: `scripts/validate-chunks.mjs`
- Verify: `tests/validate-chunks.test.ts`
- Verify: `package.json`

- [ ] **Step 1: Execute `npm run test:trm`**
Verify all unit, filesystem, and subprocess test suites pass.

- [ ] **Step 2: Execute `node scripts/validate-chunks.mjs`**
Execute the validator against live repo research paths to ensure zero regression against existing documentation.

- [ ] **Step 3: Final commit and lock**
Commit any remaining changes with clean git status.
