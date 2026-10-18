#!/usr/bin/env node
// scripts/docs-synthesizer.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  auditMarkdownText,
  normalizeWikiFrontmatter,
} from '../skills/repo-docs-diagram-sync/src/docs-synthesizer.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'archive', '.claude', '.gemini', '.trm',
  'trm-drive', '_kb-sync-staging', '.ijfw', 'weekly-report-wt', '.worktrees',
  'dist', 'coverage', '.tmp.driveupload', '.serena', '.harness',
  '.pytest_cache', '__pycache__', '.venv', 'venv', 'IronLedger'
]);

export function findMarkdownFiles(dir) {
  const list = [];
  const walk = (d) => {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.md')) list.push(full);
      }
    } catch {
      // ignore
    }
  };
  walk(dir);
  return list;
}

export function auditRepositoryDocs(targetDir = ROOT) {
  const files = findMarkdownFiles(targetDir);
  const allViolations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const violations = auditMarkdownText(content, path.relative(ROOT, file));
    if (violations.length > 0) {
      allViolations.push({ file: path.relative(ROOT, file), violations });
    }
  }

  return {
    scannedCount: files.length,
    violationCount: allViolations.reduce((acc, v) => acc + v.violations.length, 0),
    filesWithViolations: allViolations,
  };
}

export function stageWikiPages({ sourceDir, targetDir, dryRun = false }) {
  if (!fs.existsSync(sourceDir)) {
    return { staged: 0, status: 'SOURCE_DIR_MISSING' };
  }

  let stagedCount = 0;
  const entries = fs.readdirSync(sourceDir, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith('.md') && !/\.(png|svg|jpg)$/i.test(entry.name)) continue;

    const relPath = path.relative(sourceDir, path.join(entry.parentPath ?? entry.path, entry.name));
    const destPath = path.join(targetDir, relPath);

    if (!dryRun) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const srcContent = fs.readFileSync(path.join(sourceDir, relPath));
      if (entry.name.endsWith('.md')) {
        const normalized = normalizeWikiFrontmatter(srcContent.toString('utf8'));
        fs.writeFileSync(destPath, normalized, 'utf8');
      } else {
        fs.writeFileSync(destPath, srcContent);
      }
    }
    stagedCount++;
  }

  return { staged: stagedCount, status: 'STAGED' };
}

export function parseArgs(argv) {
  const options = {
    audit: false,
    syncWiki: false,
    dryRun: false,
    push: false,
    benchmark: false,
    targetPath: ROOT,
  };

  for (const arg of argv) {
    if (arg === '--audit') options.audit = true;
    else if (arg === '--sync-wiki') options.syncWiki = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--push') options.push = true;
    else if (arg === '--benchmark') options.benchmark = true;
    else if (arg.startsWith('--path=')) options.targetPath = path.resolve(ROOT, arg.slice('--path='.length));
  }

  if (!options.audit && !options.syncWiki && !options.benchmark) {
    options.audit = true;
  }

  return options;
}

export function runBenchmark() {
  const start = Date.now();
  const sampleDoc = `# Sample Documentation Guide

Certainly! In this section, we will delve into the architecture.

This game-changing framework essentially eliminates all latency.

We recommend configuring the database before starting the engine.

The query is triggered by the background daemon.

For complete details, see [here](docs/guide.md).

Supports JSON, YAML and TOML configurations.
`;

  for (let i = 0; i < 50; i++) {
    auditMarkdownText(sampleDoc, 'benchmark.md');
  }

  const elapsed = Date.now() - start;
  console.log(`BENCHMARK_COMPLETE: Audited 50 documents in ${elapsed}ms`);
  return elapsed;
}

export async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.benchmark) {
    runBenchmark();
    process.exit(0);
  }

  if (options.audit) {
    const report = auditRepositoryDocs(options.targetPath);
    if (report.violationCount > 0) {
      console.log(`DOCS_AUDIT_WARNING: Found ${report.violationCount} style heuristics violations across ${report.filesWithViolations.length} files.`);
      for (const item of report.filesWithViolations.slice(0, 5)) {
        console.log(`  File: ${item.file} (${item.violations.length} findings)`);
        for (const v of item.violations.slice(0, 3)) {
          console.log(`    Line ${v.line}: [${v.rule}] ${v.message}`);
        }
      }
    } else {
      console.log(`DOCS_AUDIT_OK: Scanned ${report.scannedCount} markdown files with zero violations.`);
    }
  }

  if (options.syncWiki) {
    const candidateTargetWiki = path.join(options.targetPath, 'wiki');
    const wikiSource = fs.existsSync(candidateTargetWiki) ? candidateTargetWiki : (options.targetPath === ROOT ? path.join(ROOT, 'wiki') : null);
    if (wikiSource && fs.existsSync(wikiSource)) {
      const targetDir = path.join(ROOT, '.wiki-stage-temp');
      const stageRes = stageWikiPages({
        sourceDir: wikiSource,
        targetDir,
        dryRun: options.dryRun,
      });
      console.log(`WIKI_SYNC_OK: ${stageRes.status} (${stageRes.staged} pages processed).`);
      if (!options.dryRun && fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    } else {
      console.log('WIKI_SYNC_OK: SKIPPED (no wiki directory found in target path).');
    }
  }

  console.log('DOCS_SYNTHESIZER_OK');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(`DOCS_SYNTHESIZER_FAILED: ${err.message}`);
    process.exit(1);
  });
}
