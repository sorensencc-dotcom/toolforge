#!/usr/bin/env node
/**
 * scripts/trm-bot-runner.mjs
 * 
 * Autonomous TRM Gap Triage & RFC Drafter Bot.
 * Scans research gap registry (kb-sync/trm-research-gaps.md), resolves topic citations,
 * routes gap complexity using Jev WhichLLM, drafts structured RFC decision notes,
 * and updates the wiki audit log.
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { routeTask } from './whichllm-router.mjs';
import { appendToWikiLogAsync } from './lib/wiki-log-append.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function resolveGapsFile() {
  const candidatePaths = [
    path.resolve(REPO_ROOT, 'trm-research-gaps.md'),
    path.resolve(REPO_ROOT, 'kb-sync', 'trm-research-gaps.md'),
    path.resolve(REPO_ROOT, '..', 'kb-sync', 'trm-research-gaps.md'),
    'C:\\dev\\kb-sync\\trm-research-gaps.md'
  ];
  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) return candidate;
  }
  return path.resolve(REPO_ROOT, 'trm-research-gaps.md');
}

const GAPS_FILE = resolveGapsFile();
const WIKI_RESEARCH_DIR = path.resolve(REPO_ROOT, 'wiki', 'research');
const REPORT_PATH = path.resolve(REPO_ROOT, '_status-feed', 'trm_bot_report.json');

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const limitArg = args.find(a => a.startsWith('--limit='));
const maxGapsToProcess = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function parseGaps(content) {
  const gaps = [];
  const lines = content.split('\n');
  const gapRegex = /^- \[( |\/|x)\]\s+\[(GAP-\d+)\]\s+\*\*([^*]+)\*\*:\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = gapRegex.exec(line);
    if (match) {
      const statusMark = match[1];
      const gapId = match[2];
      const title = match[3].trim();
      const details = match[4].trim();
      
      const isPending = statusMark === ' ';
      const isDrafted = statusMark === '/' || details.includes('(Drafted:');
      const isResolved = statusMark === 'x';

      gaps.push({
        lineIndex: i,
        gapId,
        title,
        details,
        statusMark,
        isPending,
        isDrafted,
        isResolved,
        rawLine: line
      });
    }
  }
  return gaps;
}

export function generateRfcContent(gap, routeInfo = null) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const tier = routeInfo?.tier || 'Tier 2 (Muscle)';
  const model = routeInfo?.targetModel || 'qwen2.5:7b';
  const confidence = routeInfo?.confidence !== undefined ? routeInfo.confidence.toFixed(2) : '1.00';

  return `---
title: "RFC: ${gap.gapId} - ${gap.title}"
category: "research"
status: "draft"
created_at: "${timestamp}"
assigned_tier: "${tier}"
routed_model: "${model}"
router_confidence: ${confidence}
tags:
  - trm-gap
  - rfc
  - historical-protocol
---

# RFC: ${gap.gapId} — ${gap.title}

## 1. Problem & Gap Description
${gap.details.replace(/\(Drafted:[^)]+\)/, '').trim()}

## 2. Archival & Technical Context
- **Topic Domain**: ${gap.title}
- **Source Accession**: Mined from TRM Registry (\`${gap.gapId}\`)
- **Assigned Resolution Tier**: \`${tier}\` (${model})
- **Verification Target**: Primary sources, internal ledgers, or historical cross-references.

## 3. Proposed Resolution Plan
1. Retrieve and index relevant accession documents or technical specifications.
2. Conduct deterministic cross-referencing against existing wiki nodes.
3. Validate claims against the citation matrix.
4. Synthesize final findings into a permanent knowledge-base entity.

## 4. References & Linked Topics
- [[Index]]
- [[trm-research-gaps]]
`;
}

export async function runTrmBot(options = {}) {
  const startTime = Date.now();
  const dryRun = options.isDryRun !== undefined ? options.isDryRun : isDryRun;
  const limit = options.limit !== undefined ? options.limit : maxGapsToProcess;

  console.log(`[TRM-Bot] Starting TRM Gap Triage & RFC Drafter... (dry-run: ${dryRun}, max: ${limit})`);

  let gapsContent = '';
  try {
    gapsContent = await fs.readFile(GAPS_FILE, 'utf8');
  } catch (err) {
    console.error(`[TRM-Bot] Could not read ${GAPS_FILE}: ${err.message}`);
    process.exit(1);
  }

  const allGaps = parseGaps(gapsContent);
  const pendingGaps = allGaps.filter(g => g.isPending);
  const draftedGaps = allGaps.filter(g => g.isDrafted);
  const resolvedGaps = allGaps.filter(g => g.isResolved);

  console.log(`[TRM-Bot] Registry Status: ${allGaps.length} total gaps (${pendingGaps.length} pending, ${draftedGaps.length} drafted, ${resolvedGaps.length} resolved).`);

  const toProcess = pendingGaps.slice(0, limit);
  const generatedRfcs = [];
  let tier1Count = 0;
  let tier2Count = 0;
  let totalRoutingMs = 0;

  await fs.mkdir(WIKI_RESEARCH_DIR, { recursive: true });

  for (const gap of toProcess) {
    const slug = slugify(gap.title);
    const filename = `rfc-${gap.gapId.toLowerCase()}-${slug}.md`;
    const rfcPath = path.join(WIKI_RESEARCH_DIR, filename);
    const rfcRelPath = path.relative(REPO_ROOT, rfcPath).replace(/\\/g, '/');

    // Route gap through WhichLLM to establish model resolution tier
    const routeInfo = await routeTask(`${gap.title}: ${gap.details}`);
    totalRoutingMs += routeInfo.latencyMs || 0;
    if (routeInfo.tier.includes('Tier 1')) {
      tier1Count++;
    } else {
      tier2Count++;
    }

    console.log(`  -> Processing [${gap.gapId}] -> ${filename} [Route: ${routeInfo.tier} -> ${routeInfo.targetModel}]`);

    if (!dryRun) {
      const content = generateRfcContent(gap, routeInfo);
      await fs.writeFile(rfcPath, content, 'utf8');
      generatedRfcs.push({
        gapId: gap.gapId,
        file: rfcRelPath,
        filename,
        assignedTier: routeInfo.tier,
        targetModel: routeInfo.targetModel,
        confidence: routeInfo.confidence
      });
    } else {
      generatedRfcs.push({
        gapId: gap.gapId,
        file: rfcRelPath,
        filename,
        assignedTier: routeInfo.tier,
        targetModel: routeInfo.targetModel,
        confidence: routeInfo.confidence,
        dryRun: true
      });
    }
  }

  // Update registry status and audit log if changes were made
  if (!dryRun && generatedRfcs.length > 0) {
    let updatedGapsContent = gapsContent;
    for (const rfc of generatedRfcs) {
      const targetPattern = new RegExp(`^- \\[ \\]\\s+\\[${rfc.gapId}\\](.*)$`, 'm');
      updatedGapsContent = updatedGapsContent.replace(targetPattern, (match, rest) => {
        return `- [/] [${rfc.gapId}]${rest} (Drafted: \`${rfc.file}\`)`;
      });
    }

    try {
      await fs.writeFile(GAPS_FILE, updatedGapsContent, 'utf8');
      console.log(`[TRM-Bot] Updated ${generatedRfcs.length} gap statuses in ${path.relative(REPO_ROOT, GAPS_FILE)}`);
    } catch (err) {
      console.warn(`[TRM-Bot] Could not update ${GAPS_FILE}: ${err.message}`);
    }

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 16);
    const logEntry = `\n## [${dateStr}] trm-bot-gap-triage\n\n- Provider: \`trm-bot-runner\` (\`v1.0.0\`)\n- Gaps Triaged: ${generatedRfcs.length}\n- Created RFC Decision Notes:\n` +
      generatedRfcs.map(r => `  - \`${r.file}\` (${r.gapId} -> ${r.assignedTier})`).join('\n') + '\n';

    try {
      await appendToWikiLogAsync(REPO_ROOT, logEntry);
      console.log(`[TRM-Bot] Appended ${generatedRfcs.length} RFC entries to wiki/Log.md`);
    } catch (err) {
      console.warn(`[TRM-Bot] Could not update wiki/Log.md: ${err.message}`);
    }
  }

  const elapsedMs = Date.now() - startTime;
  const avgRoutingLatencyMs = toProcess.length > 0 ? parseFloat((totalRoutingMs / toProcess.length).toFixed(1)) : 0;

  const report = {
    timestamp: new Date().toISOString(),
    elapsedMs,
    totalGaps: allGaps.length,
    pending: pendingGaps.length,
    drafted: draftedGaps.length,
    resolved: resolvedGaps.length,
    triagedCount: generatedRfcs.length,
    routing: {
      tier1Count,
      tier2Count,
      avgRoutingLatencyMs
    },
    generatedRfcs,
    dryRun
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[TRM-Bot] Execution complete in ${elapsedMs}ms.`);
  console.log(`  - Telemetry written to: ${path.relative(REPO_ROOT, REPORT_PATH).replace(/\\/g, '/')}`);

  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runTrmBot().catch(err => {
    console.error(`[TRM-Bot FATAL] ${err.stack || err.message}`);
    process.exit(1);
  });
}
