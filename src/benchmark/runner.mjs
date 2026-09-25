import { calculateDistribution } from './stats.mjs';

/**
 * Executes a target task through warm-up and steady-state profiling.
 * @param {string} stageName Name of the pipeline stage.
 * @param {() => Promise<void>|void} fn Function to benchmark.
 * @param {Object} [options={}] Execution options.
 * @param {number} [options.warmupIterations=3] Number of warm-up iterations.
 * @param {number} [options.measuredIterations=12] Number of measured iterations.
 * @param {number} [options.timeoutMs=60000] Timeout budget in milliseconds.
 * @returns {Promise<import('./stats.mjs').StageMetrics>}
 */
export async function runBenchmark(stageName, fn, options = {}) {
  const warmupIterations = options.warmupIterations ?? 3;
  const measuredIterations = options.measuredIterations ?? 12;
  const timeoutMs = options.timeoutMs ?? 60000;

  const startTime = Date.now();

  // Warm-up phase (unrecorded)
  for (let i = 0; i < warmupIterations; i++) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Benchmark exceeded timeout budget of ${timeoutMs}ms during warm-up`);
    }
    if (typeof global.gc === 'function') {
      global.gc();
    }
    await fn();
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Benchmark exceeded timeout budget of ${timeoutMs}ms during warm-up`);
    }
  }

  // Steady-state measurement phase
  const samples = [];
  for (let i = 0; i < measuredIterations; i++) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Benchmark exceeded timeout budget of ${timeoutMs}ms during measurement`);
    }
    if (typeof global.gc === 'function') {
      global.gc();
    }

    const startHr = process.hrtime.bigint();
    await fn();
    const endHr = process.hrtime.bigint();

    const elapsedMs = Number(endHr - startHr) / 1e6;
    samples.push(elapsedMs);

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Benchmark exceeded timeout budget of ${timeoutMs}ms during measurement`);
    }
  }

  return calculateDistribution(samples);
}
