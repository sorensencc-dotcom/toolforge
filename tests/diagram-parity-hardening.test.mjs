import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildManifestEntry,
  verifyDiagramParity,
  updateManifest,
} from '../scripts/diagram-sync.mjs';
import { buildCathrynLaveryHtml } from '../skills/repo-docs-diagram-sync/src/diagram-engine.mjs';

// Windows can briefly hold handles on freshly used temp dirs (EPERM); a leaked temp dir must not fail a test.
function rmQuiet(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // leave the temp dir behind
  }
}

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'diagram-sync.mjs');
// Minimal valid PNG (1x1), so isPngFile accepts it.
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360606060000000050001a7e45bc40000000049454e44ae426082', 'hex');

function makeFixture({ manifest = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-harden-'));
  const htmlPath = path.join(dir, 'arch.html');
  const pngPath = path.join(dir, 'arch.png');
  fs.writeFileSync(htmlPath, buildCathrynLaveryHtml({ title: 'Parity hardening' }), 'utf8');
  fs.writeFileSync(pngPath, PNG_BYTES);
  const manifestPath = path.join(dir, '.diagram-manifest.json');
  // An existing manifest in the target dir is used instead of the repo's.
  fs.writeFileSync(manifestPath, manifest ? JSON.stringify({ 'arch.png': buildManifestEntry(htmlPath, pngPath) }, null, 2) : '{}\n', 'utf8');
  return { dir, htmlPath, pngPath, manifestPath, cleanup: () => rmQuiet(dir) };
}

function cli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

test('parity: a pair whose HTML and PNG match the manifest passes', () => {
  const f = makeFixture();
  try {
    const report = verifyDiagramParity(f.dir);
    assert.deepEqual(report.errors, []);
    assert.equal(report.valid, true);
    assert.equal(report.checkedCount, 1);
  } finally { f.cleanup(); }
});

test('parity: a corrupted PNG fails even though the HTML is unchanged', () => {
  const f = makeFixture();
  try {
    fs.writeFileSync(f.pngPath, 'this is not a png');
    const report = verifyDiagramParity(f.dir);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.startsWith('CORRUPT_PNG')), report.errors.join('\n'));
  } finally { f.cleanup(); }
});

test('parity: altered HTML fails as a stale PNG', () => {
  const f = makeFixture();
  try {
    fs.appendFileSync(f.htmlPath, '\n<!-- edited after render -->\n');
    const report = verifyDiagramParity(f.dir);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.startsWith('STALE_PNG')), report.errors.join('\n'));
  } finally { f.cleanup(); }
});

test('parity: a new pair with no manifest entry fails, even when the PNG is newer than the HTML', () => {
  const f = makeFixture({ manifest: false });
  try {
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(f.pngPath, later, later); // the old mtime fallback would have passed this
    const report = verifyDiagramParity(f.dir);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.startsWith('MANIFEST_MISSING')), report.errors.join('\n'));
  } finally { f.cleanup(); }
});

test('parity: a manifest entry without pngHash is incomplete and fails', () => {
  const f = makeFixture();
  try {
    const { htmlHash } = buildManifestEntry(f.htmlPath, f.pngPath);
    fs.writeFileSync(f.manifestPath, JSON.stringify({ 'arch.png': { htmlHash } }), 'utf8');
    const report = verifyDiagramParity(f.dir);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.startsWith('MANIFEST_INCOMPLETE')), report.errors.join('\n'));
  } finally { f.cleanup(); }
});

test('parity: errors inside the check fail closed instead of being swallowed', () => {
  // 1. A manifest that is not valid JSON.
  const bad = makeFixture();
  try {
    fs.writeFileSync(bad.manifestPath, '{ not json', 'utf8');
    const report = verifyDiagramParity(bad.dir);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.includes('MANIFEST_INVALID')), report.errors.join('\n'));
  } finally { bad.cleanup(); }

  // 2. A PNG path that exists but cannot be hashed (a directory). The old
  //    catch {} turned this into a pass.
  const dirPng = makeFixture();
  try {
    const entry = buildManifestEntry(dirPng.htmlPath, dirPng.pngPath);
    fs.rmSync(dirPng.pngPath);
    fs.mkdirSync(dirPng.pngPath);
    fs.writeFileSync(dirPng.manifestPath, JSON.stringify({ 'arch.png': entry }), 'utf8');
    const report = verifyDiagramParity(dirPng.dir);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.startsWith('PARITY_CHECK_ERROR')), report.errors.join('\n'));
  } finally { dirPng.cleanup(); }
});

test('cli --verify-parity exits non-zero on a corrupted PNG and zero when intact', () => {
  const f = makeFixture();
  try {
    assert.equal(cli(['--verify-parity', `--path=${f.dir}`]).status, 0);
    fs.writeFileSync(f.pngPath, 'garbage');
    const res = cli(['--verify-parity', `--path=${f.dir}`]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /CORRUPT_PNG/);
  } finally { f.cleanup(); }
});

test('--update-manifest records both hashes, is idempotent, and never touches PNG files', () => {
  const f = makeFixture({ manifest: false });
  try {
    const before = fs.readFileSync(f.pngPath);
    const pngMtime = fs.statSync(f.pngPath).mtimeMs;
    assert.equal(cli(['--verify-parity', `--path=${f.dir}`]).status, 1);

    const res = cli(['--update-manifest', `--path=${f.dir}`]);
    assert.equal(res.status, 0, res.stderr);
    const manifest = JSON.parse(fs.readFileSync(f.manifestPath, 'utf8'));
    assert.match(manifest['arch.png'].htmlHash, /^[0-9a-f]{64}$/);
    assert.match(manifest['arch.png'].pngHash, /^[0-9a-f]{64}$/);
    assert.ok(fs.readFileSync(f.pngPath).equals(before), 'PNG bytes must be unchanged');
    assert.equal(fs.statSync(f.pngPath).mtimeMs, pngMtime, 'PNG must not be rewritten');
    assert.equal(cli(['--verify-parity', `--path=${f.dir}`]).status, 0);

    const manifestBytes = fs.readFileSync(f.manifestPath);
    assert.equal(cli(['--update-manifest', `--path=${f.dir}`]).status, 0);
    assert.ok(fs.readFileSync(f.manifestPath).equals(manifestBytes), 'second run must be byte-identical');
  } finally { f.cleanup(); }
});

test('--update-manifest refuses a PNG that is not a PNG and --dry-run writes nothing', () => {
  const f = makeFixture({ manifest: false });
  try {
    const dry = cli(['--update-manifest', '--dry-run', `--path=${f.dir}`]);
    assert.equal(dry.status, 0, dry.stderr);
    assert.equal(fs.readFileSync(f.manifestPath, 'utf8'), '{}\n');

    fs.writeFileSync(f.pngPath, 'corrupted');
    const res = cli(['--update-manifest', `--path=${f.dir}`]);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /NOT_A_PNG/);
    assert.equal(fs.readFileSync(f.manifestPath, 'utf8'), '{}\n');
    assert.equal(updateManifest(f.dir, { dryRun: true }).valid, false);
  } finally { f.cleanup(); }
});

test('repo parity gate passes on the committed manifest', () => {
  const report = verifyDiagramParity();
  assert.deepEqual(report.errors, []);
  assert.ok(report.checkedCount > 0);
});