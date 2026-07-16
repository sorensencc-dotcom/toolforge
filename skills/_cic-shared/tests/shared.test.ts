import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateRunId, generateBundleId } from '../src/runId';
import { artifactPaths } from '../src/artifactPaths';
import { writeResultJson } from '../src/writeResultJson';
import { findRepoRoot } from '../src/findRepoRoot';
import { lineagePaths } from '../src/lineagePaths';
import { reportPaths } from '../src/reportPaths';
import { writeLineageEntry } from '../src/writeLineageEntry';
import { writeReportEntry } from '../src/writeReportEntry';

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

describe('lineagePaths / reportPaths', () => {
  it('builds a single json file per id under <repoRoot>/cic/lineage/<kind>', () => {
    const repoRoot = findRepoRoot(__dirname);
    const { dir, file } = lineagePaths('ingest', 'run-lineage-test');
    expect(dir).toBe(path.join(repoRoot, 'cic', 'lineage', 'ingest'));
    expect(file).toBe(path.join(dir, 'run-lineage-test.json'));
  });

  it('builds a single json file per id under <repoRoot>/cic/reports/<kind>', () => {
    const repoRoot = findRepoRoot(__dirname);
    const { dir, file } = reportPaths('gates', 'run-report-test');
    expect(dir).toBe(path.join(repoRoot, 'cic', 'reports', 'gates'));
    expect(file).toBe(path.join(dir, 'run-report-test.json'));
  });
});

describe('writeLineageEntry / writeReportEntry', () => {
  const kind = 'test-kind';
  const id = 'run-index-write-test';

  afterEach(() => {
    fs.rmSync(lineagePaths(kind, id).dir, { recursive: true, force: true });
    fs.rmSync(reportPaths(kind, id).dir, { recursive: true, force: true });
  });

  it('writeLineageEntry writes payload to file and returns its path', async () => {
    const payload = { runId: id, lineageRef: 'lineage:test:x', status: 'stub' };
    const written = await writeLineageEntry(kind, id, payload);
    expect(written).toBe(lineagePaths(kind, id).file);
    expect(JSON.parse(fs.readFileSync(written, 'utf-8'))).toEqual(payload);
  });

  it('writeReportEntry writes payload to file and returns its path', async () => {
    const payload = { runId: id, gateId: 'GATE-01', status: 'PASS' };
    const written = await writeReportEntry(kind, id, payload);
    expect(written).toBe(reportPaths(kind, id).file);
    expect(JSON.parse(fs.readFileSync(written, 'utf-8'))).toEqual(payload);
  });
});
