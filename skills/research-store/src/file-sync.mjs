import { readdir, lstat, realpath, open, mkdir, readFile, writeFile, rm, mkdtemp, statfs } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process'; // noqa: SEC-AUDITOR -- fixed read-only git executable/argument arrays, no shell, 30-second timeout.
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { Upload } from 'tus-js-client';
import { checkContent } from '../../../scripts/secret-scan.mjs';

export const FILE_PROJECT = 'bhezixgmkhpndmezgsxk';
export const ORIGINAL_BUCKET = 'research-originals-uat';
const execute = promisify(execFile);
const noise = new Set(['.git', 'node_modules', '.venv', '__pycache__', '.cache', '.tmp.drivedownload', '.tmp.driveupload', 'graft', '.ijfw']);
const textTypes = new Set(['.md', '.markdown', '.txt', '.csv', '.json', '.jsonl', '.html', '.css', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.py', '.ps1', '.yaml', '.yml', '.diff', '.patch']);
const providerKeys = /AIza[0-9A-Za-z_-]{35}|\bsk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|xox[bp]-[0-9A-Za-z-]{10,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
const slash = value => value.split(path.sep).join('/');
const checked = response => { if (response.error) throw new Error('Original-file store request failed (details suppressed)'); return response.data; };

export function assertFileDestination(url) {
  if (url !== `https://${FILE_PROJECT}.supabase.co`) throw new Error('Original-file writes restricted to pinned DEV/UAT URL');
}

async function gitSnapshot(source) {
  if (!source.gitRoot) return { head: null, files: new Map() };
  const run = args => execute('git', ['-c', 'core.fsmonitor=false', '-C', source.gitRoot, ...args],
    { timeout: 30000, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8', windowsHide: true });
  const root = (await run(['rev-parse', '--show-toplevel'])).stdout.trim();
  if (path.resolve(root).toLowerCase() !== path.resolve(source.gitRoot).toLowerCase()) throw new Error('Git source root identity mismatch');
  const head = (await run(['rev-parse', 'HEAD'])).stdout.trim();
  const files = new Map();
  for (const record of (await run(['ls-tree', '-r', '-z', head])).stdout.split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t');
    const [mode, type, oid] = record.slice(0, tab).split(' ');
    if (type === 'blob' && mode !== '120000') files.set(record.slice(tab + 1), oid);
  }
  return { head, files };
}

export async function scanOriginals(sources, { stagingRoot = null, maxFileBytes = 50_000_000, maxTotalBytes = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Array.isArray(sources) || !sources.length || new Set(sources.map(source => source.id)).size !== sources.length) throw new Error('Invalid source list');
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1) throw new Error('Invalid file-size limit');
  if (!Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 1) throw new Error('Invalid total byte limit');
  let capturedBytes = 0;
  const result = { entries: [], blocked: [], errors: [] };
  for (const source of sources) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(source.id) || !path.isAbsolute(source.root)) throw new Error('Invalid source identity/root');
    const root = await realpath(source.root);
    const snapshot = await gitSnapshot(source);
    if (source.gitOnly && !source.gitRoot) throw new Error('Git-only source requires explicit Git root');
    const rootInfo = await lstat(source.root);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Source root must be a physical directory');
    async function walk(directory) {
      const listing = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
      if (directory !== root && listing.some(entry => entry.name === '.git')) {
        result.blocked.push({ source: source.id, path: slash(path.relative(root, directory)), reason: 'nested-repository' }); return;
      }
      for (const entry of listing) {
        const absolute = path.join(directory, entry.name);
        const relative = slash(path.relative(root, absolute));
        const block = reason => result.blocked.push({ source: source.id, path: relative, reason });
        try {
          if (entry.isSymbolicLink()) { block('link-not-followed'); continue; }
          if (entry.isDirectory()) {
            if (noise.has(entry.name.toLowerCase())) { block('generated-subtree'); continue; }
            const resolved = await realpath(absolute);
            const contained = path.relative(root, resolved);
            if (contained === '..' || contained.startsWith(`..${path.sep}`) || path.isAbsolute(contained)) { block('path-escape'); continue; }
            await walk(absolute); continue;
          }
          if (!entry.isFile()) continue;
          const ext = path.extname(entry.name).toLowerCase();
          if (/^\.env(?:\.|$)|^(?:credentials|secrets|id_rsa|id_ed25519)(?:\.|$)/i.test(entry.name) || /\.(pem|key|p12|pfx|keystore)$/i.test(entry.name)) { block('secret-filename'); continue; }
          if (['.gdoc', '.gsheet', '.gslides'].includes(ext)) { block('google-export-required'); continue; }
          if (['.gz', '.zip', '.tgz', '.7z', '.db', '.doc', '.docx', '.pdf', '.log', '.bak-predup', '.prev'].includes(ext)) { block('opaque-container-review'); continue; }
          const before = await lstat(absolute);
          if (before.isSymbolicLink() || !before.isFile()) { block('link-not-followed'); continue; }
          if (before.size > maxFileBytes) { block('over-file-limit'); continue; }
          if (capturedBytes + before.size > maxTotalBytes) { block('over-total-budget'); continue; }
          const sourceHandle = await open(absolute, 'r');
          const stagedPath = stagingRoot ? path.join(stagingRoot, `${source.id}-${result.entries.length}.bin`) : null;
          let staged, sha, gitOid, text, unsafe = false;
          try {
            const opened = await sourceHandle.stat();
            if (opened.dev !== before.dev || opened.ino !== before.ino || (await realpath(absolute)) !== absolute) throw new Error('Source changed before capture');
            if (stagedPath) staged = await open(stagedPath, 'wx', 0o600);
            const contentHash = createHash('sha256');
            const blobHash = createHash(snapshot.head?.length === 64 ? 'sha256' : 'sha1').update(`blob ${before.size}\0`);
            const textParts = [], scanTail = { text: '' };
            let readBytes = 0;
            for await (const bytes of sourceHandle.createReadStream({ autoClose: false })) {
              contentHash.update(bytes); blobHash.update(bytes); readBytes += bytes.length;
              if (staged) await staged.writeFile(bytes);
              const scan = scanTail.text + bytes.toString('latin1');
              if (checkContent(scan).length || providerKeys.test(scan)) unsafe = true;
              scanTail.text = scan.slice(-4096);
              if (textTypes.has(ext) && before.size <= 1024 * 1024) textParts.push(bytes);
            }
            const after = await sourceHandle.stat();
            if (readBytes !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error('Source changed during capture');
            sha = contentHash.digest('hex'); gitOid = blobHash.digest('hex');
            const raw = Buffer.concat(textParts);
            const decoded = raw.toString('utf8');
            text = textTypes.has(ext) && before.size <= 1024 * 1024 && !decoded.includes('\0') && Buffer.from(decoded).equals(raw) ? decoded : null;
          } finally { await staged?.close(); await sourceHandle.close(); }
          if (unsafe) { if (stagedPath) await rm(stagedPath, { force: true }); block('secret-content'); continue; }
          const gitPath = source.gitRoot ? slash(path.relative(source.gitRoot, absolute)) : null;
          const committed = gitPath && snapshot.files.get(gitPath) === gitOid;
          if (source.gitOnly && !snapshot.files.has(gitPath)) { if (stagedPath) await rm(stagedPath, { force: true }); block('not-git-tracked'); continue; }
          result.entries.push({ source_key: source.id, relative_path: relative, content_hash: sha, byte_size: before.size,
            storage_key: `${source.id}/${sha}`, text_content: text, git_sha: committed ? snapshot.head : null,
            git_state: !source.gitRoot ? 'not-git' : committed ? 'committed' : snapshot.files.has(gitPath) ? 'modified' : 'untracked',
            source_metadata: { git_path: gitPath, observed_head: snapshot.head, source_root: source.root }, stagedPath });
          capturedBytes += before.size;
        } catch { result.errors.push({ source: source.id, path: relative, reason: 'capture-failed-details-suppressed' }); }
      }
    }
    await walk(root);
  }
  return result;
}

export async function publishOriginals(entries, store) {
  const report = { stored: 0, unchanged: 0 };
  for (const entry of entries) {
    const previous = await store.existing(entry);
    if (previous?.content_hash === entry.content_hash && previous.git_sha === entry.git_sha && previous.git_state === entry.git_state) { report.unchanged++; continue; }
    if (previous?.content_hash !== entry.content_hash) await store.upload(entry);
    await store.save(entry);
    report.stored++;
  }
  return report;
}

export function createOriginalStore({ url, key, maxFileBytes }) {
  assertFileDestination(url);
  if (!key?.trim()) throw new Error('Writer credential required');
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000) }) } });
  return {
    async ready() {
      const bucket = checked(await service.storage.getBucket(ORIGINAL_BUCKET));
      if (bucket.public || !Number.isSafeInteger(Number(bucket.file_size_limit)) || Number(bucket.file_size_limit) < maxFileBytes) throw new Error('Private bucket capacity/limit not confirmed');
      checked(await service.from('research_original_files').select('source_key').limit(1));
    },
    existing: async row => checked(await service.from('research_original_files').select('content_hash,git_sha,git_state').eq('source_key', row.source_key).eq('relative_path', row.relative_path).maybeSingle()),
    async upload(row) {
      if (!row.stagedPath) throw new Error('Immutable captured original required');
      const stream = createReadStream(row.stagedPath);
      try {
        await new Promise((resolve, reject) => {
          const upload = new Upload(stream, { endpoint: `https://${FILE_PROJECT}.storage.supabase.co/storage/v1/upload/resumable`,
            uploadSize: row.byte_size, chunkSize: 6 * 1024 * 1024, retryDelays: null, storeFingerprintForResuming: false,
            headers: { authorization: `Bearer ${key}`, 'x-upsert': 'true' },
            metadata: { bucketName: ORIGINAL_BUCKET, objectName: row.storage_key, contentType: 'application/octet-stream', cacheControl: '3600' },
            onBeforeRequest(request) { if (new URL(request.getURL()).origin !== `https://${FILE_PROJECT}.storage.supabase.co`) throw new Error('Upload destination changed'); },
            onError: () => reject(new Error('Original upload failed (details suppressed)')), onSuccess: resolve,
            onProgress: (sent, total) => console.log(`Upload ${row.source_key}: ${sent}/${total} bytes`),
          });
          const timer = setTimeout(() => { void upload.abort(); reject(new Error('Original upload timed out')); }, 300000);
          const success = upload.options.onSuccess, failure = upload.options.onError;
          upload.options.onSuccess = value => { clearTimeout(timer); success(value); };
          upload.options.onError = error => { clearTimeout(timer); failure(error); };
          upload.start();
        });
      } finally { stream.destroy(); }
    },
    async save(row) {
      const { stagedPath, ...record } = row;
      checked(await service.from('research_original_files').upsert({ ...record, updated_at: new Date().toISOString() }, { onConflict: 'source_key,relative_path' }));
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const value = flag => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; };
  const dryRun = args.includes('--dry-run'), watch = args.includes('--watch');
  const sourcesFile = value('--sources'), reportFile = value('--report');
  if (!sourcesFile || !reportFile || (dryRun && watch)) throw new Error('Use --sources <json> --report <json> [--dry-run|--watch]');
  for (let i = 0; i < args.length; i++) {
    if (['--sources', '--report'].includes(args[i])) { i++; continue; }
    if (!['--dry-run', '--watch'].includes(args[i])) throw new Error('Unknown original-file option');
  }
  const sources = JSON.parse(await readFile(sourcesFile, 'utf8'));
  const maxFileBytes = Number(process.env.FILES_MAX_FILE_BYTES ?? 50_000_000);
  const budget = Number(process.env.FILES_MAX_TOTAL_BYTES ?? 0);
  let store;
  if (!dryRun) {
    if (!Number.isSafeInteger(budget) || budget < 1) throw new Error('Explicit approved total byte budget required');
    store = createOriginalStore({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, maxFileBytes });
    await store.ready();
  }
  const stagingParent = path.resolve(path.dirname(reportFile), 'originals-staging');
  await mkdir(stagingParent, { recursive: true });
  do {
    const staging = dryRun ? null : await mkdtemp(path.join(stagingParent, 'capture-'));
    try {
      if (staging) {
        const space = await statfs(staging);
        if (space.bavail * space.bsize < budget) throw new Error('Insufficient local staging capacity for approved byte budget');
      }
      const captured = await scanOriginals(sources, { stagingRoot: staging, maxFileBytes, maxTotalBytes: dryRun ? Number.MAX_SAFE_INTEGER : budget });
      const totalBytes = captured.entries.reduce((sum, row) => sum + row.byte_size, 0);
      if (captured.errors.length) throw new Error('Source capture errors; refusing partial upload');
      if (!dryRun && totalBytes > budget) throw new Error('Source capture exceeds approved total byte budget');
      const outcome = dryRun ? null : await publishOriginals(captured.entries, store);
      const report = { mode: dryRun ? 'dry-run' : 'dev-uat', totalBytes, eligible: captured.entries.length, outcome,
        blocked: captured.blocked, errors: captured.errors, timestamp: new Date().toISOString(),
        manifest: captured.entries.map(({ text_content, stagedPath, ...row }) => row), deletionPolicy: 'retain-missing', embeddings: 0 };
      await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({ ...report, manifest: undefined, blocked: captured.blocked.length }));
    } finally {
      if (staging) await rm(staging, { recursive: true, force: true });
    }
    if (watch) await delay(60000);
  } while (watch);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Original-file sync failed: check source capture, report, DEV/UAT configuration, and upload limits. Credentials/content suppressed.'); process.exitCode = 1; });
}
