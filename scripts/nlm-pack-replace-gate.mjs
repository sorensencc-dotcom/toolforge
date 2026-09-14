#!/usr/bin/env node
/**
 * nlm-pack-replace-gate.mjs
 *
 * Atomic Upload-Verify-Purge gate for NotebookLM knowledge packs.
 *
 * Guarantees:
 *  1. New generation is fully uploaded before the prior generation is purged.
 *  2. Each uploaded chunk reaches status 2 (active/indexed) before the gate
 *     declares success — status 3 (error) chunks cause an immediate fail.
 *  3. A lockfile (.nlm_pack/replace_gate.lock) prevents concurrent invocations
 *     from stacking duplicate sources.
 *  4. Packs exceeding SPLIT_THRESHOLD_BYTES are split into ≤1.25 MB chunks
 *     (part_aa, part_ab, …) before upload; the split manifest is recorded in
 *     .nlm_pack/split_manifest.json for operator inspection.
 *  5. Generation IDs (YYYYMMDD_HHmmss_<hash8>) are persisted in
 *     .nlm_pack/current_generation.json so only prior-generation source IDs
 *     are targeted for deletion — not all name-matched sources.
 *
 * Usage (CLI):
 *   node scripts/nlm-pack-replace-gate.mjs \
 *     --notebook-id=<uuid> \
 *     --file=.nlm_pack/pack_master_kb.txt \
 *     [--category=master-kb] \
 *     [--dry-run]
 *
 * Usage (module):
 *   import { replaceGate } from './nlm-pack-replace-gate.mjs';
 *   await replaceGate({ packFile, targetNbId, category, nlmCli, dryRun });
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum single-file size before splitting. 1.25 MB keeps server-side
 *  embedding well inside the empirical 15-second RPC timeout window. */
export const SPLIT_THRESHOLD_BYTES = 1_250_000; // 1.25 MB

/** Inter-chunk delay (ms) between successive `nlm source add` calls. */
const INTER_CHUNK_DELAY_MS = 4_000;

/** Status polling: max total wait time (ms) before declaring a chunk stuck. */
const POLL_TIMEOUT_MS = 60_000;

/** Status polling: interval between successive `nlm source list` calls. */
const POLL_INTERVAL_MS = 3_000;

/** Maximum single-chunk retry attempts on status 3 before hard failure. */
const MAX_RETRIES = 1;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const C = {
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  reset:  '\x1b[0m',
};
const TAG      = '[NLM-REPLACE-GATE]';
const logInfo  = (m) => console.log(`${C.green}${TAG} [INFO]${C.reset}  ${m}`);
const logWarn  = (m) => console.log(`${C.yellow}${TAG} [WARN]${C.reset}  ${m}`);
const logError = (m) => console.error(`${C.red}${TAG} [ERROR]${C.reset} ${m}`);
const logStep  = (m) => console.log(`\n${C.cyan}${TAG} ── ${m}${C.reset}`);

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function packDir(repoRoot) {
  return path.join(repoRoot, '.nlm_pack');
}

function lockfilePath(repoRoot) {
  return path.join(packDir(repoRoot), 'replace_gate.lock');
}

function generationFilePath(repoRoot) {
  return path.join(packDir(repoRoot), 'current_generation.json');
}

function splitManifestPath(repoRoot) {
  return path.join(packDir(repoRoot), 'split_manifest.json');
}

// ---------------------------------------------------------------------------
// Lockfile guard
// ---------------------------------------------------------------------------

function acquireLock(repoRoot) {
  const lf = lockfilePath(repoRoot);
  if (fs.existsSync(lf)) {
    const lockData = (() => {
      try { return JSON.parse(fs.readFileSync(lf, 'utf8')); }
      catch { return {}; }
    })();
    const age = lockData.ts ? Date.now() - new Date(lockData.ts).getTime() : 0;
    if (age < 30 * 60 * 1000) { // < 30 minutes old → consider live
      throw new Error(
        `Lockfile present: ${lf} (pid=${lockData.pid}, started=${lockData.ts}). ` +
        `Another replace-gate invocation is running. Aborting to prevent duplicate uploads.`
      );
    }
    logWarn(`Stale lockfile found (${(age / 60000).toFixed(1)}min old). Overwriting.`);
  }
  fs.writeFileSync(lf, JSON.stringify({ pid: process.pid, ts: new Date().toISOString() }), 'utf8');
  logInfo(`Lock acquired: ${lf}`);
}

function releaseLock(repoRoot) {
  const lf = lockfilePath(repoRoot);
  try { fs.rmSync(lf, { force: true }); } catch { /* ignore */ }
  logInfo('Lock released.');
}

// ---------------------------------------------------------------------------
// Generation ID
// ---------------------------------------------------------------------------

function makeGenerationId(content) {
  const ts  = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15);
  const h8  = crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
  return `${ts.slice(0, 8)}_${ts.slice(8, 14)}_${h8}`;
}

function readGenerationFile(repoRoot) {
  const gf = generationFilePath(repoRoot);
  if (!fs.existsSync(gf)) return {};
  try { return JSON.parse(fs.readFileSync(gf, 'utf8')); }
  catch { return {}; }
}

function writeGenerationFile(repoRoot, data) {
  fs.writeFileSync(generationFilePath(repoRoot), JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Splitting
// ---------------------------------------------------------------------------

/**
 * Split a large text file into ≤ SPLIT_THRESHOLD_BYTES chunks.
 * Splits on paragraph boundaries when possible to avoid mid-sentence cuts.
 * Returns an array of { partName, content } objects.
 */
export function splitPack(content, baseName, genId) {
  if (Buffer.byteLength(content, 'utf8') <= SPLIT_THRESHOLD_BYTES) {
    return [{ partName: baseName, content }];
  }

  const stem    = baseName.replace(/\.[^.]+$/, '');
  const ext     = baseName.match(/\.[^.]+$/)?.[0] ?? '.txt';
  const parts   = [];
  const paras   = content.split(/\n{2,}/);

  let current = '';
  let idx     = 0;

  const partLabel = () => {
    // Generates: part_aa, part_ab, … part_az, part_ba, …
    const a = String.fromCharCode(97 + Math.floor(idx / 26));
    const b = String.fromCharCode(97 + (idx % 26));
    return `${a}${b}`;
  };

  const flush = () => {
    if (!current.trim()) return;
    const partName = `${stem}_part_${partLabel()}${ext}`;
    parts.push({ partName, content: current.trimEnd() + '\n', genId });
    idx++;
    current = '';
  };

  for (const para of paras) {
    const candidate = current + (current ? '\n\n' : '') + para;
    if (Buffer.byteLength(candidate, 'utf8') > SPLIT_THRESHOLD_BYTES && current) {
      flush();
      current = para;
    } else {
      current = candidate;
    }
  }
  flush();

  logInfo(`Split ${baseName} → ${parts.length} chunk(s) (threshold: ${(SPLIT_THRESHOLD_BYTES / 1024 / 1024).toFixed(2)} MB)`);
  return parts;
}

// ---------------------------------------------------------------------------
// NLM helpers
// ---------------------------------------------------------------------------

function nlmSourceList(notebookId, nlmCli) {
  const result = spawnSync(nlmCli, ['source', 'list', notebookId, '--json'], {
    encoding:    'utf8',
    windowsHide: true,
    shell:       true,
  });
  if (result.status !== 0) {
    throw new Error(`nlm source list failed: ${result.stderr || result.stdout}`);
  }
  const raw = result.stdout.trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : (parsed.sources ?? []);
}

function nlmSourceAdd(notebookId, filePath, nlmCli) {
  const result = spawnSync(nlmCli, ['source', 'add', notebookId, '--file', filePath], {
    encoding:    'utf8',
    windowsHide: true,
    shell:       true,
    timeout:     30_000,
  });
  if (result.status !== 0) {
    throw new Error(`nlm source add failed for ${path.basename(filePath)}: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function nlmSourceDelete(sourceId, nlmCli) {
  const result = spawnSync(nlmCli, ['source', 'delete', sourceId, '-y'], {
    encoding:    'utf8',
    windowsHide: true,
    shell:       true,
  });
  if (result.status !== 0) {
    logWarn(`  nlm source delete ${sourceId} failed: ${result.stderr || result.stdout}`);
  }
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

/**
 * Block (using Atomics.wait) until all sourceIds in currentBatchIds resolve
 * from status 1 (processing) to status 2 (active) or status 3 (error).
 *
 * Throws if any source reaches status 3 or the timeout expires.
 */
async function pollUntilActive(notebookId, currentBatchIds, nlmCli) {
  const buf       = new SharedArrayBuffer(4);
  const view      = new Int32Array(buf);
  const startTime = Date.now();
  const idSet     = new Set(currentBatchIds);

  logInfo(`Polling ${idSet.size} source(s) until active (timeout=${POLL_TIMEOUT_MS / 1000}s)…`);

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const sources     = nlmSourceList(notebookId, nlmCli);
    const batchSrcs   = sources.filter((s) => idSet.has(s.id));
    const pending     = batchSrcs.filter((s) => s.status === 1);
    const failed      = batchSrcs.filter((s) => s.status === 3);

    if (failed.length > 0) {
      throw new Error(
        `Source(s) failed (status 3): ${failed.map((f) => `"${f.title}" (${f.id})`).join(', ')}`
      );
    }

    if (pending.length === 0 && batchSrcs.every((s) => s.status === 2)) {
      logInfo(`✓ All ${idSet.size} source(s) active (status 2).`);
      return batchSrcs;
    }

    logInfo(`  Still processing: ${pending.length}/${idSet.size} — waiting ${POLL_INTERVAL_MS / 1000}s…`);
    Atomics.wait(view, 0, 0, POLL_INTERVAL_MS);
  }

  throw new Error(
    `Polling timed out after ${POLL_TIMEOUT_MS / 1000}s — some sources may still be processing.`
  );
}

// ---------------------------------------------------------------------------
// Resolve uploaded source IDs by title matching
// ---------------------------------------------------------------------------

/**
 * After uploading a chunk, find its source ID by matching on title.
 * NotebookLM uses the uploaded filename as the title.
 */
async function resolveUploadedId(notebookId, partName, nlmCli, priorIds) {
  const buf       = new SharedArrayBuffer(4);
  const view      = new Int32Array(buf);
  const deadline  = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const sources = nlmSourceList(notebookId, nlmCli);
    const match   = sources.find(
      (s) => !priorIds.has(s.id) && (s.title || '').toLowerCase() === partName.toLowerCase()
    );
    if (match) return match.id;
    Atomics.wait(view, 0, 0, 1_500);
  }
  throw new Error(`Could not resolve uploaded source ID for "${partName}" after 15s.`);
}

// ---------------------------------------------------------------------------
// Core gate
// ---------------------------------------------------------------------------

/**
 * Execute the atomic Upload-Verify-Purge sequence for a single pack file.
 *
 * @param {object} opts
 * @param {string}  opts.packFile    — absolute path to the .txt pack file
 * @param {string}  opts.targetNbId  — NotebookLM notebook UUID
 * @param {string}  opts.category    — category key (for logging)
 * @param {string}  [opts.nlmCli]    — nlm CLI binary name (default: 'notebooklm')
 * @param {boolean} [opts.dryRun]    — if true, skip actual NLM calls
 * @param {string}  [opts.repoRoot]  — repo root for lockfile/generation paths
 */
export async function replaceGate(opts) {
  const {
    packFile,
    targetNbId,
    category   = path.basename(packFile, '.txt'),
    nlmCli     = process.env.NOTEBOOKLM_BIN ?? 'notebooklm',
    dryRun     = false,
    repoRoot   = path.resolve(__dirname, '..'),
  } = opts;

  if (!packFile || !targetNbId) {
    throw new Error('replaceGate: packFile and targetNbId are required.');
  }
  if (!fs.existsSync(packFile)) {
    throw new Error(`replaceGate: packFile not found: ${packFile}`);
  }

  const pDir = packDir(repoRoot);
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  // ── Step 0: Lock ──────────────────────────────────────────────────────────
  acquireLock(repoRoot);

  const unlockAndCleanup = (tmpFiles = []) => {
    for (const f of tmpFiles) {
      try { fs.rmSync(f, { force: true }); } catch { /* ignore */ }
    }
    releaseLock(repoRoot);
  };

  process.once('SIGINT',  () => { unlockAndCleanup(); process.exit(130); });
  process.once('SIGTERM', () => { unlockAndCleanup(); process.exit(143); });

  const tmpChunkFiles = [];

  try {
    // ── Step 1: Read + split ────────────────────────────────────────────────
    logStep(`Processing pack: ${path.basename(packFile)} → notebook ${targetNbId}`);
    const content = fs.readFileSync(packFile, 'utf8');
    const genId   = makeGenerationId(content);
    logInfo(`Generation ID: ${genId}`);

    const baseName = path.basename(packFile);
    const chunks   = splitPack(content, baseName, genId);

    // Write split chunks to .nlm_pack/ (they're temp for this run if > 1 chunk)
    for (const chunk of chunks) {
      const chunkPath = path.join(pDir, chunk.partName);
      fs.writeFileSync(chunkPath, chunk.content, 'utf8');
      chunk.filePath = chunkPath;
      if (chunks.length > 1) tmpChunkFiles.push(chunkPath);
      logInfo(`  Chunk: ${chunk.partName} (${(Buffer.byteLength(chunk.content, 'utf8') / 1024).toFixed(1)} KB)`);
    }

    // Write split manifest for operator inspection
    if (chunks.length > 1) {
      const manifest = {
        generatedAt: new Date().toISOString(),
        genId,
        sourceFile:  packFile,
        category,
        targetNbId,
        chunks: chunks.map((c) => ({ partName: c.partName, bytes: Buffer.byteLength(c.content, 'utf8') })),
      };
      fs.writeFileSync(splitManifestPath(repoRoot), JSON.stringify(manifest, null, 2), 'utf8');
    }

    // ── Step 2: Read prior generation source IDs ─────────────────────────────
    const prevGen    = readGenerationFile(repoRoot);
    const priorData  = prevGen[`${category}:${targetNbId}`];
    const priorIds   = new Set(priorData?.sourceIds ?? []);
    logInfo(`Prior generation source IDs for "${category}": ${priorIds.size}`);

    if (dryRun) {
      logWarn('[DRY RUN] Skipping NLM calls. Chunks that would be uploaded:');
      for (const c of chunks) logWarn(`  → ${c.partName}`);
      logWarn(`[DRY RUN] Prior IDs that would be purged: ${[...priorIds].join(', ') || '(none)'}`);
      unlockAndCleanup(tmpChunkFiles);
      return { genId, chunks: chunks.map((c) => c.partName), purged: [] };
    }

    // ── Step 3: Snapshot existing source IDs before upload ───────────────────
    const preUploadSources = nlmSourceList(targetNbId, nlmCli);
    const preUploadIds     = new Set(preUploadSources.map((s) => s.id));
    logInfo(`Notebook currently has ${preUploadIds.size} source(s).`);

    // ── Step 4: Upload chunks with pacing ────────────────────────────────────
    logStep(`Uploading ${chunks.length} chunk(s) with ${INTER_CHUNK_DELAY_MS / 1000}s pacing…`);
    const uploadedIds = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (i > 0) {
        logInfo(`  Pacing delay: ${INTER_CHUNK_DELAY_MS / 1000}s…`);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, INTER_CHUNK_DELAY_MS);
      }

      let attempts = 0;
      while (attempts <= MAX_RETRIES) {
        try {
          logInfo(`  [${i + 1}/${chunks.length}] Uploading ${chunk.partName}…`);
          nlmSourceAdd(targetNbId, chunk.filePath, nlmCli);
          const sourceId = await resolveUploadedId(targetNbId, chunk.partName, nlmCli, preUploadIds);
          preUploadIds.add(sourceId);    // add so next resolveUploadedId ignores it
          uploadedIds.push(sourceId);
          logInfo(`  ✓ Uploaded → source ID: ${sourceId}`);
          break;
        } catch (err) {
          attempts++;
          if (attempts > MAX_RETRIES) {
            throw new Error(`Upload failed for ${chunk.partName} after ${MAX_RETRIES + 1} attempt(s): ${err.message}`);
          }
          logWarn(`  Upload attempt ${attempts} failed: ${err.message}. Retrying in 6s…`);
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 6_000);
        }
      }
    }

    // ── Step 5: Poll until all uploaded chunks are active ────────────────────
    logStep('Verifying all uploaded chunks reach status 2 (active)…');
    await pollUntilActive(targetNbId, uploadedIds, nlmCli);

    // ── Step 6: Update generation file BEFORE purging ────────────────────────
    const genData = readGenerationFile(repoRoot);
    genData[`${category}:${targetNbId}`] = {
      genId,
      uploadedAt: new Date().toISOString(),
      sourceIds:  uploadedIds,
      partNames:  chunks.map((c) => c.partName),
    };
    genData.active_generation = genId;
    genData.sha256 = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
    writeGenerationFile(repoRoot, genData);
    logInfo(`✓ Generation file updated: ${generationFilePath(repoRoot)}`);

    // ── Step 7: Purge prior generation source IDs ────────────────────────────
    if (priorIds.size > 0) {
      logStep(`Purging ${priorIds.size} prior-generation source(s)…`);
      for (const id of priorIds) {
        if (uploadedIds.includes(id)) {
          logWarn(`  Skipping purge of ${id} — it is in the new generation (ID collision).`);
          continue;
        }
        logInfo(`  Deleting prior source: ${id}`);
        nlmSourceDelete(id, nlmCli);
      }
      logInfo(`✓ Prior generation purged.`);
    } else {
      logInfo('No prior generation IDs to purge.');
    }

    unlockAndCleanup(tmpChunkFiles);

    logStep(`✓ Replace gate complete for "${category}" (gen: ${genId})`);
    return { genId, chunks: chunks.map((c) => c.partName), purged: [...priorIds] };

  } catch (err) {
    unlockAndCleanup(tmpChunkFiles);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const mainFile = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
const thisFile = fs.realpathSync(__filename);

if (mainFile === thisFile) {
  const args = Object.fromEntries(
    process.argv.slice(2)
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [k, ...v] = a.slice(2).split('=');
        return [k, v.length ? v.join('=') : true];
      })
  );

  if (args.help) {
    console.log(`
Usage: node scripts/nlm-pack-replace-gate.mjs [options]

Options:
  --notebook-id=<uuid>    Target NotebookLM notebook ID (required)
  --file=<path>           Path to the .txt pack file (required)
  --category=<key>        Category label for logging (optional)
  --nlm-cli=<bin>         nlm CLI binary name (default: notebooklm)
  --dry-run               Print what would happen without calling NLM
  --repo-root=<path>      Repo root for lockfile/generation paths (default: ../)
  --help                  Show this help message
`);
    process.exit(0);
  }

  if (!args['notebook-id'] || !args['file']) {
    logError('--notebook-id and --file are required. Use --help for usage.');
    process.exit(1);
  }

  replaceGate({
    packFile:   path.resolve(args['file']),
    targetNbId: args['notebook-id'],
    category:   args['category'],
    nlmCli:     args['nlm-cli'] ?? process.env.NOTEBOOKLM_BIN ?? 'notebooklm',
    dryRun:     args['dry-run'] === true || args['dry-run'] === 'true',
    repoRoot:   args['repo-root'] ? path.resolve(args['repo-root']) : path.resolve(__dirname, '..'),
  })
    .then(({ genId, chunks, purged }) => {
      console.log(`\n✓ genId:   ${genId}`);
      console.log(`  chunks:  ${chunks.join(', ')}`);
      console.log(`  purged:  ${purged.length} source(s)`);
      process.exit(0);
    })
    .catch((err) => {
      logError(err.message);
      process.exit(1);
    });
}
