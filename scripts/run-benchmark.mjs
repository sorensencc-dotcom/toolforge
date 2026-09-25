import os from 'node:os';
import process from 'node:process';
import path from 'node:path';
import { runBenchmark } from '../src/benchmark/runner.mjs';
import { readBaselineArtifact, writeBaselineArtifact } from '../src/benchmark/artifact.mjs';
import { evaluatePipelineStages } from '../src/benchmark/cli.mjs';
import { computeGateThreshold } from '../src/benchmark/stats.mjs';

/**
 * Main CLI runner entrypoint for performance profiling and baseline gating.
 */
async function main() {
  const baselineArgIndex = process.argv.indexOf('--baseline');
  const baselinePath = baselineArgIndex !== -1 && process.argv[baselineArgIndex + 1]
    ? path.resolve(process.argv[baselineArgIndex + 1])
    : path.resolve(process.env.BENCHMARK_BASELINE_PATH || '.performance-baselines.json');

  const baseline = await readBaselineArtifact(baselinePath);

  // Synthetic stage benchmark for pipeline flattening
  const stageMetrics = {
    flattening: await runBenchmark('flattening', async () => {
      let acc = 0;
      for (let i = 0; i < 50000; i++) {
        acc += (i % 7);
      }
    })
  };

  const shouldRecalibrate = !baseline || process.argv.includes('--recalibrate');

  if (shouldRecalibrate) {
    const p50 = stageMetrics.flattening.p50Ms;
    const ceiling = 100.0;
    const gateThreshold = computeGateThreshold(p50, ceiling);

    const newArtifact = {
      $schema: 'https://json-schemas.internal/performance-baseline-v2.json',
      schema_version: 2,
      generated_at: new Date().toISOString(),
      commit_sha: process.env.GITHUB_SHA || 'local-head',
      environment: {
        runner_type: process.env.CI ? 'ci' : 'local',
        runtime_version: process.version,
        cpu_model: os.cpus()[0]?.model || 'unknown',
        core_count: os.cpus().length
      },
      fixture_hash: 'sha256:static-synthetic-fixture',
      stages: {
        flattening: {
          sample_count: stageMetrics.flattening.sampleCount,
          p50_ms: stageMetrics.flattening.p50Ms,
          min_ms: stageMetrics.flattening.minMs,
          max_ms: stageMetrics.flattening.maxMs,
          iqr_ms: stageMetrics.flattening.iqrMs,
          gate_threshold_ms: gateThreshold,
          ceiling_limit_ms: ceiling
        }
      }
    };

    await writeBaselineArtifact(baselinePath, newArtifact);
    console.log(`Successfully written new baseline artifact to ${baselinePath}.`);
    process.exit(0);
  }

  const { passed, findings, improvements } = evaluatePipelineStages(stageMetrics, baseline);

  if (improvements && improvements.length > 0) {
    console.log('🚀 PERFORMANCE IMPROVEMENTS DETECTED:');
    improvements.forEach((imp) => console.log(`  + ${imp}`));
  }

  if (!passed) {
    console.error('❌ PERFORMANCE REGRESSION DETECTED:');
    findings.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('✅ Performance verification passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(2);
});
