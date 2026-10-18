import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildManifestEntry, verifyDiagramParity } from '../scripts/diagram-sync.mjs';
import { executeSyncDocs } from '../skills/toolforge-cli/src/invoke-skill.mjs';
import { buildCathrynLaveryHtml } from '../skills/repo-docs-diagram-sync/src/diagram-engine.mjs';

test('verifyDiagramParity: detects missing PNG asset for Cathryn Lavery HTML diagram', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-missing-'));
  const htmlPath = path.join(tempDir, 'architecture.html');
  const htmlContent = buildCathrynLaveryHtml({ title: 'Test Arch' });
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');

  const report = verifyDiagramParity(tempDir);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((e) => e.includes('MISSING_PNG')));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('verifyDiagramParity: detects stale PNG asset when the HTML changed after the manifest was recorded', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-stale-'));
  const htmlPath = path.join(tempDir, 'architecture.html');
  const pngPath = path.join(tempDir, 'architecture.png');
  fs.writeFileSync(htmlPath, buildCathrynLaveryHtml({ title: 'Test Arch' }), 'utf8');
  fs.writeFileSync(pngPath, 'fake-png-bytes', 'utf8');
  const entry = buildManifestEntry(htmlPath, pngPath);
  fs.writeFileSync(path.join(tempDir, '.diagram-manifest.json'), JSON.stringify({ 'architecture.png': entry }), 'utf8');

  // The spec changes after the PNG was rendered; hashes, not mtimes, decide.
  fs.writeFileSync(htmlPath, buildCathrynLaveryHtml({ title: 'Test Arch, edited' }), 'utf8');

  const report = verifyDiagramParity(tempDir);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((e) => e.includes('STALE_PNG')));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('verifyDiagramParity: passes cleanly when HTML and PNG match the manifest hashes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-pass-'));
  const htmlPath = path.join(tempDir, 'architecture.html');
  const pngPath = path.join(tempDir, 'architecture.png');
  fs.writeFileSync(htmlPath, buildCathrynLaveryHtml({ title: 'Test Arch' }), 'utf8');
  fs.writeFileSync(pngPath, 'fake-png-bytes', 'utf8');
  const entry = buildManifestEntry(htmlPath, pngPath);
  fs.writeFileSync(path.join(tempDir, '.diagram-manifest.json'), JSON.stringify({ 'architecture.png': entry }), 'utf8');

  const report = verifyDiagramParity(tempDir);
  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
  assert.equal(report.checkedCount, 1);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
test('executeSyncDocs: produces compliant toolforge-cli invocation contract', () => {
  const descriptor = executeSyncDocs({ dryRun: true, fix: false, path: 'docs' });
  assert.equal(descriptor.command, 'sync-docs');
  assert.ok(descriptor.scriptPath.endsWith('sync-docs-and-diagrams.ps1'));
  assert.ok(descriptor.args.includes('-DryRun'));
  assert.ok(descriptor.args.some((a) => a.includes('docs')));
});

test('pre-push hook & documentation workflow: verify diagram parity gate integration', () => {
  const hookPath = path.resolve('.githooks/pre-push');
  assert.ok(fs.existsSync(hookPath), '.githooks/pre-push must exist and be tracked in git');
  const hookContent = fs.readFileSync(hookPath, 'utf8');
  assert.ok(hookContent.includes('--verify-parity'), 'Pre-push hook must include --verify-parity');
  assert.ok(hookContent.includes('--dry-run'), 'Pre-push hook must dry-run wiki publish');

  const ciPath = path.resolve('.github/workflows/documentation.yml');
  const ciContent = fs.readFileSync(ciPath, 'utf8');
  assert.ok(ciContent.includes('node scripts/diagram-sync.mjs --verify-parity'), 'CI workflow must include verify-parity step');
});

test('verifyDiagramParity: detects stale PNG asset when content hash mismatches manifest', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-hash-'));
  const htmlPath = path.join(tempDir, 'architecture.html');
  const pngPath = path.join(tempDir, 'architecture.png');
  const manifestPath = path.join(tempDir, '.diagram-manifest.json');
  const htmlContent = buildCathrynLaveryHtml({ title: 'Test Arch Hash' });

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  fs.writeFileSync(pngPath, 'fake-png-bytes', 'utf8');
  fs.writeFileSync(manifestPath, JSON.stringify({
    'architecture.png': {
      htmlHash: 'mismatched-old-hash-value',
      updatedAt: new Date().toISOString(),
    }
  }), 'utf8');

  // Verify that mismatch is flagged as stale
  const report = verifyDiagramParity(tempDir);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((e) => e.includes('STALE_PNG')));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Performance: verifyDiagramParity executes within 800ms boundary', () => {
  const start = Date.now();
  for (let i = 0; i < 20; i++) {
    verifyDiagramParity(path.resolve('skills/repo-docs-diagram-sync'));
  }
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 800, `Execution latency (${elapsed}ms) must be under 800ms`);
});
