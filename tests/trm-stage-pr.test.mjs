import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateTestScaffold, stagePr } from '../scripts/trm-stage-pr.mjs';

test('generateTestScaffold embeds issue_url and enrichment context without breaking JSDoc', () => {
  const scaffold = generateTestScaffold({
    id: 'act-remote-01',
    title: 'Wire remote agent context header',
    target: 'toolforge',
    issue_url: 'https://github.com/sorensencc-dotcom/toolforge/issues/999',
    enrichment: {
      tier: 'LOCAL_SCAFFOLD',
      rationale: 'Self-contained test contract for Remote Agents',
      astResults: [
        { path: 'scripts/trm-stage-pr.mjs', status: 'EXISTS', ast: 'export function stagePr(cardId) { /* comment */ }' }
      ],
      deltaPlan: ['Embed enrichment block', 'Commit onto trm/<cardId> via git plumbing']
    }
  });

  assert.match(scaffold, /Issue: https:\/\/github\.com\/sorensencc-dotcom\/toolforge\/issues\/999/);
  assert.match(scaffold, /Triage Tier: LOCAL_SCAFFOLD/);
  assert.match(scaffold, /AST Touchpoints:/);
  assert.match(scaffold, /scripts\/trm-stage-pr\.mjs \(EXISTS\)/);
  assert.match(scaffold, /Delta Plan:/);
  assert.equal((scaffold.match(/\*\//g) || []).length, 1, 'Only the closing JSDoc delimiter may contain */');
});

test('stagePr commits test scaffold onto trm/<cardId> and pushes to origin without switching active branch', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-stage-pr-test-'));
  const repoDir = path.join(baseDir, 'work');
  const ledgerPath = path.join(baseDir, 'ledger.jsonl');
  const pushedBranches = [];

  try {
    execFileSync('git', ['init', repoDir], { stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoDir, stdio: 'pipe' });

    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Repo\n', 'utf8');
    execFileSync('git', ['add', 'README.md'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'chore: initial'], { cwd: repoDir, stdio: 'pipe' });
    const activeBranchBefore = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim();

    fs.writeFileSync(ledgerPath, JSON.stringify({ id: 'act-remote-02', status: 'PROMOTED' }) + '\n', 'utf8');

    const res = stagePr('act-remote-02', {
      createBranch: true,
      push: true,
      repoDir,
      ledgerPath,
      pushRunner: (dir, br) => pushedBranches.push({ dir, br }),
      cardData: {
        id: 'act-remote-02',
        title: 'Remote branch commit test',
        target: 'toolforge',
        issue_url: 'https://github.com/sorensencc-dotcom/toolforge/issues/1000',
        enrichment: {
          tier: 'LOCAL_SCAFFOLD',
          rationale: 'Verify git plumbing commit and push',
          deltaPlan: ['Verify remote ref']
        }
      }
    });

    assert.equal(res.branchName, 'trm/act-remote-02');
    assert.ok(res.commitSha && res.commitSha.length >= 40, 'Should return commit SHA');
    assert.equal(res.pushed, true);
    assert.deepEqual(pushedBranches, [{ dir: repoDir, br: 'trm/act-remote-02' }]);

    const activeBranchAfter = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim();
    assert.equal(activeBranchAfter, activeBranchBefore, 'Active branch must not change');

    const committedFile = execFileSync('git', ['show', 'refs/heads/trm/act-remote-02:tests/trm-act-remote-02.test.mjs'], {
      cwd: repoDir,
      encoding: 'utf8'
    });
    assert.match(committedFile, /TRM TDD Test Contract: act-remote-02/);
    assert.match(committedFile, /Verify git plumbing commit and push/);

    const ledgerRow = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').trim());
    assert.equal(ledgerRow.pr_branch, 'trm/act-remote-02');
    assert.equal(ledgerRow.pr_commit, res.commitSha);
    assert.equal(ledgerRow.pr_pushed, true);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('stagePr upgrades an existing unenriched stub when card.enrichment arrives later', () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-stage-pr-upgrade-'));
  try {
    stagePr('act-remote-03', {
      repoDir,
      cardData: {
        id: 'act-remote-03',
        title: 'Upgrade bare scaffold',
        target: 'toolforge'
      }
    });

    const second = stagePr('act-remote-03', {
      repoDir,
      cardData: {
        id: 'act-remote-03',
        title: 'Upgrade bare scaffold',
        target: 'toolforge',
        issue_url: 'https://github.com/sorensencc-dotcom/toolforge/issues/1042',
        enrichment: {
          tier: 'LOCAL_SCAFFOLD',
          rationale: 'Upgrade initial stub with enrichment header',
          deltaPlan: ['Replace unenriched stub']
        }
      }
    });

    const content = fs.readFileSync(second.testFilePath, 'utf8');
    assert.match(content, /Triage Tier: LOCAL_SCAFFOLD/);
    assert.match(content, /Replace unenriched stub/);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

test('stagePr evaluates merge_risk and enforces high risk gate when requested', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-risk-test-'));
  const ledgerPath = path.join(baseDir, 'ledger.jsonl');
  const repoDir = path.join(baseDir, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  try {
    fs.writeFileSync(ledgerPath, JSON.stringify({ id: 'act-risk-01', status: 'PROMOTED' }) + '\n', 'utf8');

    // Low/medium risk card with tests
    const res = stagePr('act-risk-01', {
      repoDir,
      ledgerPath,
      cardData: {
        id: 'act-risk-01',
        title: 'Add safe helper util',
        target: 'toolforge',
        files: ['src/utils/safe-helper.js', 'tests/safe-helper.test.js']
      }
    });

    assert.ok(res.risk);
    assert.ok(res.risk.score < 2.25);
    assert.equal(res.risk.risk, 'low');

    const ledgerLine = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').trim());
    assert.equal(ledgerLine.merge_risk, 'low');
    assert.equal(ledgerLine.merge_risk_score, res.risk.score);

    // High risk card with sensitive auth touchpoint, schema migration, and no tests
    assert.throws(() => {
      stagePr('act-risk-high', {
        repoDir,
        ledgerPath,
        enforceRiskGate: true,
        cardData: {
          id: 'act-risk-high',
          title: 'Alter authentication token verification and schema',
          target: 'toolforge',
          files: ['src/api/auth-tokens.js', 'migrations/002_drop_auth.sql']
        }
      });
    }, /HIGH_MERGE_RISK_GATE/);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

