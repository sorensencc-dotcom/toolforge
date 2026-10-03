// scripts/doc-sync/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRegistry } from './registry.mjs';
import { publishProduct } from './publish.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KB_SYNC = path.join(ROOT, 'kb-sync');
const KB_DB = path.join(KB_SYNC, '.kb_cache', 'knowledge.db');
const KB_CACHE_MODULE = path.join(KB_SYNC, 'modules', 'cache', 'sync-cache.mjs');

// An older kb-sync ignores idPrefix and would overwrite C:\dev's own cache rows with product pages.
export async function loadProductCache(product, publishedDir, { modulePath = KB_CACHE_MODULE, dbPath = KB_DB } = {}) {
  const mod = await import(pathToFileURL(modulePath).href);
  if (mod.SUPPORTS_ID_PREFIX !== true) throw new Error(`KB_SYNC_NO_ID_PREFIX: ${modulePath} predates per-product id prefixes; update kb-sync first`);
  mod.syncKnowledgeCache({ repoRoot: publishedDir, scanPaths: ['.'], dbPath, idPrefix: `product:${product.name}/` });
}

function localHead(repoPath) {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}

function writeDriftReceipt(product, r) {
  const receipt = {
    repository: product.name,
    remote_wiki_url: product.remote,
    local_code_head: localHead(product.repoPath),
    remote_wiki_head: r.remoteHead,
    verified_at: new Date().toISOString(),
    system_time_epoch_ms: Date.now(),
    total_pages_published: r.pages,
    sync_status: r.status,
  };
  fs.writeFileSync(path.join(product.repoPath, '.wiki-sync-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
}

export function parseArgs(argv) {
  const out = { dryRun: false, only: undefined };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (/^--product=[a-z0-9][a-z0-9-]*$/.test(a)) out.only = a.slice('--product='.length);
    else throw new Error(`BAD_ARGS: unknown or malformed argument ${JSON.stringify(a)}. Usage: run.mjs [--dry-run] [--product=<name>]`);
  }
  return out;
}

function takeLock(lockPath) {
  try {
    fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') throw new Error(`RUN_LOCKED: another doc sync holds ${lockPath}. Delete it only if no doc sync is running.`);
    throw err;
  }
  return () => fs.rmSync(lockPath, { force: true });
}

export async function runDocSync({ registryPath, receiptPath, only, dryRun = false, publish = publishProduct, loadCache = loadProductCache }) {
  const all = loadRegistry(registryPath);
  let selected;
  if (only) {
    selected = all.filter((p) => p.name === only);
    if (selected.length === 0) throw new Error(`UNKNOWN_PRODUCT: ${only}`);
  } else {
    selected = all.filter((p) => p.enabled);
    if (selected.length === 0) throw new Error('NO_PRODUCTS_SELECTED: no enabled rows in the registry');
  }

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  const release = takeLock(`${receiptPath}.lock`);
  try {
    return await runSelected({ selected, receiptPath, dryRun, publish, loadCache });
  } finally {
    release();
  }
}

async function runSelected({ selected, receiptPath, dryRun, publish, loadCache }) {
  const results = [];
  for (const p of selected) {
    const onPublished = p.ingest
      ? async (dir) => {
          try {
            await loadCache(p, dir);
          } catch (err) {
            throw new Error(`CACHE_LOAD_FAILED: ${err.message}`);
          }
        }
      : undefined;
    let r;
    try {
      r = await publish(p, { dryRun, onPublished });
    } catch (err) {
      r = { product: p.name, status: 'FAILED', changed: [], deleted: [], pages: 0, error: `PUBLISH_THREW: ${err.message}` };
    }
    if (!dryRun && (r.status === 'SYNCHRONIZED' || r.status === 'UP_TO_DATE')) writeDriftReceipt(p, r);
    console.log(`[doc-sync] ${p.name}: ${r.status}${r.changed?.length ? ` (${r.changed.length} changed)` : ''}${r.error ? ` - ${r.error}` : ''}${r.cache === 'FAILED' ? ` - cache FAILED: ${r.cacheError}` : ''}`);
    results.push(r);
  }

  const ok = results.every((r) => r.status !== 'FAILED' && r.cache !== 'FAILED');
  fs.writeFileSync(receiptPath, JSON.stringify({ timestamp: new Date().toISOString(), dryRun, ok, results }, null, 2) + '\n');
  return { ok, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => runDocSync({
    registryPath: path.join(ROOT, 'docs', 'meta', 'governance', 'wiki-sync-registry.json'),
    receiptPath: path.join(ROOT, '_status-feed', 'doc-sync-receipt.json'),
    ...parseArgs(process.argv.slice(2)),
  })).then(({ ok }) => process.exit(ok ? 0 : 1)).catch((err) => {
    console.error(`[doc-sync] ${err.message}`);
    process.exit(1);
  });
}
