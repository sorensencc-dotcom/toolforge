#!/usr/bin/env node
// Reads and appends the retro action ledger, specified in docs/meta/governance/retro-policy.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { INBOX_DIR, validateInbox } from './validate-retro-inbox.mjs';

export const LEDGER_FILE = '.context/retros/actions/ledger.jsonl';
export const LEDGER_STATES = Object.freeze(['approved', 'closed', 'dismissed']);

const USAGE = [
  'usage: node scripts/retro-action-ledger.mjs validate [--ledger <file>]',
  '       node scripts/retro-action-ledger.mjs append --id <RF-id> --state <approved|closed|dismissed> --by <name> [--ref <text>] [--date <YYYY-MM-DD>] [--ledger <file>] [--inbox <dir>]',
].join('\n');
const FIELDS = new Set(['id', 'state', 'by', 'date', 'ref']);
const ID = /^RF-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isNonBlank = (value) => typeof value === 'string' && /\S/.test(value) && !/[\r\n]/.test(value);

function isCalendarDate(value) {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function eventErrors(event) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) return ['must be an object'];
  const errors = Object.keys(event).filter((key) => !FIELDS.has(key)).map((key) => `${key}: is not an allowed field`);
  if (!ID.test(event.id ?? '')) errors.push('id: must be "RF-" followed by 12 lowercase hex characters');
  if (!LEDGER_STATES.includes(event.state)) errors.push(`state: must be one of ${LEDGER_STATES.join(', ')}`);
  if (!isNonBlank(event.by)) errors.push('by: must be one non-blank line');
  if (!isCalendarDate(event.date ?? '')) errors.push('date: must be a YYYY-MM-DD calendar date');
  if ('ref' in event && !isNonBlank(event.ref)) errors.push('ref: must be one non-blank line');
  return errors;
}

export function readLedger(file = LEDGER_FILE) {
  if (!fs.existsSync(file)) return { ok: true, errors: [], events: [] };
  const text = fs.readFileSync(file, 'utf8');
  const errors = [];
  const events = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!/\S/.test(line)) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      errors.push(`line ${index + 1}: is not valid JSON (${error.message.replace(/\s+/g, ' ')})`);
      return;
    }
    const problems = eventErrors(event);
    if (problems.length > 0) errors.push(...problems.map((message) => `line ${index + 1}: ${message}`));
    else events.push(event);
  });
  return { ok: errors.length === 0, errors, events };
}

// The ledger is append-only, so the last event for an id decides its state.
export function latestStates(events) {
  const states = new Map();
  for (const event of events) states.set(event.id, event);
  return states;
}

export function appendEvent({ ledgerFile = LEDGER_FILE, inboxDir = INBOX_DIR, event }) {
  const errors = eventErrors(event);
  if (errors.length > 0) return { ok: false, errors };
  const existing = readLedger(ledgerFile);
  if (!existing.ok) return { ok: false, errors: existing.errors.map((message) => `${ledgerFile}: ${message}`) };
  const inbox = validateInbox(inboxDir);
  if (!inbox.ok) return { ok: false, errors: inbox.errors };
  const known = inbox.entries.some(({ entry }) => entry.findings.some(({ id }) => id === event.id));
  if (!known) return { ok: false, errors: [`id: ${event.id} is not a finding in ${inboxDir}`] };
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
  const needsBreak = fs.existsSync(ledgerFile) && !fs.readFileSync(ledgerFile, 'utf8').endsWith('\n') && fs.statSync(ledgerFile).size > 0;
  fs.appendFileSync(ledgerFile, `${needsBreak ? '\n' : ''}${JSON.stringify(event)}\n`);
  return { ok: true, errors: [] };
}

function main(argv) {
  const [command, ...rest] = argv;
  let values;
  try {
    ({ values } = parseArgs({
      args: rest,
      options: {
        id: { type: 'string' }, state: { type: 'string' }, by: { type: 'string' }, ref: { type: 'string' },
        date: { type: 'string' }, ledger: { type: 'string' }, inbox: { type: 'string' },
      },
      strict: true,
    }));
  } catch {
    console.error(USAGE);
    return 2;
  }
  const ledgerFile = values.ledger ?? LEDGER_FILE;
  if (command === 'validate') {
    const { ok, errors, events } = readLedger(ledgerFile);
    if (!ok) {
      console.error(`retro ledger invalid: ${errors.length} error${errors.length === 1 ? '' : 's'} in ${ledgerFile}`);
      for (const error of errors) console.error(`  ${error}`);
      return 1;
    }
    console.log(`retro ledger valid: ${events.length} event${events.length === 1 ? '' : 's'} in ${ledgerFile}`);
    return 0;
  }
  if (command === 'append') {
    const event = {
      id: values.id, state: values.state, by: values.by,
      date: values.date ?? new Date().toISOString().slice(0, 10),
      ...(values.ref !== undefined && { ref: values.ref }),
    };
    const result = appendEvent({ ledgerFile, inboxDir: values.inbox ?? INBOX_DIR, event });
    if (!result.ok) {
      console.error('retro ledger: event rejected');
      for (const error of result.errors) console.error(`  ${error}`);
      return 1;
    }
    console.log(`retro ledger: ${event.id} ${event.state} by ${event.by}`);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
