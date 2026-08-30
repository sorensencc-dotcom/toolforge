#!/usr/bin/env node
// ==============================================================================
// Topic Seeder & Archive Harvester (Enhanced Semantic & Entity Edition)
// Scans existing notebook repositories and local knowledge sources to compile
// and seed specialized thematic packs (e.g. Cuban Seizures) for NotebookLM.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadCategoriesData, resolveNotebookId } from '../kb-sync/core/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLOR = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const logInfo = (msg) => console.log(`${COLOR.green}[SEED-TOPIC] [INFO]${COLOR.reset} ${msg}`);
const logWarn = (msg) => console.log(`${COLOR.yellow}[SEED-TOPIC] [WARN]${COLOR.reset} ${msg}`);
const logError = (msg) => console.error(`${COLOR.red}[SEED-TOPIC] [ERROR]${COLOR.reset} ${msg}`);

export function loadEntityRules(category) {
  const entityFilePath = path.join(__dirname, '..', 'kb-sync', 'core', `entities_${category.replace(/-/g, '_')}.json`);
  if (fs.existsSync(entityFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(entityFilePath, 'utf8'));
      logInfo(`Loaded entity heuristics from ${path.basename(entityFilePath)}`);
      return parsed;
    } catch (e) {
      logWarn(`Failed to parse ${entityFilePath}: ${e.message}`);
    }
  }
  return null;
}

export function parseArgs(args = process.argv.slice(2)) {
  const options = {
    category: 'cuban-seizures',
    targetNotebookId: null,
    vaultRoot: process.env.TRM_VAULT || 'C:\\Users\\soren\\trm-vault',
    devRoot: path.resolve(__dirname, '..'),
    outDir: path.join(path.resolve(__dirname, '..'), '.nlm_pack'),
    minConfidence: 0.35,
    maxFileSizeKb: 1024,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--category' && args[i + 1]) {
      options.category = args[++i].toLowerCase().trim();
    } else if (arg === '--target' && args[i + 1]) {
      options.targetNotebookId = args[++i].trim();
    } else if (arg === '--vault' && args[i + 1]) {
      options.vaultRoot = args[++i];
    } else if (arg === '--out' && args[i + 1]) {
      options.outDir = args[++i];
    } else if (arg === '--min-confidence' && args[i + 1]) {
      options.minConfidence = parseFloat(args[++i]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  if (!options.targetNotebookId) {
    options.targetNotebookId = resolveNotebookId(options.category);
  }

  return options;
}

export function computeTopicRelevance(content, entityRules, category) {
  let keywordHits = 0;
  let entityHits = 0;
  let caselawHits = 0;
  const matchedKeywords = [];
  const matchedEntities = [];

  const text = content.toLowerCase();

  if (entityRules) {
    // 1. Check regex patterns
    if (Array.isArray(entityRules.patterns)) {
      for (const pStr of entityRules.patterns) {
        const regex = new RegExp(pStr, 'gi');
        const m = content.match(regex);
        if (m) {
          keywordHits += m.length;
          matchedKeywords.push(pStr);
        }
      }
    }

    // 2. Check Corporate & Asset Entities
    const corps = entityRules.entities?.corporations || [];
    for (const corp of corps) {
      if (text.includes(corp.toLowerCase())) {
        entityHits += 1;
        matchedEntities.push(corp);
      }
    }

    // 3. Check Case Law & Statues
    const caselaws = entityRules.entities?.caselaw_and_statutes || [];
    for (const cl of caselaws) {
      if (text.includes(cl.toLowerCase())) {
        caselawHits += 1;
        matchedEntities.push(cl);
      }
    }

    // 4. Check Key figures & Treaties
    const figures = entityRules.entities?.key_figures_and_treaties || [];
    for (const fig of figures) {
      if (text.includes(fig.toLowerCase())) {
        entityHits += 1;
        matchedEntities.push(fig);
      }
    }
  } else {
    // Fallback simple category pattern
    const catWords = category.split(/[-_]/);
    for (const w of catWords) {
      if (w.length > 2 && text.includes(w)) {
        keywordHits += 1;
        matchedKeywords.push(w);
      }
    }
  }

  const keywordNorm = Math.min(1.0, keywordHits * 0.15);
  const entityNorm = Math.min(1.0, entityHits * 0.25);
  const caselawNorm = Math.min(1.0, caselawHits * 0.25);

  const confidence = (keywordNorm * 0.2) + (entityNorm * 0.5) + (caselawNorm * 0.3);

  return {
    confidence: parseFloat(confidence.toFixed(3)),
    keywordHits,
    entityHits,
    caselawHits,
    matchedKeywords: Array.from(new Set(matchedKeywords)),
    matchedEntities: Array.from(new Set(matchedEntities))
  };
}

export function harvestTopicSeed(options = {}) {
  const opts = { ...parseArgs([]), ...options };
  const entityRules = loadEntityRules(opts.category);

  logInfo(`Target Category: '${opts.category}'`);
  logInfo(`Target Notebook ID: ${opts.targetNotebookId}`);
  logInfo(`Min Confidence Threshold: ${opts.minConfidence}`);

  const scanLocations = [
    { name: 'Vault NotebookLM Archives', dir: path.join(opts.vaultRoot, 'intake', 'notebooklm') },
    { name: 'Vault TRM Gaps', dir: path.join(opts.vaultRoot, 'trm', 'research-gaps') },
    { name: 'Dev Wiki & Staging', dir: path.join(opts.devRoot, 'wiki') },
    { name: 'Dev Staging TRM', dir: path.join(opts.devRoot, '_kb-sync-staging') }
  ];

  const harvestedDocs = [];
  const seenHashes = new Set();

  function walk(dir, sourceLocationName) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          walk(fullPath, sourceLocationName);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt') || entry.name.endsWith('.json'))) {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.size > opts.maxFileSizeKb * 1024) continue;

          const content = fs.readFileSync(fullPath, 'utf8');
          const relevance = computeTopicRelevance(content, entityRules, opts.category);

          if (relevance.confidence >= opts.minConfidence) {
            const hash = crypto.createHash('sha256').update(content.trim()).digest('hex');
            if (seenHashes.has(hash)) continue;
            seenHashes.add(hash);

            // Infer origin notebook if inside intake/notebooklm
            let notebookOrigin = 'local-repository';
            const normPath = fullPath.replace(/\\/g, '/');
            const matchNb = normPath.match(/intake\/notebooklm\/([^/]+)/);
            if (matchNb) {
              notebookOrigin = matchNb[1];
            }

            harvestedDocs.push({
              fileName: entry.name,
              filePath: fullPath,
              sourceLocation: sourceLocationName,
              notebookOrigin,
              content,
              sizeBytes: stats.size,
              sha256: hash,
              relevance
            });
          }
        } catch (err) {
          logWarn(`Error reading ${fullPath}: ${err.message}`);
        }
      }
    }
  }

  for (const loc of scanLocations) {
    logInfo(`Scanning ${loc.name} at: ${loc.dir}`);
    walk(loc.dir, loc.name);
  }

  harvestedDocs.sort((a, b) => b.relevance.confidence - a.relevance.confidence);

  logInfo(`Discovered ${harvestedDocs.length} qualifying documents (confidence >= ${opts.minConfidence}).`);

  if (!fs.existsSync(opts.outDir)) {
    fs.mkdirSync(opts.outDir, { recursive: true });
  }

  const safeCatName = opts.category.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
  const packFileName = `pack_${safeCatName}.txt`;
  const packFilePath = path.join(opts.outDir, packFileName);

  let payload = `# ==============================================================================\n`;
  payload += `# PACK: ${opts.category}\n`;
  payload += `# TITLE: Thematic Seed Pack - ${opts.category.toUpperCase()}\n`;
  payload += `# STATUS: canonical\n`;
  payload += `# TARGET_NOTEBOOK: ${opts.targetNotebookId}\n`;
  payload += `# SOURCE: seed-notebook-topic.mjs\n`;
  payload += `# GENERATED: ${new Date().toISOString()}\n`;
  payload += `# FILE_COUNT: ${harvestedDocs.length}\n`;
  payload += `# MIN_CONFIDENCE: ${opts.minConfidence}\n`;
  payload += `# ==============================================================================\n\n`;

  for (const doc of harvestedDocs) {
    const relPath = path.relative(opts.vaultRoot, doc.filePath).startsWith('..')
      ? path.relative(opts.devRoot, doc.filePath).replace(/\\/g, '/')
      : path.relative(opts.vaultRoot, doc.filePath).replace(/\\/g, '/');

    payload += `=== PROVENANCE ===\n`;
    payload += `source_path: ${relPath}\n`;
    payload += `source_type: ${path.extname(doc.fileName).slice(1) || 'text'}\n`;
    payload += `hash_sha256: ${doc.sha256}\n`;
    payload += `ingested_at: ${new Date().toISOString()}\n`;
    payload += `notebook_origin: ${doc.notebookOrigin}\n`;
    payload += `confidence_score: ${doc.relevance.confidence}\n`;
    payload += `matched_entities: ${doc.relevance.matchedEntities.join(', ') || 'N/A'}\n`;
    payload += `===================\n\n`;
    payload += `${doc.content.trim()}\n\n`;
    payload += `--- END OF FILE: ${relPath} ---\n\n`;
  }

  if (!opts.dryRun) {
    fs.writeFileSync(packFilePath, payload, 'utf8');
    const bytes = fs.statSync(packFilePath).size;
    const kb = (bytes / 1024).toFixed(2);
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    logInfo(`✓ Created Seed Pack: ${packFilePath} (${kb} KB / ${mb} MB, ${harvestedDocs.length} sources)`);
    logInfo(`\nReady for NotebookLM Seeding:`);
    logInfo(`notebooklm source upload --notebook-id="${opts.targetNotebookId}" --file="${packFilePath}"`);
  } else {
    logInfo(`[DRY-RUN] Would generate ${packFilePath} with ${harvestedDocs.length} sources.`);
  }

  return {
    packFilePath,
    docCount: harvestedDocs.length,
    targetNotebookId: opts.targetNotebookId,
    docs: harvestedDocs
  };
}

const mainFile = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
const thisFile = fs.realpathSync(__filename);
if (mainFile === thisFile) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    harvestTopicSeed(opts);
    logInfo('Seeding process completed successfully.');
  } catch (err) {
    logError(`Seeding failed: ${err.message}`);
    process.exit(1);
  }
}
