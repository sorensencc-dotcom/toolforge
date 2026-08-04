import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cliPath = join(process.cwd(), 'skills', 'toolforge-cli', 'src', 'cli.ps1');
const checksumPath = join(process.cwd(), 'skills', 'toolforge-registry-manager', 'src', 'checksum.ps1');
const cli = readFileSync(cliPath, 'utf8');
const checksumScript = readFileSync(checksumPath, 'utf8');

function checksum(path) {
  return execFileSync('pwsh', ['-NoProfile', '-File', checksumPath, '-Path', path], { encoding: 'utf8' }).trim();
}

test('install declares and forwards dry-run mode', () => {
  assert.match(cli, /\[switch\]\$DryRunMode/);
  assert.match(cli, /-DryRunMode:\$DryRun/);
});

test('dry-run is checked before install directory creation or copy', () => {
  const dryRun = cli.indexOf('if ($DryRunMode)');
  assert.ok(dryRun >= 0);
  assert.ok(dryRun < cli.indexOf('New-Item -ItemType Directory -Path $installDir'));
  assert.ok(dryRun < cli.indexOf('Copy-Item -LiteralPath $_.FullName'));
});

for (const directory of ['node_modules', '.git', 'tests']) {
  test(`install excludes ${directory}`, () => assert.match(cli, new RegExp(`"${directory.replace('.', '\\.') }"`)));
  test(`checksum excludes ${directory}`, () => assert.match(checksumScript, new RegExp(`"${directory.replace('.', '\\.') }"`)));
}

for (const lockfile of ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']) {
  test(`install excludes ${lockfile}`, () => assert.match(cli, new RegExp(`"${lockfile}"`)));
  test(`checksum excludes ${lockfile}`, () => assert.match(checksumScript, new RegExp(`"${lockfile}"`)));
}

test('checksum uses relative paths, making source and install payloads portable', () => {
  assert.match(checksumScript, /Substring\(\$root\.Length\)/);
  assert.match(checksumScript, /\.Replace\(/);
});

test('filtered source and installed payload produce the same checksum', () => {
  const root = mkdtempSync(join(tmpdir(), 'toolforge-install-test-'));
  const source = join(root, 'source');
  const install = join(root, 'install');
  try {
    mkdirSync(join(source, 'src'), { recursive: true });
    for (const directory of ['node_modules/dependency', '.git', 'tests']) mkdirSync(join(source, directory), { recursive: true });
    writeFileSync(join(source, 'src', 'index.ps1'), 'Write-Output payload');
    writeFileSync(join(source, 'node_modules', 'dependency', 'index.js'), 'dev-only');
    writeFileSync(join(source, '.git', 'config'), 'dev-only');
    writeFileSync(join(source, 'tests', 'install.test.ps1'), 'dev-only');
    writeFileSync(join(source, 'package-lock.json'), '{}');
    mkdirSync(join(install, 'src'), { recursive: true });
    writeFileSync(join(install, 'src', 'index.ps1'), 'Write-Output payload');
    assert.equal(checksum(source), checksum(install));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('copy implementation preserves relative paths and uses literal file copies', () => {
  assert.match(cli, /Substring\(\$sourceRoot\.Length\)/);
  assert.match(cli, /Copy-Item -LiteralPath \$_.FullName -Destination \$destination -Force/);
});
