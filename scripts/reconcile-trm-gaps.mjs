#!/usr/bin/env node
/**
 * scripts/reconcile-trm-gaps.mjs
 *
 * Scans canonical RFC notes in wiki/research/ for status: resolved,
 * reconciles gap statuses in daily_status.json (active_gaps & KPIs),
 * and updates markdown checkboxes in trm-research-gaps.md.
 */

import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const WIKI_RESEARCH_DIR = path.resolve(REPO_ROOT, 'wiki', 'research');
const DAILY_STATUS_FILES = [
  path.resolve(REPO_ROOT, 'icf', 'dashboard', 'daily_status.json'),
  path.resolve(REPO_ROOT, '_status-feed', 'daily_status.json'),
  path.resolve(REPO_ROOT, 'modules', 'wiki', 'daily_status.json')
].filter(p => existsSync(p));

const GAPS_REGISTRY_FILES = [
  path.resolve(REPO_ROOT, 'kb-sync', 'trm-research-gaps.md'),
  path.resolve(REPO_ROOT, 'trm-research-gaps.md')
].filter(p => existsSync(p));

async function main() {
  console.log('[TRM-Reconcile] Scanning wiki/research for resolved RFCs...');
  const rfcFiles = (await fs.readdir(WIKI_RESEARCH_DIR)).filter(f => f.startsWith('rfc-gap-') && f.endsWith('.md'));

  const resolvedRfcMap = new Map(); // gapId -> { file, title, relPath }

  for (const file of rfcFiles) {
    const fullPath = path.join(WIKI_RESEARCH_DIR, file);
    const content = await fs.readFile(fullPath, 'utf8');

    if (/status:\s*"?resolved"?/i.test(content)) {
      let gapId = null;
      const gapMatch = content.match(/gap_id:\s*"?([^"\r\n]+)"?/i);
      if (gapMatch) {
        gapId = gapMatch[1].trim();
      } else {
        const idMatch = file.match(/rfc-gap-(\d+)/i);
        if (idMatch) gapId = `GAP-${idMatch[1]}`;
      }

      let title = file;
      const titleMatch = content.match(/^title:\s*"?([^"\r\n]+)"?/im);
      if (titleMatch) title = titleMatch[1].trim();

      const relPath = `wiki/research/${file}`;
      if (gapId) {
        resolvedRfcMap.set(gapId, { file, title, relPath });
      }
    }
  }

  console.log(`[TRM-Reconcile] Discovered ${resolvedRfcMap.size} resolved RFCs:`);
  for (const [gapId, info] of resolvedRfcMap.entries()) {
    console.log(`  - ${gapId}: ${info.file} ("${info.title.substring(0, 50)}...")`);
  }

  // 1. Reconcile daily_status.json files
  for (const statusFilePath of DAILY_STATUS_FILES) {
    console.log(`[TRM-Reconcile] Updating status feed: ${path.relative(REPO_ROOT, statusFilePath)}`);
    const raw = await fs.readFile(statusFilePath, 'utf8');
    const data = JSON.parse(raw);

    if (data.trm_intelligence && Array.isArray(data.trm_intelligence.active_gaps)) {
      const gaps = data.trm_intelligence.active_gaps;
      let newlyResolved = 0;

      for (const gap of gaps) {
        // Match Willow Run gaps corresponding to the resolved RFCs
        const isWillowRun = (gap.target || '').includes('Willow Run Videos (non-obvious-connections');
        if (isWillowRun && resolvedRfcMap.has(gap.id)) {
          const rfcInfo = resolvedRfcMap.get(gap.id);
          gap.status = 'RESOLVED';
          gap.resolved = true;
          gap.triaged = true;
          gap.rfc_link = rfcInfo.relPath;
          newlyResolved++;
        }
      }

      const totalOpen = gaps.filter(g => !g.resolved && g.status !== 'RESOLVED' && !g.triaged && g.status !== 'TRIAGED').length;
      const totalResolved = gaps.filter(g => g.resolved || g.status === 'RESOLVED').length;
      const totalTriaged = gaps.filter(g => !g.resolved && g.status !== 'RESOLVED' && (g.triaged || g.status === 'TRIAGED')).length;

      data.trm_intelligence.matrix_gaps_open = totalOpen;
      data.trm_intelligence.matrix_gaps_triaged = totalTriaged;
      data.trm_intelligence.matrix_gaps_resolved = totalResolved;
      data.trm_intelligence.matrix_gaps_total = gaps.length;

      await fs.writeFile(statusFilePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[TRM-Reconcile] -> Updated ${newlyResolved} gaps in ${path.basename(statusFilePath)} (Open: ${totalOpen}, Triaged: ${totalTriaged}, Resolved: ${totalResolved})`);
    }
  }

  // 2. Reconcile Markdown registries (kb-sync/trm-research-gaps.md)
  for (const gapsFilePath of GAPS_REGISTRY_FILES) {
    console.log(`[TRM-Reconcile] Updating markdown registry: ${path.relative(REPO_ROOT, gapsFilePath)}`);
    let content = await fs.readFile(gapsFilePath, 'utf8');
    let updatedCount = 0;

    for (const [gapId, rfcInfo] of resolvedRfcMap.entries()) {
      // Find lines matching Willow Run Videos with this gap ID
      const pattern = new RegExp(`^- \\[\\/\\]\\s+\\[${gapId}\\]\\s+(\\*\\*Willow Run Videos \\(non-obvious-connections[^*]+\\*\\*:.*?)$`, 'gm');
      content = content.replace(pattern, (match, rest) => {
        updatedCount++;
        return `- [x] [${gapId}] ${rest} (Resolved: [RFC](${rfcInfo.relPath}))`;
      });
    }

    if (updatedCount > 0) {
      await fs.writeFile(gapsFilePath, content, 'utf8');
      console.log(`[TRM-Reconcile] -> Reconciled ${updatedCount} entries in ${path.basename(gapsFilePath)}`);
    }
  }

  console.log('[TRM-Reconcile] Reconciliation complete.');
}

main().catch(err => {
  console.error('[TRM-Reconcile FATAL]', err);
  process.exit(1);
});
