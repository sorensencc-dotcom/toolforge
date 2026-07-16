import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateRunId, generateBundleId } from '../src/runId';
import { artifactPaths } from '../src/artifactPaths';
import { writeResultJson } from '../src/writeResultJson';
import { findRepoRoot } from '../src/findRepoRoot';

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

describe('findRepoRoot', () => {
  it('finds the .git ancestor from a nested dir', () => {
    const root = findRepoRoot(__dirname);
    expect(fs.existsSync(path.join(root, '.git'))).toBe(true);
  });

  it('throws when no .git is found within the bound', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cic-norepo-'));
    try {
      expect(() => findRepoRoot(tmp)).toThrow(/no \.git found/i);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('artifactPaths', () => {
  it('builds dir and resultFile under <repoRoot>/cic/artifacts/<kind>/<id>', () => {
    const repoRoot = findRepoRoot(__dirname);
    const { dir, resultFile } = artifactPaths('gates', 'run-test-1');
    expect(dir).toBe(path.join(repoRoot, 'cic', 'artifacts', 'gates', 'run-test-1'));
    expect(resultFile).toBe(path.join(dir, 'result.json'));
  });

  it('resolves the same dir regardless of process.cwd()', () => {
    const before = artifactPaths('gates', 'run-repo-root-test');
    const originalCwd = process.cwd();
    process.chdir(path.parse(originalCwd).root);
    try {
      const after = artifactPaths('gates', 'run-repo-root-test');
      expect(after.dir).toBe(before.dir);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('accepts an explicit repoRoot override', () => {
    const { dir } = artifactPaths('gates', 'run-test-2', 'C:\\fake-root');
    expect(dir).toBe(path.join('C:\\fake-root', 'cic', 'artifacts', 'gates', 'run-test-2'));
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
