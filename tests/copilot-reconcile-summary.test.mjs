import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCopilotReconcile } from '../scripts/ironbots-daily-reporter.mjs';

const now = Date.parse('2026-10-27T12:00:00Z');

test('missing or malformed snapshot reports UNKNOWN', () => {
  assert.deepEqual(summarizeCopilotReconcile({ status: 'UNKNOWN', missing: true }, now), { status: 'UNKNOWN' });
  assert.deepEqual(summarizeCopilotReconcile(null, now), { status: 'UNKNOWN' });
});

test('summary keeps counts and ages only, never balances or account names', () => {
  const out = summarizeCopilotReconcile({
    status: 'STALE_PROJECTION',
    timestamp: '2026-10-27T06:00:00Z',
    summary: { mapped: 5, match: 1, drift: 4, unmappedCopilot: 4, totalAbsDriftMinor: 154010829 },
    projection: { ageHours: 813.9, stale: true },
    rows: [{ ledgerAccount: 'Assets:Fidelity:Checking', copilotMinor: 95035 }]
  }, now);
  assert.deepEqual(out, {
    status: 'STALE_PROJECTION',
    mapped: 5,
    match: 1,
    drift: 4,
    unmappedCopilot: 4,
    projectionAgeHours: 813.9,
    projectionStale: true,
    snapshotAgeHours: 6
  });
  assert.ok(!JSON.stringify(out).includes('Fidelity'));
});
