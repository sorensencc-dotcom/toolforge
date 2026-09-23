import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTaskText,
  getTaskHash,
  parseTodoItems,
  mergeTaskLists,
  renderTodoBlock,
  injectManagedRegion
} from '../../sync-tools/agent-todo-sync.cjs';

test('normalizeTaskText strips priority tags and spaces', () => {
  assert.equal(normalizeTaskText('  [P0]  Fix   authentication token  '), 'fix authentication token');
  assert.equal(normalizeTaskText('[p2] review pr diff'), 'review pr diff');
});

test('getTaskHash is deterministic', () => {
  const hash1 = getTaskHash('Fix authentication token');
  const hash2 = getTaskHash('  [P1] fix   authentication   token  ');
  assert.equal(hash1, hash2);
});

test('parseTodoItems extracts checkbox states and priority', () => {
  const md = `
# Backlog
- [ ] [P0] Security patch for OIDC
- [/] [P1] Ingest pipeline refactor
- [x] Deploy v1.2
`;
  const items = parseTodoItems(md, 'test.md');
  assert.equal(items.length, 3);
  assert.equal(items[0].priority, 'P0');
  assert.equal(items[0].completed, false);
  assert.equal(items[1].inProgress, true);
  assert.equal(items[2].completed, true);
});

test('mergeTaskLists prioritizes completed and highest priority', () => {
  const list1 = [
    { hash: 'abc', rawText: '[P2] Ship feature', completed: false, inProgress: true, priority: 'P2', sourcePath: 'A.md' }
  ];
  const list2 = [
    { hash: 'abc', rawText: '[P0] Ship feature', completed: true, inProgress: false, priority: 'P0', sourcePath: 'B.md' }
  ];
  const merged = mergeTaskLists([list1, list2]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].completed, true);
  assert.equal(merged[0].priority, 'P0');
});

test('injectManagedRegion replaces existing managed block cleanly', () => {
  const initial = `# Notes\n\nSome custom notes here.\n`;
  const block = renderTodoBlock([]);
  const injected = injectManagedRegion(initial, block);

  assert.match(injected, /<!-- MANAGED-REGION: AGENT-TODOS -->/);
  assert.match(injected, /Some custom notes here/);

  const updatedBlock = renderTodoBlock([{
    hash: '123',
    rawText: 'Test task',
    completed: false,
    inProgress: false,
    priority: 'P1'
  }]);

  const reinjected = injectManagedRegion(injected, updatedBlock);
  assert.equal((reinjected.match(/MANAGED-REGION: AGENT-TODOS/g) || []).length, 2);
  assert.match(reinjected, /Test task/);
});
