#!/usr/bin/env node
// Validates retro inbox entries against .context/retros/INBOX-SPEC.md.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_FILE = fileURLToPath(new URL('../docs/meta/governance/schemas/retro-inbox-v1.schema.json', import.meta.url));
const INBOX_SEGMENTS = ['.context', 'retros', 'inbox'];
export const INBOX_DIR = INBOX_SEGMENTS.join('/');
const ENTRY_FILE_NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export const INBOX_REGISTRY = deepFreeze({
  schema: 'retro-inbox/1',
  agents: ['claude', 'codex', 'grok', 'gemini', 'copilot', 'antigravity', 'human', 'ci'],
  tags: {
    INGESTION: { icfCategory: 'reliability' },
    MCP: { icfCategory: 'reliability' },
    GATE: { icfCategory: 'governance' },
    CI: { icfCategory: 'quality' },
    DRIFT: { icfCategory: 'governance' },
    SPEC: { icfCategory: 'governance' },
    TEST: { icfCategory: 'quality' },
    PROCESS: { icfCategory: 'governance' },
    TOOLING: { icfCategory: 'delivery' },
    SECURITY: { icfCategory: 'governance' },
    RELIABILITY: { icfCategory: 'reliability' },
  },
  severities: {
    critical: { priority: 'P0' },
    high: { priority: 'P1' },
    medium: { priority: 'P2' },
    low: { priority: 'P2' },
  },
  priorities: {
    P0: { todosAppend: 'approval' },
    P1: { todosAppend: 'approval' },
    P2: { todosAppend: 'auto' },
  },
});

const PATTERNS = {
  repo: { source: '^[A-Za-z0-9][A-Za-z0-9._-]*$', hint: 'a repository name of letters, digits, ".", "_", or "-"' },
  date: { source: '^\\d{4}-\\d{2}-\\d{2}$', hint: 'a YYYY-MM-DD date' },
  findingId: { source: '^RF-[0-9a-f]{12}$', hint: '"RF-" followed by 12 lowercase hex characters' },
  line: { source: '^[^\\S\\r\\n]*\\S[^\\r\\n]*$', hint: 'one non-blank line' },
  text: { source: '\\S', hint: 'non-blank text' },
};
const PATTERN_HINTS = new Map(Object.values(PATTERNS).map(({ source, hint }) => [source, hint]));
const matching = (name, extra = {}) => ({ type: 'string', pattern: PATTERNS[name].source, ...extra });

export const INBOX_SCHEMA = deepFreeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:cic:retro-inbox:v1',
  title: 'Retro inbox entry',
  description: 'One retro inbox entry (retro-inbox/1), specified in .context/retros/INBOX-SPEC.md. Generated from INBOX_REGISTRY by `node scripts/validate-retro-inbox.mjs --write-schema`. Do not edit by hand.',
  type: 'object',
  required: ['schema', 'agent', 'repo', 'date', 'findings'],
  additionalProperties: false,
  properties: {
    schema: { const: INBOX_REGISTRY.schema },
    agent: { enum: INBOX_REGISTRY.agents },
    repo: matching('repo'),
    date: matching('date', { format: 'date' }),
    session: matching('text'),
    findings: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'tag', 'severity', 'summary', 'evidence'],
        additionalProperties: false,
        properties: {
          id: matching('findingId'),
          tag: { enum: Object.keys(INBOX_REGISTRY.tags) },
          severity: { enum: Object.keys(INBOX_REGISTRY.severities) },
          summary: matching('line', { maxLength: 200 }),
          evidence: { type: 'array', minItems: 1, items: matching('text') },
          suggestion: matching('text'),
        },
      },
    },
  },
});

export function computeFindingId({ repo, tag, summary }) {
  const parts = [repo, tag, summary];
  if (!parts.every((part) => typeof part === 'string')) {
    throw new TypeError('computeFindingId needs string repo, tag, and summary');
  }
  // Normalized parts never contain a newline, so the joined key is unambiguous.
  const key = parts.map((part) => part.trim().replace(/\s+/g, ' ').toLowerCase()).join('\n');
  return `RF-${createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 12)}`;
}

// Interprets only the JSON Schema subset INBOX_SCHEMA uses, so validation needs no
// dependency and cannot drift from the published schema file.
const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', 'format']);
const TYPE_NAMES = { object: 'an object', array: 'an array', string: 'a string' };
const typeOf = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
const child = (at, key) => (at ? `${at}.${key}` : key);
const fail = (at, message) => [`${at || 'entry'}: ${message}`];

const KEYWORDS = {
  type: (s, v, at) => (typeOf(v) === s.type ? [] : fail(at, `must be ${TYPE_NAMES[s.type]}`)),
  const: (s, v, at) => (v === s.const ? [] : fail(at, `must be ${JSON.stringify(s.const)}`)),
  enum: (s, v, at) => (s.enum.includes(v) ? [] : fail(at, `must be one of ${s.enum.join(', ')}`)),
  pattern: (s, v, at) => (new RegExp(s.pattern, 'u').test(v)
    ? []
    : fail(at, `must be ${PATTERN_HINTS.get(s.pattern) ?? `a match for ${s.pattern}`}`)),
  maxLength: (s, v, at) => ([...v].length <= s.maxLength ? [] : fail(at, `must be at most ${s.maxLength} characters`)),
  minItems: (s, v, at) => (v.length >= s.minItems ? [] : fail(at, `must have at least ${count(s.minItems, 'item')}`)),
  required: (s, v, at) => s.required
    .filter((key) => !Object.hasOwn(v, key))
    .flatMap((key) => fail(child(at, key), 'is required')),
  additionalProperties: (s, v, at) => (s.additionalProperties !== false ? [] : Object.keys(v)
    .filter((key) => !Object.hasOwn(s.properties, key))
    .flatMap((key) => fail(child(at, key), 'is not an allowed field'))),
  properties: (s, v, at) => Object.entries(s.properties)
    .filter(([key]) => Object.hasOwn(v, key))
    .flatMap(([key, sub]) => schemaErrors(sub, v[key], child(at, key))),
  items: (s, v, at) => v.flatMap((item, index) => schemaErrors(s.items, item, `${at}[${index}]`)),
};

function schemaErrors(schema, value, at = '') {
  if ('type' in schema && typeOf(value) !== schema.type) return KEYWORDS.type(schema, value, at);
  return Object.keys(schema).flatMap((keyword) => {
    if (ANNOTATIONS.has(keyword)) return [];
    if (!Object.hasOwn(KEYWORDS, keyword)) throw new Error(`retro inbox schema uses unsupported keyword "${keyword}"`);
    return KEYWORDS[keyword](schema, value, at);
  });
}

function count(n, noun) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function isCalendarDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function contentErrors({ repo, date, findings }) {
  const errors = isCalendarDate(date) ? [] : [`date: ${date} is not a calendar date`];
  const firstIndex = new Map();
  findings.forEach(({ id, tag, summary }, index) => {
    const expected = computeFindingId({ repo, tag, summary });
    if (id !== expected) errors.push(`findings[${index}].id: ${id} must be ${expected}, computed from repo, tag, and summary`);
    if (firstIndex.has(id)) errors.push(`findings[${index}].id: ${id} duplicates findings[${firstIndex.get(id)}]`);
    else firstIndex.set(id, index);
  });
  return errors;
}

function locationErrors(filePath, entry) {
  const parts = path.resolve(filePath).split(/[\\/]+/);
  const start = parts.findIndex((_, index) => INBOX_SEGMENTS.every((segment, offset) => parts[index + offset] === segment));
  if (start === -1) return [`path: must be under ${INBOX_DIR}/`];
  const rest = parts.slice(start + INBOX_SEGMENTS.length);
  if (rest.length !== 2) return [`path: must be ${INBOX_DIR}/<agent>/<YYYY-MM-DD>-<slug>.json`];
  const [agentDir, fileName] = rest;
  const fileDate = ENTRY_FILE_NAME.exec(fileName)?.[1];
  const errors = fileDate ? [] : ['path: file name must be <YYYY-MM-DD>-<slug>.json with a lowercase kebab-case slug'];
  if (entry && agentDir !== entry.agent) errors.push(`path: agent directory ${agentDir} does not match agent ${entry.agent}`);
  if (entry && fileDate && fileDate !== entry.date) errors.push(`path: file name date ${fileDate} does not match date ${entry.date}`);
  return errors;
}

export function validateEntry(entry, filePath) {
  const shapeErrors = schemaErrors(INBOX_SCHEMA, entry);
  const shaped = shapeErrors.length === 0 ? entry : null;
  const errors = [
    ...(filePath === undefined ? [] : locationErrors(filePath, shaped)),
    ...shapeErrors,
    ...(shaped ? contentErrors(shaped) : []),
  ];
  return { ok: errors.length === 0, errors };
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) return listFiles(full);
    return dirent.isFile() ? [full] : [];
  });
}

function readEntry(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) return { error: 'must be UTF-8 without a byte order mark' };
  try {
    return { entry: JSON.parse(text) };
  } catch (error) {
    return { error: `is not valid JSON (${error.message.replace(/\s+/g, ' ')})` };
  }
}

export function validateInbox(dir) {
  const root = path.resolve(dir);
  const tail = root.split(/[\\/]+/).slice(-INBOX_SEGMENTS.length);
  if (!INBOX_SEGMENTS.every((segment, index) => tail[index] === segment)) {
    return { ok: false, errors: [`${dir}: inbox must be a ${INBOX_DIR} directory`], entries: [] };
  }
  const stat = fs.statSync(root, { throwIfNoEntry: false });
  // A checkout where no agent has filed an entry yet has no inbox directory.
  if (!stat) return { ok: true, errors: [], entries: [], missing: true };
  if (!stat.isDirectory()) {
    return { ok: false, errors: [`${dir}: inbox must be a directory`], entries: [] };
  }
  const errors = [];
  const entries = [];
  const firstSeen = new Map();
  for (const file of listFiles(root).sort()) {
    const where = [INBOX_DIR, ...path.relative(root, file).split(path.sep)].join('/');
    const parsed = readEntry(file);
    const fileErrors = 'error' in parsed
      ? [...locationErrors(file, null), `file: ${parsed.error}`]
      : validateEntry(parsed.entry, file).errors;
    errors.push(...fileErrors.map((message) => `${where}: ${message}`));
    if (fileErrors.length > 0) continue;
    entries.push({ path: where, entry: parsed.entry });
    parsed.entry.findings.forEach(({ id }, index) => {
      const first = firstSeen.get(id);
      if (first) errors.push(`${where}: findings[${index}].id: ${id} duplicates ${first}`);
      else firstSeen.set(id, `${where} findings[${index}]`);
    });
  }
  return { ok: errors.length === 0, errors, entries };
}

function main(args) {
  if (args.length === 1 && args[0] === '--write-schema') {
    fs.writeFileSync(SCHEMA_FILE, `${JSON.stringify(INBOX_SCHEMA, null, 2)}\n`);
    console.log(`wrote ${path.relative(process.cwd(), SCHEMA_FILE)}`);
    return 0;
  }
  if (args.length > 1 || args.some((arg) => arg.startsWith('--'))) {
    console.error('usage: node scripts/validate-retro-inbox.mjs [inbox-dir]');
    console.error('       node scripts/validate-retro-inbox.mjs --write-schema');
    return 2;
  }
  const dir = args[0] ?? INBOX_DIR;
  const { ok, errors, entries, missing } = validateInbox(dir);
  if (missing) {
    console.log(`retro inbox absent: ${dir} does not exist, so there is nothing to validate`);
    return 0;
  }
  if (!ok) {
    console.error(`retro inbox invalid: ${count(errors.length, 'error')} in ${dir}`);
    for (const error of errors) console.error(`  ${error}`);
    return 1;
  }
  const findings = entries.reduce((total, { entry }) => total + entry.findings.length, 0);
  console.log(`retro inbox valid: ${count(entries.length, 'file')}, ${count(findings, 'finding')} in ${dir}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
