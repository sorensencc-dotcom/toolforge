import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { compactVault } from './viking-compact-vault.mjs';

function createTempDir(prefix = 'viking-compact-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('compactVault: processes JS, TS, and Markdown files and creates L0, L1, and manifest', async () => {
  const sourceDir = createTempDir('viking-src-');
  const outputDir = createTempDir('viking-out-');

  try {
    // Setup nested files
    fs.mkdirSync(path.join(sourceDir, 'src', 'utils'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'docs'), { recursive: true });

    const jsCode = `/**
 * Calculate sum of numbers
 */
export function add(a, b) {
  const result = a + b;
  return result;
}
export const VERSION = '1.0.0';
`;
    fs.writeFileSync(path.join(sourceDir, 'src', 'utils', 'math.js'), jsCode);

    const tsCode = `/**
 * Greeter service interface
 */
export interface Greeter {
  greet(name: string): string;
}
export class ConsoleGreeter implements Greeter {
  greet(name: string): string {
    console.log('Hello ' + name);
    return 'Hello ' + name;
  }
}
`;
    fs.writeFileSync(path.join(sourceDir, 'src', 'greeter.ts'), tsCode);

    const mdDoc = `# Project Guide
## Installation
Run npm install.
## Usage
Run npm start.
`;
    fs.writeFileSync(path.join(sourceDir, 'docs', 'guide.md'), mdDoc);

    const result = await compactVault({
      sourceDir,
      outputDir,
      vaultName: 'test-vault',
    });

    assert.equal(result.processedFiles, 3);
    assert.equal(result.manifestPath, path.join(path.resolve(outputDir), 'manifest.json'));
    assert.ok(result.totalBytesSaved > 0, 'Should have positive bytes saved');

    // Verify L0 and L1 artifacts exist
    const mathL0Path = path.join(outputDir, 'src', 'utils', 'math.js.l0.json');
    const mathL1Path = path.join(outputDir, 'src', 'utils', 'math.js.l1.txt');
    assert.ok(fs.existsSync(mathL0Path), 'math.js.l0.json should exist');
    assert.ok(fs.existsSync(mathL1Path), 'math.js.l1.txt should exist');

    const mathL0 = JSON.parse(fs.readFileSync(mathL0Path, 'utf8'));
    assert.equal(mathL0.tier, 'L0');
    assert.ok(mathL0.abstract.includes('Calculate sum'));
    assert.ok(mathL0.exportedSymbols.includes('add'));
    assert.ok(mathL0.exportedSymbols.includes('VERSION'));

    const mathL1 = fs.readFileSync(mathL1Path, 'utf8');
    assert.ok(mathL1.includes('COMPACTED SKELETON'));
    assert.ok(!mathL1.includes('const result = a + b;'));

    // Verify TS L0 and L1
    const tsL0Path = path.join(outputDir, 'src', 'greeter.ts.l0.json');
    const tsL1Path = path.join(outputDir, 'src', 'greeter.ts.l1.txt');
    assert.ok(fs.existsSync(tsL0Path));
    assert.ok(fs.existsSync(tsL1Path));

    const tsL0 = JSON.parse(fs.readFileSync(tsL0Path, 'utf8'));
    assert.ok(tsL0.exportedSymbols.includes('ConsoleGreeter'));

    // Verify MD L0 and L1
    const mdL0Path = path.join(outputDir, 'docs', 'guide.md.l0.json');
    const mdL1Path = path.join(outputDir, 'docs', 'guide.md.l1.txt');
    assert.ok(fs.existsSync(mdL0Path));
    assert.ok(fs.existsSync(mdL1Path));

    const mdL0 = JSON.parse(fs.readFileSync(mdL0Path, 'utf8'));
    assert.equal(mdL0.abstract, 'Project Guide');
    assert.deepEqual(mdL0.exportedSymbols, ['Project Guide', 'Installation', 'Usage']);

    const mdL1 = fs.readFileSync(mdL1Path, 'utf8');
    assert.equal(mdL1, '# Project Guide\n## Installation\n## Usage');

    // Verify manifest
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
    assert.equal(manifest.vault_name, 'test-vault');
    assert.equal(manifest.processed_files, 3);
    assert.ok(manifest.files['src/utils/math.js']);
    assert.ok(manifest.files['src/greeter.ts']);
    assert.ok(manifest.files['docs/guide.md']);

    const mathSourceHash = crypto.createHash('sha256').update(jsCode, 'utf8').digest('hex');
    assert.equal(manifest.files['src/utils/math.js'].source_hash, mathSourceHash);
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('compactVault: filters out node_modules, dotfiles, .git, dist, and binary files', async () => {
  const sourceDir = createTempDir('viking-filter-src-');
  const outputDir = createTempDir('viking-filter-out-');

  try {
    fs.mkdirSync(path.join(sourceDir, 'node_modules', 'pkg'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, '.git', 'objects'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'dist', 'bundle'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, '.claude'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'src'), { recursive: true });

    fs.writeFileSync(path.join(sourceDir, 'node_modules', 'pkg', 'index.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(sourceDir, '.git', 'config'), '[core]');
    fs.writeFileSync(path.join(sourceDir, 'dist', 'bundle', 'app.min.js'), 'console.log("bundle");');
    fs.writeFileSync(path.join(sourceDir, '.claude', 'state.json'), '{}');
    fs.writeFileSync(path.join(sourceDir, '.env'), 'SECRET=123');
    fs.writeFileSync(path.join(sourceDir, 'src', 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(sourceDir, 'src', 'valid.js'), 'export const active = true;');

    const result = await compactVault({
      sourceDir,
      outputDir,
    });

    assert.equal(result.processedFiles, 1);
    assert.ok(fs.existsSync(path.join(outputDir, 'src', 'valid.js.l0.json')));
    assert.ok(!fs.existsSync(path.join(outputDir, 'node_modules')));
    assert.ok(!fs.existsSync(path.join(outputDir, '.git')));
    assert.ok(!fs.existsSync(path.join(outputDir, 'dist')));
    assert.ok(!fs.existsSync(path.join(outputDir, '.env.l0.json')));
    assert.ok(!fs.existsSync(path.join(outputDir, 'src', 'image.png.l0.json')));
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('compactVault: handles empty directory gracefully', async () => {
  const sourceDir = createTempDir('viking-empty-src-');
  const outputDir = createTempDir('viking-empty-out-');

  try {
    const result = await compactVault({
      sourceDir,
      outputDir,
      vaultName: 'empty-vault',
    });

    assert.equal(result.processedFiles, 0);
    assert.equal(result.totalBytesSaved, 0);
    assert.ok(fs.existsSync(result.manifestPath));
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
    assert.equal(manifest.processed_files, 0);
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('compactVault: validates parameters and respects custom options', async () => {
  await assert.rejects(
    async () => compactVault({ sourceDir: null, outputDir: 'out' }),
    { name: 'TypeError' }
  );
  await assert.rejects(
    async () => compactVault({ sourceDir: 'src', outputDir: null }),
    { name: 'TypeError' }
  );

  const sourceDir = createTempDir('viking-opts-src-');
  const outputDir = createTempDir('viking-opts-out-');

  try {
    fs.mkdirSync(path.join(sourceDir, 'custom_ignore'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'included'), { recursive: true });

    fs.writeFileSync(path.join(sourceDir, 'custom_ignore', 'test.js'), 'export const a = 1;');
    fs.writeFileSync(path.join(sourceDir, 'included', 'test.js'), 'export const b = 2;');
    fs.writeFileSync(path.join(sourceDir, 'included', 'test.txt'), 'plain text');

    const result = await compactVault({
      sourceDir,
      outputDir,
      options: {
        excludeDirs: ['custom_ignore'],
        extensions: ['.js'],
      },
    });

    assert.equal(result.processedFiles, 1);
    assert.ok(fs.existsSync(path.join(outputDir, 'included', 'test.js.l0.json')));
    assert.ok(!fs.existsSync(path.join(outputDir, 'custom_ignore')));
    assert.ok(!fs.existsSync(path.join(outputDir, 'included', 'test.txt.l0.json')));
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

