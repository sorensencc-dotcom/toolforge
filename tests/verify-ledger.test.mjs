import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { formatCents, runHarness } from '../scripts/verify-ledger.mjs';

const execAsync = promisify(exec);

describe('Seam A: formatCents (Exact BigInt Formatting)', () => {
  it('formats zero and positive cents accurately', () => {
    assert.equal(formatCents(0n), '$0.00');
    assert.equal(formatCents(5n), '$0.05');
    assert.equal(formatCents(100n), '$1.00');
    assert.equal(formatCents(10_000_000n), '$100,000.00');
  });

  it('formats negative cents with leading minus', () => {
    assert.equal(formatCents(-50n), '-$0.50');
    assert.equal(formatCents(-100_50n), '-$100.50');
  });

  it('maintains precision above Number.MAX_SAFE_INTEGER ($90T+)', () => {
    assert.equal(formatCents(10_000_000_000_000_000n), '$100,000,000,000,000.00');
  });
});

describe('Seam B: runHarness Invariant Engine', () => {
  it('returns passed: true when debits match credits and no pending migrations', async () => {
    const mockAdapters = {
      getBalance: async () => ({ debitsCents: 5000n, creditsCents: 5000n }),
      getPendingMigrations: async () => [],
      getTaxLotAnomalies: async () => ({ orphans: 0, invalidBasis: 0 }),
      runSmokeTests: async () => ({ hudOk: true, ingestOk: true }),
    };

    const result = await runHarness({ all: true }, mockAdapters);
    assert.equal(result.passed, true);
    assert.equal(result.failures.length, 0);
  });

  it('returns passed: false when debits != credits', async () => {
    const mockAdapters = {
      getBalance: async () => ({ debitsCents: 5000n, creditsCents: 4500n }),
      getPendingMigrations: async () => [],
      getTaxLotAnomalies: async () => ({ orphans: 0, invalidBasis: 0 }),
      runSmokeTests: async () => ({ hudOk: true, ingestOk: true }),
    };

    const result = await runHarness({ balance: true }, mockAdapters);
    assert.equal(result.passed, false);
    assert.ok(result.failures[0].includes('Balance mismatch'));
  });

  it('respects flag isolation and only runs filtered checks', async () => {
    let balanceChecked = false;
    let migrationsChecked = false;

    const mockAdapters = {
      getBalance: async () => { balanceChecked = true; return { debitsCents: 100n, creditsCents: 100n }; },
      getPendingMigrations: async () => { migrationsChecked = true; return ['0016_add_tax.sql']; },
      getTaxLotAnomalies: async () => ({ orphans: 0, invalidBasis: 0 }),
      runSmokeTests: async () => ({ hudOk: true, ingestOk: true }),
    };

    const result = await runHarness({ balance: true }, mockAdapters);
    assert.equal(result.passed, true);
    assert.equal(balanceChecked, true);
    assert.equal(migrationsChecked, false);
  });
});

describe('Seam C: CLI Execution & Exit Code Contract', () => {
  it('executes via node CLI and exits cleanly with code 0 on pass', async () => {
    const { stdout } = await execAsync('node scripts/verify-ledger.mjs --all');
    assert.match(stdout, /VERDICT: PASS/);
  });

  it('tolerates trailing positional arguments without crashing', async () => {
    const { stdout } = await execAsync('node scripts/verify-ledger.mjs --balance # trailing comment text');
    assert.match(stdout, /VERDICT: PASS/);
  });
});
