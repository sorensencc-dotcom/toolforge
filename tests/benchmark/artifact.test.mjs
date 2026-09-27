import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { hashFile, writeBaselineArtifact, readBaselineArtifact } from '../../src/benchmark/artifact.mjs';

describe('Benchmark Artifact Persistence', () => {
  const tmpDir = path.resolve('./.tmp-benchmark-test');
  const fixturePath = path.join(tmpDir, 'fixture.json');
  const artifactPath = path.join(tmpDir, '.performance-baselines.json');

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('hashes static fixture file deterministically', async () => {
    const fixtureData = JSON.stringify({ test: "data" });
    await fs.writeFile(fixturePath, fixtureData, 'utf-8');

    const expectedHash = `sha256:${createHash('sha256').update(fixtureData).digest('hex')}`;
    const hash = await hashFile(fixturePath);
    assert.equal(hash, expectedHash);
    assert.match(hash, /^sha256:[a-f0-9]{64}$/);
  });

  it('writes and reads baseline artifact atomically', async () => {
    const artifact = {
      $schema: 'https://json-schemas.internal/performance-baseline-v2.json',
      schema_version: 2,
      generated_at: new Date().toISOString(),
      commit_sha: 'test-sha',
      environment: {
        runner_type: 'local',
        runtime_version: process.version,
        cpu_model: 'test-cpu',
        core_count: 4
      },
      fixture_hash: 'sha256:dummy',
      stages: {
        flattening: {
          p50_ms: 42.0,
          gate_threshold_ms: 61.7,
          ceiling_limit_ms: 150.0
        }
      }
    };

    await writeBaselineArtifact(artifactPath, artifact);
    const loaded = await readBaselineArtifact(artifactPath);

    assert.deepEqual(loaded, artifact);
  });

  it('overwrites existing artifact file atomically on subsequent writes', async () => {
    const artifact1 = { schema_version: 2, run: 1 };
    const artifact2 = { schema_version: 2, run: 2 };

    await writeBaselineArtifact(artifactPath, artifact1);
    const loaded1 = await readBaselineArtifact(artifactPath);
    assert.deepEqual(loaded1, artifact1);

    await writeBaselineArtifact(artifactPath, artifact2);
    const loaded2 = await readBaselineArtifact(artifactPath);
    assert.deepEqual(loaded2, artifact2);
  });

  it('reads baseline artifact and returns null on ENOENT when file does not exist', async () => {
    const nonExistentPath = path.join(tmpDir, 'does-not-exist.json');
    const result = await readBaselineArtifact(nonExistentPath);
    assert.equal(result, null);
  });

  it('re-throws unexpected errors when reading baseline artifact', async () => {
    await assert.rejects(
      async () => {
        await readBaselineArtifact(tmpDir);
      },
      (err) => err.code !== 'ENOENT'
    );
  });
});
