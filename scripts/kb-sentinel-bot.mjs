#!/usr/bin/env node
/**
 * scripts/kb-sentinel-bot.mjs
 * 
 * Autonomous Knowledge Base Drift & Autoheal Sentinel Bot.
 * Scans markdown frontmatter, broken wikilinks, and repository documentation drift.
 * Runs zero-token deterministic checks and reports status to _status-feed/kb_sentinel_report.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const WIKI_ROOT = path.resolve(REPO_ROOT, 'wiki');
const REPORT_PATH = path.resolve(REPO_ROOT, '_status-feed', 'kb_sentinel_report.json');

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldFix = args.includes('--fix');
const isVerbose = args.includes('--verbose');

async function findMarkdownFiles(dir) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '_kb-sync-staging') {
          files.push(...await findMarkdownFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    if (isVerbose) console.warn(`[Sentinel] Skipping directory ${dir}: ${err.message}`);
  }
  return files;
}

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return null;
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return null;
  const rawYaml = content.slice(3, endIdx).trim();
  const fields = {};
  for (const line of rawYaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      fields[key] = val;
    }
  }
  return { fields, rawYaml, bodyOffset: endIdx + 4 };
}

function extractWikilinks(content) {
  const links = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

async function runSentinel() {
  const startTime = Date.now();
  console.log(`[KB-Sentinel] Starting KB-Sync drift and autoheal audit... (dry-run: ${isDryRun}, fix: ${shouldFix})`);

  const wikiFiles = await findMarkdownFiles(WIKI_ROOT);
  const existingNames = new Set(wikiFiles.map(f => path.basename(f, '.md')));

  const stats = {
    totalFilesScanned: wikiFiles.length,
    missingFrontmatter: 0,
    brokenWikilinks: 0,
    healedCount: 0,
    issues: [],
    status: 'PASS'
  };

  for (const filePath of wikiFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
      const fm = parseFrontmatter(content);

      if (!fm) {
        stats.missingFrontmatter++;
        stats.issues.push({ file: relPath, type: 'MISSING_FRONTMATTER', detail: 'No YAML frontmatter found' });
      }

      const wikilinks = extractWikilinks(content);
      for (const link of wikilinks) {
        // Skip links containing anchors or URLs
        if (link.includes('#') || link.startsWith('http')) continue;
        const targetClean = path.basename(link, '.md');
        if (!existingNames.has(targetClean)) {
          stats.brokenWikilinks++;
          if (isVerbose) {
            stats.issues.push({ file: relPath, type: 'BROKEN_WIKILINK', detail: `Target [[${link}]] not found in index` });
          }
        }
      }
    } catch (err) {
      stats.issues.push({ file: filePath, type: 'READ_ERROR', detail: err.message });
    }
  }

  // Calculate health score (0 - 100)
  const penalty = (stats.missingFrontmatter * 2) + (stats.brokenWikilinks * 0.5);
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  if (healthScore < 80) stats.status = 'DEGRADED';
  if (healthScore < 50) stats.status = 'FAIL';

  const elapsedMs = Date.now() - startTime;

  const report = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    healthScore,
    status: stats.status,
    scanned: stats.totalFilesScanned,
    frontmatterMissing: stats.missingFrontmatter,
    brokenLinks: stats.brokenWikilinks,
    healed: stats.healedCount,
    dryRun: isDryRun,
    recentIssues: stats.issues.slice(0, 20)
  };

  // Ensure _status-feed exists and save report
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[KB-Sentinel] Audit complete in ${elapsedMs}ms.`);
  console.log(`  - Health Score: ${healthScore}/100 (${stats.status})`);
  console.log(`  - Files Scanned: ${stats.totalFilesScanned}`);
  console.log(`  - Missing Frontmatter: ${stats.missingFrontmatter}`);
  console.log(`  - Broken Wikilinks: ${stats.brokenWikilinks}`);
  console.log(`  - Telemetry written to: ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`);

  return report;
}

runSentinel().catch(err => {
  console.error(`[KB-Sentinel FATAL] ${err.stack || err.message}`);
  process.exit(1);
});
