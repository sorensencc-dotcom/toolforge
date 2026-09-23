import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installHook, MARKER } from '../scripts/install-hook.mjs';

describe('installHook', () => {
  let dir;
  let hookPath;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'slop-grader-hook-test-'));
    hookPath = join(dir, 'pre-commit.ps1');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the hook file with the marker when none exists', () => {
    const result = installHook(hookPath);

    expect(result).toEqual({ installed: true });
    expect(existsSync(hookPath)).toBe(true);
    expect(readFileSync(hookPath, 'utf8')).toContain(MARKER);
  });

  it('appends to an existing hook file without the marker', () => {
    writeFileSync(hookPath, '# existing gate\necho "roadmap check"\n', 'utf8');

    const result = installHook(hookPath);
    const content = readFileSync(hookPath, 'utf8');

    expect(result).toEqual({ installed: true });
    expect(content).toContain('# existing gate');
    expect(content).toContain(MARKER);
  });

  it('inserts the block above a terminal `exit 0` so it is not dead code', () => {
    writeFileSync(hookPath, '# existing gate\necho "roadmap check"\n\nexit 0\n', 'utf8');

    installHook(hookPath);
    const content = readFileSync(hookPath, 'utf8');

    expect(content.indexOf(MARKER)).toBeGreaterThan(-1);
    expect(content.indexOf(MARKER)).toBeLessThan(content.indexOf('exit 0'));
    expect(content.trimEnd().endsWith('exit 0')).toBe(true);
  });

  it('inserts the block above a terminal `exit $LASTEXITCODE`', () => {
    writeFileSync(hookPath, '# existing gate\r\nexit $LASTEXITCODE\r\n', 'utf8');

    installHook(hookPath);
    const content = readFileSync(hookPath, 'utf8');

    expect(content.indexOf(MARKER)).toBeLessThan(content.indexOf('exit $LASTEXITCODE'));
    expect(content).toContain('\r\n');
  });

  it('does not treat an indented exit inside a block as terminal', () => {
    writeFileSync(hookPath, 'if ($x) {\n    exit 1\n}\n\nexit 0\n', 'utf8');

    installHook(hookPath);
    const content = readFileSync(hookPath, 'utf8');

    expect(content.indexOf(MARKER)).toBeGreaterThan(content.indexOf('    exit 1'));
    expect(content.indexOf(MARKER)).toBeLessThan(content.lastIndexOf('exit 0'));
  });

  it('is idempotent: running twice leaves exactly one marker', () => {
    installHook(hookPath);
    const second = installHook(hookPath);
    const content = readFileSync(hookPath, 'utf8');

    expect(second).toEqual({ installed: false, reason: 'already installed' });
    expect(content.split(MARKER)).toHaveLength(2);
  });
});
