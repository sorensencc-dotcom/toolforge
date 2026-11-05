import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHealthReport, groupWarnings, renderTodoRow, closeTodoRow, groupsToClose } from '../src/index.mjs';

const REPORT = [
  '### beta — ⚠️ WARN', '',
  '| Check | Result | Details |', '|---|---|---|',
  '| AuditLog | ⚠️ WARN | No runtime history in audit log |',
  '| Manifest | ⚠️ WARN | No entry in manifest |',
  '| Runtime | ✅ PASS | Found: npm |', '',
  '### alpha — ⚠️ WARN', '',
  '| AuditLog | ⚠️ WARN | No runtime history in audit log |',
  '### gamma — ✅ GOOD', '',
  '| AuditLog | ✅ PASS | Runtime history exists |',
].join('\n');

test('parseHealthReport reads skills, status, and checks', () => {
  const p = parseHealthReport(REPORT);
  assert.equal(p.length, 3);
  assert.equal(p[0].skill, 'beta');
  assert.equal(p[0].checks.length, 3);
  assert.equal(p[2].status, 'GOOD');
});

test('groupWarnings groups non-PASS checks with stable ordering', () => {
  const g = groupWarnings(parseHealthReport(REPORT));
  assert.deepEqual(Object.keys(g), ['AuditLog', 'Manifest']);
  assert.deepEqual(g.AuditLog.map((x) => x.skill), ['alpha', 'beta']);
});

test('renderTodoRow matches the existing open and resolved formats', () => {
  const open = renderTodoRow({ group: 'DryRun', skills: ['a'], created: '2026-10-24' });
  assert.equal(open, '| ⏳ `[ ]` | **P2** | **[P2] Toolforge health warning group: DryRun** (created 2026-10-24) — 1 skill(s): a. Source: SKILLPACK-RUNTIME-HEALTH.md. <!-- todo-group: toolforge-health-warning:DryRun --> |');
  const done = renderTodoRow({ group: 'DryRun', skills: ['a'], created: '2026-10-24', resolved: '2026-10-25' });
  assert.match(done, /^\| ✅ `\[x\]` .*\(created 2026-10-24\) \(resolved 2026-10-25\) — 1 skill/);
});

test('closeTodoRow flips only the matching open row', () => {
  const md = [
    renderTodoRow({ group: 'AuditLog', skills: ['a', 'b'], created: '2026-10-01' }),
    renderTodoRow({ group: 'Manifest', skills: ['a'], created: '2026-10-01' }),
  ].join('\n');
  const r = closeTodoRow(md, 'AuditLog', '2026-10-24');
  assert.equal(r.changed, true);
  const [first, second] = r.md.split('\n');
  assert.equal(first, renderTodoRow({ group: 'AuditLog', skills: ['a', 'b'], created: '2026-10-01', resolved: '2026-10-24' }));
  assert.match(second, /⏳/);
});

test('closeTodoRow is idempotent and ignores unknown groups', () => {
  const done = renderTodoRow({ group: 'Runtime', skills: ['a'], created: 'D', resolved: 'E' });
  assert.equal(closeTodoRow(done, 'Runtime', 'F').changed, false);
  assert.equal(closeTodoRow(done, 'Nope', 'F').md, done);
});

test('groupsToClose keeps groups still warning in the fresh report', () => {
  assert.deepEqual(groupsToClose(['AuditLog', 'Manifest'], { AuditLog: [] }), ['Manifest']);
});
