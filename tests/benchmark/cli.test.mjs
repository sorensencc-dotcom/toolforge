import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { evaluatePipelineStages } from '../../src/benchmark/cli.mjs';
import { writeBaselineArtifact } from '../../src/benchmark/artifact.mjs';

const execFileAsync = promisify(execFile);

describe('Benchmark Gate Evaluator', () => {
  it('passes when current metrics are within gate threshold', () => {
    const baseline = {
      stages: {
        flattening: { p50_ms: 100, ceiling_limit_ms: 500 }
      }
    };
    const current = {
      flattening: { p50Ms: 110, sampleCount: 12, minMs: 105, maxMs: 115, iqrMs: 4, variance: 2 }
    };

    const result = evaluatePipelineStages(current, baseline);
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it('fails and returns descriptive findings when metrics exceed threshold', () => {
    const baseline = {
      stages: {
        flattening: { p50_ms: 100, ceiling_limit_ms: 500 }
      }
    };
    const current = {
      flattening: { p50Ms: 160, sampleCount: 12, minMs: 155, maxMs: 165, iqrMs: 4, variance: 2 }
    };

    const result = evaluatePipelineStages(current, baseline);
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.match(result.findings[0], /Regression in stage 'flattening'/);
    assert.match(result.findings[0], /160\.00ms/);
  });

  it('flags improvements when metrics drop below 0.70x baseline', () => {
    const baseline = {
      stages: {
        flattening: { p50_ms: 100, ceiling_limit_ms: 500 }
      }
    };
    const current = {
      flattening: { p50Ms: 65, sampleCount: 12, minMs: 60, maxMs: 70, iqrMs: 4, variance: 2 }
    };

    const result = evaluatePipelineStages(current, baseline);
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
    assert.equal(result.improvements.length, 1);
    assert.match(result.improvements[0], /Improvement in stage 'flattening'/);
    assert.match(result.improvements[0], /65\.00ms/);
  });

  it('handles missing stages in baseline gracefully', () => {
    const baseline = {
      stages: {
        flattening: { p50_ms: 100, ceiling_limit_ms: 500 }
      }
    };
    const current = {
      unknown_stage: { p50Ms: 200, sampleCount: 12, minMs: 190, maxMs: 210, iqrMs: 5, variance: 3 }
    };

    const result = evaluatePipelineStages(current, baseline);
    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
  });

  it('handles null, undefined, or empty baselines and metrics gracefully', () => {
    const current = {
      flattening: { p50Ms: 100, sampleCount: 12, minMs: 95, maxMs: 105, iqrMs: 2, variance: 1 }
    };

    assert.equal(evaluatePipelineStages(current, null).passed, true);
    assert.equal(evaluatePipelineStages(current, {}).passed, true);
    assert.equal(evaluatePipelineStages(null, { stages: {} }).passed, true);
    assert.equal(evaluatePipelineStages(undefined, undefined).passed, true);
  });

  it('evaluates multiple stages and aggregates findings and improvements', () => {
    const baseline = {
      stages: {
        stage_pass: { p50_ms: 100, ceiling_limit_ms: 500 },
        stage_fail: { p50_ms: 100, ceiling_limit_ms: 500 },
        stage_improve: { p50_ms: 100, ceiling_limit_ms: 500 }
      }
    };
    const current = {
      stage_pass: { p50Ms: 110, sampleCount: 12, minMs: 105, maxMs: 115, iqrMs: 4, variance: 2 },
      stage_fail: { p50Ms: 160, sampleCount: 12, minMs: 155, maxMs: 165, iqrMs: 4, variance: 2 },
      stage_improve: { p50Ms: 50, sampleCount: 12, minMs: 45, maxMs: 55, iqrMs: 4, variance: 2 }
    };

    const result = evaluatePipelineStages(current, baseline);
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.match(result.findings[0], /stage_fail/);
    assert.equal(result.improvements.length, 1);
    assert.match(result.improvements[0], /stage_improve/);
  });
});

describe('Benchmark CLI Integration', () => {
  const tmpDir = path.resolve('./.tmp-benchmark-cli-test');
  const tmpBaselinePath = path.join(tmpDir, '.performance-baselines.json');
  const runnerScript = path.resolve('./scripts/run-benchmark.mjs');

  it('recalibrates and generates baseline artifact when --recalibrate is passed', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    try {
      const { stdout } = await execFileAsync(process.execPath, [
        runnerScript,
        '--baseline',
        tmpBaselinePath,
        '--recalibrate'
      ]);
      assert.match(stdout, /Successfully written new baseline artifact/);

      const exists = await fs.stat(tmpBaselinePath);
      assert.ok(exists.isFile());
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails with exit code 1 and outputs error details to stderr when regression occurs', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    try {
      const regressedBaseline = {
        schema_version: 2,
        stages: {
          flattening: {
            p50_ms: 0.0001,
            ceiling_limit_ms: 0.0001
          }
        }
      };
      await writeBaselineArtifact(tmpBaselinePath, regressedBaseline);

      await assert.rejects(
        async () => {
          await execFileAsync(process.execPath, [runnerScript, '--baseline', tmpBaselinePath]);
        },
        (err) => {
          assert.equal(err.code, 1);
          assert.match(err.stderr, /PERFORMANCE REGRESSION DETECTED/);
          assert.match(err.stderr, /Regression in stage 'flattening'/);
          return true;
        }
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
