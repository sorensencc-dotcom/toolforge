import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export class LedgerError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'LedgerError';
    this.details = details;
  }
}

export class BudgetExhaustedError extends LedgerError {
  constructor(requested, available) {
    super(`Budget exhausted: requested ${requested}, available ${available}`);
    this.name = 'BudgetExhaustedError';
    this.requested = requested;
    this.available = available;
  }
}

export class ReservationNotFoundError extends LedgerError {
  constructor(reservationId) {
    super(`Reservation not found: ${reservationId}`);
    this.name = 'ReservationNotFoundError';
    this.reservationId = reservationId;
  }
}

export class ReservationStateError extends LedgerError {
  constructor(reservationId, currentStatus) {
    super(`Reservation ${reservationId} is already ${currentStatus}`);
    this.name = 'ReservationStateError';
    this.reservationId = reservationId;
    this.currentStatus = currentStatus;
  }
}

export class ReservationAlreadySettledError extends ReservationStateError {
  constructor(reservationId) {
    super(reservationId, 'settled');
    this.name = 'ReservationAlreadySettledError';
  }
}

function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // synchronous spin-wait for short lock contention intervals
  }
}

export function getDefaultLedgerStoragePath() {
  if (process.env.DELIVERY_GUARD_BUDGET_LEDGER_PATH) {
    return path.resolve(process.env.DELIVERY_GUARD_BUDGET_LEDGER_PATH);
  }
  return path.join(os.homedir(), '.delivery-guard', 'budget-ledger.jsonl');
}

export class BudgetLedger {
  constructor(options = {}) {
    this.storagePath = options.storagePath
      ? path.resolve(options.storagePath)
      : getDefaultLedgerStoragePath();
    this.lockPath = `${this.storagePath}.lock`;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 5000;
    this.staleLockMs = options.staleLockMs ?? 10000;
  }

  // TODO: Add periodic snapshot checkpoints when ledger exceeds 10k events to bound replay overhead.

  _acquireLock() {
    const start = Date.now();
    let delay = 10;

    const dir = path.dirname(this.storagePath);
    fs.mkdirSync(dir, { recursive: true });

    while (Date.now() - start < this.lockTimeoutMs) {
      try {
        const fd = fs.openSync(this.lockPath, 'wx');
        const lockInfo = JSON.stringify({ pid: process.pid, time: Date.now() });
        fs.writeFileSync(fd, lockInfo, 'utf8');
        fs.closeSync(fd);
        return true;
      } catch (err) {
        if (err.code === 'EEXIST') {
          // Check for stale lock
          try {
            const stats = fs.statSync(this.lockPath);
            if (Date.now() - stats.mtimeMs > this.staleLockMs) {
              fs.rmSync(this.lockPath, { force: true });
              continue;
            }
          } catch {
            // Lock was removed in between
            continue;
          }

          sleepMs(delay);
          delay = Math.min(delay * 1.5, 100);
        } else {
          throw new LedgerError(`Failed to acquire lock: ${err.message}`);
        }
      }
    }
    throw new LedgerError(`Lock acquisition timed out after ${this.lockTimeoutMs}ms`);
  }

  _releaseLock() {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.rmSync(this.lockPath, { force: true });
      }
    } catch {
      // Best effort lock release
    }
  }

  _withLock(fn) {
    this._acquireLock();
    try {
      return fn();
    } finally {
      this._releaseLock();
    }
  }

  _readRecords() {
    if (!fs.existsSync(this.storagePath)) {
      return [];
    }

    const content = fs.readFileSync(this.storagePath, 'utf8');
    const lines = content.split('\n');
    const records = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      try {
        const record = JSON.parse(line);
        if (record && typeof record === 'object' && record.type) {
          records.push(record);
        }
      } catch {
        // Skip malformed record lines safely during replay
      }
    }
    return records;
  }

  _computeState(records) {
    let totalGranted = 0;
    let totalSpent = 0;
    const reservations = new Map();

    for (const record of records) {
      if (record.type === 'grant') {
        const amount = Number(record.amount) || 0;
        totalGranted += amount;
      } else if (record.type === 'reserve') {
        const amount = Number(record.amount) || 0;
        reservations.set(record.reservationId, {
          reservationId: record.reservationId,
          amount,
          provider: record.provider,
          model: record.model,
          metadata: record.metadata,
          timestamp: record.timestamp,
          status: 'pending',
        });
      } else if (record.type === 'settle') {
        const actualCost = Number(record.actualCost) || 0;
        totalSpent += actualCost;
        const res = reservations.get(record.reservationId);
        if (res) {
          res.status = 'settled';
          res.actualCost = actualCost;
        }
      } else if (record.type === 'release') {
        const res = reservations.get(record.reservationId);
        if (res) {
          res.status = 'released';
          res.releaseReason = record.reason;
        }
      }
    }

    let totalReserved = 0;
    const activeReservations = [];

    for (const res of reservations.values()) {
      if (res.status === 'pending') {
        totalReserved += res.amount;
        activeReservations.push(res);
      }
    }

    // Rounding to 6 decimal places to prevent float precision drift
    totalGranted = Math.round(totalGranted * 1e6) / 1e6;
    totalSpent = Math.round(totalSpent * 1e6) / 1e6;
    totalReserved = Math.round(totalReserved * 1e6) / 1e6;
    const availableBudget = Math.max(0, Math.round((totalGranted - totalSpent - totalReserved) * 1e6) / 1e6);

    return {
      totalGranted,
      totalSpent,
      totalReserved,
      availableBudget,
      reservations,
      activeReservations,
    };
  }

  _appendRecord(record) {
    const dir = path.dirname(this.storagePath);
    fs.mkdirSync(dir, { recursive: true });
    const line = `${JSON.stringify(record)}\n`;
    fs.appendFileSync(this.storagePath, line, 'utf8');
  }

  getSummary() {
    return this._withLock(() => {
      const records = this._readRecords();
      const state = this._computeState(records);
      return {
        totalGranted: state.totalGranted,
        totalSpent: state.totalSpent,
        totalReserved: state.totalReserved,
        availableBudget: state.availableBudget,
        activeReservations: state.activeReservations,
      };
    });
  }

  grantBudget({ amount, grantId, reason, metadata }) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new LedgerError(`Grant amount must be a positive number, got ${amount}`);
    }

    return this._withLock(() => {
      const record = {
        type: 'grant',
        grantId: grantId || crypto.randomUUID(),
        amount: numAmount,
        reason: reason || 'Budget deposit',
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      };

      this._appendRecord(record);

      const records = this._readRecords();
      const state = this._computeState(records);
      return {
        grantId: record.grantId,
        amount: numAmount,
        totalGranted: state.totalGranted,
        availableBudget: state.availableBudget,
      };
    });
  }

  reserveBudget({ amount, reservationId, provider, model, metadata }) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new LedgerError(`Reserve amount must be a positive number, got ${amount}`);
    }

    const resId = reservationId || crypto.randomUUID();

    return this._withLock(() => {
      const records = this._readRecords();
      const state = this._computeState(records);

      if (state.reservations.has(resId)) {
        throw new LedgerError(`Reservation ID ${resId} already exists`);
      }

      if (numAmount > state.availableBudget) {
        throw new BudgetExhaustedError(numAmount, state.availableBudget);
      }

      const record = {
        type: 'reserve',
        reservationId: resId,
        amount: numAmount,
        provider: provider || 'unknown',
        model: model || 'unknown',
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      };

      this._appendRecord(record);

      const newAvailable = Math.max(0, Math.round((state.availableBudget - numAmount) * 1e6) / 1e6);
      return {
        reservationId: resId,
        amount: numAmount,
        remainingBudget: newAvailable,
        granted: true,
      };
    });
  }

  settleReservation({ reservationId, actualCost, metadata }) {
    const numCost = Number(actualCost);
    if (isNaN(numCost) || numCost < 0) {
      throw new LedgerError(`Actual cost must be a non-negative number, got ${actualCost}`);
    }

    return this._withLock(() => {
      const records = this._readRecords();
      const state = this._computeState(records);
      const res = state.reservations.get(reservationId);

      if (!res) {
        throw new ReservationNotFoundError(reservationId);
      }

      if (res.status === 'settled') {
        throw new ReservationAlreadySettledError(reservationId);
      }

      if (res.status !== 'pending') {
        throw new ReservationStateError(reservationId, res.status);
      }

      const reservedAmount = res.amount;
      const releasedAmount = Math.max(0, Math.round((reservedAmount - numCost) * 1e6) / 1e6);

      const record = {
        type: 'settle',
        reservationId,
        reservedAmount,
        actualCost: numCost,
        releasedAmount,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      };

      this._appendRecord(record);

      const updatedRecords = this._readRecords();
      const updatedState = this._computeState(updatedRecords);

      return {
        reservationId,
        reservedAmount,
        actualCost: numCost,
        releasedAmount,
        remainingBudget: updatedState.availableBudget,
      };
    });
  }

  releaseReservation({ reservationId, reason, metadata }) {
    return this._withLock(() => {
      const records = this._readRecords();
      const state = this._computeState(records);
      const res = state.reservations.get(reservationId);

      if (!res) {
        throw new ReservationNotFoundError(reservationId);
      }

      if (res.status !== 'pending') {
        throw new ReservationStateError(reservationId, res.status);
      }

      const record = {
        type: 'release',
        reservationId,
        reservedAmount: res.amount,
        reason: reason || 'Reservation cancelled',
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      };

      this._appendRecord(record);

      const updatedRecords = this._readRecords();
      const updatedState = this._computeState(updatedRecords);

      return {
        reservationId,
        releasedAmount: res.amount,
        remainingBudget: updatedState.availableBudget,
      };
    });
  }
}

export function createBudgetLedger(options = {}) {
  return new BudgetLedger(options);
}
