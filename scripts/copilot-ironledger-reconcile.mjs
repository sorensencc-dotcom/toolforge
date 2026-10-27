#!/usr/bin/env node
/**
 * scripts/copilot-ironledger-reconcile.mjs
 *
 * Read-only reconciliation spike. Compares Copilot Money account balances
 * against the IronLedger projection and writes a drift snapshot to
 * _status-feed/copilot_reconcile.json.
 *
 * Inputs are read-only: a Copilot accounts file (written by a Claude session
 * from the Copilot MCP get-accounts tool) and the IronLedger projection opened
 * with readOnly. The only write is the snapshot, via temp file and rename.
 * No ledger, staging, or projection writes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export const DEFAULTS = {
  projection: 'C:/dev/IronLedger/projection/projection.sqlite',
  map: path.resolve(REPO_ROOT, 'config', 'copilot-ironledger-map.json'),
  out: path.resolve(REPO_ROOT, '_status-feed', 'copilot_reconcile.json'),
  toleranceMinor: 100,
  maxProjectionAgeHours: 48
};

export function toMinor(amount) {
  return Math.round(Number(amount) * 100);
}

// Beancount: assets positive, liabilities negative when owed.
// Copilot: CREDIT and LOAN balances are positive when owed.
export function ledgerToCopilotSign(ledgerAccount, minorUnits) {
  return ledgerAccount.startsWith('Liabilities:') ? -minorUnits : minorUnits;
}

export function accountKey(institution, mask) {
  return `${institution}|${mask}`;
}

export function reconcile({ copilotAccounts, ledgerBalances, map, toleranceMinor, projectionBuiltAtUtc, now, maxProjectionAgeHours }) {
  const copilotByKey = new Map();
  for (const a of copilotAccounts) {
    if (a.isUserClosed || a.isUserHidden || !a.mask) continue;
    copilotByKey.set(accountKey(a.institution, a.mask), a);
  }

  const ledgerByAccount = new Map(
    ledgerBalances.filter(b => b.currency === 'USD').map(b => [b.account, b.minorUnits])
  );

  const rows = [];
  const claimed = new Set();

  for (const [ledgerAccount, targets] of Object.entries(map)) {
    let copilotMinor = 0;
    const members = [];
    let missing = false;
    for (const t of targets) {
      const key = accountKey(t.institution, t.mask);
      const a = copilotByKey.get(key);
      if (!a) { missing = true; continue; }
      claimed.add(key);
      copilotMinor += toMinor(a.balance);
      members.push({ institution: a.institution, mask: a.mask, type: a.type });
    }
    const ledgerRaw = ledgerByAccount.get(ledgerAccount);
    if (ledgerRaw === undefined || missing || members.length === 0) {
      rows.push({
        ledgerAccount,
        members,
        status: ledgerRaw === undefined ? 'MISSING_IN_LEDGER' : 'MISSING_IN_COPILOT',
        copilotMinor: members.length ? copilotMinor : null,
        ledgerMinor: ledgerRaw === undefined ? null : ledgerToCopilotSign(ledgerAccount, ledgerRaw),
        deltaMinor: null
      });
      continue;
    }
    const ledgerMinor = ledgerToCopilotSign(ledgerAccount, ledgerRaw);
    const deltaMinor = copilotMinor - ledgerMinor;
    rows.push({
      ledgerAccount,
      members,
      status: Math.abs(deltaMinor) <= toleranceMinor ? 'MATCH' : 'DRIFT',
      copilotMinor,
      ledgerMinor,
      deltaMinor
    });
  }

  const unmappedCopilot = [...copilotByKey.entries()]
    .filter(([key]) => !claimed.has(key))
    .map(([, a]) => ({ institution: a.institution, mask: a.mask, type: a.type, balanceMinor: toMinor(a.balance) }));

  const ageHours = projectionBuiltAtUtc
    ? Math.round(((now - Date.parse(projectionBuiltAtUtc)) / 36e5) * 10) / 10
    : null;
  const projectionStale = ageHours === null || ageHours > maxProjectionAgeHours;

  const count = s => rows.filter(r => r.status === s).length;
  const summary = {
    mapped: rows.length,
    match: count('MATCH'),
    drift: count('DRIFT'),
    missingInLedger: count('MISSING_IN_LEDGER'),
    missingInCopilot: count('MISSING_IN_COPILOT'),
    unmappedCopilot: unmappedCopilot.length,
    totalAbsDriftMinor: rows.reduce((s, r) => s + (r.deltaMinor === null ? 0 : Math.abs(r.deltaMinor)), 0)
  };
  const status = projectionStale
    ? 'STALE_PROJECTION'
    : summary.drift + summary.missingInLedger + summary.missingInCopilot > 0 ? 'DRIFT' : 'OK';

  return { status, summary, projection: { builtAtUtc: projectionBuiltAtUtc ?? null, ageHours, stale: projectionStale }, rows, unmappedCopilot };
}

export function readLedgerBalances(projectionPath) {
  const db = new DatabaseSync(projectionPath, { readOnly: true });
  try {
    const meta = db.prepare('SELECT compile_run_id, built_at_utc FROM projection_meta').get();
    const balances = db
      .prepare('SELECT account, currency, minor_units, minor_unit_scale FROM proj_balances')
      .all()
      .map(r => {
        if (r.minor_unit_scale !== 2) throw new Error(`unsupported minor_unit_scale ${r.minor_unit_scale} for ${r.account}`);
        return { account: r.account, currency: r.currency, minorUnits: Number(r.minor_units) };
      });
    return { meta, balances };
  } finally {
    db.close();
  }
}

export function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function parseArgs(argv) {
  const opts = { ...DEFAULTS, copilot: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--copilot') { opts.copilot = path.resolve(v); i++; }
    else if (k === '--projection') { opts.projection = v; i++; }
    else if (k === '--map') { opts.map = path.resolve(v); i++; }
    else if (k === '--out') { opts.out = path.resolve(v); i++; }
    else if (k === '--tolerance-minor') { opts.toleranceMinor = Number(v); i++; }
    else if (k === '--max-age-hours') { opts.maxProjectionAgeHours = Number(v); i++; }
  }
  return opts;
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (!opts.copilot) {
    console.error('usage: copilot-ironledger-reconcile.mjs --copilot <accounts.json> [--map f] [--projection f] [--out f]');
    return 2;
  }
  const copilotAccounts = JSON.parse(fs.readFileSync(opts.copilot, 'utf8'));
  const map = JSON.parse(fs.readFileSync(opts.map, 'utf8'));
  const { meta, balances } = readLedgerBalances(opts.projection);

  const result = reconcile({
    copilotAccounts,
    ledgerBalances: balances,
    map,
    toleranceMinor: opts.toleranceMinor,
    projectionBuiltAtUtc: meta?.built_at_utc,
    now: Date.now(),
    maxProjectionAgeHours: opts.maxProjectionAgeHours
  });

  const snapshot = {
    timestamp: new Date().toISOString(),
    source: { copilotAccountCount: copilotAccounts.length, compileRunId: meta?.compile_run_id ?? null },
    toleranceMinor: opts.toleranceMinor,
    ...result
  };
  writeAtomic(opts.out, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`${result.status}: ${result.summary.match} match, ${result.summary.drift} drift, ${result.summary.unmappedCopilot} unmapped -> ${opts.out}`);
  return result.status === 'OK' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
