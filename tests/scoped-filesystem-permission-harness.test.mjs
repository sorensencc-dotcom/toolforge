import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  canonicalizePath,
  isContainedWithin,
  isSystemDenied,
  evaluateFilesystemPermission,
  REPO_ROOT
} from '../scripts/scoped-filesystem-permission-harness.mjs';

test('PermissionHarness - canonicalizePath normalizes and detects attack vectors', () => {
  assert.equal(canonicalizePath('C:\\foo\\bar\\..\\baz'), path.resolve('C:/foo/baz'));
  assert.equal(canonicalizePath('C:/foo/bar/test.txt\0.js'), null); // null byte
  assert.equal(canonicalizePath('test.txt::$DATA'), null); // NTFS stream
});

test('PermissionHarness - isContainedWithin validates workspace boundaries', () => {
  const allowedRoots = ['C:\\dev\\workspace'];
  assert.equal(isContainedWithin('C:\\dev\\workspace\\src\\index.ts', allowedRoots), true);
  assert.equal(isContainedWithin('C:\\dev\\workspace\\sub\\..\\file.txt', allowedRoots), true);
  assert.equal(isContainedWithin('C:\\dev\\other-repo\\file.txt', allowedRoots), false);
  assert.equal(isContainedWithin('C:\\Windows\\System32\\calc.exe', allowedRoots), false);
});

test('PermissionHarness - isSystemDenied blocks sensitive host files and keys', () => {
  assert.equal(isSystemDenied('C:\\Windows\\System32\\cmd.exe'), true);
  assert.equal(isSystemDenied('C:\\Users\\alice\\.ssh\\id_rsa'), true);
  assert.equal(isSystemDenied('C:\\Users\\alice\\.aws\\credentials'), true);
  assert.equal(isSystemDenied('C:\\dev\\myproject\\.git\\config'), true);
  assert.equal(isSystemDenied('C:\\dev\\myproject\\src\\App.tsx'), false);
});

test('PermissionHarness - evaluates read-only vs workspace-mutate capability correctly', () => {
  const readOnlyPolicy = {
    capability: 'read-only',
    allowedRoots: [REPO_ROOT]
  };

  const mutatePolicy = {
    capability: 'workspace-mutate',
    allowedRoots: [REPO_ROOT]
  };

  const targetFile = path.join(REPO_ROOT, 'docs', 'README.md');

  // Read allowed in both
  assert.equal(evaluateFilesystemPermission(targetFile, 'read', readOnlyPolicy).allowed, true);
  assert.equal(evaluateFilesystemPermission(targetFile, 'read', mutatePolicy).allowed, true);

  // Write denied in read-only, allowed in mutate
  const writeReadOnly = evaluateFilesystemPermission(targetFile, 'write', readOnlyPolicy);
  assert.equal(writeReadOnly.allowed, false);
  assert.equal(writeReadOnly.violationCode, 'READ_ONLY_VIOLATION');

  const writeMutate = evaluateFilesystemPermission(targetFile, 'write', mutatePolicy);
  assert.equal(writeMutate.allowed, true);
});

test('PermissionHarness - isolated-tmp restricts writes strictly to scratch/temp', () => {
  const tmpPolicy = {
    capability: 'isolated-tmp',
    allowedRoots: [REPO_ROOT]
  };

  const scratchFile = path.join(REPO_ROOT, 'scratch', 'test.json');
  const srcFile = path.join(REPO_ROOT, 'src', 'core.ts');

  assert.equal(evaluateFilesystemPermission(scratchFile, 'write', tmpPolicy).allowed, true);
  const srcWrite = evaluateFilesystemPermission(srcFile, 'write', tmpPolicy);
  assert.equal(srcWrite.allowed, false);
  assert.equal(srcWrite.violationCode, 'TMP_JAIL_VIOLATION');
});

test('PermissionHarness - blocks traversal escape attempts outside allowed roots', () => {
  const policy = {
    capability: 'workspace-mutate',
    allowedRoots: [path.join(REPO_ROOT, 'submodules', 'safe-zone')]
  };

  const escapeAttempt = path.join(REPO_ROOT, 'submodules', 'safe-zone', '..', '..', 'secrets.txt');
  const result = evaluateFilesystemPermission(escapeAttempt, 'read', policy);

  assert.equal(result.allowed, false);
  assert.equal(result.violationCode, 'JAIL_ESCAPE_ATTEMPT');
});
