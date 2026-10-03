import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { extractL0Abstract, extractL1Skeleton } from '../modules/mcp/viking-ast-skeleton.mjs';

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.nlm_pack',
  '_kb-sync-staging',
  '.claude',
  '.gemini',
  '.ijfw',
  'tmp',
  'temp',
  '.viking_compact',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg', '.bmp', '.tiff',
  '.pdf', '.wasm', '.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg',
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar',
  '.parquet', '.db', '.sqlite', '.sqlite3',
  '.node', '.pyc', '.class', '.jar',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.mp3', '.mp4', '.mov', '.avi', '.wav', '.flac', '.ogg', '.webm',
]);

function shouldIgnoreDirectory(dirName, customExcludes) {
  if (dirName.startsWith('.')) return true;
  if (DEFAULT_IGNORED_DIRS.has(dirName)) return true;
  if (customExcludes && customExcludes.has(dirName)) return true;
  return false;
}

function shouldProcessFile(fileName, ext, options) {
  if (fileName.startsWith('.')) return false;
  if (fileName.endsWith('.l0.json') || fileName.endsWith('.l1.txt')) return false;
  if (fileName === 'manifest.json' || fileName === 'FILES.manifest.txt') return false;
  if (BINARY_EXTENSIONS.has(ext.toLowerCase())) return false;
  if (options.extensions && !options.extensions.includes(ext.toLowerCase())) return false;
  return true;
}

function collectFiles(currentDir, rootDir, customExcludes, options, fileList = []) {
  if (!fs.existsSync(currentDir)) return fileList;
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldIgnoreDirectory(entry.name, customExcludes)) {
        collectFiles(fullPath, rootDir, customExcludes, options, fileList);
      }
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      const ext = path.extname(entry.name);
      if (shouldProcessFile(entry.name, ext, options)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

/**
 * Compacts a source vault offline by extracting L0 abstracts and L1 AST skeletons.
 *
 * @param {Object} params
 * @param {string} params.sourceDir - Source vault root path
 * @param {string} params.outputDir - Target directory for compacted artifacts
 * @param {string} [params.vaultName='dev'] - Logical vault name
 * @param {Object} [params.options={}] - Additional compaction options
 * @returns {Promise<{ processedFiles: number, manifestPath: string, totalBytesSaved: number }>}
 */
export async function compactVault({
  sourceDir,
  outputDir,
  vaultName = 'dev',
  options = {},
}) {
  if (!sourceDir || typeof sourceDir !== 'string') {
    throw new TypeError('sourceDir is required and must be a string');
  }
  if (!outputDir || typeof outputDir !== 'string') {
    throw new TypeError('outputDir is required and must be a string');
  }

  const resolvedSource = path.resolve(sourceDir);
  const resolvedOutput = path.resolve(outputDir);
  fs.mkdirSync(resolvedOutput, { recursive: true });

  const customExcludes = options.excludeDirs ? new Set(options.excludeDirs) : null;
  const filePaths = collectFiles(resolvedSource, resolvedSource, customExcludes, options);

  let totalSourceBytes = 0;
  let totalL0Bytes = 0;
  let totalL1Bytes = 0;
  let totalBytesSaved = 0;

  const manifestFiles = {};
  const manifestEntries = [];

  for (const filePath of filePaths) {
    const relPath = path.relative(resolvedSource, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const sourceSize = Buffer.byteLength(content, 'utf8');
    const sourceHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    // Extract L0 and L1
    const l0Extract = extractL0Abstract(content, ext);
    const l0Data = {
      path: relPath,
      source_hash: sourceHash,
      tier: 'L0',
      abstract: l0Extract.abstract,
      exportedSymbols: l0Extract.exportedSymbols,
      generated_at: new Date().toISOString(),
    };
    const l0Content = JSON.stringify(l0Data, null, 2);
    const l0Size = Buffer.byteLength(l0Content, 'utf8');
    const l0Hash = crypto.createHash('sha256').update(l0Content, 'utf8').digest('hex');

    const l1Content = extractL1Skeleton(content, ext);
    const l1Size = Buffer.byteLength(l1Content, 'utf8');
    const l1Hash = crypto.createHash('sha256').update(l1Content, 'utf8').digest('hex');

    const bytesSaved = Math.max(0, sourceSize - l1Size);

    totalSourceBytes += sourceSize;
    totalL0Bytes += l0Size;
    totalL1Bytes += l1Size;
    totalBytesSaved += bytesSaved;

    // Write artifacts preserving relative hierarchy
    const targetL0Path = path.join(resolvedOutput, `${relPath}.l0.json`);
    const targetL1Path = path.join(resolvedOutput, `${relPath}.l1.txt`);

    fs.mkdirSync(path.dirname(targetL0Path), { recursive: true });
    fs.writeFileSync(targetL0Path, l0Content, 'utf8');
    fs.writeFileSync(targetL1Path, l1Content, 'utf8');

    const fileEntry = {
      path: relPath,
      source_hash: sourceHash,
      source_size: sourceSize,
      l0_artifact: `${relPath}.l0.json`,
      l0_hash: l0Hash,
      l0_size: l0Size,
      l0_abstract: l0Extract.abstract,
      l0_exported_symbols: l0Extract.exportedSymbols,
      l1_artifact: `${relPath}.l1.txt`,
      l1_hash: l1Hash,
      l1_size: l1Size,
      bytes_saved: bytesSaved,
    };

    manifestFiles[relPath] = fileEntry;
    manifestEntries.push(fileEntry);
  }

  const manifestPath = path.join(resolvedOutput, 'manifest.json');
  const manifest = {
    vault_name: vaultName,
    generated_at: new Date().toISOString(),
    source_dir: resolvedSource,
    output_dir: resolvedOutput,
    processed_files: manifestEntries.length,
    total_source_bytes: totalSourceBytes,
    total_l0_bytes: totalL0Bytes,
    total_l1_bytes: totalL1Bytes,
    total_bytes_saved: totalBytesSaved,
    files: manifestFiles,
    entries: manifestEntries,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    processedFiles: manifestEntries.length,
    manifestPath,
    totalBytesSaved,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const sourceDir = process.argv[2] || process.cwd();
  const outputDir = process.argv[3] || path.join(sourceDir, '.viking_compact');
  const vaultName = process.argv[4] || 'dev';

  compactVault({ sourceDir, outputDir, vaultName })
    .then((summary) => {
      console.log(`Vault compaction completed for '${vaultName}':`);
      console.log(`  Processed files:   ${summary.processedFiles}`);
      console.log(`  Manifest:          ${summary.manifestPath}`);
      console.log(`  Total bytes saved: ${summary.totalBytesSaved}`);
    })
    .catch((err) => {
      console.error('Compaction failed:', err);
      process.exitCode = 1;
    });
}
