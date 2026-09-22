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
