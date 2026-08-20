import test from 'node:test';
import assert from 'node:assert/strict';
import { groupTodoLines } from './sibling-checker-v2.mjs';

test('groups legacy kb-sync per-file entries into one active batch item', () => {
  const content = [
    '## Open',
    '- [ ] **kb-sync documentation drift remediation** — one',
    '- [ ] **kb-sync documentation drift remediation** — two',
    '- [ ] **unrelated work** — keep',
    '',
    '## Completed',
    ''
  ].join('\n');
  const result = groupTodoLines(content, {
    groupMarker: '<!-- todo-group: kb-sync-documentation-drift -->',
    line: '- [ ] **[P2] kb-sync documentation drift remediation (batch)** — 2 files.',
    legacy: /^- \[ \] \*\*kb-sync documentation drift remediation\*\*/
  });
  assert.equal((result.match(/todo-group: kb-sync-documentation-drift/g) || []).length, 1);
  assert.equal((result.match(/kb-sync documentation drift remediation/g) || []).length, 1);
  assert.match(result, /unrelated work/);
});

test('grouping is idempotent', () => {
  const options = {
    groupMarker: '<!-- todo-group: toolforge-health-warning:Manifest -->',
    line: '- [ ] **[P2] Toolforge health warning group: Manifest** — 2 skills.',
    legacy: /^- \[ \] \*\*\[P2\] Toolforge health warning: .*\/Manifest\*/
  };
  const once = groupTodoLines('## Open\n', options);
  const twice = groupTodoLines(once, options);
  assert.equal(twice, once);
});
