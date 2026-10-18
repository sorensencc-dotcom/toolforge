import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isRoadmapFile,
  isAllowedRoadmapLocation,
  validateRoadmapPaths,
  runCli,
  ALLOWED_ROADMAP_ROOTS,
} from '../scripts/governance/check-roadmap-location.mjs';

test('governance workflow includes roadmap location policy and invokes linter', () => {
  const workflowPath = resolve('.github/workflows/governance.yml');
  assert.equal(existsSync(workflowPath), true);
  const content = readFileSync(workflowPath, 'utf8');
  assert.match(content, /Roadmap location policy/);
  assert.match(content, /node scripts\/governance\/check-roadmap-location\.mjs/);
});

test('pre-commit installers wire check-roadmap-location.mjs', () => {
  const setupHooksPath = resolve('setup-git-hooks.ps1');
  assert.equal(existsSync(setupHooksPath), true);
  const setupContent = readFileSync(setupHooksPath, 'utf8');
  assert.match(setupContent, /check-roadmap-location\.mjs/);

  const shimPath = resolve('CIC-GOVERNANCE/scripts/pre-commit-shim.sh');
  assert.equal(existsSync(shimPath), true);
  const shimContent = readFileSync(shimPath, 'utf8');
  assert.match(shimContent, /check-roadmap-location\.mjs/);
});

test('isRoadmapFile identifies roadmap.md regardless of casing', () => {
  assert.equal(isRoadmapFile('ROADMAP.md'), true);
  assert.equal(isRoadmapFile('roadmap.md'), true);
  assert.equal(isRoadmapFile('Roadmap.MD'), true);
  assert.equal(isRoadmapFile('path/to/ROADMAP.md'), true);
  assert.equal(isRoadmapFile('path/to/other.md'), false);
  assert.equal(isRoadmapFile('docs/meta/toolforge-platform-roadmap.md'), false);
});

test('isAllowedRoadmapLocation permits roadmaps in allowed roots', () => {
  for (const root of ALLOWED_ROADMAP_ROOTS) {
    assert.equal(isAllowedRoadmapLocation(`${root}ROADMAP.md`), true, `Should allow roadmap in ${root}`);
    assert.equal(isAllowedRoadmapLocation(`${root}nested/ROADMAP.md`), true, `Should allow nested roadmap in ${root}`);
  }
  // Non-roadmap files are always allowed
  assert.equal(isAllowedRoadmapLocation('anywhere/else/README.md'), true);
});

test('isAllowedRoadmapLocation rejects roadmaps outside allowed roots', () => {
  const forbiddenPaths = [
    'ROADMAP.md',
    '.claude/worktrees/feat/ROADMAP.md',
    '.worktrees/feat/roadmap.md',
    'archive/ROADMAP.md',
    'skills/foo/ROADMAP.md',
    'utilities/ROADMAP.md',
    'sync-tools/ROADMAP.md',
    'packages/ROADMAP.md',
  ];

  for (const forbidden of forbiddenPaths) {
    assert.equal(isAllowedRoadmapLocation(forbidden), false, `Should reject forbidden roadmap at ${forbidden}`);
  }
});

test('validateRoadmapPaths aggregates violations correctly', () => {
  const input = [
    'docs/meta/ROADMAP.md',
    'cic-ingestion/ROADMAP.md',
    'skills/foo/ROADMAP.md',
    'archive/roadmap.md',
    'src/index.ts',
  ];

  const result = validateRoadmapPaths(input);
  assert.equal(result.ok, false);
  assert.equal(result.scanned.length, 4);
  assert.deepEqual(result.violations, [
    'skills/foo/ROADMAP.md',
    'archive/roadmap.md',
  ]);
});

test('runCli validates path arguments and returns expected exit codes', () => {
  const passCode = runCli(['docs/meta/ROADMAP.md', 'rewrite-mcp/roadmap.md']);
  assert.equal(passCode, 0);

  const failCode = runCli(['.claude/worktrees/feat/ROADMAP.md']);
  assert.equal(failCode, 1);
});
