import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

import { installGitHook } from '../../../scripts/setup-git-hook.mjs';

const packageRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..', '..');
const installerScript = path.join(repositoryRoot, 'CIC-GOVERNANCE', 'scripts', 'setup-git-hook.mjs');
const canonicalShim = path.join(repositoryRoot, 'CIC-GOVERNANCE', 'scripts', 'pre-commit-shim.sh');

function createTempGitRepo() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-guard-hook-test-'));
  execFileSync('git', ['init', '--quiet'], { cwd: tempDir, encoding: 'utf8' });
  return tempDir;
}

function cleanupTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch {
    // Best-effort cleanup on Windows temp directory
  }
}

function runHook(tempRepo) {
  return spawnSync('sh', ['.git/hooks/pre-commit'], {
    cwd: tempRepo,
    encoding: 'utf8',
    env: process.env,
  });
}

test('installs hook artifact into temporary git repository via CLI', () => {
  const tempRepo = createTempGitRepo();
  try {
    const result = spawnSync(process.execPath, [installerScript, '--target', tempRepo], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: process.env,
    });

    assert.equal(result.status, 0, result.stderr);
    const installedHook = path.join(tempRepo, '.git', 'hooks', 'pre-commit');
    assert.ok(fs.existsSync(installedHook), 'Installed hook artifact should exist');

    const installedContent = fs.readFileSync(installedHook, 'utf8');
    const expectedContent = fs.readFileSync(canonicalShim, 'utf8');
    assert.equal(installedContent, expectedContent);
    assert.match(installedContent, /governance-validate-precommit\.sh/);
    assert.match(installedContent, /secret-scan\.mjs/);
    assert.match(installedContent, /evaluate-automation-policy\.mjs/);
    assert.match(installedContent, /pre-commit\.ps1/);
  } finally {
    cleanupTempDir(tempRepo);
  }
});

test('installs hook artifact programmatically via exported installGitHook API', () => {
  const tempRepo = createTempGitRepo();
  try {
    const installResult = installGitHook(tempRepo);
    assert.equal(installResult.success, true);
    assert.ok(fs.existsSync(installResult.hookPath));

    const installedContent = fs.readFileSync(installResult.hookPath, 'utf8');
    assert.match(installedContent, /evaluate-automation-policy\.mjs/);
  } finally {
    cleanupTempDir(tempRepo);
  }
});

test('executes installed hook artifact in temporary repository with passing fixtures', () => {
  const tempRepo = createTempGitRepo();
  try {
    installGitHook(tempRepo);

    // Create passing mock script
    fs.mkdirSync(path.join(tempRepo, 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRepo, 'scripts', 'secret-scan.mjs'),
      'console.log("Secret scan passed cleanly"); process.exit(0);\n',
      'utf8',
    );

    const result = runHook(tempRepo);

    assert.equal(result.status, 0, `Hook execution failed: ${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /Secret scan passed cleanly/);
  } finally {
    cleanupTempDir(tempRepo);
  }
});

test('executes installed hook artifact and blocks when a required gate fails', () => {
  const tempRepo = createTempGitRepo();
  try {
    installGitHook(tempRepo);

    // Create failing mock script
    fs.mkdirSync(path.join(tempRepo, 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRepo, 'scripts', 'secret-scan.mjs'),
      'console.error("FATAL: Secret detected!"); process.exit(1);\n',
      'utf8',
    );

    const result = runHook(tempRepo);

    assert.equal(result.status, 1, 'Hook should have exited with code 1');
    assert.match(result.stderr, /FATAL: Secret detected!/);
  } finally {
    cleanupTempDir(tempRepo);
  }
});

test('executes installed hook artifact and keeps advisory delivery-guard policy non-blocking', () => {
  const tempRepo = createTempGitRepo();
  try {
    installGitHook(tempRepo);

    // Create failing advisory script for delivery guard
    const guardScriptDir = path.join(tempRepo, 'CIC-GOVERNANCE', 'packages', 'delivery-guard', 'scripts');
    fs.mkdirSync(guardScriptDir, { recursive: true });
    fs.writeFileSync(
      path.join(guardScriptDir, 'evaluate-automation-policy.mjs'),
      'console.error("Policy violation in staged diff"); process.exit(1);\n',
      'utf8',
    );

    const result = runHook(tempRepo);

    assert.equal(result.status, 0, 'Advisory failure should not block commit');
    assert.match(result.stdout, /Delivery guard automation policy is advisory; unable to evaluate\./);
  } finally {
    cleanupTempDir(tempRepo);
  }
});

test('executes installed hook artifact and runs pre-commit.ps1 sidecar when present', () => {
  const tempRepo = createTempGitRepo();
  try {
    installGitHook(tempRepo);
    const sidecarPath = path.join(tempRepo, '.git', 'hooks', 'pre-commit.ps1');

    fs.writeFileSync(
      sidecarPath,
      'Write-Host "SIDECAR_PRECOMMIT_SUCCESS"\nexit 0\n',
      'utf8',
    );

    const result = runHook(tempRepo);

    assert.equal(result.status, 0, `Hook execution failed: ${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /SIDECAR_PRECOMMIT_SUCCESS/);
  } finally {
    cleanupTempDir(tempRepo);
  }
});
