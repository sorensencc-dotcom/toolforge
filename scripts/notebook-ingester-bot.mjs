#!/usr/bin/env node
/**
 * scripts/notebook-ingester-bot.mjs
 * 
 * Autonomous NotebookLM & Knowledge Ingester Bot.
 * Scans research accessions, markdown wiki nodes, and knowledge packs.
 * Indexes text into local SQLite FTS5 database (.kb_cache/knowledge_fts5.db) with 0 token burn.
 * Emits structured telemetry to _status-feed/notebook_ingester_report.json.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.resolve(REPO_ROOT, 'wiki');
const PACKS_DIR = path.resolve(REPO_ROOT, '.nlm_pack');
const CACHE_DIR = path.resolve(REPO_ROOT, '.kb_cache');
const DB_PATH = path.resolve(CACHE_DIR, 'knowledge_fts5.db');
const REPORT_PATH = path.resolve(REPO_ROOT, '_status-feed', 'notebook_ingester_report.json');

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const forceReindex = args.includes('--reindex');

function computeHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseMarkdownMetadata(content, filePath) {
  let title = path.basename(filePath, path.extname(filePath));
  let category = 'general';
  let tags = [];
  let body = content;

  if (content.startsWith('---')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) {
      const yaml = content.slice(3, endIdx);
      body = content.slice(endIdx + 4).trim();
      for (const line of yaml.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const k = line.slice(0, colonIdx).trim();
          const v = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (k === 'title') title = v;
          if (k === 'category') category = v;
        }
      }
    }
  }

  // Fallback to first H1 if title not in frontmatter
  if (!title || title === path.basename(filePath, path.extname(filePath))) {
    const h1Match = /^#\s+(.+)$/m.exec(body);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }

  return { title, category, body };
}

async function findFiles(dir, exts = ['.md', '.txt']) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '_kb-sync-staging') {
          results.push(...await findFiles(full, exts));
        }
      } else if (entry.isFile() && exts.some(e => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  } catch (err) {
    if (isVerbose) console.warn(`[Notebook-Ingester] Notice reading ${dir}: ${err.message}`);
  }
  return results;
}

function initDatabase(dbPath) {
  if (!fsSync.existsSync(path.dirname(dbPath))) {
    fsSync.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT,
      filepath TEXT NOT NULL,
      content TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      id,
      title,
      category,
      content,
      tokenize = 'porter unicode61'
    );
  `);

  return db;
}

async function runIngester() {
  const startTime = Date.now();
  console.log(`[Notebook-Ingester] Starting Knowledge Ingester Bot... (dry-run: ${isDryRun}, reindex: ${forceReindex})`);

  let db = null;
  if (!isDryRun) {
    db = initDatabase(DB_PATH);
  }

  // Find candidate files in wiki and packs
  const wikiFiles = await findFiles(WIKI_DIR, ['.md']);
  const packFiles = await findFiles(PACKS_DIR, ['.txt']);
  const allFiles = [...wikiFiles, ...packFiles];

  console.log(`[Notebook-Ingester] Discovered ${allFiles.length} candidate documents (${wikiFiles.length} wiki, ${packFiles.length} packs).`);

  let existingMap = new Map();
  if (db && !forceReindex) {
    const rows = db.prepare('SELECT id, sha256 FROM knowledge_items').all();
    for (const row of rows) {
      existingMap.set(row.id, row.sha256);
    }
  }

  let indexedCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;

  const insertItem = db ? db.prepare(`
    INSERT OR REPLACE INTO knowledge_items (id, title, category, filepath, content, sha256, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `) : null;

  const deleteFts = db ? db.prepare(`DELETE FROM knowledge_fts WHERE id = ?`) : null;
  const insertFts = db ? db.prepare(`
    INSERT INTO knowledge_fts (id, title, category, content)
    VALUES (?, ?, ?, ?)
  `) : null;

  for (const filePath of allFiles) {
    try {
      const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
      const content = await fs.readFile(filePath, 'utf8');
      const hash = computeHash(content);
      const id = relPath;

      const existingHash = existingMap.get(id);
      if (existingHash === hash && !forceReindex) {
        skippedCount++;
        continue;
      }

      const { title, category, body } = parseMarkdownMetadata(content, filePath);
      const isUpdate = existingMap.has(id);

      if (!isDryRun && db) {
        const now = new Date().toISOString();
        db.transaction(() => {
          insertItem.run(id, title, category, relPath, body, hash, now);
          deleteFts.run(id);
          insertFts.run(id, title, category, body);
        })();
      }

      if (isUpdate) {
        updatedCount++;
        if (isVerbose) console.log(`  ↻ Updated: ${relPath}`);
      } else {
        indexedCount++;
        if (isVerbose) console.log(`  ✓ Indexed: ${relPath}`);
      }
    } catch (err) {
      if (isVerbose) console.warn(`[Notebook-Ingester] Error processing ${filePath}: ${err.message}`);
    }
  }

  if (db) {
    db.close();
  }

  const elapsedMs = Date.now() - startTime;
  const status = 'HEALTHY';

  const telemetry = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    status,
    totalFiles: allFiles.length,
    indexedCount,
    updatedCount,
    skippedCount,
    databasePath: path.relative(REPO_ROOT, DB_PATH).replace(/\\/g, '/'),
    dryRun: isDryRun
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(telemetry, null, 2), 'utf8');

  console.log(`[Notebook-Ingester] Completed indexing in ${elapsedMs}ms.`);
  console.log(`  - Total Scanned: ${allFiles.length}`);
  console.log(`  - Newly Indexed: ${indexedCount}`);
  console.log(`  - Updated:       ${updatedCount}`);
  console.log(`  - Unchanged:     ${skippedCount}`);
  console.log(`  - Database:      ${path.relative(REPO_ROOT, DB_PATH).replace(/\\/g, '/')}`);
  console.log(`  - Telemetry:     ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`);

  return telemetry;
}

runIngester().catch(err => {
  console.error(`[Notebook-Ingester FATAL] ${err.stack || err.message}`);
  process.exit(1);
});
