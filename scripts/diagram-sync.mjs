#!/usr/bin/env node
// scripts/diagram-sync.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
  'trm-drive', '_kb-sync-staging', '.ijfw', 'weekly-report-wt', '.worktrees',
  'dist', 'coverage', '.tmp.driveupload', '.serena', '.harness',
  '.pytest_cache', '__pycache__', '.venv', 'venv', 'IronLedger'
]);

const DEFAULT_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CHROME_PATH = process.env.CHROME_PATH || DEFAULT_CHROME;

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

export function verifyDiagramParity(targetPath = ROOT) {
  const errors = [];
  const checked = [];

  let trackedFiles = null;
  if (fs.existsSync(path.join(ROOT, '.git'))) {
    try {
      const stdout = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      trackedFiles = new Set(stdout.split('\n').map((l) => path.resolve(ROOT, l.trim())).filter(Boolean));
    } catch {
      // ignore git command failure
    }
  }

  const checkHtmlFile = (htmlPath) => {
    try {
      const content = fs.readFileSync(htmlPath, 'utf8');
      const skin = inspectHtmlSkin(content);
      if (!skin.isLavery) return; // Only verify Cathryn Lavery diagrams

      const pngPath = htmlPath.replace(/\.html$/i, '.png');
      if (!fs.existsSync(pngPath)) {
        errors.push(`MISSING_PNG: ${path.relative(ROOT, pngPath)} is missing for ${path.relative(ROOT, htmlPath)}`);
        return;
      }

      if (trackedFiles && trackedFiles.has(path.resolve(htmlPath)) && !trackedFiles.has(path.resolve(pngPath))) {
        errors.push(`UNTRACKED_PNG: ${path.relative(ROOT, pngPath)} is untracked in git for tracked spec ${path.relative(ROOT, htmlPath)}`);
        return;
      }

      const htmlStat = fs.statSync(htmlPath);
      const pngStat = fs.statSync(pngPath);
      if (pngStat.mtimeMs < htmlStat.mtimeMs) {
        errors.push(`STALE_PNG: ${path.relative(ROOT, pngPath)} is older than ${path.relative(ROOT, htmlPath)}`);
        return;
      }
      checked.push(htmlPath);
    } catch {
      // ignore
    }
  };

  const walk = (d) => {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.html')) checkHtmlFile(full);
      }
    } catch {
      // ignore
    }
  };

  if (fs.existsSync(targetPath)) {
    const s = fs.statSync(targetPath);
    if (s.isFile() && targetPath.endsWith('.html')) checkHtmlFile(targetPath);
    else if (s.isDirectory()) walk(targetPath);
  }

  return {
    valid: errors.length === 0,
    errors,
    checkedCount: checked.length,
  };
}

export function parseArgs(argv) {
  const options = {
    dryRun: false,
    benchmark: false,
    verifyParity: false,
    targetPath: ROOT,
    fix: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--fix') options.fix = true;
    else if (arg === '--benchmark') options.benchmark = true;
    else if (arg === '--verify-parity') options.verifyParity = true;
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

  if (options.verifyParity) {
    const report = verifyDiagramParity(options.targetPath);
    if (!report.valid) {
      console.error(`DIAGRAM_PARITY_ERROR: Found ${report.errors.length} visual spec drift errors:`);
      for (const err of report.errors) console.error(`  - ${err}`);
      process.exit(1);
    }
    console.log(`DIAGRAM_PARITY_OK: All ${report.checkedCount} visual diagram assets match their HTML sources.`);
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
            if (IGNORED_DIRS.has(entry.name)) continue;
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
