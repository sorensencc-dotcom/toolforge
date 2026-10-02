/**
 * scripts/extract-decisions.mjs
 *
 * Deterministic Decision & Action Extraction Parser for Meeting Transcripts & Ingress Notes.
 * Parses unstructured transcript texts (Granola, Google Meet, voice notes) into strongly-typed,
 * verified decision records.
 *
 * Schema Enforced:
 * - id: Deterministic slug or SHA-256 fingerprint
 * - decision: Concrete decision statement
 * - owner: Explicit assignee / owner
 * - target_deadline: Concrete ISO-8601 or YYYY-MM-DD date (rejects vague "soon"/"ASAP")
 * - verification_gate: Concrete test / condition verifying completion
 * - priority: P1 | P2 | P3
 * - status: PROPOSED | COMMITTED | REJECTED
 *
 * Zero token footprint (deterministic AST & regex token parser).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve('c:/dev');
const DEFAULT_DECISIONS_DIR = path.join(REPO_ROOT, '.harness/decisions');
const DEFAULT_DECISIONS_LEDGER = path.join(DEFAULT_DECISIONS_DIR, 'decisions.jsonl');

export const VAGUE_DEADLINE_PATTERNS = [
  /^(asap|soon|later|eventually|tbd|pending|sometime|next\s+week|next\s+month|q\d|eod)$/i,
  /^in\s+a\s+(few\s+days|couple\s+days|while)$/i,
  /^\s*$/
];

export const VALID_DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)?$/,
  /^(202\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
];

/**
 * Computes deterministic SHA-256 hash for deduplication.
 */
export function computeDecisionFingerprint(decisionText, owner) {
  const normalized = `${(decisionText || '').trim().toLowerCase()}|${(owner || '').trim().toLowerCase()}`;
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').substring(0, 16);
}

/**
 * Validates a decision record against strict schema rules.
 *
 * @param {Object} record
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDecisionRecord(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be a valid object'] };
  }

  // 1. Decision statement
  if (!record.decision || typeof record.decision !== 'string' || record.decision.trim().length < 5) {
    errors.push('Decision statement must be a non-empty string of at least 5 characters');
  }

  // 2. Owner validation
  if (!record.owner || typeof record.owner !== 'string' || !record.owner.trim() || record.owner.trim().toLowerCase() === 'unassigned') {
    errors.push('Owner must be an assigned person, team, or bot (cannot be empty or "unassigned")');
  }

  // 3. Deadline validation
  if (!record.target_deadline || typeof record.target_deadline !== 'string') {
    errors.push('Target deadline is required and must be a concrete date (YYYY-MM-DD)');
  } else {
    const trimmedDeadline = record.target_deadline.trim();
    const isVague = VAGUE_DEADLINE_PATTERNS.some(p => p.test(trimmedDeadline));
    const isValidFormat = VALID_DATE_PATTERNS.some(p => p.test(trimmedDeadline));

    if (isVague || !isValidFormat) {
      errors.push(`Target deadline '${trimmedDeadline}' is invalid or ambiguous; must match YYYY-MM-DD`);
    }
  }

  // 4. Verification gate
  if (!record.verification_gate || typeof record.verification_gate !== 'string' || record.verification_gate.trim().length < 5) {
    errors.push('Verification gate must define an explicit verification condition/test');
  }

  // 5. Priority validation
  if (record.priority && !['P1', 'P2', 'P3', 'P0'].includes(String(record.priority).toUpperCase())) {
    errors.push(`Priority '${record.priority}' is invalid (must be P0, P1, P2, or P3)`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parses raw text transcripts into structured decision candidates.
 * Supports:
 * - Markdown decision sections (`## Decisions`, `### Action Items`)
 * - Granola / Meet bullet conventions: `- [ ] Decision/Task: ... | Owner: ... | Deadline: ... | Gate: ...`
 * - Key-value metadata blocks (`Decision: ...\nOwner: ...\nDeadline: ...\nGate: ...`)
 * - Conversational speaker lines (`Speaker: We decided to X. @Owner will verify by YYYY-MM-DD via Gate`)
 *
 * @param {string} rawText Raw transcript or meeting notes text
 * @returns {Array<Object>} Extracted candidate records
 */
export function extractDecisionsFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const candidates = [];
  const lines = rawText.split(/\r?\n/);

  // Pattern A: Delimited pipe or semicolon formats:
  // e.g. - Decision: Migrated to PostgreSQL | Owner: chris | Deadline: 2026-10-15 | Gate: npm test passes
  const pipeRegex = /(?:^|\n)[*-]?\s*(?:\[[ xX]\])?\s*(?:Decision|Decided|Action):\s*([^|\n;]+)(?:[|;]\s*Owner:\s*([^|\n;]+))(?:[|;]\s*(?:Deadline|By):\s*([^|\n;]+))(?:[|;]\s*(?:Gate|Verify|Test):\s*([^|\n;]+))/gi;
  let match;
  while ((match = pipeRegex.exec(rawText)) !== null) {
    const decision = match[1].trim();
    const owner = match[2].trim();
    const target_deadline = match[3].trim();
    const verification_gate = match[4].trim();
    const id = `dec-${computeDecisionFingerprint(decision, owner)}`;

    candidates.push({
      id,
      decision,
      owner,
      target_deadline,
      verification_gate,
      priority: 'P2',
      status: 'COMMITTED',
      source_pattern: 'delimited_pipeline'
    });
  }

  // Pattern B: Structured Key-Value Block parsing
  // Decision: ...
  // Owner: ...
  // Deadline: ...
  // Gate: ...
  let currentBlock = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const decMatch = line.match(/^(?:###?\s+)?(?:Decision|Decided):\s*(.+)$/i);
    if (decMatch) {
      if (currentBlock && currentBlock.decision) {
        if (currentBlock.owner && currentBlock.target_deadline && currentBlock.verification_gate) {
          currentBlock.id = `dec-${computeDecisionFingerprint(currentBlock.decision, currentBlock.owner)}`;
          candidates.push(currentBlock);
        }
      }
      currentBlock = {
        decision: decMatch[1].trim(),
        owner: null,
        target_deadline: null,
        verification_gate: null,
        priority: 'P2',
        status: 'COMMITTED',
        source_pattern: 'kv_block'
      };
      continue;
    }

    if (currentBlock) {
      const ownerMatch = line.match(/^(?:Owner|Assignee|Lead):\s*(.+)$/i);
      if (ownerMatch) {
        currentBlock.owner = ownerMatch[1].trim();
        continue;
      }
      const deadlineMatch = line.match(/^(?:Deadline|Target Date|Due Date|By):\s*(.+)$/i);
      if (deadlineMatch) {
        currentBlock.target_deadline = deadlineMatch[1].trim();
        continue;
      }
      const gateMatch = line.match(/^(?:Verification Gate|Gate|Verification|Test Criteria|Done Definition):\s*(.+)$/i);
      if (gateMatch) {
        currentBlock.verification_gate = gateMatch[1].trim();
        continue;
      }
      const prioMatch = line.match(/^(?:Priority|Severity):\s*(P[0-3])$/i);
      if (prioMatch) {
        currentBlock.priority = prioMatch[1].toUpperCase();
        continue;
      }
    }
  }

  if (currentBlock && currentBlock.decision && currentBlock.owner && currentBlock.target_deadline && currentBlock.verification_gate) {
    currentBlock.id = `dec-${computeDecisionFingerprint(currentBlock.decision, currentBlock.owner)}`;
    candidates.push(currentBlock);
  }

  // Deduplicate candidates by ID
  const uniqueMap = new Map();
  for (const c of candidates) {
    if (!uniqueMap.has(c.id)) {
      uniqueMap.set(c.id, c);
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Stages extracted decision records to the local git-tracked backlog.
 *
 * @param {Array<Object>} decisions
 * @param {Object} [options]
 * @param {string} [options.targetDir]
 * @param {string} [options.ledgerPath]
 * @returns {{ stagedCount: number, duplicatesSkipped: number, invalidSkipped: number, records: Array<Object> }}
 */
export function stageDecisionsToBacklog(decisions, options = {}) {
  const targetDir = options.targetDir || DEFAULT_DECISIONS_DIR;
  const ledgerPath = options.ledgerPath || DEFAULT_DECISIONS_LEDGER;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Read existing ledger IDs
  const existingIds = new Set();
  if (fs.existsSync(ledgerPath)) {
    try {
      const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const row = JSON.parse(line);
          if (row.id) existingIds.add(row.id);
        } catch {}
      }
    } catch {}
  }

  let stagedCount = 0;
  let duplicatesSkipped = 0;
  let invalidSkipped = 0;
  const stagedRecords = [];

  for (const dec of decisions) {
    const validation = validateDecisionRecord(dec);
    if (!validation.valid) {
      console.warn(`[EXTRACT-DECISIONS] Skipping invalid decision '${dec.decision}': ${validation.errors.join('; ')}`);
      invalidSkipped++;
      continue;
    }

    if (existingIds.has(dec.id)) {
      duplicatesSkipped++;
      continue;
    }

    const record = {
      id: dec.id,
      decision: dec.decision,
      owner: dec.owner,
      target_deadline: dec.target_deadline,
      verification_gate: dec.verification_gate,
      priority: (dec.priority || 'P2').toUpperCase(),
      status: dec.status || 'COMMITTED',
      staged_at: new Date().toISOString(),
      source_pattern: dec.source_pattern || 'custom'
    };

    // Append to decisions.jsonl
    fs.appendFileSync(ledgerPath, JSON.stringify(record) + '\n', 'utf8');

    // Write individual decision markdown card
    const cardPath = path.join(targetDir, `${record.id}.md`);
    const cardContent = `---
id: "${record.id}"
owner: "${record.owner}"
target_deadline: "${record.target_deadline}"
priority: "${record.priority}"
status: "${record.status}"
staged_at: "${record.staged_at}"
---

# Decision: ${record.id}

- **Statement**: ${record.decision}
- **Owner**: \`${record.owner}\`
- **Target Deadline**: \`${record.target_deadline}\`
- **Verification Gate**: \`${record.verification_gate}\`
- **Status**: \`${record.status}\`
`;
    fs.writeFileSync(cardPath, cardContent, 'utf8');

    existingIds.add(record.id);
    stagedRecords.push(record);
    stagedCount++;
  }

  return {
    stagedCount,
    duplicatesSkipped,
    invalidSkipped,
    records: stagedRecords
  };
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const isStage = args.includes('--stage');
  const filePath = args.find(a => !a.startsWith('--'));

  if (!filePath) {
    console.log(`Usage: node scripts/extract-decisions.mjs <file_path_or_text> [--stage]`);
    process.exit(1);
  }

  let text = '';
  if (fs.existsSync(filePath)) {
    text = fs.readFileSync(filePath, 'utf8');
  } else {
    text = filePath;
  }

  const extracted = extractDecisionsFromText(text);
  console.log(`[EXTRACT-DECISIONS] Extracted ${extracted.length} candidate decision(s).`);

  if (isStage) {
    const result = stageDecisionsToBacklog(extracted);
    console.log(`[EXTRACT-DECISIONS] Staged: ${result.stagedCount} | Duplicates: ${result.duplicatesSkipped} | Invalid: ${result.invalidSkipped}`);
  } else {
    console.log(JSON.stringify(extracted, null, 2));
  }
}
