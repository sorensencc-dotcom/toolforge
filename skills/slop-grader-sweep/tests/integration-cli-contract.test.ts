/**
 * Integration test against the real @lukstei/slop-grader binary.
 *
 * Runs in `--check` mode, which validates ruleset syntax without grading and
 * without calling the API, so it needs no OPENROUTER_API_KEY and costs nothing.
 * It exists to lock the argv contract: the wrapper's flags were invented from
 * memory once already, and every other test in this suite mocks `spawn`.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { buildGraderArgs, resolveGraderEntrypoint } from '../src/slop-grader-runner';

const ENTRYPOINT = resolveGraderEntrypoint();

function runGrader(args: string[]) {
  return spawnSync(process.execPath, [ENTRYPOINT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, OPENROUTER_API_KEY: '', TYPESAFE_API_KEY: '' },
  });
}

describe('real slop-grader CLI contract', () => {
  it('accepts the wrapper rulesets as repeated -r flags', () => {
    const args = buildGraderArgs('unused.md').filter((arg) => arg !== '--json' && arg !== 'unused.md');

    const result = runGrader(['--check', ...args]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Rules valid.');
  });

  it('accepts a markdown ruleset file via -r <path>', () => {
    const fixture = join(__dirname, 'fixtures', 'custom-rules.md');

    const result = runGrader(['--check', '-r', fixture]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Rules valid.');
  });

  it('rejects the pre-fix argv shape that the wrapper used to emit', () => {
    const result = runGrader(['check', '--ruleset', 'no-ai-slop,tech-docs', '--format', 'json']);

    expect(result.status).not.toBe(0);
  });

  it('exposes -r, --json, and --check in its own usage string', () => {
    const result = runGrader(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('-r <name|path>');
    expect(result.stdout).toContain('--json');
    expect(result.stdout).toContain('--check');
    expect(result.stdout).not.toContain('--ruleset');
    expect(result.stdout).not.toContain('--format');
  });
});
