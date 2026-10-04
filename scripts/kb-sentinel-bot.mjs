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
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '_kb-sync-staging' && !entry.name.startsWith('.')) {
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

const ALLOWED_CATEGORIES = new Set([
  'daemons', 'utilities', 'sync-tools', 'adapters', 'mcp-servers',
  'scaffolds', 'prototypes', 'wiki', 'research', 'lessons', 'reporting'
]);
const ALLOWED_STATUSES = new Set(['active', 'beta', 'archived', 'draft', 'proposed', 'resolved', 'canonical']);

function extractWikilinks(content) {
  // Strip code blocks and inline code in single pass to avoid intermediate string allocations
  const sanitized = content.replace(/```[\s\S]*?```|`[^`\r\n]+`/g, '');
  const links = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(sanitized)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

function synthesizeFrontmatter(filePath, rawContent) {
  const base = path.basename(filePath, '.md');
  const title = base.replace(/[-_]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const now = new Date().toISOString().slice(0, 10);
  const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  const isResearch = rel.includes('research/');
  const category = isResearch ? 'research' : 'wiki';

  return `---
title: "${title}"
category: "${category}"
status: "active"
created_at: "${now}"
tags:
  - auto-healed
  - ${category}
---

${rawContent.trimStart()}`;
}

function sanitizeExistingFrontmatter(filePath, content, fm) {
  const base = path.basename(filePath, '.md');
  const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  const isResearch = rel.includes('research/');
  const defaultCategory = isResearch ? 'research' : 'wiki';

  let rawYaml = fm.rawYaml;
  let changed = false;

  const currentCategory = (fm.fields.category || '').toLowerCase();
  if (!currentCategory || !ALLOWED_CATEGORIES.has(currentCategory)) {
    if (rawYaml.includes('category:')) {
      rawYaml = rawYaml.replace(/category:\s*["']?[^"'\r\n]+["']?/i, `category: "${defaultCategory}"`);
    } else {
      rawYaml += `\ncategory: "${defaultCategory}"`;
    }
    changed = true;
  }

  const currentStatus = (fm.fields.status || '').toLowerCase();
  if (!currentStatus || !ALLOWED_STATUSES.has(currentStatus)) {
    if (rawYaml.includes('status:')) {
      rawYaml = rawYaml.replace(/status:\s*["']?[^"'\r\n]+["']?/i, `status: "active"`);
    } else {
      rawYaml += `\nstatus: "active"`;
    }
    changed = true;
  }

  if (changed) {
    const body = content.slice(fm.bodyOffset);
    return `---\n${rawYaml}\n---\n${body.trimStart()}`;
  }
  return null;
}

async function runSentinel() {
  const startTime = Date.now();
  console.log(`[KB-Sentinel] Starting KB-Sync drift and autoheal audit... (dry-run: ${isDryRun}, fix: ${shouldFix})`);

  const wikiFiles = await findMarkdownFiles(WIKI_ROOT);
  const rootFiles = [];
  try {
    const rootEntries = await fs.readdir(REPO_ROOT, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        rootFiles.push(entry.name);
      }
    }
  } catch {}
  
  // Dynamically collect target names from docs/ and subprojects so cross-doc wikilinks resolve cleanly
  const extraDocFiles = [];
  try {
    const topEntries = await fs.readdir(REPO_ROOT, { withFileTypes: true });
    for (const ent of topEntries) {
      if (!ent.isDirectory() || ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === '_kb-sync-staging') continue;
      if (ent.name === 'docs') {
        extraDocFiles.push(...await findMarkdownFiles(path.join(REPO_ROOT, 'docs')));
      } else if (ent.name !== 'wiki') {
        extraDocFiles.push(...await findMarkdownFiles(path.join(REPO_ROOT, ent.name, 'docs')));
        extraDocFiles.push(...await findMarkdownFiles(path.join(REPO_ROOT, ent.name, 'wiki')));
      }
    }
  } catch {}

  const existingNames = new Set([
    ...wikiFiles.map(f => path.basename(f, '.md')),
    ...rootFiles.map(f => path.basename(f, '.md')),
    ...extraDocFiles.map(f => path.basename(f, '.md'))
  ]);

  const stats = {
    totalFilesScanned: wikiFiles.length,
    missingFrontmatter: 0,
    invalidSchema: 0,
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

        if (shouldFix) {
          if (!isDryRun) {
            const healedContent = synthesizeFrontmatter(filePath, content);
            await fs.writeFile(filePath, healedContent, 'utf8');
          }
          stats.healedCount++;
          if (isVerbose) console.log(`  [Autoheal] Frontmatter generated for ${relPath}`);
        }
      } else {
        const cat = (fm.fields.category || '').toLowerCase();
        const stat = (fm.fields.status || '').toLowerCase();
        const isCatInvalid = !cat || !ALLOWED_CATEGORIES.has(cat);
        const isStatInvalid = !stat || !ALLOWED_STATUSES.has(stat);

        if (isCatInvalid || isStatInvalid) {
          stats.invalidSchema++;
          stats.issues.push({
            file: relPath,
            type: 'INVALID_SCHEMA',
            detail: `Invalid category '${cat}' or status '${stat}'`
          });

          if (shouldFix) {
            const healed = sanitizeExistingFrontmatter(filePath, content, fm);
            if (healed) {
              if (!isDryRun) {
                await fs.writeFile(filePath, healed, 'utf8');
              }
              stats.healedCount++;
              if (isVerbose) console.log(`  [Autoheal] Standardized schema for ${relPath}`);
            }
          }
        }
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

export {
  extractWikilinks,
  parseFrontmatter,
  synthesizeFrontmatter,
  runSentinel
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  runSentinel().catch(err => {
    console.error(`[KB-Sentinel FATAL] ${err.stack || err.message}`);
    process.exit(1);
  });
}
