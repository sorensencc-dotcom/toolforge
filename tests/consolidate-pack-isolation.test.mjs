import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { consolidatePacks } from '../scripts/consolidate-pack.mjs';
import { getMasterKbExclusions } from '../kb-sync/core/config.mjs';

test('consolidatePacks excludes all excluded categories from master-kb', () => {
  const tmpDir = path.join(process.cwd(), '.tmp', 'test-pack-isolation');
  const fixtureDir = path.join(tmpDir, 'fixtures');
  fs.mkdirSync(fixtureDir, { recursive: true });

  // Write a historical note and an excluded non-historical note
  fs.writeFileSync(path.join(fixtureDir, 'willow.md'), '---\ncategory: willow-run\nsource_title: Willow Note\n---\nWillow content\n');
  fs.writeFileSync(path.join(fixtureDir, 'sigil.md'), '---\ncategory: sigil\nsource_title: Sigil Note\n---\nSigil content\n');
  fs.writeFileSync(path.join(fixtureDir, 'ironledger.md'), '---\ncategory: ironledger\nsource_title: IronLedger Note\n---\nIronLedger content\n');

  const exclusions = getMasterKbExclusions();
  assert.ok(exclusions.has('sigil'));
  assert.ok(exclusions.has('ironledger'));

  const packs = consolidatePacks({ outDir: tmpDir, scanDirs: [fixtureDir] });
  const masterPack = packs.find(p => p.packDef.category === 'master-kb');
  assert.ok(masterPack, 'master-kb pack must be generated');

  const content = fs.readFileSync(masterPack.packFile, 'utf8');
  assert.ok(content.includes('Willow content'), 'Allowed categories must be included in master-kb');
  assert.equal(content.includes('Sigil content'), false, 'Sigil must not leak into master-kb');
  assert.equal(content.includes('IronLedger content'), false, 'IronLedger must not leak into master-kb');

  const singlePacks = consolidatePacks({ outDir: tmpDir, scanDirs: [fixtureDir], category: 'willow-run' });
  assert.equal(singlePacks.length, 1);
  assert.equal(singlePacks[0].packDef.category, 'willow-run');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('consolidatePacks ignores _kb-sync-staging folders during recursive walk', () => {
  const tmpDir = path.join(process.cwd(), '.tmp', 'test-staging-exclusion');
  const wikiDir = path.join(tmpDir, 'wiki');
  const stagingDir = path.join(tmpDir, 'wiki', '_kb-sync-staging');
  fs.mkdirSync(wikiDir, { recursive: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  fs.writeFileSync(path.join(wikiDir, 'valid.md'), '---\ncategory: willow-run\n---\nValid wiki content\n');
  fs.writeFileSync(path.join(stagingDir, 'staging-oversized.md'), '---\ncategory: willow-run\n---\nOversized staging junk\n');

  const packs = consolidatePacks({ rootDir: tmpDir, outDir: tmpDir, scanDirs: [wikiDir] });
  const willowPack = packs.find(p => p.packDef.category === 'willow-run');
  assert.ok(willowPack, 'willow pack must be generated');

  const content = fs.readFileSync(willowPack.packFile, 'utf8');
  assert.ok(content.includes('Valid wiki content'));
  assert.equal(content.includes('Oversized staging junk'), false, 'Staging junk must be excluded from walk');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
