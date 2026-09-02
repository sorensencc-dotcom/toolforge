import { describe, it, expect } from 'vitest';
import { runCli } from '../src/cli';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('CLI Command, Flags, and Stream Suite', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const passFile = path.join(fixturesDir, 'pass-all.md');
  const failFile = path.join(fixturesDir, 'fail-rules.md');

  it('returns exit code 0 on --help', async () => {
    const code = await runCli(['--help']);
    expect(code).toBe(0);
  });

  it('returns exit code 0 on -h', async () => {
    const code = await runCli(['-h']);
    expect(code).toBe(0);
  });

  it('returns exit code 0 on --version', async () => {
    const code = await runCli(['--version']);
    expect(code).toBe(0);
  });

  it('returns exit code 0 on -v', async () => {
    const code = await runCli(['-v']);
    expect(code).toBe(0);
  });

  it('returns exit code 0 on clean fixture check', async () => {
    const code = await runCli(['check', passFile]);
    expect(code).toBe(0);
  });

  it('returns exit code 1 on failing fixture check', async () => {
    const code = await runCli(['check', failFile]);
    expect(code).toBe(1);
  });

  it('returns exit code 1 on warnings with --strict flag', async () => {
    const code = await runCli(['check', '--strict', failFile]);
    expect(code).toBe(1);
  });

  it('supports --format=json structured output', async () => {
    let output = '';
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => {
      output += chunk;
      return true;
    }) as any;

    try {
      await runCli(['check', '--format=json', passFile]);
      const parsed = JSON.parse(output);
      expect(parsed.summary.clean).toBe(true);
      expect(parsed.summary.filesScanned).toBe(1);
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('supports --format=sarif standard format output', async () => {
    let output = '';
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => {
      output += chunk;
      return true;
    }) as any;

    try {
      await runCli(['check', '--format=sarif', failFile]);
      const parsed = JSON.parse(output);
      expect(parsed.version).toBe('2.1.0');
      expect(parsed.runs.length).toBe(1);
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('returns exit code 2 when non-existent files are specified', async () => {
    const code = await runCli(['check', 'non-existent-directory-or-file-xyz.md']);
    expect(code).toBe(2);
  });
});
