#!/usr/bin/env node
/**
 * scripts/decision-action-extract.mjs
 *
 * Deterministic meeting-transcript extractor for ACT-02 (issue 61).
 * Labeled blocks and strict JSON become typed decision cards.
 * Vague deadlines and shared owners are quarantined.
 * Accepted cards land in the staging buffer. --approve copies one reviewed
 * card into the backlog. This script never runs git commit.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 'decision-action/1';
export const REPO_ROOT = path.resolve(import.meta.dirname, '..');
export const DEFAULT_STAGING_DIR = path.join(REPO_ROOT, 'dev', 'triage', 'decision-staging');
export const DEFAULT_QUARANTINE_DIR = path.join(REPO_ROOT, 'dev', 'triage', 'decision-quarantine');
export const DEFAULT_BACKLOG_DIR = path.join(REPO_ROOT, 'dev', 'triage', 'decision-backlog');

const FIELDS = ['decision_summary', 'owner', 'deadline', 'verification_gate'];
const CARD_ID = /^dec-[a-f0-9]{12}$/;
const PLACEHOLDER = /^(?:tbd|tba|todo|n\/a|na|none|decide later|\?+)$/i;
const OWNER_REJECT = /^(?:tbd|tba|unknown|unassigned|n\/a|na|none|team|the team|everyone|all|shared|we|us|group|somebody|someone|anyone)$/i;
const SHARED_OWNER = /(?:\sand\s|[&+/;,]|\s\/\s)/i;
const VAGUE_GATE = /^(?:tbd|tba|n\/a|na|none|done|complete|completed|ok|yes|soon|later|asap)$/i;
const OBSERVABLE = /\b(?:passes|passing|exists|returns|equals|contains|status|diff|commit|file|test|command|script|shows|lists|green|exit|renders|logs|records|counts|asserts|git)\b|[\\/]|\.(?:mjs|md|json|ps1|js)\b/i;
const ISO_DEADLINE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const LABEL_NAMES = /^(?:decision|action|owner|assignee|accountable|deadline|due|target|verification|success|done|gate)$/i;

const LABEL_RULES = [
  ['decision_summary', /^(?:decision(?:_summary)?|action(?:\s+item)?)\s*:\s*(.+)$/i],
  ['owner', /^(?:owner|assignee|accountable)\s*:\s*(.+)$/i],
  ['deadline', /^(?:deadline|due(?:\s+date)?|target[\s_]+deadline)\s*:\s*(.+)$/i],
  ['verification_gate', /^(?:verification(?:_gate)?|success criteria|done when|gate)\s*:\s*(.+)$/i],
];

const HELP = `Extract typed decision cards from a meeting transcript.

Usage:
  node scripts/decision-action-extract.mjs --input <transcript.txt> [--source <name>]
  node scripts/decision-action-extract.mjs --approve dec-<12 hex>
  node scripts/decision-action-extract.mjs --review

A decision is four labeled lines, a four-field pipe row, or a JSON object:

  Decision: Ship typed cards into the git staging buffer
  Owner: Chris Sorensen
  Deadline: 2026-10-12
  Verification: git diff lists the card and the backlog file is unchanged

  - Ship typed cards into the git staging buffer | Chris Sorensen | Sprint 35 | git diff lists the card

Deadline is an ISO-8601 date or a "Sprint N" milestone. "soon" is rejected.
Owner is one person. "Alex and Jordan" is rejected.
The JSON block inside a card is the record --approve validates.

Default paths:
  staging     dev/triage/decision-staging
  quarantine  dev/triage/decision-quarantine
  backlog     dev/triage/decision-backlog

This script does not run git commit. Read the staged card, then commit it yourself.
`;

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function decisionId(record) {
  const basis = FIELDS
    .map((key) => String(record[key] ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('\n');
  return `dec-${digest(basis)}`;
}

function quarantineId(raw) {
  return `rej-${digest(JSON.stringify(raw ?? {}))}`;
}

function stripBom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '');
}

function readString(value, key, errors) {
  if (typeof value !== 'string') {
    errors.push(`${key} must be a single string`);
    return '';
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) errors.push(`${key} is empty`);
  return normalized;
}

function isRealIsoDeadline(value) {
  if (!ISO_DEADLINE.test(value)) return false;
  if (value.length === 10) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day;
  }
  return !Number.isNaN(new Date(value).getTime());
}

export function normalizeDeadline(value) {
  const sprint = value.match(/^sprint[\s-]?(\d+)$/i);
  if (sprint) return { ok: true, value: `Sprint ${sprint[1]}` };
  if (isRealIsoDeadline(value)) return { ok: true, value };
  return { ok: false, value };
}

function validateOwner(value, errors) {
  if (!value) return;
  if (OWNER_REJECT.test(value) || SHARED_OWNER.test(value)) {
    errors.push('owner must be a single accountable person');
    return;
  }
  const words = value.split(' ');
  const personalName = /^[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,3}$/u.test(value);
  const slug = /^[a-z0-9][a-z0-9._-]{1,48}$/i.test(value);
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  if (words.length > 4 || (!personalName && !slug && !email)) {
    errors.push('owner must be a single accountable person');
  }
}

export function validateDecision(raw) {
  const errors = [];
  const decision_summary = readString(raw?.decision_summary, 'decision_summary', errors);
  const owner = readString(raw?.owner, 'owner', errors);
  const deadlineInput = readString(raw?.deadline, 'deadline', errors);
  const verification_gate = readString(raw?.verification_gate, 'verification_gate', errors);

  if (decision_summary && (decision_summary.length < 12 || decision_summary.length > 400 || PLACEHOLDER.test(decision_summary))) {
    errors.push('decision_summary must be a concrete decision between 12 and 400 characters');
  }
  validateOwner(owner, errors);

  let deadline = deadlineInput;
  if (deadlineInput) {
    const normalized = normalizeDeadline(deadlineInput);
    if (!normalized.ok) {
      errors.push(`deadline "${deadlineInput}" is not an ISO-8601 date or a sprint milestone`);
    } else {
      deadline = normalized.value;
    }
  }

  if (verification_gate && (VAGUE_GATE.test(verification_gate) || verification_gate.length < 12 || !OBSERVABLE.test(verification_gate))) {
    errors.push('verification_gate must be an observable completion check');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: { decision_summary, owner, deadline, verification_gate },
  };
}

function matchLabel(line) {
  for (const [key, rule] of LABEL_RULES) {
    const hit = line.match(rule);
    if (hit) return { key, value: hit[1].trim() };
  }
  return null;
}

function stripBoldLabel(text) {
  return text.replace(/^\*\*([^*]+)\*\*:?\s*/, (_, label) => {
    const name = label.replace(/:\s*$/, '').trim();
    return `${name}: `;
  });
}

function normalizeLine(line) {
  let text = line.trim().replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s+/, '');
  text = text.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
  text = stripBoldLabel(text);
  if (matchLabel(text) || parsePipe(text)) return text.trim();
  const speaker = text.match(/^([\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,2}):\s+(.+)$/u);
  if (speaker && !LABEL_NAMES.test(speaker[1])) {
    text = stripBoldLabel(speaker[2].trim());
  }
  return text.trim();
}

function parsePipe(line) {
  const parts = line.split('|').map((part) => part.trim());
  if (parts.length !== 4 || parts.some((part) => part.length === 0)) return null;
  const deadlineHint = /^(?:sprint[\s-]?\d+|\d{4}-\d{2}-\d{2}|soon|asap|later|tbd|tba|next week|this week|tomorrow)$/i.test(parts[2])
    || ISO_DEADLINE.test(parts[2]);
  if (!deadlineHint) return null;
  return {
    decision_summary: parts[0],
    owner: parts[1],
    deadline: parts[2],
    verification_gate: parts[3],
  };
}

function parseLabeledTranscript(text) {
  const blocks = [];
  let current = null;
  const push = () => {
    if (current && Object.keys(current).length > 0) blocks.push(current);
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      push();
      continue;
    }
    const line = normalizeLine(rawLine);
    if (!line) continue;
    const piped = parsePipe(line);
    if (piped) {
      push();
      blocks.push(piped);
      continue;
    }
    const labeled = matchLabel(line);
    if (!labeled) continue;
    if (!current || (labeled.key === 'decision_summary' && current.decision_summary)) {
      push();
      current = {};
    }
    current[labeled.key] = labeled.value;
  }
  push();
  return blocks;
}

function looksLikeJson(text) {
  const start = text.trim()[0];
  return start === '{' || start === '[';
}

function coerceJson(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.decisions)) return data.decisions;
  if (data && typeof data === 'object' && FIELDS.some((key) => key in data)) return [data];
  throw new Error('JSON must be a decision object, an array, or { "decisions": [] }');
}

function rejection(raw, errors, source, extra = {}) {
  return {
    id: quarantineId({ raw, errors }),
    raw,
    errors,
    source,
    ...extra,
  };
}

export function extractFromText(text, options = {}) {
  const source = options.source || 'stdin';
  const extractedAt = options.extractedAt || new Date().toISOString();
  const body = stripBom(text);
  if (!body.trim()) {
    return { accepted: [], rejected: [rejection({}, ['transcript is empty'], source)] };
  }

  let rawRecords;
  if (looksLikeJson(body)) {
    try {
      rawRecords = coerceJson(JSON.parse(body));
    } catch (error) {
      const message = error instanceof SyntaxError
        ? 'transcript is not valid JSON'
        : error.message;
      return { accepted: [], rejected: [rejection({}, [message], source)] };
    }
  } else {
    rawRecords = parseLabeledTranscript(body);
  }

  if (rawRecords.length === 0) {
    return {
      accepted: [],
      rejected: [rejection({}, ['no labeled decision blocks in transcript'], source, { snippet: body.slice(0, 240) })],
    };
  }

  const accepted = [];
  const rejected = [];
  const seen = new Set();
  for (const raw of rawRecords) {
    const result = validateDecision(raw);
    if (!result.ok) {
      rejected.push(rejection(raw, result.errors, source));
      continue;
    }
    const id = decisionId(result.value);
    if (seen.has(id)) continue;
    seen.add(id);
    accepted.push({
      ...result.value,
      id,
      schema: SCHEMA_VERSION,
      status: 'STAGED_FOR_REVIEW',
      source,
      extracted_at: extractedAt,
    });
  }
  return { accepted, rejected };
}

function orderedRecord(record) {
  const ordered = {
    id: record.id,
    schema: record.schema,
    status: record.status,
    source: record.source,
    extracted_at: record.extracted_at,
  };
  if (record.approved_at) ordered.approved_at = record.approved_at;
  ordered.decision_summary = record.decision_summary;
  ordered.owner = record.owner;
  ordered.deadline = record.deadline;
  ordered.verification_gate = record.verification_gate;
  return ordered;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|');
}

export function renderCard(record) {
  const review = record.status === 'APPROVED'
    ? 'This card is approved for the backlog. Commit it yourself after git diff matches this file.'
    : 'Review this card in git diff. Copy it to the backlog with --approve. This script does not commit.';
  const json = JSON.stringify(orderedRecord(record), null, 2);
  return [
    `# Decision ${record.id}`,
    '',
    record.status,
    '',
    '| Field | Value |',
    '|---|---|',
    `| Decision | ${escapeCell(record.decision_summary)} |`,
    `| Owner | ${escapeCell(record.owner)} |`,
    `| Deadline | ${escapeCell(record.deadline)} |`,
    `| Verification gate | ${escapeCell(record.verification_gate)} |`,
    '',
    review,
    '',
    '```json',
    json,
    '```',
    '',
  ].join('\n');
}

export function parseCard(markdown) {
  const match = String(markdown).match(/```json\s*\n([\s\S]*?)\n```/);
  if (!match) throw new Error('card is missing a json record');
  return JSON.parse(match[1]);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function stageExtraction(text, options) {
  const extracted = extractFromText(text, options);
  const stagingDir = options.stagingDir;
  const quarantineDir = options.quarantineDir;
  const stagedPaths = [];
  const quarantinedPaths = [];

  for (const record of extracted.accepted) {
    const filePath = path.join(stagingDir, `${record.id}.md`);
    fs.mkdirSync(stagingDir, { recursive: true });
    fs.writeFileSync(filePath, renderCard(record), 'utf8');
    stagedPaths.push(filePath);
  }
  for (const item of extracted.rejected) {
    const filePath = path.join(quarantineDir, `${item.id}.json`);
    writeJson(filePath, {
      id: item.id,
      source: item.source,
      errors: item.errors,
      raw: item.raw,
      snippet: item.snippet ?? null,
    });
    quarantinedPaths.push(filePath);
  }
  return { ...extracted, stagedPaths, quarantinedPaths };
}

export function approveStaged(id, options) {
  if (!CARD_ID.test(id)) {
    return { ok: false, error: 'approve id must look like dec- followed by 12 hex characters' };
  }
  const stagingPath = path.join(options.stagingDir, `${id}.md`);
  if (!fs.existsSync(stagingPath)) {
    return { ok: false, error: `staged card not found: ${id}` };
  }
  let record;
  try {
    record = parseCard(fs.readFileSync(stagingPath, 'utf8'));
  } catch (error) {
    return { ok: false, error: error.message };
  }
  const validated = validateDecision(record);
  if (!validated.ok) return { ok: false, error: validated.errors.join('; ') };
  if (decisionId(validated.value) !== id) {
    return { ok: false, error: 'card id does not match its decision fields' };
  }
  const approved = {
    ...validated.value,
    id,
    schema: SCHEMA_VERSION,
    status: 'APPROVED',
    source: typeof record.source === 'string' ? record.source : 'unknown',
    extracted_at: typeof record.extracted_at === 'string' ? record.extracted_at : options.approvedAt,
    approved_at: options.approvedAt,
  };
  const backlogPath = path.join(options.backlogDir, `${id}.md`);
  fs.mkdirSync(options.backlogDir, { recursive: true });
  fs.writeFileSync(backlogPath, renderCard(approved), 'utf8');
  fs.unlinkSync(stagingPath);
  return { ok: true, backlogPath, record: approved };
}

export function listStaged(stagingDir) {
  if (!fs.existsSync(stagingDir)) return [];
  return fs.readdirSync(stagingDir)
    .filter((name) => CARD_ID.test(name.replace(/\.md$/, '')))
    .sort()
    .map((name) => parseCard(fs.readFileSync(path.join(stagingDir, name), 'utf8')));
}

function parseArgs(argv) {
  const args = {
    stagingDir: DEFAULT_STAGING_DIR,
    quarantineDir: DEFAULT_QUARANTINE_DIR,
    backlogDir: DEFAULT_BACKLOG_DIR,
  };
  for (const token of argv) {
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--review') args.review = true;
    else if (token.startsWith('--input=')) args.input = token.slice('--input='.length);
    else if (token.startsWith('--source=')) args.source = token.slice('--source='.length);
    else if (token.startsWith('--approve=')) args.approve = token.slice('--approve='.length);
    else if (token.startsWith('--staging=')) args.stagingDir = path.resolve(token.slice('--staging='.length));
    else if (token.startsWith('--quarantine=')) args.quarantineDir = path.resolve(token.slice('--quarantine='.length));
    else if (token.startsWith('--backlog=')) args.backlogDir = path.resolve(token.slice('--backlog='.length));
    else return { error: `unknown argument: ${token}` };
  }
  return args;
}

function printExtraction(result) {
  console.log(`staged ${result.accepted.length}`);
  console.log(`rejected ${result.rejected.length}`);
  for (const record of result.accepted) {
    console.log(`stage ${record.id} ${record.owner} ${record.deadline} ${record.decision_summary}`);
  }
  for (const item of result.rejected) {
    console.log(`reject ${item.id} ${item.errors.join('; ')}`);
  }
  console.log('Review the staged card in git diff. This script does not commit.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error(args.error);
    process.exit(1);
  }
  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (args.approve && (args.input || args.review)) {
    console.error('Pass only one of --approve, --input, or --review.');
    process.exit(1);
  }
  if (args.review) {
    const cards = listStaged(args.stagingDir);
    if (cards.length === 0) console.log('staged 0');
    for (const card of cards) {
      console.log(`${card.id} ${card.owner} ${card.deadline} ${card.decision_summary}`);
    }
    process.exit(0);
  }
  if (args.approve) {
    const result = approveStaged(args.approve, {
      stagingDir: args.stagingDir,
      backlogDir: args.backlogDir,
      approvedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }
    console.log(`approved ${result.record.id}`);
    console.log(result.backlogPath);
    console.log('Commit the backlog card yourself. This script does not commit.');
    process.exit(0);
  }

  const text = args.input
    ? fs.readFileSync(args.input, 'utf8')
    : fs.readFileSync(0, 'utf8');
  const source = args.source || (args.input ? path.basename(args.input) : 'stdin');
  const result = stageExtraction(text, {
    source,
    stagingDir: args.stagingDir,
    quarantineDir: args.quarantineDir,
  });
  printExtraction(result);
  process.exit(result.rejected.length > 0 ? 2 : 0);
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(fileURLToPath(import.meta.url)).toLowerCase() === path.resolve(entry).toLowerCase();
}

if (invokedDirectly()) main();
