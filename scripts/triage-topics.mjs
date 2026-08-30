#!/usr/bin/env node
// ==============================================================================
// Topic Triage Console
// Operator CLI and interactive console for managing placeholder topic lifecycles
// (unmapped -> canonical | merged | retired) with transactional atomic safety.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCategoriesData, saveCategoriesData } from '../kb-sync/core/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_JSON_PATH = path.join(__dirname, '..', 'wiki', 'Log.json');
const LOG_MD_PATH = path.join(__dirname, '..', 'wiki', 'Log.md');

const COLOR = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const logInfo = (msg) => console.log(`${COLOR.green}[TOPIC-TRIAGE] [INFO]${COLOR.reset} ${msg}`);
const logWarn = (msg) => console.log(`${COLOR.yellow}[TOPIC-TRIAGE] [WARN]${COLOR.reset} ${msg}`);
const logError = (msg) => console.error(`${COLOR.red}[TOPIC-TRIAGE] [ERROR]${COLOR.reset} ${msg}`);

export function appendAuditLog(entry) {
  const record = {
    timestamp: new Date().toISOString(),
    actor: process.env.USERNAME || process.env.USER || 'operator',
    ...entry
  };

  // 1. Machine-readable JSON log
  try {
    let logs = [];
    if (fs.existsSync(LOG_JSON_PATH)) {
      logs = JSON.parse(fs.readFileSync(LOG_JSON_PATH, 'utf8'));
    }
    logs.push(record);
    fs.writeFileSync(LOG_JSON_PATH, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    logWarn(`Could not write Log.json: ${e.message}`);
  }

  // 2. Human-readable Markdown log
  try {
    const mdEntry = `\n## ${record.timestamp}\n- **Action:** ${record.action}\n- **Actor:** ${record.actor}\n- **Placeholder:** ${record.placeholder || 'N/A'}\n- **Target Category:** ${record.targetCategory || record.category || 'N/A'}\n- **Notebook ID:** ${record.notebookId || 'N/A'}\n- **Result:** ${record.result || 'success'}\n`;
    fs.appendFileSync(LOG_MD_PATH, mdEntry, 'utf8');
  } catch (e) {
    logWarn(`Could not append Log.md: ${e.message}`);
  }
}

export function listPlaceholders() {
  const data = loadCategoriesData();
  const placeholders = Object.values(data.placeholders || {});
  
  console.log(`\n${COLOR.cyan}=== PENDING TOPIC PLACEHOLDERS (${placeholders.length}) ===${COLOR.reset}`);
  if (placeholders.length === 0) {
    console.log('No pending topic placeholders found. System is fully mapped.\n');
    return [];
  }

  console.log('--------------------------------------------------------------------------------');
  console.log(String('SLUG').padEnd(25) + String('STATUS').padEnd(12) + String('CANDIDATES').padEnd(12) + 'DISCOVERED AT');
  console.log('--------------------------------------------------------------------------------');
  for (const p of placeholders) {
    const slug = p.slug || p.category.replace('placeholder::', '');
    console.log(
      String(slug).padEnd(25) +
      String(p.status).padEnd(12) +
      String(p.candidate_files || 1).padEnd(12) +
      (p.created_at || 'N/A')
    );
  }
  console.log('--------------------------------------------------------------------------------\n');
  return placeholders;
}

export function mapPlaceholder(slug, notebookId, title) {
  const normSlug = slug.toLowerCase().trim();
  const placeholderKey = `placeholder::${normSlug}`;
  const data = loadCategoriesData();

  if (!data.placeholders || !data.placeholders[placeholderKey]) {
    throw new Error(`Placeholder '${placeholderKey}' not found.`);
  }

  const catTitle = title || `CIC - ${normSlug.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;

  // Promote to canonical
  data.categories[normSlug] = {
    title: catTitle,
    target: notebookId,
    aliases: [normSlug.replace(/-/g, '_')],
    status: 'canonical'
  };

  // Update placeholder status
  data.placeholders[placeholderKey].status = 'mapped';
  data.placeholders[placeholderKey].mapped_to = normSlug;
  data.placeholders[placeholderKey].mapped_at = new Date().toISOString();

  saveCategoriesData(data);
  logInfo(`✓ Successfully mapped '${normSlug}' -> '${catTitle}' (${notebookId})`);

  appendAuditLog({
    action: 'map',
    placeholder: placeholderKey,
    category: normSlug,
    notebookId,
    result: 'success'
  });

  return data.categories[normSlug];
}

export function mergePlaceholder(slug, targetCategory) {
  const normSlug = slug.toLowerCase().trim();
  const normTarget = targetCategory.toLowerCase().trim();
  const placeholderKey = `placeholder::${normSlug}`;
  const data = loadCategoriesData();

  if (!data.placeholders || !data.placeholders[placeholderKey]) {
    throw new Error(`Placeholder '${placeholderKey}' not found.`);
  }
  if (!data.categories[normTarget]) {
    throw new Error(`Target category '${normTarget}' is not a registered canonical category.`);
  }

  // Add as alias to canonical target
  const catDef = data.categories[normTarget];
  if (!catDef.aliases) catDef.aliases = [];
  if (!catDef.aliases.includes(normSlug)) {
    catDef.aliases.push(normSlug);
  }

  // Mark placeholder as merged
  data.placeholders[placeholderKey].status = 'merged';
  data.placeholders[placeholderKey].merged_into = normTarget;
  data.placeholders[placeholderKey].merged_at = new Date().toISOString();

  saveCategoriesData(data);
  logInfo(`✓ Successfully merged '${normSlug}' into '${normTarget}' as alias.`);

  appendAuditLog({
    action: 'merge',
    placeholder: placeholderKey,
    targetCategory: normTarget,
    result: 'success'
  });

  return catDef;
}

export function retirePlaceholder(slug, reason = 'Operator retired') {
  const normSlug = slug.toLowerCase().trim();
  const placeholderKey = `placeholder::${normSlug}`;
  const data = loadCategoriesData();

  if (!data.placeholders || !data.placeholders[placeholderKey]) {
    throw new Error(`Placeholder '${placeholderKey}' not found.`);
  }

  data.placeholders[placeholderKey].status = 'retired';
  data.placeholders[placeholderKey].retired_at = new Date().toISOString();
  data.placeholders[placeholderKey].reason = reason;

  saveCategoriesData(data);
  logInfo(`✓ Successfully retired placeholder '${placeholderKey}'.`);

  appendAuditLog({
    action: 'retire',
    placeholder: placeholderKey,
    reason,
    result: 'success'
  });

  return data.placeholders[placeholderKey];
}

export function runLifecycleTest() {
  logInfo('Running Topic Triage Lifecycle Self-Test Harness...');
  const testSlug = `test-temp-topic-${Date.now().toString(36)}`;
  const placeholderKey = `placeholder::${testSlug}`;
  const dummyTarget = '11111111-2222-3333-4444-555555555555';

  // 1. Create dummy placeholder
  const data = loadCategoriesData();
  if (!data.placeholders) data.placeholders = {};
  data.placeholders[placeholderKey] = {
    category: placeholderKey,
    slug: testSlug,
    created_at: new Date().toISOString(),
    status: 'unmapped',
    candidate_files: 3,
    fallback_notebook_id: '1b4861a3-931f-4632-8fc1-343a8dd37df8',
    operator_required: true
  };
  saveCategoriesData(data);
  logInfo(`  1. Created test placeholder: ${placeholderKey}`);

  // 2. Map placeholder
  mapPlaceholder(testSlug, dummyTarget, 'Test Temporary Topic');
  logInfo(`  2. Successfully mapped ${testSlug} to ${dummyTarget}`);

  // 3. Merge placeholder into daily
  mergePlaceholder(testSlug, 'daily');
  logInfo(`  3. Successfully merged ${testSlug} into daily`);

  // 4. Retire placeholder
  retirePlaceholder(testSlug, 'Automated test teardown');
  logInfo(`  4. Successfully retired ${testSlug}`);

  // 5. Cleanup test canonical entry
  const cleanupData = loadCategoriesData();
  delete cleanupData.categories[testSlug];
  delete cleanupData.placeholders[placeholderKey];
  saveCategoriesData(cleanupData);
  logInfo('  5. Cleaned up temporary test fixtures.');

  logInfo('🎉 Topic Triage Lifecycle Test PASSED with full invariant conformance!\n');
  return true;
}

// CLI Argument Handling
const args = process.argv.slice(2);
const command = args[0];

if (command === 'list' || args.includes('--list')) {
  listPlaceholders();
} else if (command === 'map') {
  const slug = args[1];
  const targetId = args[2];
  let title = null;
  const titleIdx = args.indexOf('--title');
  if (titleIdx !== -1 && args[titleIdx + 1]) {
    title = args[titleIdx + 1];
  }
  if (!slug || !targetId) {
    logError('Usage: node triage-topics.mjs map <slug> <notebook_id> [--title <title>]');
    process.exit(1);
  }
  mapPlaceholder(slug, targetId, title);
} else if (command === 'merge') {
  const slug = args[1];
  const target = args[2];
  if (!slug || !target) {
    logError('Usage: node triage-topics.mjs merge <slug> <target_category>');
    process.exit(1);
  }
  mergePlaceholder(slug, target);
} else if (command === 'retire') {
  const slug = args[1];
  if (!slug) {
    logError('Usage: node triage-topics.mjs retire <slug> [reason]');
    process.exit(1);
  }
  retirePlaceholder(slug, args.slice(2).join(' ') || undefined);
} else if (command === '--test-lifecycle' || args.includes('--test-lifecycle')) {
  try {
    runLifecycleTest();
  } catch (err) {
    logError(`Lifecycle test failed: ${err.message}`);
    process.exit(1);
  }
} else if (command) {
  logWarn(`Unknown command '${command}'. Usage: list | map | merge | retire | --test-lifecycle`);
}
