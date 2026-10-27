import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, toMinor, ledgerToCopilotSign, runCopilotReconcile } from '../scripts/copilot-ironledger-reconcile.mjs';

test('entrypoint exits 2 with usage when --copilot is missing', () => {
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(runCopilotReconcile([]), 2);
  } finally {
    console.error = original;
  }
});

const now = Date.parse('2026-10-27T00:00:00Z');
const base = { toleranceMinor: 100, now, maxProjectionAgeHours: 48, projectionBuiltAtUtc: '2026-10-26T12:00:00Z' };
const acct = (o) => ({ institution: 'Fidelity', mask: '1111', type: 'depository', balance: 10, isUserClosed: false, isUserHidden: false, ...o });

test('toMinor rounds float dollars to cents', () => {
  assert.equal(toMinor(505.11), 50511);
  assert.equal(toMinor(0.1 + 0.2), 30);
});

test('liability sign flips ledger minor units to owed-positive', () => {
  assert.equal(ledgerToCopilotSign('Liabilities:CreditCard:X', -50000), 50000);
  assert.equal(ledgerToCopilotSign('Assets:A', 50000), 50000);
});

test('match within tolerance, drift beyond it', () => {
  const map = { 'Assets:A': [{ institution: 'Fidelity', mask: '1111' }], 'Assets:B': [{ institution: 'Fidelity', mask: '2222' }] };
  const r = reconcile({
    ...base, map,
    copilotAccounts: [acct({ balance: 10.5 }), acct({ mask: '2222', balance: 20 })],
    ledgerBalances: [
      { account: 'Assets:A', currency: 'USD', minorUnits: 1000 },
      { account: 'Assets:B', currency: 'USD', minorUnits: 1000 }
    ]
  });
  assert.equal(r.rows[0].status, 'MATCH');
  assert.equal(r.rows[1].status, 'DRIFT');
  assert.equal(r.rows[1].deltaMinor, 1000);
  assert.equal(r.status, 'DRIFT');
});

test('stale projection overrides status; closed and hidden accounts are ignored', () => {
  const r = reconcile({
    ...base, projectionBuiltAtUtc: '2026-09-23T00:00:00Z', map: {},
    copilotAccounts: [acct({ isUserClosed: true }), acct({ mask: '3333', isUserHidden: true }), acct({ mask: '4444' })],
    ledgerBalances: []
  });
  assert.equal(r.status, 'STALE_PROJECTION');
  assert.equal(r.unmappedCopilot.length, 1);
  assert.equal(r.unmappedCopilot[0].mask, '4444');
});

test('mapped account absent from ledger or Copilot is reported, not hidden', () => {
  const map = { 'Assets:Gone': [{ institution: 'Fidelity', mask: '1111' }], 'Assets:B': [{ institution: 'Nope', mask: '9' }] };
  const r = reconcile({
    ...base, map, copilotAccounts: [acct()],
    ledgerBalances: [{ account: 'Assets:B', currency: 'USD', minorUnits: 5 }]
  });
  assert.deepEqual(r.rows.map(x => x.status), ['MISSING_IN_LEDGER', 'MISSING_IN_COPILOT']);
});
