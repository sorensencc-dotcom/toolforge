import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import handler, { runWikiGovernance, scanVaultFiles, auditMarkdownFile } from '../src/index.js';

describe('wiki-governance-sync', () => {
  it('scans markdown files in vault recursively', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'page1.md'), '# Page 1');
      fs.mkdirSync(path.join(tmpDir, 'sub'));
      fs.writeFileSync(path.join(tmpDir, 'sub', 'page2.md'), '# Page 2');
      fs.writeFileSync(path.join(tmpDir, 'ignore.txt'), 'Not MD');

      const scanned = scanVaultFiles(tmpDir);
      assert.strictEqual(scanned.length, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects naming violations and empty wikilinks', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-test-'));
    try {
      const badFilePath = path.join(tmpDir, 'bad page name.md');
      fs.writeFileSync(badFilePath, '# Title\nBroken link: [[]]\nValid link: [[Valid]]');

      const findings = auditMarkdownFile(badFilePath, tmpDir, false, true);
      assert.strictEqual(findings.length, 2);
      assert.strictEqual(findings[0].type, 'NAMING_VIOLATION');
      assert.strictEqual(findings[1].type, 'BROKEN_LINK');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('runs full governance audit pass', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'clean-page.md'), '# Clean\n[[OtherPage]]');

      const res = await runWikiGovernance({
        action: 'audit',
        vaultRoot: tmpDir
      });

      assert.strictEqual(res.status, 'success');
      assert.strictEqual(res.findingsCount, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws error when action is missing', async () => {
    await assert.rejects(async () => {
      await handler({} as any);
    }, /Missing required property: action/);
  });
});
