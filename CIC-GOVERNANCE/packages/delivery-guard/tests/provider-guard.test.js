import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBudgetLedger,
  createGuardedProvider,
  estimateModelCost,
  normalizeModelId,
  buildNormalizedModelMap,
  GuardedProviderError,
  UnknownModelError,
  ModelRegistryConflictError,
  BudgetExhaustedError,
} from '../src/index.js';

const MOCK_REGISTRY = {
  'openrouter/oxalpha': {
    modelId: 'openrouter/oxalpha',
    apiSlug: 'oxalpha',
    isFree: true,
    inputCostPer1M: 0.0,
    outputCostPer1M: 0.0,
  },
  'oxalpha': {
    modelId: 'openrouter/oxalpha',
    apiSlug: 'oxalpha',
    isFree: true,
    inputCostPer1M: 0.0,
    outputCostPer1M: 0.0,
  },
  'openrouter/anthropic/claude-3.5-sonnet': {
    modelId: 'openrouter/anthropic/claude-3.5-sonnet',
    apiSlug: 'anthropic/claude-3.5-sonnet',
    isFree: false,
    maxOutputTokens: 8192,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  'anthropic/claude-3.5-sonnet': {
    modelId: 'openrouter/anthropic/claude-3.5-sonnet',
    apiSlug: 'anthropic/claude-3.5-sonnet',
    isFree: false,
    maxOutputTokens: 8192,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
};

test('estimateModelCost calculates conservative pre-dispatch estimate for paid models', () => {
  const query = {
    model: 'anthropic/claude-3.5-sonnet',
    prompt: 'A'.repeat(4000), // ~1000 tokens
    maxTokens: 2000,
  };

  // input: (1000 * 3.0)/1e6 = 0.003
  // output: (2000 * 15.0)/1e6 = 0.030
  // total: 0.033
  const cost = estimateModelCost(query, MOCK_REGISTRY);
  assert.equal(cost, 0.033);
});

test('estimateModelCost clamps maxTokens against model maxOutputTokens', () => {
  const query = {
    model: 'openrouter/anthropic/claude-3.5-sonnet',
    prompt: '', // 0 tokens
    maxTokens: 50000, // exceeds maxOutputTokens (8192)
  };

  // input: 0
  // output: (8192 * 15.0)/1e6 = 0.12288
  const cost = estimateModelCost(query, MOCK_REGISTRY);
  assert.equal(cost, 0.12288);
});

test('estimateModelCost returns 0.0 for free models and handles empty prompts', () => {
  const query = {
    model: 'oxalpha',
    prompt: 'Some big prompt',
  };

  const cost = estimateModelCost(query, MOCK_REGISTRY);
  assert.equal(cost, 0.0);
});

test('estimateModelCost fails closed with UnknownModelError for unlisted models', () => {
  assert.throws(
    () => estimateModelCost({ model: 'unlisted/model', prompt: 'test' }, MOCK_REGISTRY),
    (err) => {
      assert.ok(err instanceof UnknownModelError);
      assert.equal(err.code, 'UNKNOWN_MODEL');
      assert.equal(err.model, 'unlisted/model');
      return true;
    },
  );
});

test('buildNormalizedModelMap detects and throws on conflicting rate card aliases', () => {
  const conflictRegistry = {
    'my-model': { isFree: true, inputCostPer1M: 0, outputCostPer1M: 0 },
    'openrouter/my-model': { isFree: false, inputCostPer1M: 5, outputCostPer1M: 10 },
  };

  assert.throws(
    () => buildNormalizedModelMap(conflictRegistry),
    (err) => {
      assert.ok(err instanceof ModelRegistryConflictError);
      assert.equal(err.code, 'MODEL_REGISTRY_CONFLICT');
      return true;
    },
  );
});

test('paid dispatch succeeds when budget is available, reserving and settling with refund', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-guard-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });
    ledger.grantBudget({ amount: 1.0 });

    let rawDispatched = false;
    const mockProvider = {
      async execute(query) {
        rawDispatched = true;
        return {
          model: query.model,
          response: 'Hello from Claude',
          usage: { inputTokens: 500, outputTokens: 200, costUsd: 0.0045 },
        };
      },
    };

    const guarded = createGuardedProvider(mockProvider, {
      ledger,
      modelRegistry: MOCK_REGISTRY,
      providerName: 'openrouter',
    });

    const result = await guarded.execute({
      queryId: 'q-paid-1',
      model: 'anthropic/claude-3.5-sonnet',
      prompt: 'Hello Claude',
      maxTokens: 1000,
    });

    assert.equal(rawDispatched, true);
    assert.equal(result.response, 'Hello from Claude');

    const summary = ledger.getSummary();
    assert.equal(summary.totalGranted, 1.0);
    assert.equal(summary.totalSpent, 0.0045);
    assert.equal(summary.totalReserved, 0);
    assert.equal(summary.availableBudget, 0.9955);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('paid dispatch is blocked with 0 network calls when budget is exhausted', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-guard-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });
    ledger.grantBudget({ amount: 0.01 }); // only 1 cent

    let networkCallMade = false;
    const mockProvider = {
      async execute() {
        networkCallMade = true;
        return { response: 'Should not happen' };
      },
    };

    const guarded = createGuardedProvider(mockProvider, {
      ledger,
      modelRegistry: MOCK_REGISTRY,
      providerName: 'openrouter',
    });

    await assert.rejects(
      () => guarded.execute({
        model: 'anthropic/claude-3.5-sonnet',
        prompt: 'A'.repeat(8000), // requires more than 0.01
        maxTokens: 4000,
      }),
      (err) => {
        assert.ok(err instanceof GuardedProviderError);
        assert.equal(err.code, 'BUDGET_EXHAUSTED');
        assert.equal(err.isBudgetExhausted, true);
        assert.ok(err.cause instanceof BudgetExhaustedError);
        return true;
      },
    );

    assert.equal(networkCallMade, false, 'No network call should be made when budget is exhausted');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('provider failure triggers automatic reservation release back to ledger balance', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-guard-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });
    ledger.grantBudget({ amount: 10.0 });

    const mockProvider = {
      async execute() {
        throw new Error('OpenRouter HTTP 500: Internal Server Error');
      },
    };

    const guarded = createGuardedProvider(mockProvider, {
      ledger,
      modelRegistry: MOCK_REGISTRY,
      providerName: 'openrouter',
    });

    await assert.rejects(
      () => guarded.execute({
        model: 'openrouter/anthropic/claude-3.5-sonnet',
        prompt: 'Hello',
        maxTokens: 1000,
      }),
      (err) => {
        assert.ok(err instanceof GuardedProviderError);
        assert.equal(err.code, 'DISPATCH_FAILED');
        assert.match(err.message, /Internal Server Error/);
        return true;
      },
    );

    // Reserved funds must be completely released
    const summary = ledger.getSummary();
    assert.equal(summary.totalGranted, 10.0);
    assert.equal(summary.totalSpent, 0);
    assert.equal(summary.totalReserved, 0);
    assert.equal(summary.availableBudget, 10.0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('free models bypass budget reservation and dispatch cleanly', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-guard-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });
    // Note: 0 budget granted

    let dispatched = false;
    const mockProvider = {
      async execute(q) {
        dispatched = true;
        return { model: q.model, response: 'Ox Alpha Free Response' };
      },
    };

    const guarded = createGuardedProvider(mockProvider, {
      ledger,
      modelRegistry: MOCK_REGISTRY,
      providerName: 'openrouter',
    });

    const res = await guarded.execute({
      model: 'openrouter/oxalpha',
      prompt: 'Hello Free Model',
    });

    assert.equal(dispatched, true);
    assert.equal(res.response, 'Ox Alpha Free Response');

    const summary = ledger.getSummary();
    assert.equal(summary.totalGranted, 0);
    assert.equal(summary.totalSpent, 0);
    assert.equal(summary.totalReserved, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('actual cost exceeding estimate settles full actual cost with overrun metadata in ledger', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-guard-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });
    ledger.grantBudget({ amount: 10.0 });

    const mockProvider = {
      async execute() {
        // Return usage cost higher than estimated
        return {
          response: 'Done',
          usage: { costUsd: 0.50 },
        };
      },
    };

    const guarded = createGuardedProvider(mockProvider, {
      ledger,
      modelRegistry: MOCK_REGISTRY,
      providerName: 'openrouter',
    });

    await guarded.execute({
      model: 'anthropic/claude-3.5-sonnet',
      prompt: 'Small prompt',
      maxTokens: 100, // estimated small, e.g. ~0.002
    });

    const summary = ledger.getSummary();
    assert.equal(summary.totalSpent, 0.50);
    assert.equal(summary.availableBudget, 9.50);

    const records = JSON.parse(`[${fs.readFileSync(storagePath, 'utf8').trim().split('\n').join(',')}]`);
    const settleRecord = records.find((r) => r.type === 'settle');
    assert.ok(settleRecord);
    assert.equal(settleRecord.actualCost, 0.50);
    assert.equal(settleRecord.metadata.overrun, true);
    assert.ok(settleRecord.metadata.overrunAmount > 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('settlement failure throws GuardedProviderError with code SETTLEMENT_FAILED and attached result', async () => {
  const mockLedger = {
    reserveBudget() { return { reservationId: 'r1', amount: 0.05 }; },
    settleReservation() { throw new Error('Simulated disk write failure during settlement'); },
    releaseReservation() {},
  };

  const mockProvider = {
    async execute() {
      return { response: 'Valid LLM output payload', usage: { costUsd: 0.02 } };
    },
  };

  const guarded = createGuardedProvider(mockProvider, {
    ledger: mockLedger,
    modelRegistry: MOCK_REGISTRY,
    providerName: 'openrouter',
  });

  await assert.rejects(
    () => guarded.execute({ model: 'anthropic/claude-3.5-sonnet', prompt: 'test' }),
    (err) => {
      assert.ok(err instanceof GuardedProviderError);
      assert.equal(err.code, 'SETTLEMENT_FAILED');
      assert.equal(err.result.response, 'Valid LLM output payload');
      assert.match(err.message, /Simulated disk write failure/);
      return true;
    },
  );
});

test('handles concurrent guarded provider calls without overspending budget', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-guard-'));
  try {
    const storagePath = path.join(tempDir, 'budget.jsonl');
    const ledger = createBudgetLedger({ storagePath });
    // Total budget 0.10
    ledger.grantBudget({ amount: 0.10 });

    const mockProvider = {
      async execute() {
        return { response: 'done', usage: { costUsd: 0.015 } };
      },
    };

    const guarded = createGuardedProvider(mockProvider, {
      ledger,
      modelRegistry: MOCK_REGISTRY,
      providerName: 'openrouter',
    });

    // Each call estimates ~0.02
    const calls = Array.from({ length: 10 }, (_, i) =>
      guarded.execute({
        queryId: `concurrent-q-${i}`,
        model: 'anthropic/claude-3.5-sonnet',
        prompt: 'test prompt',
        maxTokens: 1000,
      }).then(
        (res) => ({ success: true, res }),
        (err) => ({ success: false, err }),
      ),
    );

    const results = await Promise.all(calls);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // With budget 0.10 and estimated cost ~0.015-0.02, only 5-6 can succeed
    assert.ok(successes.length >= 4 && successes.length <= 6);
    assert.ok(failures.length >= 4);

    for (const f of failures) {
      assert.equal(f.err.code, 'BUDGET_EXHAUSTED');
    }

    const summary = ledger.getSummary();
    assert.ok(summary.totalSpent <= 0.10);
    assert.ok(summary.availableBudget >= 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
