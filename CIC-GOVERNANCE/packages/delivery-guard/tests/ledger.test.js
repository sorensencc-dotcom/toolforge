import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBudgetLedger,
  BudgetLedger,
  BudgetExhaustedError,
  LedgerError,
  ReservationNotFoundError,
  ReservationStateError,
  ReservationAlreadySettledError,
} from '../src/index.js';

test('grantBudget adds funds and computes accurate available budget', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });

    const grant1 = ledger.grantBudget({ amount: 50.0, reason: 'Initial seed' });
    assert.equal(grant1.amount, 50.0);
    assert.equal(grant1.totalGranted, 50.0);
    assert.equal(grant1.availableBudget, 50.0);

    const grant2 = ledger.grantBudget({ amount: 25.5, reason: 'Top-up' });
    assert.equal(grant2.amount, 25.5);
    assert.equal(grant2.totalGranted, 75.5);
    assert.equal(grant2.availableBudget, 75.5);

    const summary = ledger.getSummary();
    assert.equal(summary.totalGranted, 75.5);
    assert.equal(summary.totalSpent, 0);
    assert.equal(summary.totalReserved, 0);
    assert.equal(summary.availableBudget, 75.5);
    assert.equal(summary.activeReservations.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('reserveBudget atomically locks funds and handles exact boundary conditions', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });

    ledger.grantBudget({ amount: 10.0 });

    // 1. Partial reservation
    const res1 = ledger.reserveBudget({
      amount: 4.0,
      reservationId: 'res-1',
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
    });
    assert.equal(res1.reservationId, 'res-1');
    assert.equal(res1.amount, 4.0);
    assert.equal(res1.remainingBudget, 6.0);
    assert.equal(res1.granted, true);

    // 2. Exact boundary reservation (remaining 6.0 reserved exactly)
    const res2 = ledger.reserveBudget({
      amount: 6.0,
      reservationId: 'res-2',
      provider: 'openrouter',
      model: 'openai/gpt-4o',
    });
    assert.equal(res2.reservationId, 'res-2');
    assert.equal(res2.amount, 6.0);
    assert.equal(res2.remainingBudget, 0.0);

    const summary = ledger.getSummary();
    assert.equal(summary.totalGranted, 10.0);
    assert.equal(summary.totalReserved, 10.0);
    assert.equal(summary.availableBudget, 0.0);
    assert.equal(summary.activeReservations.length, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('reserveBudget rejects overspend with BudgetExhaustedError', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });

    ledger.grantBudget({ amount: 5.0 });

    assert.throws(
      () => ledger.reserveBudget({ amount: 5.01 }),
      (err) => {
        assert.ok(err instanceof BudgetExhaustedError);
        assert.equal(err.requested, 5.01);
        assert.equal(err.available, 5.0);
        return true;
      },
    );

    // Ensure state remained unchanged
    const summary = ledger.getSummary();
    assert.equal(summary.availableBudget, 5.0);
    assert.equal(summary.totalReserved, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('reserveBudget rejects duplicate reservationId', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });

    ledger.grantBudget({ amount: 20.0 });
    ledger.reserveBudget({ amount: 5.0, reservationId: 'dup-id' });

    assert.throws(
      () => ledger.reserveBudget({ amount: 5.0, reservationId: 'dup-id' }),
      (err) => {
        assert.ok(err instanceof LedgerError);
        assert.match(err.message, /already exists/);
        return true;
      },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('settleReservation finalizes spend, releases unused estimate, and prevents double-settlement', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });

    ledger.grantBudget({ amount: 10.0 });
    ledger.reserveBudget({ amount: 4.0, reservationId: 'res-settle' });

    // Settle with lower actual cost (actual 2.50 vs reserved 4.00 -> 1.50 refunded)
    const settleRes = ledger.settleReservation({
      reservationId: 'res-settle',
      actualCost: 2.50,
    });

    assert.equal(settleRes.reservationId, 'res-settle');
    assert.equal(settleRes.reservedAmount, 4.0);
    assert.equal(settleRes.actualCost, 2.50);
    assert.equal(settleRes.releasedAmount, 1.50);
    assert.equal(settleRes.remainingBudget, 7.50);

    const summary = ledger.getSummary();
    assert.equal(summary.totalGranted, 10.0);
    assert.equal(summary.totalSpent, 2.50);
    assert.equal(summary.totalReserved, 0);
    assert.equal(summary.availableBudget, 7.50);

    // Double-settlement protection
    assert.throws(
      () => ledger.settleReservation({ reservationId: 'res-settle', actualCost: 1.0 }),
      (err) => {
        assert.ok(err instanceof ReservationAlreadySettledError);
        assert.ok(err instanceof ReservationStateError);
        assert.equal(err.currentStatus, 'settled');
        return true;
      },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('releaseReservation cancels pending reservation and returns full budget', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });

    ledger.grantBudget({ amount: 15.0 });
    ledger.reserveBudget({ amount: 5.0, reservationId: 'res-release' });

    assert.equal(ledger.getSummary().availableBudget, 10.0);

    const releaseRes = ledger.releaseReservation({
      reservationId: 'res-release',
      reason: 'Request cancelled before dispatch',
    });

    assert.equal(releaseRes.reservationId, 'res-release');
    assert.equal(releaseRes.releasedAmount, 5.0);
    assert.equal(releaseRes.remainingBudget, 15.0);

    const summary = ledger.getSummary();
    assert.equal(summary.totalGranted, 15.0);
    assert.equal(summary.totalSpent, 0);
    assert.equal(summary.totalReserved, 0);
    assert.equal(summary.availableBudget, 15.0);

    // Double-release protection
    assert.throws(
      () => ledger.releaseReservation({ reservationId: 'res-release' }),
      (err) => {
        assert.ok(err instanceof ReservationStateError);
        assert.equal(err.currentStatus, 'released');
        return true;
      },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('settle and release throw ReservationNotFoundError on unknown reservation ID', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });

    ledger.grantBudget({ amount: 10.0 });

    assert.throws(
      () => ledger.settleReservation({ reservationId: 'non-existent', actualCost: 1.0 }),
      ReservationNotFoundError,
    );

    assert.throws(
      () => ledger.releaseReservation({ reservationId: 'non-existent' }),
      ReservationNotFoundError,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('replays ledger on restart from disk and recovers accurate state', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');

    // Process 1: perform sequence of operations
    const ledger1 = createBudgetLedger({ storagePath });
    ledger1.grantBudget({ amount: 100.0 });
    ledger1.reserveBudget({ amount: 20.0, reservationId: 'r1' });
    ledger1.reserveBudget({ amount: 30.0, reservationId: 'r2' });
    ledger1.settleReservation({ reservationId: 'r1', actualCost: 15.0 }); // 5.0 refunded
    ledger1.releaseReservation({ reservationId: 'r2' }); // 30.0 refunded
    ledger1.reserveBudget({ amount: 10.0, reservationId: 'r3' }); // active

    // Process 2: re-instantiate pointing to same storage path
    const ledger2 = createBudgetLedger({ storagePath });
    const summary = ledger2.getSummary();

    assert.equal(summary.totalGranted, 100.0);
    assert.equal(summary.totalSpent, 15.0);
    assert.equal(summary.totalReserved, 10.0);
    assert.equal(summary.availableBudget, 75.0);
    assert.equal(summary.activeReservations.length, 1);
    assert.equal(summary.activeReservations[0].reservationId, 'r3');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('tolerates and skips malformed JSON records during replay without crashing', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');

    const validRecord1 = JSON.stringify({ type: 'grant', amount: 50.0, timestamp: new Date().toISOString() });
    const corruptedLine = '{"type":"reserve", "amount": 10.0, INVALID_JSON...';
    const emptyLine = '   ';
    const validRecord2 = JSON.stringify({ type: 'reserve', reservationId: 'r1', amount: 12.0, timestamp: new Date().toISOString() });

    fs.writeFileSync(storagePath, `${validRecord1}\n${corruptedLine}\n${emptyLine}\n${validRecord2}\n`, 'utf8');

    const ledger = createBudgetLedger({ storagePath });
    const summary = ledger.getSummary();

    assert.equal(summary.totalGranted, 50.0);
    assert.equal(summary.totalReserved, 12.0);
    assert.equal(summary.availableBudget, 38.0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('handles concurrent reservations without overspending budget', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-ledger-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });

    // Total budget: 10.00
    ledger.grantBudget({ amount: 10.0 });

    // Launch 15 concurrent reservation attempts of 1.00 each
    const attempts = Array.from({ length: 15 }, (_, i) => ({
      amount: 1.0,
      reservationId: `concurrent-res-${i}`,
    }));

    const results = await Promise.all(
      attempts.map(async (req) => {
        try {
          const res = ledger.reserveBudget(req);
          return { success: true, res };
        } catch (err) {
          return { success: false, err };
        }
      }),
    );

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Exactly 10 must succeed, and 5 must fail with BudgetExhaustedError
    assert.equal(successes.length, 10);
    assert.equal(failures.length, 5);

    for (const f of failures) {
      assert.ok(f.err instanceof BudgetExhaustedError);
    }

    const summary = ledger.getSummary();
    assert.equal(summary.totalGranted, 10.0);
    assert.equal(summary.totalReserved, 10.0);
    assert.equal(summary.availableBudget, 0.0);
    assert.equal(summary.activeReservations.length, 10);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
