import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TripwireMonitor, type TripwireConfig, type ExecutionTelemetry } from './tripwire-monitor.ts';

describe('TripwireMonitor', () => {
  const defaultConfig: TripwireConfig = {
    maxRedTests: 3,
    maxFileChurn: 3,
    tokenBudget: 50000,
    wallClockTimeoutMs: 600000 // 10 minutes
  };

  const createTelemetry = (overrides: Partial<ExecutionTelemetry> = {}): ExecutionTelemetry => ({
    startTime: Date.now() - 1000,
    tokensConsumed: 5000,
    consecutiveTestFailures: 0,
    fileEditHistory: [],
    diffHistory: [],
    ...overrides
  });

  it('passes when all metrics are within safe operational boundaries', () => {
    const monitor = new TripwireMonitor(defaultConfig);
    const verdict = monitor.check(createTelemetry({
      startTime: Date.now() - 5000,
      tokensConsumed: 12000,
      consecutiveTestFailures: 1,
      fileEditHistory: [{ path: 'src/core.ts', hash: 'abc1' }],
      diffHistory: ['diff --git a/src/core.ts b/src/core.ts\n+const a = 1;']
    }));

    assert.equal(verdict.tripped, false);
    assert.equal(verdict.reason, undefined);
  });

  it('trips wall-clock timeout guard when elapsed execution time exceeds limit', () => {
    const monitor = new TripwireMonitor(defaultConfig);
    const verdict = monitor.check(createTelemetry({
      startTime: Date.now() - 700000 // 700s > 600s
    }));

    assert.equal(verdict.tripped, true);
    assert.match(verdict.reason ?? '', /^TRIPWIRE_WALL_CLOCK_TIMEOUT/);
  });

  it('trips token budget breach guard when consumed tokens exceed budget', () => {
    const monitor = new TripwireMonitor(defaultConfig);
    const verdict = monitor.check(createTelemetry({
      tokensConsumed: 55000 // > 50000
    }));

    assert.equal(verdict.tripped, true);
    assert.match(verdict.reason ?? '', /^TRIPWIRE_TOKEN_BUDGET_BREACH/);
  });

  it('trips consecutive red tests guard when failures reach maxRedTests', () => {
    const monitor = new TripwireMonitor(defaultConfig);
    const verdict = monitor.check(createTelemetry({
      consecutiveTestFailures: 3 // >= 3
    }));

    assert.equal(verdict.tripped, true);
    assert.match(verdict.reason ?? '', /^TRIPWIRE_CONSECUTIVE_RED_TESTS/);
  });

  it('trips file churn threshold guard when single file is edited >= maxFileChurn times', () => {
    const monitor = new TripwireMonitor(defaultConfig);
    const verdict = monitor.check(createTelemetry({
      fileEditHistory: [
        { path: 'src/engine.ts', hash: 'h1' },
        { path: 'src/other.ts', hash: 'h2' },
        { path: 'src/engine.ts', hash: 'h3' },
        { path: 'src/engine.ts', hash: 'h4' }
      ]
    }));

    assert.equal(verdict.tripped, true);
    assert.match(verdict.reason ?? '', /^TRIPWIRE_FILE_CHURN/);
    assert.match(verdict.reason ?? '', /src\/engine\.ts/);
  });

  it('trips diff reversals guard when cyclic diff hashes are detected', () => {
    const monitor = new TripwireMonitor(defaultConfig);
    const diffA = '--- a/file.ts\n+++ b/file.ts\n-let x = 1;\n+let x = 2;';
    const diffB = '--- a/file.ts\n+++ b/file.ts\n-let x = 2;\n+let x = 3;';

    const verdict = monitor.check(createTelemetry({
      diffHistory: [diffA, diffB, diffA] // Repeated diffA
    }));

    assert.equal(verdict.tripped, true);
    assert.match(verdict.reason ?? '', /^TRIPWIRE_DIFF_REVERSAL/);
  });

  it('ignores empty diffs in diff reversal checks', () => {
    const monitor = new TripwireMonitor(defaultConfig);
    const verdict = monitor.check(createTelemetry({
      diffHistory: ['', '   ', '']
    }));

    assert.equal(verdict.tripped, false);
  });
});
