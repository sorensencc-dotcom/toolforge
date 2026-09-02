import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  extractFrontmatter,
  validateFileProvenance,
  validateResearchDirectories,
  REQUIRED_PROVENANCE_FIELDS
} from '../scripts/validate-chunks.mjs';

describe('TRM Provenance Validator Test Suite', () => {
  describe('1. extractFrontmatter() Unit Suite', () => {
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

    it('strips single and double quotes from string values', () => {
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

    it('handles keys with hyphens and underscores correctly', () => {
      const content = `---
source_title: Sample
doc-identifier: id-1234
custom_tag_name: tag_val
---
Body`;
      const fm = extractFrontmatter(content);
      assert.ok(fm);
      assert.equal(fm.source_title, 'Sample');
      assert.equal(fm['doc-identifier'], 'id-1234');
      assert.equal(fm.custom_tag_name, 'tag_val');
    });

    it('returns null when frontmatter fences are missing or malformed', () => {
      assert.equal(extractFrontmatter('# Just markdown without fences'), null);
      assert.equal(extractFrontmatter('--- missing closing fence'), null);
      assert.equal(extractFrontmatter(null as unknown as string), null);
      assert.equal(extractFrontmatter(undefined as unknown as string), null);
    });
  });

  describe('2. validateFileProvenance() Unit Suite', () => {
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
      assert.equal(result.frontmatter.source_title, 'Accession 42 Notes');
    });

    it('fails when frontmatter block is missing', () => {
      const result = validateFileProvenance('/fake/path.md', '# No frontmatter');
      assert.equal(result.valid, false);
      assert.equal(result.frontmatter, null);
      assert.match(result.errors[0], /Missing required YAML frontmatter block/);
    });

    it('fails when any mandatory field is missing or empty', () => {
      for (const field of REQUIRED_PROVENANCE_FIELDS) {
        const lines = validContent.split('\n').filter(l => !l.startsWith(`${field}:`));
        const partialContent = lines.join('\n');
        const result = validateFileProvenance('/fake/path.md', partialContent);
        assert.equal(result.valid, false);
        assert.ok(
          result.errors.some(e => e.includes(`Missing mandatory provenance field: '${field}'`)),
          `Expected error for missing field ${field}`
        );
      }
    });

    it('validates verification_status enum constraints', () => {
      const allowed = ['verified', 'unverified', 'pending', 'active', 'archived'];
      for (const status of allowed) {
        const content = validContent.replace('verification_status: verified', `verification_status: ${status}`);
        const result = validateFileProvenance('/fake/path.md', content);
        assert.equal(result.valid, true, `Expected valid status for '${status}'`);
      }

      const invalidStatusContent = validContent.replace('verification_status: verified', 'verification_status: unknown_status');
      const result = validateFileProvenance('/fake/path.md', invalidStatusContent);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid verification_status')));
    });
  });

  describe('3. Filesystem & Directory Walker Suite', () => {
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
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-fs-test-'));
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
      assert.equal(outcome.failures.length, 0);
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

    it('ignores non-markdown files and excluded directories (node_modules, .git, .nlm_pack)', () => {
      const researchDir = path.join(tempDir, 'research');
      const ignoredModules = path.join(researchDir, 'node_modules/bad_pkg');
      const ignoredGit = path.join(researchDir, '.git');
      const ignoredNlm = path.join(researchDir, '.nlm_pack');

      fs.mkdirSync(ignoredModules, { recursive: true });
      fs.mkdirSync(ignoredGit, { recursive: true });
      fs.mkdirSync(ignoredNlm, { recursive: true });

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

  describe('4. CLI Subprocess Execution Suite', () => {
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
});
