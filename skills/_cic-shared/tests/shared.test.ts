import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { generateRunId, generateBundleId } from '../src/runId';
import { artifactPaths } from '../src/artifactPaths';
import { writeResultJson } from '../src/writeResultJson';

describe('runId', () => {
  it('generateRunId matches run-<compact-iso>-<6hex>', () => {
    const id = generateRunId();
    expect(id).toMatch(/^run-\d{8}T\d{6}Z-[0-9a-f]{6}$/);
  });

  it('generateBundleId matches bundle-<compact-iso>-<6hex>', () => {
    const id = generateBundleId();
    expect(id).toMatch(/^bundle-\d{8}T\d{6}Z-[0-9a-f]{6}$/);
  });

  it('generateRunId produces unique values', () => {
    const a = generateRunId();
    const b = generateRunId();
    expect(a).not.toBe(b);
  });
});

describe('artifactPaths', () => {
  it('builds dir and resultFile under cic/artifacts/<kind>/<id>', () => {
    const { dir, resultFile } = artifactPaths('gates', 'run-test-1');
    expect(dir).toBe(path.join(process.cwd(), 'cic', 'artifacts', 'gates', 'run-test-1'));
    expect(resultFile).toBe(path.join(dir, 'result.json'));
  });
});

describe('writeResultJson', () => {
  const kind = 'test-kind';
  const id = 'run-write-test';

  afterEach(() => {
    const dir = artifactPaths(kind, id).dir;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes payload to resultFile and returns its path', async () => {
    const payload = { runId: id, status: 'stub', timestamp: new Date().toISOString() };
    const written = await writeResultJson(kind, id, payload);
    expect(written).toBe(artifactPaths(kind, id).resultFile);
    const onDisk = JSON.parse(fs.readFileSync(written, 'utf-8'));
    expect(onDisk).toEqual(payload);
  });
});
