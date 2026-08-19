import { describe, it, expect } from 'vitest';
import { runCli } from '../src/cli';
import * as path from 'path';

describe('CLI Integration Suite', () => {
  it('returns code 0 on --help', async () => {
    const code = await runCli(['--help']);
    expect(code).toBe(0);
  });

  it('returns code 0 on --version', async () => {
    const code = await runCli(['--version']);
    expect(code).toBe(0);
  });

  it('returns code 0 on clean fixture', async () => {
    const fixture = path.join(__dirname, 'fixtures', 'pass-all.md');
    const code = await runCli(['check', fixture]);
    expect(code).toBe(0);
  });

  it('returns code 1 on failing fixture', async () => {
    const fixture = path.join(__dirname, 'fixtures', 'fail-rules.md');
    const code = await runCli(['check', fixture]);
    expect(code).toBe(1);
  });
});
