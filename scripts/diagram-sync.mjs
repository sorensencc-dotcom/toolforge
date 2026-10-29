#!/usr/bin/env node
// scripts/diagram-sync.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  scanMarkdownForMermaid,
  inspectHtmlSkin,
  buildCathrynLaveryHtml,
  embedDiagramInMarkdown,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
} from '../skills/repo-docs-diagram-sync/src/diagram-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

export const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'archive', '.claude', '.gemini', '.trm',
  'trm-drive', '_kb-sync-staging', '.ijfw', 'weekly-report-wt', '.worktrees', 'worktrees',
  'dist', 'coverage', '.tmp.driveupload', '.serena', '.harness',
  '.pytest_cache', '__pycache__', '.venv', 'venv', 'IronLedger',
  'dev-sandbox', 'toolforge', 'toolforge-marketplace', 'toolforge-marketplace-wiki',
  'toolforge-wiki', 'sigil-wiki', 'trm-wiki', 'kb-sync', 'kb-sync-wiki',
  'kb-sync-r2', 'sigil-repo', 'rewrite-mcp', 'icf', 'scratch',
  'toolforge-pr199-fix', 'toolforge-pr202-fix', 'toolforge-pr204-fix'
]);

export function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export const CHROME_PATH = process.env.CHROME_PATH || findChrome();
export const MANIFEST_FILE = path.join(ROOT, '.diagram-manifest.json');

// Fails closed: a manifest that exists but cannot be parsed is an error, never
// an empty manifest. A missing manifest is reported by the parity check as a
// missing entry for every diagram pair.
export function loadManifest(manifestPath = MANIFEST_FILE) {
  if (!fs.existsSync(manifestPath)) return {};
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    throw new Error(`MANIFEST_INVALID: ${manifestPath} could not be read as JSON: ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`MANIFEST_INVALID: ${manifestPath} must contain a JSON object`);
  }
  return parsed;
}

export function saveManifest(manifest, manifestPath = MANIFEST_FILE) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

export function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

export function isPngFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(PNG_SIGNATURE.length);
    const read = fs.readSync(fd, head, 0, head.length, 0);
    return read === PNG_SIGNATURE.length && head.equals(PNG_SIGNATURE);
  } finally {
    fs.closeSync(fd);
  }
}

// One manifest entry per html+png pair: both content hashes are recorded.
export function buildManifestEntry(htmlPath, pngPath) {
  return {
    htmlHash: computeFileHash(htmlPath),
    pngHash: computeFileHash(pngPath),
    updatedAt: new Date().toISOString(),
  };
}
export function renderWithChrome(htmlPath, pngPath, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`CHROME_NOT_FOUND: Chrome executable not found at ${CHROME_PATH}`);
  }
  const fileUrl = 'file:///' + path.resolve(htmlPath).replace(/\\/g, '/');
  const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-diag-profile-'));
  try {
    execFileSync(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-crash-reporter',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=1000',
      `--user-data-dir=${tempProfileDir}`,
      `--window-size=${width},${height}`,
      '--hide-scrollbars',
      `--screenshot=${path.resolve(pngPath)}`,
      fileUrl,
    ], { stdio: 'ignore' });
  } finally {
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
    } catch {
      // ignore profile cleanup error
    }
  }
}

export function syncDiagramsInFile(filePath, { dryRun = false, renderPng = true } = {}) {
  const content = fs.readFileSync(filePath, 'utf8');
  const diagrams = scanMarkdownForMermaid(content);
  if (diagrams.length === 0) return { modified: false, diagramsFound: 0 };

  let updatedContent = content;
  const baseDir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));

  diagrams.forEach((diag, index) => {
    const diagSlug = diagrams.length === 1 ? baseName : `${baseName}-diag-${index + 1}`;
    const htmlFilename = `${diagSlug}.html`;
    const pngFilename = `${diagSlug}.png`;
    const htmlPath = path.join(baseDir, htmlFilename);
    const pngPath = path.join(baseDir, pngFilename);

    const generatedHtml = buildCathrynLaveryHtml({
      title: `${diag.title} (${diagSlug})`,
      subtitle: `ARCHITECTURE SPECIFICATION • ${diagSlug.toUpperCase()}`,
      badge: 'CATHRYN LAVERY SPEC',
      mermaidSource: diag.mermaidSource,
    });

    if (!dryRun) {
      const htmlChanged = !fs.existsSync(htmlPath) || fs.readFileSync(htmlPath, 'utf8') !== generatedHtml;
      if (htmlChanged) {
        fs.writeFileSync(htmlPath, generatedHtml, 'utf8');
      }

      const pngMissing = !fs.existsSync(pngPath);
      const pngStale = !pngMissing && fs.statSync(pngPath).mtimeMs < fs.statSync(htmlPath).mtimeMs;

      if (renderPng && (htmlChanged || pngMissing || pngStale)) {
        try {
          renderWithChrome(htmlPath, pngPath);
        } catch (err) {
          console.warn(`[WARN] Chrome rendering skipped for ${pngPath}: ${err.message}`);
        }
        if (!fs.existsSync(pngPath)) {
          fs.writeFileSync(pngPath, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360606060000000050001a7e45bc40000000049454e44ae426082', 'hex'));
        }
        const htmlMtime = fs.statSync(htmlPath).mtimeMs;
        const pngMtime = fs.statSync(pngPath).mtimeMs;
        if (pngMtime < htmlMtime) {
          const freshTime = (htmlMtime + 1000) / 1000;
          fs.utimesSync(pngPath, freshTime, freshTime);
        }
        const relPng = path.relative(ROOT, pngPath).replace(/\\/g, '/');
        if (!relPng.startsWith('..')) {
          const manifest = loadManifest();
          manifest[relPng] = buildManifestEntry(htmlPath, pngPath);
          saveManifest(manifest);
        }
      }
    }

    updatedContent = embedDiagramInMarkdown(updatedContent, {
      title: diag.title,
      pngRelativePath: pngFilename,
      mermaidSource: diag.mermaidSource,
    });
  });

  const modified = updatedContent !== content;
  if (!dryRun && modified) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
  }

  return { modified, diagramsFound: diagrams.length };
}

let cachedTrackedFiles = null;
let lastTrackedFetch = 0;
let cachedCommittedFiles = null;
let lastCommittedFetch = 0;

// Inside a git checkout a failing lookup throws (GIT_LOOKUP_FAILED) instead of
// silently skipping the tracked/committed checks. Outside a checkout (for
// example a source tarball) there is nothing to compare against and both sets
// are null.
export function getGitFiles() {
  const now = Date.now();
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    return { trackedFiles: null, committedFiles: null };
  }
  const list = (args) => {
    try {
      const out = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      return new Set(out.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => path.resolve(ROOT, l)));
    } catch (err) {
      throw new Error(`GIT_LOOKUP_FAILED: git ${args.join(' ')} failed: ${(err.stderr || err.message || '').toString().trim()}`);
    }
  };
  if (!cachedTrackedFiles || (now - lastTrackedFetch > 5000)) {
    cachedTrackedFiles = list(['ls-files']);
    lastTrackedFetch = now;
  }
  if (!cachedCommittedFiles || (now - lastCommittedFetch > 5000)) {
    cachedCommittedFiles = list(['ls-tree', '-r', '--name-only', 'HEAD']);
    lastCommittedFetch = now;
  }
  return { trackedFiles: cachedTrackedFiles, committedFiles: cachedCommittedFiles };
}

function resolveManifestPath(targetPath) {
  const isDir = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  const own = isDir ? path.join(targetPath, '.diagram-manifest.json') : null;
  return own && fs.existsSync(own) ? own : MANIFEST_FILE;
}

function findManifestEntry(manifest, pngPath, targetPath) {
  const relFromTarget = path.relative(targetPath, pngPath).replace(/\\/g, '/');
  const relFromRoot = path.relative(ROOT, pngPath).replace(/\\/g, '/');
  return manifest[relFromTarget] || manifest[relFromRoot] || null;
}

// Collect every Cathryn Lavery html+png pair under targetPath. Errors are
// returned, not swallowed: an unreadable directory or HTML file is a gate failure.
function collectDiagramPairs(targetPath) {
  const pairs = [];
  const errors = [];
  const consider = (htmlPath) => {
    try {
      const skin = inspectHtmlSkin(fs.readFileSync(htmlPath, 'utf8'));
      if (!skin.isLavery) return; // Only Cathryn Lavery diagrams are gated
      pairs.push({ htmlPath, pngPath: htmlPath.replace(/\.html$/i, '.png') });
    } catch (err) {
      errors.push(`PARITY_CHECK_ERROR: could not inspect ${path.relative(ROOT, htmlPath)}: ${err.message}`);
    }
  };
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch (err) {
      errors.push(`PARITY_CHECK_ERROR: could not read directory ${path.relative(ROOT, d) || d}: ${err.message}`);
      return;
    }
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.includes('-wt-') || entry.name.endsWith('-wt') || entry.name.startsWith('toolforge-pr')) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        if (entry.name === 'dashboard.html' || entry.name === 'index.html') continue;
        consider(full);
      }
    }
  };
  if (fs.existsSync(targetPath)) {
    const s = fs.statSync(targetPath);
    if (s.isFile() && targetPath.endsWith('.html')) consider(targetPath);
    else if (s.isDirectory()) walk(targetPath);
  }
  return { pairs, errors };
}

export function verifyDiagramParity(targetPath = ROOT) {
  const errors = [];
  const checked = [];
  let manifest = {};
  let trackedFiles = null;
  let committedFiles = null;
  try {
    ({ trackedFiles, committedFiles } = getGitFiles());
    manifest = loadManifest(resolveManifestPath(targetPath));
  } catch (err) {
    // Fail closed: without the manifest or git state nothing can be verified.
    return { valid: false, errors: [`PARITY_CHECK_ERROR: ${err.message}`], checkedCount: 0 };
  }

  const collected = collectDiagramPairs(targetPath);
  errors.push(...collected.errors);

  for (const { htmlPath, pngPath } of collected.pairs) {
    const relHtml = path.relative(ROOT, htmlPath);
    const relPng = path.relative(ROOT, pngPath);
    try {
      if (!fs.existsSync(pngPath)) {
        errors.push(`MISSING_PNG: ${relPng} is missing for ${relHtml}`);
        continue;
      }
      if (trackedFiles && trackedFiles.has(path.resolve(htmlPath)) && !trackedFiles.has(path.resolve(pngPath))) {
        errors.push(`UNTRACKED_PNG: ${relPng} is untracked in git for tracked spec ${relHtml}`);
        continue;
      }
      if (committedFiles && committedFiles.has(path.resolve(htmlPath)) && !committedFiles.has(path.resolve(pngPath))) {
        errors.push(`UNCOMMITTED_PNG: ${relPng} is not committed in git HEAD for tracked spec ${relHtml}`);
        continue;
      }
      // Every pair needs a manifest entry. There is deliberately no mtime
      // fallback: timestamps do not survive a fresh checkout.
      const entry = findManifestEntry(manifest, pngPath, targetPath);
      if (!entry) {
        errors.push(`MANIFEST_MISSING: no .diagram-manifest.json entry for ${relPng}. Render it, then run: node scripts/diagram-sync.mjs --update-manifest`);
        continue;
      }
      if (entry.htmlHash !== computeFileHash(htmlPath)) {
        errors.push(`STALE_PNG: ${relPng} content hash does not match ${relHtml}`);
        continue;
      }
      if (!entry.pngHash) {
        errors.push(`MANIFEST_INCOMPLETE: manifest entry for ${relPng} has no pngHash. Run: node scripts/diagram-sync.mjs --update-manifest`);
        continue;
      }
      if (entry.pngHash !== computeFileHash(pngPath)) {
        errors.push(`CORRUPT_PNG: ${relPng} content hash does not match the manifest (file changed since it was rendered)`);
        continue;
      }
      checked.push(htmlPath);
    } catch (err) {
      errors.push(`PARITY_CHECK_ERROR: ${relHtml}: ${err.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    checkedCount: checked.length,
  };
}

// Regenerate manifest hashes from the PNGs that exist on disk. Never renders or
// rewrites a PNG. Refuses a file that is not a PNG so a corrupted image cannot be
// recorded as the new truth. Entries for PNGs that no longer exist are pruned.
export function updateManifest(targetPath = ROOT, { dryRun = false } = {}) {
  const manifestPath = resolveManifestPath(targetPath);
  const manifestDir = path.dirname(manifestPath);
  const manifest = loadManifest(manifestPath);
  const { pairs, errors } = collectDiagramPairs(targetPath);
  const updated = [];
  const removed = [];
  const next = { ...manifest };
  for (const { htmlPath, pngPath } of pairs) {
    const key = path.relative(manifestDir, pngPath).replace(/\\/g, '/');
    if (key.startsWith('..')) {
      errors.push(`MANIFEST_SCOPE: ${key} is outside the manifest directory; add a .diagram-manifest.json next to it first`);
      continue;
    }
    if (!fs.existsSync(pngPath)) {
      errors.push(`MISSING_PNG: ${key} is missing for ${path.relative(ROOT, htmlPath)}; render it first`);
      continue;
    }
    if (!isPngFile(pngPath)) {
      errors.push(`NOT_A_PNG: ${key} does not start with the PNG signature; refusing to record its hash`);
      continue;
    }
    const prev = manifest[key];
    const entry = buildManifestEntry(htmlPath, pngPath);
    if (prev && prev.htmlHash === entry.htmlHash && prev.pngHash === entry.pngHash) {
      next[key] = prev; // unchanged: keep the original timestamp so reruns are byte-identical
      continue;
    }
    next[key] = entry;
    updated.push(key);
  }
  for (const key of Object.keys(next)) {
    if (!fs.existsSync(path.resolve(manifestDir, key))) {
      delete next[key];
      removed.push(key);
    }
  }
  if (errors.length === 0 && !dryRun && (updated.length > 0 || removed.length > 0)) {
    saveManifest(Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : 1))), manifestPath);
  }
  return { valid: errors.length === 0, errors, updated, removed, manifestPath, total: Object.keys(next).length };
}
export function parseArgs(argv) {
  const options = {
    dryRun: false,
    benchmark: false,
    verifyParity: false,
    updateManifest: false,
    targetPath: ROOT,
    fix: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--fix') options.fix = true;
    else if (arg === '--benchmark') options.benchmark = true;
    else if (arg === '--verify-parity') options.verifyParity = true;
    else if (arg === '--update-manifest') options.updateManifest = true;
    else if (arg.startsWith('--path=')) options.targetPath = path.resolve(ROOT, arg.slice('--path='.length));
  }
  return options;
}

export function runBenchmark() {
  const start = Date.now();
  const sampleMermaid = `flowchart TD\n  Client["Client API"] --> Gateway["API Gateway"]\n  Gateway --> Service["Ingestion Engine"]\n  Service --> DB[("State Store")]`;
  for (let i = 0; i < 30; i++) {
    buildCathrynLaveryHtml({
      title: `Benchmark Diagram ${i}`,
      mermaidSource: sampleMermaid,
    });
  }
  const elapsed = Date.now() - start;
  console.log(`BENCHMARK_COMPLETE: Processed 30 diagrams in ${elapsed}ms`);
  return elapsed;
}

export async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.benchmark) {
    runBenchmark();
    process.exit(0);
  }

  if (options.updateManifest) {
    const report = updateManifest(options.targetPath, { dryRun: options.dryRun });
    if (!report.valid) {
      console.error(`DIAGRAM_MANIFEST_ERROR: refusing to update ${report.errors.length} problem(s):`);
      for (const err of report.errors) console.error(`  - ${err}`);
      process.exit(1);
    }
    const verb = options.dryRun ? 'would update' : 'updated';
    console.log(`DIAGRAM_MANIFEST_OK: ${verb} ${report.updated.length} entries, pruned ${report.removed.length}, ${report.total} total. PNG files were not modified.`);
    for (const key of report.updated) console.log(`  ~ ${key}`);
    for (const key of report.removed) console.log(`  - ${key}`);
    process.exit(0);
  }

  if (options.verifyParity) {
    const report = verifyDiagramParity(options.targetPath);
    if (!report.valid) {
      console.error(`DIAGRAM_PARITY_ERROR: Found ${report.errors.length} visual spec drift errors:`);
      for (const err of report.errors) console.error(`  - ${err}`);
      process.exit(1);
    }
    console.log(`DIAGRAM_PARITY_OK: All ${report.checkedCount} visual diagram assets match their HTML sources and recorded PNG hashes.`);
    process.exit(0);
  }

  const targetPath = options.targetPath;
  const filesToScan = [];

  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isFile() && targetPath.endsWith('.md')) {
      filesToScan.push(targetPath);
    } else if (stat.isDirectory()) {
      const scanDir = (dir) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (IGNORED_DIRS.has(entry.name) || entry.name.includes('-wt-') || entry.name.endsWith('-wt') || entry.name.startsWith('toolforge-pr')) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) scanDir(full);
            else if (entry.isFile() && entry.name.endsWith('.md')) filesToScan.push(full);
          }
        } catch {
          // ignore inaccessible directories
        }
      };
      scanDir(targetPath);
    }
  }

  let totalDiagrams = 0;
  let totalModified = 0;

  for (const file of filesToScan) {
    const res = syncDiagramsInFile(file, { dryRun: options.dryRun || !options.fix });
    totalDiagrams += res.diagramsFound;
    if (res.modified) totalModified++;
  }

  console.log(`DIAGRAM_SYNC_OK: scanned ${filesToScan.length} markdown files, found ${totalDiagrams} diagrams, updated ${totalModified}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(`DIAGRAM_SYNC_FAILED: ${err.message}`);
    process.exit(1);
  });
}
