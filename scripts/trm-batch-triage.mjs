#!/usr/bin/env node

/**
 * trm-batch-triage.mjs
 *
 * High-throughput Batch Triage Engine for the Mobile Inbox to PR Triage pipeline.
 * Processes 25+ action cards stranded in .harness/tasks/pending/ or trm-drive/inbox/ledger.jsonl.
 *
 * Dual-Lane Execution:
 *   Lane A (Autonomous Research Spike):
 *     - Evaluates cards with category RESEARCH, EVALUATE (feasibility spike), or cic-kb
 *     - Generates RFC decision notes in kb-sync/obsidian/vault/wiki/research/
 *     - Emits outbox completion receipts (receipt-<id>-completed.json)
 *     - Transitions ledger to DONE and moves card to .harness/tasks/completed/
 *
 *   Lane B (Pre-Coding GitHub Issue Promotion & Context Pack):
 *     - Evaluates cards with category IMPLEMENT, direction REFACTOR/FEATURE/FIX/NEW_IMPLEMENTATION
 *     - Resolves deterministic target repository
 *     - Creates GitHub Issue with formatted traceability
 *     - Spawns trm-post-promote-enricher.mjs out-of-band (Graft AST, RRF prior art, host probes, Ollama 3-tier scoring)
 *     - Transitions ledger to IN_PROGRESS / PROMOTED
 *     - Calls trm-stage-pr.mjs to scaffold trm/<cardId> branch and test harness
 *
 * Options:
 *   --dry-run             Preview actions without mutating issues, git, or files
 *   --lane=<spikes|coding|all>  Process only spikes, only coding promotions, or all (default: all)
 *   --limit=<N>           Limit number of cards processed (default: all)
 *   --target=<domain>     Filter by target repository (e.g. toolforge, rewrite-mcp, sigil)
 *   --stage-pr            Also scaffold test file and PR bridge for coding cards
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEV_ROOT = path.resolve(__dirname, '..');

// Helper to normalize card metadata from raw content
export function normalizeCard(cardData, rawContent = '') {
  const content = rawContent || cardData.raw_content || cardData.body || cardData.context?.body || '';
  const item = { ...cardData };

  if (content) {
    const catM = content.match(/category:\s*([A-Za-z_-]+)/i);
    if (catM) {
      const cat = catM[1].toUpperCase();
      if (['IMPLEMENT', 'FEATURE', 'REFACTOR', 'EVALUATE', 'RESEARCH', 'MONITOR'].includes(cat)) {
        item.category = (cat === 'REFACTOR' || cat === 'FEATURE') ? 'IMPLEMENT' : cat;
      }
    }

    const dirM = content.match(/direction:\s*([A-Za-z_-]+)/i);
    if (dirM) item.direction = dirM[1].toUpperCase();

    const tgtM = content.match(/target:\s*([A-Za-z0-9_-]+)/i);
    if (tgtM && (!item.target || item.target === 'toolforge')) {
      item.target = tgtM[1].toLowerCase();
    }

    const prioM = content.match(/priority:\s*([A-Za-z0-9_-]+)/i);
    if (prioM) item.priority = prioM[1].toUpperCase();

    const titleM = content.match(/title:\s*([^\r\n]+)/i);
    if (titleM) {
      let t = titleM[1].split(/\r?\n/)[0].trim();
      const cutIdx = t.search(/\s+(created:|folder_id:|status:|priority:|target:|category:)/i);
      if (cutIdx > 0) t = t.slice(0, cutIdx).trim();
      item.title = t;
    }

    if (typeof item.title === 'string') {
      item.title = item.title.replace(/\\r\\n|\\r|\\n/g, '\n').split('\n')[0].trim();
    }

    const dirObjM = content.match(/Directive & Objective\s*\n+([^\n#]+)/i);
    if (dirObjM) item.summary = dirObjM[1].trim();
  }

  return item;
}

export function classifyCardLane(card) {
  const category = String(card.category || '').toUpperCase();
  const direction = String(card.direction || '').toUpperCase();
  const target = String(card.target || card.domain || '').toLowerCase();

  const isCodeDirection = direction.includes('REFACTOR') ||
                          direction.includes('IMPLEMENT') ||
                          direction.includes('FIX') ||
                          direction.includes('FEATURE') ||
                          direction.includes('NEW_IMPLEMENTATION');

  if (category === 'IMPLEMENT' || isCodeDirection) {
    return 'LANE_B_CODING';
  }

  if (category === 'RESEARCH' || target === 'cic-kb' || target === 'research' || direction === 'FEASIBILITY_SPIKE') {
    return 'LANE_A_SPIKE';
  }

  if (category === 'EVALUATE') {
    return isCodeDirection ? 'LANE_B_CODING' : 'LANE_A_SPIKE';
  }

  return 'LANE_A_SPIKE';
}

export function getPendingCards(options = {}) {
  const pendingDir = path.resolve(DEV_ROOT, '.harness/tasks/pending');
  const ledgerPath = path.resolve(DEV_ROOT, 'trm-drive/inbox/ledger.jsonl');

  const cardsMap = new Map();

  // 1. Scan .harness/tasks/pending
  if (fs.existsSync(pendingDir)) {
    const files = fs.readdirSync(pendingDir);
    for (const file of files) {
      try {
        const fullPath = path.join(pendingDir, file);
        const raw = fs.readFileSync(fullPath, 'utf8');
        let data = {};
        if (file.endsWith('.json') || raw.trim().startsWith('{')) {
          data = JSON.parse(raw);
        } else if (file.endsWith('.md') || raw.includes('---')) {
          const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (match) {
            for (const line of match[1].split(/\r?\n/)) {
              const idx = line.indexOf(':');
              if (idx > 0) data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
            }
            data.body = raw.slice(match[0].length).trim();
          }
        }
        data._filePath = fullPath;
        data._fileName = file;
        const normalized = normalizeCard(data, raw);
        const cardId = normalized.id || normalized.action_id || file.replace(/\.(json|md|gdoc)$/i, '');
        normalized.id = cardId;
        cardsMap.set(cardId, normalized);
      } catch (err) {
        // Skip unparseable
      }
    }
  }

  // 2. Scan ledger.jsonl for open rows
  if (fs.existsSync(ledgerPath)) {
    const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        const id = row.id || row.action_id;
        if (!id) continue;
        const status = String(row.status || '').toUpperCase();
        const isOpen = !['DONE', 'COMPLETED', 'ARCHIVED', 'REJECTED', 'IN_PROGRESS', 'PROMOTED', 'QUARANTINED', 'QUARANTINED_INSUFFICIENT_DATA'].includes(status) && !row.issue_url;
        if (isOpen) {
          if (cardsMap.has(id)) {
            const existing = cardsMap.get(id);
            cardsMap.set(id, { ...row, ...existing });
          } else {
            cardsMap.set(id, normalizeCard(row));
          }
        } else {
          // If already DONE/COMPLETED in ledger, remove from pending batch
          cardsMap.delete(id);
        }
      } catch {}
    }
  }

  let cards = Array.from(cardsMap.values());

  // Filter by target if requested
  if (options.target) {
    const t = options.target.toLowerCase();
    cards = cards.filter(c => (c.target || c.domain || '').toLowerCase().includes(t));
  }

  // Filter by lane if requested
  if (options.lane === 'spikes') {
    cards = cards.filter(c => classifyCardLane(c) === 'LANE_A_SPIKE');
  } else if (options.lane === 'coding') {
    cards = cards.filter(c => classifyCardLane(c) === 'LANE_B_CODING');
  }

  if (options.limit && options.limit > 0) {
    cards = cards.slice(0, options.limit);
  }

  return cards;
}

export async function processBatchTriage(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const stagePrOption = Boolean(options.stagePr);
  const cards = getPendingCards(options);

  console.log(`[batch-triage] Discovered ${cards.length} pending cards (Dry-Run: ${dryRun})`);

  const results = {
    total: cards.length,
    spikesExecuted: 0,
    codingPromoted: 0,
    prStaged: 0,
    errors: [],
    details: []
  };

  const kbSyncRoot = path.resolve(DEV_ROOT, 'kb-sync');
  const trmInboxDir = path.resolve(DEV_ROOT, 'trm-drive/inbox');
  const outputDir = path.resolve(kbSyncRoot, 'obsidian/vault/wiki/research');
  const outboxDir = path.resolve(trmInboxDir, 'outbox');
  const completedHarnessDir = path.resolve(DEV_ROOT, '.harness/tasks/completed');
  const inProgressHarnessDir = path.resolve(DEV_ROOT, '.harness/tasks/in-progress');
  const quarantineDir = path.resolve(trmInboxDir, 'quarantine');

  // Load gap-triage-engine for Lane A
  const gapEngineUrl = pathToFileURL(path.resolve(kbSyncRoot, 'modules/trm/gap-triage-engine.mjs')).href;
  const { evaluateActionCard } = await import(gapEngineUrl);

  // Load promote helper for Lane B
  const promoteScriptUrl = pathToFileURL(path.resolve(DEV_ROOT, 'scripts/trm-promote-card.mjs')).href;
  const { resolveTargetRepo, commitTypeForCard, formatIssueBody, updateLedgerRow } = await import(promoteScriptUrl);

  // Load stage-pr helper
  const stagePrUrl = pathToFileURL(path.resolve(DEV_ROOT, 'scripts/trm-stage-pr.mjs')).href;
  const { stagePr } = await import(stagePrUrl);

  for (const card of cards) {
    const cardId = card.id || card.action_id;
    const lane = classifyCardLane(card);
    const itemResult = { cardId, lane, title: card.title || card.intent, target: card.target, status: 'SKIPPED' };

    // Universal Quality Gate (both Lane A Spikes & Lane B Coding)
    const rawText = card.raw_content || card.summary || card.body || '';
    const isBodyFetchFailure = Boolean(
      card.context?.body_fetch_failed ||
      (card.context?.note && /fetch failed|standalone Google Drive \.gdoc/i.test(card.context.note)) ||
      card.title === 'Unknown Title' ||
      card.intent === 'triage_mobile_request' ||
      (rawText.replace(/\s+/g, ' ').trim().length < 50 && !card.context?.body)
    );
    if (isBodyFetchFailure) {
      console.warn(`[batch-triage] Incomplete card ${cardId}: body fetch failed or content missing (<50 chars).`);
      itemResult.status = 'QUARANTINED_INSUFFICIENT_DATA';
      itemResult.error = 'Incomplete card (body fetch failure or missing directives)';
      if (!dryRun) {
        if (card._filePath && fs.existsSync(card._filePath)) {
          if (!fs.existsSync(quarantineDir)) fs.mkdirSync(quarantineDir, { recursive: true });
          const destPath = path.join(quarantineDir, card._fileName || path.basename(card._filePath));
          try {
            fs.renameSync(card._filePath, destPath);
          } catch {
            try { fs.copyFileSync(card._filePath, destPath); fs.unlinkSync(card._filePath); } catch {}
          }
        }
        const ledgerPath = path.resolve(trmInboxDir, 'ledger.jsonl');
        if (fs.existsSync(ledgerPath)) {
          updateLedgerRow(ledgerPath, cardId, {
            status: 'QUARANTINED_INSUFFICIENT_DATA',
            error: itemResult.error,
            quarantined_at: new Date().toISOString()
          });
        }
      }
      results.details.push(itemResult);
      continue;
    }

    try {
      if (lane === 'LANE_A_SPIKE') {
        console.log(`[batch-triage] Lane A: Running Autonomous Spike for ${cardId}...`);
        const spike = await evaluateActionCard(card, {
          outputDir,
          outboxDir,
          writeReceipt: true,
          dryRun
        });

        if (!dryRun) {
          // Move harness pending task to completed
          if (card._filePath && fs.existsSync(card._filePath)) {
            if (!fs.existsSync(completedHarnessDir)) fs.mkdirSync(completedHarnessDir, { recursive: true });
            const destPath = path.join(completedHarnessDir, card._fileName || path.basename(card._filePath));
            try {
              fs.renameSync(card._filePath, destPath);
            } catch {
              try { fs.copyFileSync(card._filePath, destPath); fs.unlinkSync(card._filePath); } catch {}
            }
          }

          // Update ledger to DONE
          const ledgerPath = path.resolve(trmInboxDir, 'ledger.jsonl');
          if (fs.existsSync(ledgerPath)) {
            const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
            let found = false;
            const updated = lines.map(line => {
              try {
                const row = JSON.parse(line);
                if (row.id === cardId || row.action_id === cardId) {
                  found = true;
                  return JSON.stringify({
                    ...row,
                    status: 'DONE',
                    completed_at: new Date().toISOString(),
                    research_ref: spike.rfcPath
                  });
                }
                return line;
              } catch {
                return line;
              }
            });
            if (found) {
              fs.writeFileSync(ledgerPath, updated.join('\n') + '\n', 'utf8');
            }
          }
        }

        results.spikesExecuted++;
        itemResult.status = 'DONE';
        itemResult.rfcPath = spike.rfcPath;
        itemResult.receiptPath = spike.receiptPath;
      } else {
        // Lane B: Coding Card Promotion & Context Pack
        const repo = resolveTargetRepo(card.target || card.domain);
        if (!repo) {
          console.warn(`[batch-triage] Skipping promotion for ${cardId}: unmapped target '${card.target || card.domain}' needs explicit routing.`);
          itemResult.status = 'NEEDS_ROUTING';
          itemResult.error = `Unroutable target '${card.target || card.domain}'`;
          results.details.push(itemResult);
          continue;
        }

        console.log(`[batch-triage] Lane B: Promoting coding card ${cardId} to ${repo}...`);

        let issueUrl = card.issue_url || null;
        if (!issueUrl) {
          if (dryRun) {
            issueUrl = `https://github.com/${repo}/issues/mock-batch-${Date.now()}`;
          } else {
            const tmpDir = path.resolve(os.homedir(), '.tmp');
            fs.mkdirSync(tmpDir, { recursive: true });
            const tmpFile = path.join(tmpDir, `trm-batch-${cardId}-${Date.now()}.md`);
            const commitType = commitTypeForCard(card);
            const intent = card.intent || card.title || cardId;
            const title = `${commitType}(${card.target || card.domain || 'core'}): ${intent}`;
            const bodyText = formatIssueBody(card, { body: card.raw_content || card.summary || '' });
            fs.writeFileSync(tmpFile, bodyText, 'utf8');
            try {
              try {
                const out = execFileSync('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body-file', tmpFile, '--label', 'enhancement'], { encoding: 'utf8', timeout: 30000 });
                issueUrl = out.trim().split(/\r?\n/).pop();
              } catch {
                const out = execFileSync('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body-file', tmpFile], { encoding: 'utf8', timeout: 30000 });
                issueUrl = out.trim().split(/\r?\n/).pop();
              }
            } catch (ghErr) {
              console.error(`[batch-triage] gh issue create failed for ${cardId}: ${ghErr.message}`);
              itemResult.status = 'ERROR';
              itemResult.error = `gh issue create failed: ${ghErr.message}`;
              results.errors.push({ cardId, error: ghErr.message });
              results.details.push(itemResult);
              continue;
            } finally {
              try { fs.unlinkSync(tmpFile); } catch {}
            }

            if (!issueUrl || !issueUrl.startsWith('http')) {
              console.error(`[batch-triage] Invalid issue URL received for ${cardId}: ${issueUrl}`);
              itemResult.status = 'ERROR';
              itemResult.error = `Invalid issue URL: ${issueUrl}`;
              results.errors.push({ cardId, error: itemResult.error });
              results.details.push(itemResult);
              continue;
            }

            // Update ledger with issue_url and IN_PROGRESS
            const ledgerPath = path.resolve(trmInboxDir, 'ledger.jsonl');
            if (fs.existsSync(ledgerPath)) {
              updateLedgerRow(ledgerPath, cardId, {
                status: 'IN_PROGRESS',
                issue_url: issueUrl,
                promoted_at: new Date().toISOString()
              });
            }
          }
        }

        // Spawn enricher out-of-band
        if (!dryRun) {
          const enricherScript = path.resolve(DEV_ROOT, 'scripts/trm-post-promote-enricher.mjs');
          if (fs.existsSync(enricherScript)) {
            spawn(process.execPath, [enricherScript, `--card-id=${cardId}`, `--issue-url=${issueUrl}`], {
              detached: true,
              stdio: 'ignore'
            }).unref();
            console.log(`[batch-triage] Dispatched trm-post-promote-enricher for ${cardId}`);
          }

          if (card._filePath && fs.existsSync(card._filePath)) {
            if (!fs.existsSync(inProgressHarnessDir)) fs.mkdirSync(inProgressHarnessDir, { recursive: true });
            const destPath = path.join(inProgressHarnessDir, card._fileName || path.basename(card._filePath));
            try {
              fs.renameSync(card._filePath, destPath);
            } catch {
              try { fs.copyFileSync(card._filePath, destPath); fs.unlinkSync(card._filePath); } catch {}
            }
          }
        }

        results.codingPromoted++;
        itemResult.status = 'PROMOTED';
        itemResult.issueUrl = issueUrl;

        // Stage PR if requested
        if (stagePrOption) {
          try {
            const staged = stagePr(cardId, { createBranch: false, dryRun });
            results.prStaged++;
            itemResult.prBranch = staged.branchName;
            itemResult.testScaffold = staged.testFilePath;
          } catch (stErr) {
            console.warn(`[batch-triage] PR staging failed for ${cardId}: ${stErr.message}`);
          }
        }
      }
    } catch (cardErr) {
      console.error(`[batch-triage] Failed to process ${cardId}:`, cardErr.message);
      itemResult.status = 'ERROR';
      itemResult.error = cardErr.message;
      results.errors.push({ cardId, error: cardErr.message });
    }

    results.details.push(itemResult);
  }

  console.log(`[batch-triage] Batch complete: ${results.spikesExecuted} spikes executed, ${results.codingPromoted} coding promoted, ${results.errors.length} errors.`);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    lane: 'all',
    limit: null,
    target: null,
    stagePr: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--stage-pr') options.stagePr = true;
    else if (arg.startsWith('--lane=')) options.lane = arg.slice('--lane='.length);
    else if (arg.startsWith('--limit=')) options.limit = parseInt(arg.slice('--limit='.length), 10);
    else if (arg.startsWith('--target=')) options.target = arg.slice('--target='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/trm-batch-triage.mjs [options]

Options:
  --dry-run             Preview actions without mutating disk or GitHub
  --lane=<spikes|coding|all>  Process only spikes, only coding promotions, or all (default: all)
  --limit=<N>           Limit number of cards processed (default: all)
  --target=<domain>     Filter by target repository (e.g. toolforge, rewrite-mcp, sigil)
  --stage-pr            Scaffold test file and PR bridge for coding cards
      `);
      process.exit(0);
    }
  }

  const results = await processBatchTriage(options);
  console.log(JSON.stringify(results, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(err => {
    console.error('[batch-triage] Fatal execution error:', err);
    process.exit(1);
  });
}
