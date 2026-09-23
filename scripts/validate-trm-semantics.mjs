import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCategoriesData } from '../kb-sync/core/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export const ETR_RULES = {
  SCHEMA_INVALID: 'RULE_ETR_SCHEMA_INVALID',
  TIMESTAMP_MISSING: 'RULE_ETR_TIMESTAMP_MISSING',
  NAME_MISSING: 'RULE_ETR_NAME_MISSING',
  DUPLICATE_CANONICAL_NAME: 'RULE_ETR_DUPLICATE_CANONICAL_NAME',
  UNKNOWN_CATEGORY: 'RULE_ETR_UNKNOWN_CATEGORY',
  SUMMARY_INSUFFICIENT: 'RULE_ETR_SUMMARY_INSUFFICIENT',
  ALIASES_EMPTY: 'RULE_ETR_ALIASES_EMPTY',
  ALIAS_COLLISION: 'RULE_ETR_ALIAS_COLLISION'
};

export function validateEntityTopicRegistry(manifest, categoriesData = loadCategoriesData()) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || !manifest.entities) {
    return { valid: false, errors: [{ rule_id: ETR_RULES.SCHEMA_INVALID, message: 'Manifest missing entities dictionary' }] };
  }
  if (!manifest.updated_at || typeof manifest.updated_at !== 'string') {
    errors.push({ rule_id: ETR_RULES.TIMESTAMP_MISSING, message: 'Manifest missing valid updated_at timestamp' });
  }

  const categories = categoriesData.categories || {};
  const seenAliases = new Map();
  const seenCanonicalNames = new Set();
  for (const [entityKey, entityDef] of Object.entries(manifest.entities)) {
    if (!entityDef.canonical_name || typeof entityDef.canonical_name !== 'string' || entityDef.canonical_name.trim().length < 2) {
      errors.push({ rule_id: ETR_RULES.NAME_MISSING, message: `Entity '${entityKey}' missing canonical_name` });
    } else {
      const normName = entityDef.canonical_name.toLowerCase().trim();
      if (seenCanonicalNames.has(normName)) errors.push({ rule_id: ETR_RULES.DUPLICATE_CANONICAL_NAME, message: `Duplicate canonical name: '${entityDef.canonical_name}'` });
      seenCanonicalNames.add(normName);
    }
    if (!categories[entityDef.primary_category]) errors.push({ rule_id: ETR_RULES.UNKNOWN_CATEGORY, message: `Entity '${entityKey}' references unknown primary_category '${entityDef.primary_category}'` });
    if (!entityDef.l0_summary || typeof entityDef.l0_summary !== 'string' || entityDef.l0_summary.trim().length < 20) {
      errors.push({ rule_id: ETR_RULES.SUMMARY_INSUFFICIENT, message: `Entity '${entityKey}' missing or insufficient l0_summary (min 20 chars)` });
    }
    if (!Array.isArray(entityDef.aliases) || entityDef.aliases.length === 0) {
      errors.push({ rule_id: ETR_RULES.ALIASES_EMPTY, message: `Entity '${entityKey}' has no aliases` });
    } else for (const alias of entityDef.aliases) {
      if (typeof alias !== 'string' || alias.trim().length === 0) {
        errors.push({ rule_id: ETR_RULES.ALIASES_EMPTY, message: `Entity '${entityKey}' contains an empty or non-string alias` });
        continue;
      }
      const norm = alias.toLowerCase().trim();
      if (seenAliases.has(norm)) errors.push({ rule_id: ETR_RULES.ALIAS_COLLISION, message: `Alias collision: '${alias}' in '${entityKey}' was already declared by '${seenAliases.get(norm)}'` });
      seenAliases.set(norm, entityKey);
    }
  }
  return { valid: errors.length === 0, errors };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  const manifestPath = path.join(REPO_ROOT, '_kb-sync-staging/trm/master_entity_manifest.json');
  if (!fs.existsSync(manifestPath)) { console.error(`[ETR] Manifest not found: ${manifestPath}`); process.exit(1); }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const res = validateEntityTopicRegistry(manifest);
  if (!res.valid) {
    console.error(`[ETR] Semantic validation failed with ${res.errors.length} error(s):`);
    for (const err of res.errors) console.error(`  - [${err.rule_id}] ${err.message}`);
    process.exit(1);
  }
  console.log(`[ETR] Manifest validation passed (validated ${Object.keys(manifest.entities).length} entities).`);
}
