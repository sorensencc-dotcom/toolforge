import { describe, it, expect } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cliPath = join(__dirname, '..', 'src', 'cli.ps1');
const checksumPath = join(__dirname, '..', '..', 'toolforge-registry-manager', 'src', 'checksum.ps1');
const cliSource = readFileSync(cliPath, 'utf8');

function checksum(skillPath: string): string {
  return execFileSync('pwsh', ['-NoProfile', '-File', checksumPath, '-Path', skillPath], { encoding: 'utf8' }).trim();
}

describe('ToolforgeCLI', () => {
  it('declares and forwards install dry-run mode', () => {
    expect(cliSource).toMatch(/\[switch\]\$DryRunMode/);
    expect(cliSource).toMatch(/-DryRunMode:\$DryRun/);
  });

  it('checks dry-run before creating the install directory', () => {
    expect(cliSource.indexOf('if ($DryRunMode)')).toBeGreaterThan(-1);
    expect(cliSource.indexOf('if ($DryRunMode)')).toBeLessThan(cliSource.indexOf('New-Item -ItemType Directory -Path $installDir'));
  });

  it.each(['node_modules', '.git', 'tests'])('excludes %s directories from install payload', (directory) => {
    expect(cliSource).toMatch(new RegExp(`\"${directory.replace('.', '\\.') }\"`));
  });

  it.each(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'])('excludes %s lockfile', (lockfile) => {
    expect(cliSource).toContain(`\"${lockfile}\"`);
  });

  it('copies files individually with literal paths, preserving relative layout', () => {
    expect(cliSource).toContain('Copy-Item -LiteralPath $_.FullName -Destination $destination -Force');
    expect(cliSource).toContain('Substring($sourceRoot.Length)');
  });

  it('uses identical exclusions in checksum calculation', () => {
    const checksumSource = readFileSync(checksumPath, 'utf8');
    for (const entry of ['node_modules', '.git', 'tests', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
      expect(checksumSource).toContain(`\"${entry}\"`);
    }
    expect(checksumSource).toContain('Replace(\'\\\', \'/\')');
  });

  it('produces the same checksum for source and filtered install trees', () => {
    const root = mkdtempSync(join(tmpdir(), 'toolforge-install-test-'));
    const source = join(root, 'source');
    const install = join(root, 'install');
    try {
      mkdirSync(join(source, 'src'), { recursive: true });
      mkdirSync(join(source, 'node_modules', 'large-dependency'), { recursive: true });
      mkdirSync(join(source, '.git'), { recursive: true });
      mkdirSync(join(source, 'tests'), { recursive: true });
      writeFileSync(join(source, 'src', 'index.ps1'), 'Write-Output payload');
      writeFileSync(join(source, 'node_modules', 'large-dependency', 'index.js'), 'dev-only');
      writeFileSync(join(source, '.git', 'config'), 'dev-only');
      writeFileSync(join(source, 'tests', 'install.test.ps1'), 'dev-only');
      writeFileSync(join(source, 'package-lock.json'), '{}');
      mkdirSync(join(install, 'src'), { recursive: true });
      writeFileSync(join(install, 'src', 'index.ps1'), 'Write-Output payload');
      expect(checksum(source)).toBe(checksum(install));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not accidentally whitelist lockfiles by basename case', () => {
    expect(cliSource).toContain('$excludedFiles -notcontains $_.Name');
    expect(readFileSync(checksumPath, 'utf8')).toContain('$excludedFiles -notcontains $_.Name');
  });
});
