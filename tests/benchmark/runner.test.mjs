import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runBenchmark } from '../../src/benchmark/runner.mjs';

describe('Monotonic Benchmark Runner', () => {
  it('executes warm-up and steady-state iterations with monotonic timing', async () => {
    let callCount = 0;
    const mockTask = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 5));
    };

    const metrics = await runBenchmark('mock_stage', mockTask, {
      warmupIterations: 2,
      measuredIterations: 5,
      timeoutMs: 5000
    });

    assert.equal(callCount, 7); // 2 warmup + 5 measured
    assert.equal(metrics.sampleCount, 5);
    assert.ok(metrics.p50Ms >= 4.0, `p50Ms was ${metrics.p50Ms}, expected >= 4.0`);
  });

  it('fails with timeout if execution exceeds budget', async () => {
    const hangingTask = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    };

    await assert.rejects(
      async () => {
        await runBenchmark('slow_stage', hangingTask, {
          warmupIterations: 1,
          measuredIterations: 5,
          timeoutMs: 100
        });
      },
      { message: /Benchmark stage 'slow_stage' exceeded timeout budget of 100ms/ }
    );
  });

  it('safely handles presence or absence of global.gc', async () => {
    const originalGc = global.gc;
    try {
      // 1. When global.gc is absent
      global.gc = undefined;
      let countWithoutGc = 0;
      const metricsWithoutGc = await runBenchmark('no_gc', () => { countWithoutGc++; }, {
        warmupIterations: 2,
        measuredIterations: 3,
        timeoutMs: 5000
      });
      assert.equal(countWithoutGc, 5);
      assert.equal(metricsWithoutGc.sampleCount, 3);

      // 2. When global.gc is present
      let gcCallCount = 0;
      global.gc = () => { gcCallCount++; };
      let countWithGc = 0;
      const metricsWithGc = await runBenchmark('with_gc', () => { countWithGc++; }, {
        warmupIterations: 2,
        measuredIterations: 3,
        timeoutMs: 5000
      });
      assert.equal(countWithGc, 5);
      assert.equal(metricsWithGc.sampleCount, 3);
      assert.equal(gcCallCount, 5); // 2 warmup + 3 measured
    } finally {
      global.gc = originalGc;
    }
  });
});
