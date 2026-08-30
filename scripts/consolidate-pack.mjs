#!/usr/bin/env node
// ==============================================================================
// Thematic Knowledge Pack Consolidator (Stage 6)
// Emits modular, self-describing packs into .nlm_pack/ partitioned by research category:
// - .nlm_pack/pack_willow_run.txt      (Target: CIC - Willow Run & Aviation Engineering)
// - .nlm_pack/pack_ford_politics.txt   (Target: CIC - Ford Executive Dynamics & Politics)
// - .nlm_pack/pack_post_war.txt        (Target: CIC - Post-War & Willys-Overland)
// - .nlm_pack/pack_cuban_seizures.txt  (Target: CIC - Cuban Seizures & Retired Assets)
// - .nlm_pack/pack_master_kb.txt       (Target: CIC-KB)
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadCategoriesData, buildNotebookTargetMap, NOTEBOOK_TARGETS, resolveNotebookId } from '../kb-sync/core/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLOR = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', reset: '\x1b[0m' };
const logInfo = (msg) => console.log(`${COLOR.green}[CONSOLIDATE-PACK] [INFO]${COLOR.reset} ${msg}`);
const logWarn = (msg) => console.log(`${COLOR.yellow}[CONSOLIDATE-PACK] [WARN]${COLOR.reset} ${msg}`);
const logError = (msg) => console.error(`${COLOR.red}[CONSOLIDATE-PACK] [ERROR]${COLOR.reset} ${msg}`);

export function getCanonicalPacks() {
  const data = loadCategoriesData();
  const categories = data.categories || {};
  const packList = [];

  for (const [catKey, catDef] of Object.entries(categories)) {
    const safeFilename = `pack_${catKey.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_')}.txt`;
    packList.push({
      category: catKey,
      aliases: catDef.aliases || [],
      filename: safeFilename,
      notebookId: catDef.target,
      title: catDef.title,
      status: catDef.status || 'canonical'
    });
  }

  return packList;
}

export function extractFrontmatter(content) {
  if (typeof content !== 'string') return {};
  const parts = content.split(/^---\r?\n/m);
  if (parts.length < 3) return {};
  const fmRaw = parts[1];
  const data = {};
  for (const line of fmRaw.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (m) {
      data[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return data;
}

export function consolidatePacks(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const outDir = options.outDir || path.join(rootDir, '.nlm_pack');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  logInfo(`Consolidating thematic packs from root: ${rootDir}`);
  logInfo(`Output directory: ${outDir}`);

  const canonicalPacks = getCanonicalPacks();

  // Map category aliases to canonical category key
  const aliasMap = new Map();
  for (const packDef of canonicalPacks) {
    aliasMap.set(packDef.category.toLowerCase().trim(), packDef.category);
    for (const alias of packDef.aliases) {
      aliasMap.set(alias.toLowerCase().trim(), packDef.category);
    }
  }

  // Collect candidate files from wiki and staging
  const scanDirs = [
    path.join(rootDir, 'wiki'),
    path.join(rootDir, '_kb-sync-staging')
  ];

  const candidateFiles = [];
  const trmGapsPath = path.join(rootDir, 'trm-research-gaps.md');
  if (fs.existsSync(trmGapsPath)) {
    candidateFiles.push(trmGapsPath);
  }

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          walk(full);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        candidateFiles.push(full);
      }
    }
  }

  for (const sDir of scanDirs) {
    walk(sDir);
  }

  logInfo(`Discovered ${candidateFiles.length} markdown source files.`);

  // Initialize buckets
  const categorized = {};
  for (const packDef of canonicalPacks) {
    categorized[packDef.category] = [];
  }

  const dynamicPacks = new Map();

  for (const filePath of candidateFiles) {
    try {
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf8');
      const fm = extractFrontmatter(content);
      const rawCat = (fm.category || '').toLowerCase().trim();
      const sha256 = crypto.createHash('sha256').update(content.trim()).digest('hex');

      const item = {
        relPath,
        filePath,
        content,
        frontmatter: fm,
        sha256,
        sourceType: 'markdown'
      };

      if (rawCat && aliasMap.has(rawCat)) {
        const canonicalKey = aliasMap.get(rawCat);
        categorized[canonicalKey].push(item);
      } else if (rawCat) {
        // Unknown category: dynamically bucket
        if (!dynamicPacks.has(rawCat)) {
          dynamicPacks.set(rawCat, []);
        }
        dynamicPacks.get(rawCat).push(item);
      }

      // Master KB includes all valid notes
      if (categorized['master-kb']) {
        categorized['master-kb'].push(item);
      }
    } catch (err) {
      logWarn(`Could not read ${filePath}: ${err.message}`);
    }
  }

  const generatedPacks = [];

  // Emit Canonical Packs
  for (const packDef of canonicalPacks) {
    const packFile = path.join(outDir, packDef.filename);
    const items = categorized[packDef.category] || [];

    // Invariant: Do not overwrite an existing rich seed pack with an empty pack
    if (items.length === 0 && fs.existsSync(packFile)) {
      const existing = fs.readFileSync(packFile, 'utf8');
      if (existing.includes('=== PROVENANCE ===') || existing.includes('seed-notebook-topic.mjs')) {
        logInfo(`Preserving non-empty seed pack: ${packDef.filename} (${(fs.statSync(packFile).size / 1024).toFixed(2)} KB)`);
        generatedPacks.push({
          packDef,
          packFile,
          bytes: fs.statSync(packFile).size,
          fileCount: (existing.match(/=== PROVENANCE ===/g) || []).length
        });
        continue;
      }
    }

    let payload = `# ==============================================================================\n`;
    payload += `# PACK: ${packDef.category}\n`;
    payload += `# TITLE: ${packDef.title}\n`;
    payload += `# STATUS: ${packDef.status}\n`;
    payload += `# TARGET_NOTEBOOK: ${packDef.notebookId}\n`;
    payload += `# SOURCE: consolidate-pack.mjs\n`;
    payload += `# GENERATED: ${new Date().toISOString()}\n`;
    payload += `# FILE_COUNT: ${items.length}\n`;
    payload += `# ==============================================================================\n\n`;

    for (const item of items) {
      payload += `=== PROVENANCE ===\n`;
      payload += `source_path: ${item.relPath}\n`;
      payload += `source_type: ${item.sourceType}\n`;
      payload += `hash_sha256: ${item.sha256}\n`;
      payload += `ingested_at: ${new Date().toISOString()}\n`;
      payload += `source_title: ${item.frontmatter.source_title || 'N/A'}\n`;
      payload += `repository: ${item.frontmatter.repository || 'N/A'}\n`;
      payload += `document_date: ${item.frontmatter.document_date || 'N/A'}\n`;
      payload += `verification_status: ${item.frontmatter.verification_status || 'N/A'}\n`;
      payload += `===================\n\n`;
      payload += `${item.content}\n\n`;
      payload += `--- END OF FILE: ${item.relPath} ---\n\n`;
    }

    fs.writeFileSync(packFile, payload, 'utf8');
    const bytes = fs.statSync(packFile).size;
    const mb = bytes / (1024 * 1024);

    if (mb > 5.0) {
      logWarn(`Pack ${packDef.filename} (${mb.toFixed(2)} MB) exceeds 5.0 MB warning limit!`);
    } else {
      logInfo(`✓ Emitted ${packDef.filename} (${(bytes / 1024).toFixed(2)} KB, ${items.length} files) -> Target: ${packDef.notebookId}`);
    }

    generatedPacks.push({
      packDef,
      packFile,
      bytes,
      fileCount: items.length
    });
  }

  // Handle Dynamic Placeholder Packs
  for (const [dynCat, dynItems] of dynamicPacks.entries()) {
    const safeCatName = dynCat.replace(/[^a-zA-Z0-9_-]/g, '_');
    const packFile = path.join(outDir, `pack_placeholder_${safeCatName}.txt`);
    const fallbackTarget = NOTEBOOK_TARGETS['daily'] || '1b4861a3-931f-4632-8fc1-343a8dd37df8';

    let payload = `# ==============================================================================\n`;
    payload += `# PACK: placeholder::${dynCat}\n`;
    payload += `# TITLE: Dynamic Unmapped Topic - ${dynCat}\n`;
    payload += `# STATUS: unmapped\n`;
    payload += `# TARGET_NOTEBOOK: ${fallbackTarget} (PENDING OPERATOR REGISTRATION)\n`;
    payload += `# SOURCE: consolidate-pack.mjs\n`;
    payload += `# GENERATED: ${new Date().toISOString()}\n`;
    payload += `# FILE_COUNT: ${dynItems.length}\n`;
    payload += `# OPERATOR_REQUIRED: true - do not ingest until mapped to canonical target\n`;
    payload += `# ==============================================================================\n\n`;

    for (const item of dynItems) {
      payload += `=== PROVENANCE ===\n`;
      payload += `source_path: ${item.relPath}\n`;
      payload += `source_type: ${item.sourceType}\n`;
      payload += `hash_sha256: ${item.sha256}\n`;
      payload += `ingested_at: ${new Date().toISOString()}\n`;
      payload += `source_title: ${item.frontmatter.source_title || 'N/A'}\n`;
      payload += `repository: ${item.frontmatter.repository || 'N/A'}\n`;
      payload += `===================\n\n`;
      payload += `${item.content}\n\n`;
      payload += `--- END OF FILE: ${item.relPath} ---\n\n`;
    }

    fs.writeFileSync(packFile, payload, 'utf8');
    const bytes = fs.statSync(packFile).size;
    logWarn(`[DYNAMIC-TOPIC] Emitted unmapped placeholder pack: ${packFile} (${(bytes / 1024).toFixed(2)} KB, ${dynItems.length} files) -> Operator action required.`);

    generatedPacks.push({
      packDef: { category: `placeholder::${dynCat}`, filename: `pack_placeholder_${safeCatName}.txt`, notebookId: fallbackTarget, title: `Placeholder - ${dynCat}`, status: 'unmapped' },
      packFile,
      bytes,
      fileCount: dynItems.length
    });
  }

  return generatedPacks;
}

const mainFile = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
const thisFile = fs.realpathSync(__filename);
if (mainFile === thisFile) {
  try {
    consolidatePacks();
    logInfo('Thematic knowledge pack consolidation completed successfully.');
  } catch (err) {
    logError(`Consolidation failed: ${err.message}`);
    process.exit(1);
  }
}
