#!/usr/bin/env node
/**
 * scripts/storage-pruner.mjs
 *
 * Autonomous Storage & Telemetry Compactor (Storage-Pruner).
 * Performs:
 * 1. Weekly SQLite vacuuming and WAL checkpointing across .kb_cache, .ijfw, and reporting databases.
 * 2. Historical telemetry compression (gzip compaction of daily status archives older than retention window).
 * 3. Autonomous .harness task pruning (archiving/pruning completed tasks older than retention threshold).
 * 4. Shred expired `.agent-scratch/` session directories.
 * 5. Emits structured telemetry to _status-feed/storage_pruner_status.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import Database from 'better-sqlite3';
import { shredExpiredScratchpads } from './egress-upload-gate.mjs';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..');

export const TELEMETRY_FEED_PATH = path.resolve(REPO_ROOT, '_status-feed', 'storage_pruner_status.json');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

/**
 * Format byte count into human-readable string.
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Discover all active SQLite databases in repo target locations.
 */
export function discoverSqliteDatabases(rootDir = REPO_ROOT) {
  const searchDirs = [
    path.join(rootDir, '.kb_cache'),
    path.join(rootDir, 'icf', '.kb_cache'),
    path.join(rootDir, '.ijfw', 'index'),
    path.join(rootDir, '.icf-retros', 'weekly')
  ];

  const dbPaths = [];
  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (/\.(db|sqlite|sqlite3)$/i.test(f) && !f.endsWith('-journal') && !f.endsWith('-wal') && !f.endsWith('-shm')) {
            const fullPath = path.join(dir, f);
            if (fs.statSync(fullPath).isFile()) {
              dbPaths.push(fullPath);
            }
          }
        }
      } catch (err) {
        if (isVerbose) console.warn(`[Storage-Pruner] Warning reading directory ${dir}:`, err.message);
      }
    }
  }
  return dbPaths;
}

/**
 * Vacuum and optimize a SQLite database file.
 */
export function vacuumDatabase(dbPath, options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  if (!fs.existsSync(dbPath)) return null;

  const sizeBefore = fs.statSync(dbPath).size;
  if (dryRun) {
    return {
      dbPath,
      sizeBefore,
      sizeAfter: sizeBefore,
      bytesSaved: 0,
      status: 'SKIPPED_DRY_RUN'
    };
  }

  let db = null;
  try {
    db = new Database(dbPath, { timeout: 5000 });
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.exec('VACUUM;');
    db.pragma('optimize');
    db.close();
    db = null;

    const sizeAfter = fs.statSync(dbPath).size;
    const bytesSaved = Math.max(0, sizeBefore - sizeAfter);

    return {
      dbPath,
      sizeBefore,
      sizeAfter,
      bytesSaved,
      status: 'SUCCESS'
    };
  } catch (err) {
    if (db) {
      try { db.close(); } catch {}
    }
    return {
      dbPath,
      sizeBefore,
      sizeAfter: sizeBefore,
      bytesSaved: 0,
      status: 'FAILED',
      error: err.message
    };
  }
}

/**
 * Compress historical telemetry JSON files older than retention days.
 */
export function compressHistoricalTelemetry(options = {}) {
  const rootDir = options.rootDir || REPO_ROOT;
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  const retentionDays = options.retentionDays || 7;
  const cutoffTime = Date.now() - (retentionDays * 86400 * 1000);

  const targetDirs = [
    path.join(rootDir, '_status-feed', 'trm_history'),
    path.join(rootDir, '_status-feed', 'ironbots_history'),
    path.join(rootDir, 'icf', 'dashboard', 'trm_history')
  ];

  const results = [];
  let totalSaved = 0;

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);

        // Check if older than retention window
        if (stats.mtimeMs < cutoffTime) {
          const raw = fs.readFileSync(fullPath);
          const gzPath = `${fullPath}.gz`;

          if (dryRun) {
            const simCompressedSize = Math.floor(raw.length * 0.15); // typical gzip ratio
            const saved = raw.length - simCompressedSize;
            totalSaved += saved;
            results.push({
              file: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
              sizeBefore: raw.length,
              sizeAfter: simCompressedSize,
              bytesSaved: saved,
              status: 'SKIPPED_DRY_RUN'
            });
            continue;
          }

          try {
            const compressed = zlib.gzipSync(raw, { level: 9 });
            const tmpGzPath = `${gzPath}.tmp`;
            fs.writeFileSync(tmpGzPath, compressed);
            if (fs.existsSync(tmpGzPath) && fs.statSync(tmpGzPath).size > 0) {
              fs.renameSync(tmpGzPath, gzPath);
              fs.unlinkSync(fullPath);
            } else {
              throw new Error(`Compressed archive verification failed at ${tmpGzPath}`);
            }
            const saved = raw.length - compressed.length;
            totalSaved += saved;

            results.push({
              file: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
              gzFile: path.relative(rootDir, gzPath).replace(/\\/g, '/'),
              sizeBefore: raw.length,
              sizeAfter: compressed.length,
              bytesSaved: saved,
              status: 'COMPRESSED'
            });
          } catch (err) {
            results.push({
              file: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
              status: 'ERROR',
              error: err.message
            });
          }
        }
      }
    } catch {}
  }

  return { results, totalSaved };
}

/**
 * Prune or archive completed harness tasks older than threshold.
 */
export function pruneHarnessTasks(options = {}) {
  const rootDir = options.rootDir || REPO_ROOT;
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;
  const retentionDays = options.retentionDays || 14;
  const cutoffTime = Date.now() - (retentionDays * 86400 * 1000);

  const completedDir = path.join(rootDir, '.harness', 'tasks', 'completed');
  const archiveDir = path.join(rootDir, '.harness', 'tasks', 'archive');

  const pruned = [];

  if (!fs.existsSync(completedDir)) {
    return { pruned, totalPruned: 0 };
  }

  try {
    const files = fs.readdirSync(completedDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fullPath = path.join(completedDir, file);
      const stats = fs.statSync(fullPath);

      if (stats.mtimeMs < cutoffTime) {
        if (dryRun) {
          pruned.push({
            task: file,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            status: 'SKIPPED_DRY_RUN'
          });
          continue;
        }

        if (!fs.existsSync(archiveDir)) {
          fs.mkdirSync(archiveDir, { recursive: true });
        }

        const dest = path.join(archiveDir, file);
        fs.renameSync(fullPath, dest);
        pruned.push({
          task: file,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          status: 'ARCHIVED'
        });
      }
    }
  } catch {}

  return { pruned, totalPruned: pruned.length };
}

/**
 * Execute full autonomous storage compaction cycle.
 */
export async function runStoragePruner(options = {}) {
  const startTime = Date.now();
  const dryRun = options.dryRun !== undefined ? options.dryRun : isDryRun;

  console.log(`[Storage-Pruner] Starting autonomous storage compaction (dry-run: ${dryRun})...`);

  // 1. Vacuum SQLite databases
  const dbPaths = discoverSqliteDatabases(options.rootDir || REPO_ROOT);
  const dbResults = [];
  let totalDbSaved = 0;

  for (const dbPath of dbPaths) {
    const res = vacuumDatabase(dbPath, { dryRun });
    if (res) {
      dbResults.push(res);
      totalDbSaved += res.bytesSaved;
      console.log(`  - DB: ${path.basename(dbPath)} (${formatBytes(res.sizeBefore)} -> ${formatBytes(res.sizeAfter)}, freed: ${formatBytes(res.bytesSaved)}) [${res.status}]`);
    }
  }

  // 2. Compress historical telemetry
  const telemetryCompaction = compressHistoricalTelemetry({ ...options, dryRun });
  console.log(`  - Telemetry: processed ${telemetryCompaction.results.length} historical archives, freed ~${formatBytes(telemetryCompaction.totalSaved)}`);

  // 3. Prune harness tasks
  const harnessCompaction = pruneHarnessTasks({ ...options, dryRun });
  console.log(`  - Harness: pruned/archived ${harnessCompaction.totalPruned} completed tasks`);

  // 4. Shred expired agent scratchpads. Dry runs report matches and leave directories in place.
  const scratchCompaction = shredExpiredScratchpads(options.rootDir || REPO_ROOT, Date.now(), { dryRun });
  console.log(`  - Scratch: ${dryRun ? 'would shred' : 'shredded'} ${scratchCompaction.shredded.length} expired session directories`);

  const hasDbFailures = dbResults.some(r => r.status === 'FAILED');
  const hasTelemetryErrors = telemetryCompaction.results.some(r => r.status === 'ERROR');
  const hasErrors = hasDbFailures || hasTelemetryErrors;
  const status = hasErrors ? 'FAILURES_DETECTED' : 'HEALTHY';

  const elapsedMs = Date.now() - startTime;
  const totalFreed = totalDbSaved + telemetryCompaction.totalSaved;

  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    elapsedMs,
    totalFreedBytes: totalFreed,
    totalFreedFormatted: formatBytes(totalFreed),
    databasesScanned: dbPaths.length,
    databaseResults: dbResults,
    telemetryCompactedCount: telemetryCompaction.results.length,
    telemetryResults: telemetryCompaction.results,
    harnessTasksPrunedCount: harnessCompaction.totalPruned,
    harnessResults: harnessCompaction.pruned,
    scratchpadsShredded: scratchCompaction.shredded,
    scratchpadErrors: scratchCompaction.errors,
    status
  };

  const feedDir = path.dirname(TELEMETRY_FEED_PATH);
  if (!fs.existsSync(feedDir)) {
    fs.mkdirSync(feedDir, { recursive: true });
  }
  fs.writeFileSync(TELEMETRY_FEED_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[Storage-Pruner] Compaction complete in ${elapsedMs}ms. Status: ${status}. Total space reclaimed: ${formatBytes(totalFreed)}`);
  console.log(`[Storage-Pruner] Telemetry written to ${path.relative(REPO_ROOT, TELEMETRY_FEED_PATH).replace(/\\/g, '/')}`);

  return report;
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  runStoragePruner().then(report => {
    if (report.status === 'FAILURES_DETECTED' && !report.dryRun) {
      process.exit(1);
    }
  }).catch(err => {
    console.error(`[Storage-Pruner FATAL] ${err.stack || err.message}`);
    process.exit(1);
  });
}
