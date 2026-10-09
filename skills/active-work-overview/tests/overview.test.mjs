import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseWorktreePorcelain,
  parseTodos,
  formatReportMarkdown,
  collectTodos,
  collectWorktrees,
  collectOutboxReceipts,
  collectTelemetry
} from '../src/overview.mjs';

test('parseWorktreePorcelain parses git porcelain format accurately', () => {
  const fixture = `
worktree C:/dev/repo
HEAD 1234567890abcdef
branch refs/heads/main

worktree C:/dev/.worktrees/feature-a
HEAD fedcba0987654321
branch refs/heads/feat/feature-a

worktree C:/dev/.worktrees/bare-repo
bare
`;

  const result = parseWorktreePorcelain(fixture);
  assert.equal(result.length, 3);
  assert.equal(result[0].path, 'C:/dev/repo');
  assert.equal(result[0].branch, 'main');
  assert.equal(result[0].bare, false);

  assert.equal(result[1].path, 'C:/dev/.worktrees/feature-a');
  assert.equal(result[1].branch, 'feat/feature-a');
  assert.equal(result[1].bare, false);

  assert.equal(result[2].path, 'C:/dev/.worktrees/bare-repo');
  assert.equal(result[2].bare, true);
});

test('parseTodos parses markdown backlog items and priority tags', () => {
  const fixture = `
# Backlog

## Open

- [ ] **[P1] Critical Task** (created 2026-10-01) — Needs immediate investigation.
  - Subtask detail here.

- [ ] **[P2] Secondary Polish** — Minor cleanup.

## Completed

- [x] **[P1] Finished item**
`;

  const items = parseTodos(fixture);
  assert.equal(items.length, 2);
  assert.equal(items[0].priority, 'P1');
  assert.equal(items[0].title, 'Critical Task');
  assert.equal(items[0].meta, 'created 2026-10-01');
  assert.match(items[0].detail, /Needs immediate investigation/);
  assert.match(items[0].detail, /Subtask detail here/);

  assert.equal(items[1].priority, 'P2');
  assert.equal(items[1].title, 'Secondary Polish');
});

test('formatReportMarkdown outputs well-structured markdown tables', () => {
  const mockReport = {
    timestamp: '2026-10-08T18:00:00.000Z',
    workspaceRoot: 'C:\\dev',
    pullRequests: [
      {
        number: 39,
        title: 'feat: add room form',
        repo: 'sorensencc-dotcom/sigil',
        url: 'https://github.com/sorensencc-dotcom/sigil/pull/39',
        createdAt: '2026-10-08T17:00:00Z',
        updatedAt: '2026-10-08T18:00:00Z',
        state: 'open'
      }
    ],
    recentLandings: [],
    worktrees: [
      {
        path: 'C:/dev/sigil-repo',
        head: '1234567',
        branch: 'main',
        lastCommit: 'fix: something'
      }
    ],
    todos: [
      {
        priority: 'P1',
        title: 'Sample todo',
        meta: '',
        detail: 'Sample detail'
      }
    ],
    outboxReceipts: [],
    telemetry: {
      ironledger: { status: 'VALID', containerRunning: true, invariantsPassed: true },
      kbSync: { syncStatus: 'SUCCESS', fileCount: 8000, driftStatus: 'NO_DRIFT', stalePages: 0 },
      ciAlerts: null,
      daemon8080: { status: 'HEALTHY', consecutiveHeals: 0, thrashCooldown: false }
    }
  };

  const md = formatReportMarkdown(mockReport);
  assert.match(md, /# Ecosystem Active Work Overview/);
  assert.match(md, /sorensencc-dotcom\/sigil/);
  assert.match(md, /\[#39\]/);
  assert.match(md, /Sample todo/);
  assert.match(md, /IronLedger/);
  assert.match(md, /KB-Sync/);
});

test('live local collectors run without unhandled exceptions', () => {
  const todos = collectTodos('C:\\dev');
  assert.ok(Array.isArray(todos));

  const worktrees = collectWorktrees('C:\\dev');
  assert.ok(Array.isArray(worktrees));

  const receipts = collectOutboxReceipts('C:\\dev');
  assert.ok(Array.isArray(receipts));

  const telemetry = collectTelemetry('C:\\dev');
  assert.ok(telemetry);
  assert.ok(typeof telemetry === 'object');
});
