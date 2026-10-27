import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  promoteBatch,
  formatConsolidatedPrBody,
  defaultLockRegistry,
  CardLockRegistry,
  ActionCard,
  GitHubClient,
  PrStagingBridge
} from '../../src/backend/pr-staging-bridge.ts';

export interface HermeticSandbox {
  sandboxDir: string;
  repos: {
    toolforge: string;
    sigil: string;
    'kb-sync': string;
  };
  pendingDir: string;
  cards: ActionCard[];
}

export async function withHermeticSandbox<T>(
  fn: (sandbox: HermeticSandbox) => Promise<T>
): Promise<T> {
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-triage-sandbox-'));
  const repos = {
    toolforge: path.join(sandboxDir, 'toolforge'),
    sigil: path.join(sandboxDir, 'sigil'),
    'kb-sync': path.join(sandboxDir, 'kb-sync')
  };

  for (const [name, repoPath] of Object.entries(repos)) {
    fs.mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', '-b', 'main'], { cwd: repoPath, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'TRM Test User'], { cwd: repoPath, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@toolforge.local'], { cwd: repoPath, stdio: 'pipe' });
    fs.writeFileSync(path.join(repoPath, 'README.md'), `# ${name}\n`, 'utf8');
    execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'pipe' });
  }

  const pendingDir = path.join(sandboxDir, '.harness', 'tasks', 'pending');
  fs.mkdirSync(pendingDir, { recursive: true });

  const mockCards: ActionCard[] = [
    {
      id: 'act-215-01',
      title: 'Toolforge Batch Triage Automation',
      intent: 'Automate multi-card triage promotion into consolidated PRs',
      target: 'toolforge',
      category: 'IMPLEMENT',
      direction: 'FEATURE',
      priority: 'P1',
      deliverables: [
        'Bridge script for batch staging',
        'Rollback handler on API failure'
      ]
    },
    {
      id: 'act-215-02',
      title: 'Sigil Rate Limiting Retry Adapter',
      intent: 'Stabilize Sigil ingress under API load spikes',
      target: 'sigil',
      category: 'IMPLEMENT',
      direction: 'REFACTOR',
      priority: 'P2',
      deliverables: [
        'Token bucket jitter logic',
        'Integration retry tests'
      ]
    },
    {
      id: 'act-215-03',
      title: 'KB Sync DAG Invariant Verifier',
      intent: 'Prevent cyclic dependencies in knowledge sync graphs',
      target: 'kb-sync',
      category: 'IMPLEMENT',
      direction: 'FIX',
      priority: 'P1',
      deliverables: [
        'Acyclic verification pass',
        'Topological sorting regression test'
      ]
    }
  ];

  for (const card of mockCards) {
    fs.writeFileSync(path.join(pendingDir, `${card.id}.json`), JSON.stringify(card, null, 2), 'utf8');
  }

  try {
    return await fn({ sandboxDir, repos, pendingDir, cards: mockCards });
  } finally {
    defaultLockRegistry.clear();
    try {
      fs.rmSync(sandboxDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Best effort temp cleanup on Windows
    }
  }
}

test('Test Case 1: Batch Promotion - creates unified branch batch/trm-20261020-triage and consolidated PR body containing all 3 cards', async () => {
  await withHermeticSandbox(async ({ repos, pendingDir, cards }) => {
    let capturedPrParams: any = null;
    const mockGh: GitHubClient = {
      async createPullRequest(params) {
        capturedPrParams = params;
        return {
          number: 215,
          html_url: 'https://github.com/sorensencc-dotcom/toolforge/pull/215'
        };
      }
    };

    const cardIds = cards.map(c => c.id);
    const result = await promoteBatch({
      cardIds,
      targetRepo: 'toolforge',
      repoPath: repos.toolforge,
      pendingDir,
      date: '20261020',
      githubClient: mockGh
    });

    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.branchName, 'batch/trm-20261020-triage');
    assert.equal(result.prNumber, 215);

    const branchList = execFileSync('git', ['branch', '--list', 'batch/trm-20261020-triage'], {
      cwd: repos.toolforge,
      encoding: 'utf8'
    });
    assert.match(branchList, /batch\/trm-20261020-triage/);

    for (const card of cards) {
      assert.ok(result.prBody.includes(card.id), `PR body should include ${card.id}`);
      assert.ok(result.prBody.includes(card.title!), `PR body should include title of ${card.id}`);
      assert.ok(result.prBody.includes(card.intent!), `PR body should include intent of ${card.id}`);
      for (const deliverable of card.deliverables as string[]) {
        assert.ok(result.prBody.includes(deliverable), `PR body should include deliverable: ${deliverable}`);
        assert.ok(result.prBody.includes(`- [ ] ${deliverable}`), `PR body should format checklist for ${deliverable}`);
      }
    }

    assert.equal(capturedPrParams.head, 'batch/trm-20261020-triage');
    assert.equal(capturedPrParams.body, result.prBody);
  });
});

test('Test Case 2: Concurrency Safety - simultaneous promotion of overlapping cards rejects second action with LOCK_HELD', async () => {
  await withHermeticSandbox(async ({ repos, pendingDir }) => {
    const slowGh: GitHubClient = {
      async createPullRequest() {
        await new Promise(r => setTimeout(r, 60));
        return { number: 101, html_url: 'https://github.com/mock/pr/101' };
      }
    };

    const action1 = promoteBatch({
      cardIds: ['act-215-01', 'act-215-02'],
      targetRepo: 'toolforge',
      repoPath: repos.toolforge,
      pendingDir,
      branchName: 'batch/trm-concurrency-1',
      githubClient: slowGh
    });

    const action2 = promoteBatch({
      cardIds: ['act-215-02', 'act-215-03'],
      targetRepo: 'toolforge',
      repoPath: repos.toolforge,
      pendingDir,
      branchName: 'batch/trm-concurrency-2',
      githubClient: slowGh
    });

    await assert.rejects(action2, (err: any) => {
      assert.ok(err.code === 'LOCK_HELD' || err.message.includes('LOCK_HELD'));
      return true;
    });

    const result1 = await action1;
    assert.equal(result1.status, 'SUCCESS');
  });
});

test('Test Case 3: Rollback Invariant - deletes branch and leaves cards unlocked in pending/ on GitHub API 500 error', async () => {
  await withHermeticSandbox(async ({ repos, pendingDir, cards }) => {
    const failingGh: GitHubClient = {
      async createPullRequest() {
        const err = new Error('GitHub API 500 Internal Server Error');
        (err as any).status = 500;
        throw err;
      }
    };

    const cardIds = cards.map(c => c.id);
    const branchName = 'batch/trm-rollback-verify';

    await assert.rejects(async () => {
      await promoteBatch({
        cardIds,
        targetRepo: 'toolforge',
        repoPath: repos.toolforge,
        pendingDir,
        branchName,
        githubClient: failingGh
      });
    }, /500/);

    const branchList = execFileSync('git', ['branch', '--list', branchName], {
      cwd: repos.toolforge,
      encoding: 'utf8'
    });
    assert.equal(branchList.trim(), '', 'Branch must be deleted from repository during rollback');

    for (const id of cardIds) {
      assert.equal(defaultLockRegistry.isLocked(id), false, `Card ${id} must remain unlocked`);
      assert.ok(fs.existsSync(path.join(pendingDir, `${id}.json`)), `Card file ${id}.json must remain intact in pending/`);
    }
  });
});

test('PrStagingBridge class wrapper works identically with custom registry', async () => {
  await withHermeticSandbox(async ({ repos, pendingDir, cards }) => {
    const customRegistry = new CardLockRegistry();
    const bridge = new PrStagingBridge({ pendingDir }, customRegistry);

    const mockGh: GitHubClient = {
      async createPullRequest() {
        return { number: 42, html_url: 'https://github.com/mock/pr/42' };
      }
    };

    const res = await bridge.promoteBatch({
      cardIds: ['act-215-01'],
      targetRepo: 'toolforge',
      repoPath: repos.toolforge,
      githubClient: mockGh
    });

    assert.equal(res.status, 'SUCCESS');
    assert.equal(customRegistry.isLocked('act-215-01'), false);
  });
});
