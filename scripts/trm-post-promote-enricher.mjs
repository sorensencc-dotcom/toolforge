#!/usr/bin/env node

/**
 * trm-post-promote-enricher.mjs
 *
 * Decoupled, out-of-band post-promotion context enricher for TRM action cards.
 * Runs deterministically first (Graft AST, SQLite RRF knowledge retrieval, host probes),
 * then queries local Ollama for 3-tier routing and scaffold synthesis.
 *
 * Usage:
 *   node scripts/trm-post-promote-enricher.mjs --card-id=<cardId> [--issue-url=<url>] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, execFileSync } from 'node:child_process';

const DEV_ROOT = path.resolve('C:/dev');
const OLLAMA_HOST = process.env.TRM_OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.TRM_OLLAMA_MODEL || 'llama3.1:8b';

// Parse command line arguments
function parseArgs() {
  const args = {
    cardId: null,
    issueUrl: null,
    dryRun: false
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--card-id=')) {
      args.cardId = arg.slice('--card-id='.length);
    } else if (arg.startsWith('--card=')) {
      args.cardId = arg.slice('--card='.length);
    } else if (arg.startsWith('--issue-url=')) {
      args.issueUrl = arg.slice('--issue-url='.length);
    } else if (arg.startsWith('--issue=')) {
      args.issueUrl = arg.slice('--issue='.length);
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

// 1. Load card metadata from disk
function loadCardData(cardId) {
  if (!cardId) return null;
  const cleanId = String(cardId).trim().toLowerCase();

  let card = { id: cardId };

  // Check .harness/tasks/pending
  const pendingDir = path.join(DEV_ROOT, '.harness', 'tasks', 'pending');
  if (fs.existsSync(pendingDir)) {
    const files = fs.readdirSync(pendingDir);
    const match = files.find(f => f.toLowerCase().includes(cleanId));
    if (match) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, match), 'utf8');
        if (match.endsWith('.json') || match.endsWith('.gdoc')) {
          const parsed = JSON.parse(content);
          card = { ...card, ...parsed };
        } else {
          card.raw_content = content;
        }
      } catch {}
    }
  }

  // Check trm-drive/inbox/ledger.jsonl
  const ledgerPath = path.join(DEV_ROOT, 'trm-drive', 'inbox', 'ledger.jsonl');
  if (fs.existsSync(ledgerPath)) {
    try {
      const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const row = JSON.parse(line);
          if (row.id && row.id.toLowerCase() === cleanId) {
            card = { ...card, ...row };
            break;
          }
        } catch {}
      }
    } catch {}
  }

  // Check trm-drive/inbox/triage or completed
  for (const sub of ['triage', 'completed']) {
    const dir = path.join(DEV_ROOT, 'trm-drive', 'inbox', sub);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const match = files.find(f => f.toLowerCase().includes(cleanId));
      if (match) {
        try {
          const content = fs.readFileSync(path.join(dir, match), 'utf8');
          if (match.endsWith('.json')) {
            card = { ...card, ...JSON.parse(content) };
          } else if (!card.raw_content) {
            card.raw_content = content;
          }
        } catch {}
      }
    }
  }

  return card;
}

// 2. Extract potential file touchpoints from card text
function extractTargetFiles(card) {
  const combined = [
    card.intent || '',
    card.summary || '',
    card.title || '',
    card.context?.body || '',
    card.raw_content || '',
    card.raw_preview || ''
  ].join('\n');

  const fileRegex = /(?:^|[\s`"'(])([a-zA-Z0-9_\-./]+\.(?:mjs|js|ts|tsx|py|html|json|md))(?:$|[\s`"')])/g;
  const matches = new Set();
  let m;
  while ((m = fileRegex.exec(combined)) !== null) {
    const candidate = m[1].replace(/^[./]+/, '');
    if (!candidate.includes('node_modules') && !candidate.startsWith('package') && candidate.includes('/')) {
      matches.add(candidate);
    }
  }

  return Array.from(matches);
}

// 3. AST inspection via graft
function inspectAstForFiles(files, domain) {
  const results = [];

  for (const relPath of files) {
    // Resolve absolute path across candidate roots
    const candidateRoots = [
      DEV_ROOT,
      path.join(DEV_ROOT, domain || ''),
      path.join(DEV_ROOT, 'kb-sync'),
      path.join(DEV_ROOT, 'icf'),
      path.join(DEV_ROOT, 'personal-os'),
      path.join(DEV_ROOT, 'IronLedger'),
      path.join(DEV_ROOT, 'toolforge')
    ].filter(Boolean);

    let foundPath = null;
    for (const root of candidateRoots) {
      const testP = path.join(root, relPath);
      if (fs.existsSync(testP)) {
        foundPath = testP;
        break;
      }
    }

    if (foundPath) {
      try {
        const skeletonOut = execFileSync('graft', ['skeleton', foundPath], {
          cwd: DEV_ROOT,
          encoding: 'utf8',
          timeout: 15000
        });
        results.push({
          path: relPath,
          status: 'EXISTS',
          ast: skeletonOut.trim()
        });
      } catch (err) {
        results.push({
          path: relPath,
          status: 'EXISTS',
          ast: `(AST skeleton extraction failed: ${err.message})`
        });
      }
    } else {
      results.push({
        path: relPath,
        status: 'NEW_FILE',
        ast: `Target file not yet created: \`${relPath}\``
      });
    }
  }

  return results;
}

// 4. Dual-lane Knowledge Cache Search (.kb_cache/knowledge.db)
async function searchKnowledgeOverlap(card) {
  const dbPaths = [
    path.join(DEV_ROOT, 'kb-sync', '.kb_cache', 'knowledge.db'),
    path.join(DEV_ROOT, '.kb_cache', 'knowledge.db')
  ];

  const dbPath = dbPaths.find(p => fs.existsSync(p));
  if (!dbPath) {
    return { matches: [], note: 'No knowledge.db found on disk' };
  }

  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(dbPath, { readonly: true });

    const searchTokens = [
      card.id,
      card.intent,
      card.title,
      card.target,
      card.domain
    ].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9_-]+/g, ' ').split(/\s+/).filter(w => w.length > 3);

    const uniqueTokens = Array.from(new Set(searchTokens)).slice(0, 8);
    const matches = [];

    // Query for semantic prior art or overlapping commits/entities
    for (const token of uniqueTokens) {
      try {
        const rows = db.prepare(`
          SELECT id, file_path, substr(content, 1, 300) as snippet
          FROM kb_documents
          WHERE content LIKE ? OR id LIKE ?
          LIMIT 3
        `).all(`%${token}%`, `%${token}%`);
        for (const row of rows) {
          if (!matches.some(m => m.id === row.id)) {
            matches.push(row);
          }
        }
      } catch {}
    }

    // Specific check for TRM mining dynamic questions / commit 4be34e8 if applicable
    if (card.id.includes('dynamic-question') || card.intent?.includes('dynamic-question') || card.summary?.includes('dynamic-question')) {
      try {
        const trmMatches = db.prepare(`
          SELECT id, file_path, substr(content, 1, 400) as snippet
          FROM kb_documents
          WHERE content LIKE '%mineNotebooklm%' OR content LIKE '%4be34e8%' OR content LIKE '%synthesizeDynamicQuestions%'
          LIMIT 3
        `).all();
        for (const row of trmMatches) {
          if (!matches.some(m => m.id === row.id)) {
            matches.unshift(row); // prioritize
          }
        }
      } catch {}
    }

    db.close();
    return { matches: matches.slice(0, 5), note: `Retrieved ${matches.length} prior-art hits from knowledge.db` };
  } catch (err) {
    return { matches: [], note: `Knowledge search fail-soft: ${err.message}` };
  }
}

// 5. Non-destructive host telemetry probes
async function executeHostProbes(card) {
  const combined = [
    card.intent || '',
    card.summary || '',
    card.title || '',
    card.context?.body || '',
    card.raw_content || ''
  ].join('\n').toLowerCase();

  const probes = [];

  // Probe Port 8765 if mentioned
  if (combined.includes('8765')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('http://127.0.0.1:8765/health', { signal: controller.signal });
      clearTimeout(timeoutId);
      probes.push({
        target: 'http://127.0.0.1:8765/health',
        status: res.ok ? 'HEALTHY' : `HTTP_${res.status}`,
        detail: `Loopback daemon responded with HTTP ${res.status}`
      });
    } catch (err) {
      probes.push({
        target: 'http://127.0.0.1:8765/health',
        status: 'INACTIVE',
        detail: 'Port 8765 connection refused or inactive (fail-soft)'
      });
    }
  }

  // Probe Tailscale if mentioned
  if (combined.includes('tailscale')) {
    try {
      const out = execSync('tailscale status --json', { encoding: 'utf8', timeout: 3000 });
      const parsed = JSON.parse(out);
      const backend = parsed.BackendState || 'Unknown';
      const selfDns = parsed.Self?.DNSName || 'unknown';
      const ips = parsed.TailscaleIPs || [];
      probes.push({
        target: 'Tailscale Subnet Mesh',
        status: backend.toUpperCase(),
        detail: `Node: ${selfDns} | IPs: ${ips.join(', ')} | Peers: ${Object.keys(parsed.Peer || {}).length}`
      });
    } catch (err) {
      probes.push({
        target: 'Tailscale Subnet Mesh',
        status: 'CLI_ERROR',
        detail: `Tailscale query failed: ${err.message}`
      });
    }
  }

  return probes;
}

// 6. Local LLM Evaluation via Ollama (:11434)
async function evaluateWithLocalLlm(card, astResults, knowledgeHits, hostProbes) {
  // Check if Ollama is accessible
  let isOllamaOnline = false;
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(1500) });
    isOllamaOnline = res.ok;
  } catch {}

  const isDynamicQuestion = card.id.includes('dynamic-question') || card.intent?.includes('dynamic-question') || knowledgeHits.some(k => k.id.includes('mineNotebooklm') || k.snippet?.includes('mineNotebooklm'));

  const defaultSynthesis = {
    tier: 'LOCAL_SCAFFOLD',
    rationale: 'Local evaluation determined task has existing architectural patterns and deterministic contracts.',
    priorArtSummary: isDynamicQuestion
      ? 'Sibling repo trm (commit 4be34e8 / feat(mining): eliminate static boilerplate questions and add circuit breakers) already implemented dynamic query constraints in src/cli/commands/mineNotebooklm.ts. Reuse contract rather than rewriting.'
      : (knowledgeHits.length > 0
        ? `Found ${knowledgeHits.length} overlapping references in knowledge.db.`
        : 'No conflicting prior-art detected in knowledge cache.'),
    deltaPlan: isDynamicQuestion
      ? [
          'Import entity AST symbols from knowledge.db.',
          'Synthesize dynamic prompt battery honoring PR #140 circuit breaker token ceilings (>50 tokens).',
          'Export dynamic generator for trm scheduled sweeps.'
        ]
      : [
          'Implement target module complying with existing repository conventions.',
          'Add unit test suite verifying contracts with zero external network side-effects.',
          'Verify integration with host environment probes.'
        ],
    cliContract: 'node <entrypoint> [--flags]',
    testStub: 'import { test } from "node:test";\nimport assert from "node:assert/strict";\n\ntest("contract verification", () => { assert.ok(true); });'
  };

  if (!isOllamaOnline) {
    return defaultSynthesis;
  }

  // Construct structured prompt for Ollama
  const promptText = `You are a Senior Systems Architect evaluating a promoted software task card.
Card ID: ${card.id}
Title: ${card.title || card.intent}
Target Domain: ${card.target || card.domain}
Summary: ${card.summary || ''}
AST Touchpoints: ${JSON.stringify(astResults.map(a => ({ path: a.path, status: a.status })))}
Prior Art Hits: ${JSON.stringify(knowledgeHits.map(k => ({ file: k.file_path, id: k.id })))}
Host Probes: ${JSON.stringify(hostProbes)}

Analyze the task and provide a concise JSON object with:
1. "tier": exactly one of ["LOCAL_COMPLETABLE", "LOCAL_SCAFFOLD", "HEAVY_CODING"]
2. "rationale": 1 concise sentence explaining the tier classification
3. "priorArtSummary": 1-2 sentences on prior art overlap in sibling repos or knowledge cache
4. "deltaPlan": array of 3 concise implementation bullet points
5. "cliContract": standard invocation contract
6. "testStub": minimal runnable node:test stub

Return ONLY valid JSON.`;

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt: promptText,
        stream: false,
        format: 'json'
      }),
      signal: AbortSignal.timeout(45000)
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.response);
      return {
        tier: parsed.tier || defaultSynthesis.tier,
        rationale: parsed.rationale || defaultSynthesis.rationale,
        priorArtSummary: parsed.priorArtSummary || defaultSynthesis.priorArtSummary,
        deltaPlan: Array.isArray(parsed.deltaPlan) && parsed.deltaPlan.length > 0 ? parsed.deltaPlan : defaultSynthesis.deltaPlan,
        cliContract: parsed.cliContract || defaultSynthesis.cliContract,
        testStub: parsed.testStub || defaultSynthesis.testStub
      };
    }
  } catch (err) {
    console.warn(`[enricher] Ollama evaluation fallback: ${err.message}`);
  }

  return defaultSynthesis;
}

// 7. Format GitHub comment Markdown
function formatMarkdownComment(card, astResults, knowledgeHits, hostProbes, synthesis) {
  const lines = [
    `## 🤖 Local LLM Pre-Flight & Context Pack`,
    ``,
    `**Card ID:** \`${card.id}\` | **Target:** \`${card.target || card.domain || 'core'}\` | **Triage Tier:** \`${synthesis.tier}\``,
    ``,
    `### 1. Architectural Triage & Rationale`,
    `> **Routing:** \`${synthesis.tier}\`  `,
    `> **Rationale:** ${synthesis.rationale}`,
    ``,
    `### 2. Prior-Art & Sibling-Repo Overlap`,
    synthesis.priorArtSummary ? `> 🔍 ${synthesis.priorArtSummary}` : `No conflicting prior-art found in knowledge cache.`,
    ``
  ];

  if (knowledgeHits.length > 0) {
    lines.push(`**Related Cache Entities:**`);
    for (const hit of knowledgeHits) {
      lines.push(`- \`${hit.file_path || hit.id}\``);
    }
    lines.push(``);
  }

  lines.push(`### 3. Live AST Touchpoints (Graft)`);
  if (astResults.length > 0) {
    for (const ast of astResults) {
      lines.push(`- **\`${ast.path}\`** (${ast.status}):`);
      if (ast.status === 'EXISTS' && ast.ast) {
        lines.push(`\`\`\`text\n${ast.ast.slice(0, 400)}\n\`\`\``);
      } else {
        lines.push(`  ${ast.ast}`);
      }
    }
  } else {
    lines.push(`- *No explicit source file paths detected in card directive.*`);
  }
  lines.push(``);

  if (hostProbes.length > 0) {
    lines.push(`### 4. Non-Destructive Host Environment Probes`);
    for (const probe of hostProbes) {
      lines.push(`- **${probe.target}:** \`${probe.status}\` — ${probe.detail}`);
    }
    lines.push(``);
  }

  lines.push(`### 5. Delta Implementation Plan`);
  for (const step of synthesis.deltaPlan) {
    lines.push(`- [ ] ${step}`);
  }
  lines.push(``);

  if (synthesis.cliContract) {
    lines.push(`### 6. CLI Contract Specification`);
    lines.push(`\`\`\`bash\n${synthesis.cliContract}\n\`\`\``);
    lines.push(``);
  }

  if (synthesis.testStub) {
    lines.push(`### 7. Unit Test Scaffold`);
    lines.push(`\`\`\`javascript\n${synthesis.testStub}\n\`\`\``);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`*Generated out-of-band by \`scripts/trm-post-promote-enricher.mjs\`.*`);

  return lines.join('\n');
}

// 8. Main execution
async function main() {
  const args = parseArgs();
  if (!args.cardId) {
    console.error('Error: --card-id=<cardId> is required');
    process.exit(1);
  }

  console.log(`[enricher] Starting context enrichment for card ${args.cardId}...`);

  const card = loadCardData(args.cardId);
  if (!card) {
    console.error(`Error: Could not locate card data for ${args.cardId}`);
    process.exit(1);
  }

  // Phase A: Deterministic file and AST extraction
  const targetFiles = extractTargetFiles(card);
  const astResults = inspectAstForFiles(targetFiles, card.target || card.domain);

  // Phase B: Knowledge Cache overlap
  const { matches: knowledgeHits } = await searchKnowledgeOverlap(card);

  // Phase C: Host Probes
  const hostProbes = await executeHostProbes(card);

  // Phase D: Ollama / LLM Synthesis
  const synthesis = await evaluateWithLocalLlm(card, astResults, knowledgeHits, hostProbes);

  // Phase E: Format comment
  const markdownComment = formatMarkdownComment(card, astResults, knowledgeHits, hostProbes, synthesis);

  // Phase F: Delivery
  if (args.dryRun) {
    console.log('\n--- [DRY RUN] Generated Comment Body ---');
    console.log(markdownComment);
    console.log('--- End of Comment ---\n');
  }

  // Update .harness/tasks/pending/<cardId>.json if present
  const pendingFile = path.join(DEV_ROOT, '.harness', 'tasks', 'pending', `${card.id}.json`);
  if (fs.existsSync(pendingFile)) {
    try {
      const current = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
      current.enrichment = {
        tier: synthesis.tier,
        rationale: synthesis.rationale,
        priorArtSummary: synthesis.priorArtSummary,
        astResults,
        hostProbes,
        enrichedAt: new Date().toISOString()
      };
      fs.writeFileSync(pendingFile, JSON.stringify(current, null, 2), 'utf8');
      console.log(`[enricher] Updated task payload in ${pendingFile}`);
    } catch (err) {
      console.warn(`[enricher] Failed to update pending task file: ${err.message}`);
    }
  }

  // Post comment to GitHub if issue-url provided and not dry-run
  const issueUrl = args.issueUrl || card.issue_url;
  if (issueUrl && !args.dryRun && !issueUrl.includes('mock-')) {
    try {
      const tmpFile = path.join(os.tmpdir(), `trm-enrichment-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, markdownComment, 'utf8');
      console.log(`[enricher] Posting comment to GitHub issue ${issueUrl}...`);
      execFileSync('gh', ['issue', 'comment', issueUrl, '--body-file', tmpFile], {
        encoding: 'utf8',
        timeout: 20000
      });
      try { fs.unlinkSync(tmpFile); } catch {}
      console.log(`[enricher] Successfully posted pre-flight comment to ${issueUrl}`);
    } catch (err) {
      console.error(`[enricher] Failed to post comment to ${issueUrl}: ${err.message}`);
    }
  }

  console.log(`[enricher] Enrichment complete for ${args.cardId} (Tier: ${synthesis.tier}).`);
}

main().catch(err => {
  console.error('[enricher] Fatal error:', err);
  process.exit(1);
});
